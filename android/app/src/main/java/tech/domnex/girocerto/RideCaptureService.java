package tech.domnex.girocerto;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.util.DisplayMetrics;
import android.view.WindowManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.IntentCompat;
import com.google.android.gms.tasks.Task;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.nio.ByteBuffer;

/**
 * Captura de tela por MediaProjection com OCR 100% local (ML Kit on-device).
 *
 * Regras do protótipo:
 * - Exige o consentimento oficial do Android a cada sessão.
 * - Em Android 14+ o usuário escolhe a região pelo diálogo do sistema (app único ou tela
 *   inteira). O app NÃO recebe a identidade da janela escolhida: não há API para saber qual
 *   app foi compartilhado, então a seleção "Uber/99" do frontend é apenas uma intenção do
 *   usuário, não uma prova.
 * - A detecção de tela inteira é uma ESTIMATIVA (best-effort), não uma garantia de
 *   isolamento. Usamos {@code onCapturedContentResize} apenas para sinalizar o usuário;
 *   não bloqueamos a sessão automaticamente, pois apps em tela cheia (Uber/99) podem reportar
 *   bounds iguais aos do display e seriam recusados por engano.
 * - Nenhuma imagem é salva ou enviada; os frames vivem apenas em memória e são
 *   descartados logo após o OCR.
 * - Encerra quando solicitado ou quando o Android encerra a sessão. Nunca reinicia sozinho.
 * - Ao encerrar, libera MediaProjection/VirtualDisplay/ImageReader, cancela o OCR em
 *   andamento, descarta o bitmap pendente e finaliza a thread de captura.
 */
public class RideCaptureService extends Service {
    static final String ACTION_START = "tech.domnex.girocerto.capture.START";
    static final String ACTION_STOP = "tech.domnex.girocerto.capture.STOP";
    static final String EXTRA_RESULT_CODE = "resultCode";
    static final String EXTRA_RESULT_DATA = "resultData";
    static final String EXTRA_APP_NAME = "appName";
    static final String EXTRA_PACKAGE = "packageName";

    static final String KEY_ACTIVE = "captureActive";
    static final String KEY_APP_NAME = "captureAppName";
    static final String KEY_PACKAGE = "capturePackage";
    static final String KEY_FULL_SCREEN = "captureFullScreen";
    static final String KEY_LAST_RESULT = "captureLastResult";
    static final String KEY_STOP_REASON = "captureStopReason";

    private static final String CHANNEL_ID = "giro_certo_copiloto";
    private static final int NOTIFICATION_ID = 4212;
    private static final long OCR_INTERVAL_MS = 1200L;

    private final Object stateLock = new Object();
    private boolean released;
    private Task<Text> ocrTask;
    private Bitmap ocrBitmap;
    private HandlerThread captureThread;
    private Handler captureHandler;
    private MediaProjection projection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private TextRecognizer recognizer;
    private long lastOcrAt;
    private boolean ocrInFlight;
    private int captureWidth;
    private int captureHeight;
    private int displayWidth;
    private int displayHeight;

    private final MediaProjection.Callback projectionCallback = new MediaProjection.Callback() {
        @Override
        public void onCapturedContentResize(int width, int height) {
            handleCapturedContentResize(width, height);
        }

        @Override
        public void onStop() {
            stopBySystem();
        }
    };

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            prefs().edit().putString(KEY_STOP_REASON, "Captura encerrada.").apply();
            release(true);
            stopForegroundCompat();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0);
        Intent resultData = IntentCompat.getParcelableExtra(intent, EXTRA_RESULT_DATA, Intent.class);
        String appName = intent.getStringExtra(EXTRA_APP_NAME);
        String packageName = intent.getStringExtra(EXTRA_PACKAGE);
        if (resultData == null) {
            release(false);
            return START_NOT_STICKY;
        }

        released = false;
        prefs().edit()
            .putBoolean(KEY_ACTIVE, true)
            .putBoolean(KEY_FULL_SCREEN, false)
            .putString(KEY_APP_NAME, appName == null ? "" : appName)
            .putString(KEY_PACKAGE, packageName == null ? "" : packageName)
            .remove(KEY_STOP_REASON)
            .apply();

        startForegroundCompat(appName == null ? "" : appName);
        startProjection(resultCode, resultData);
        return START_NOT_STICKY;
    }

    private void startProjection(int resultCode, Intent resultData) {
        captureThread = new HandlerThread("giro-certo-capture");
        captureThread.start();
        captureHandler = new Handler(captureThread.getLooper());
        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);

        MediaProjectionManager manager =
            (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        projection = manager.getMediaProjection(resultCode, resultData);
        if (projection == null) {
            fail("Não foi possível iniciar a captura.");
            return;
        }
        projection.registerCallback(projectionCallback, captureHandler);

        readDisplayBounds();
        captureWidth = Math.max(1, Math.min(displayWidth, 1080));
        captureHeight = Math.max(1, Math.round((float) captureWidth * displayHeight / displayWidth));

        imageReader = ImageReader.newInstance(
            captureWidth, captureHeight, PixelFormat.RGBA_8888, 2);
        virtualDisplay = projection.createVirtualDisplay(
            "giro-certo-capture",
            captureWidth,
            captureHeight,
            getResources().getDisplayMetrics().densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader.getSurface(),
            null,
            captureHandler);
        imageReader.setOnImageAvailableListener(this::onFrame, captureHandler);
    }

    private void readDisplayBounds() {
        WindowManager windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Rect bounds = windowManager.getMaximumWindowMetrics().getBounds();
            displayWidth = bounds.width();
            displayHeight = bounds.height();
            return;
        }
        DisplayMetrics metrics = new DisplayMetrics();
        windowManager.getDefaultDisplay().getRealMetrics(metrics);
        displayWidth = metrics.widthPixels;
        displayHeight = metrics.heightPixels;
    }

    private void onFrame(ImageReader reader) {
        Image image = reader.acquireLatestImage();
        if (image == null) return;

        long now = System.currentTimeMillis();
        synchronized (stateLock) {
            if (released || ocrInFlight || now - lastOcrAt < OCR_INTERVAL_MS) {
                image.close();
                return;
            }
            Bitmap frame;
            try {
                frame = toBitmap(image);
            } catch (RuntimeException error) {
                frame = null;
            } finally {
                image.close();
            }
            if (frame == null) return;

            ocrInFlight = true;
            ocrBitmap = frame;
            lastOcrAt = now;

            TextRecognizer localRecognizer = recognizer;
            if (localRecognizer == null) {
                finishOcr(frame, null);
                return;
            }
            final Bitmap bitmap = frame;
            ocrTask = localRecognizer
                .process(InputImage.fromBitmap(bitmap, 0))
                .addOnSuccessListener(text -> finishOcr(bitmap, text))
                .addOnFailureListener(error -> finishOcr(bitmap, null))
                .addOnCanceledListener(() -> finishOcr(bitmap, null));
        }
    }

    private void finishOcr(Bitmap bitmap, Text text) {
        synchronized (stateLock) {
            if (bitmap != null && !bitmap.isRecycled()) bitmap.recycle();
            if (ocrBitmap == bitmap) ocrBitmap = null;
            ocrInFlight = false;
            ocrTask = null;
            if (released) return;
        }
        if (text != null) handleText(text);
    }

    private Bitmap toBitmap(Image image) {
        Image.Plane plane = image.getPlanes()[0];
        ByteBuffer buffer = plane.getBuffer();
        int pixelStride = plane.getPixelStride();
        int rowStride = plane.getRowStride();
        int padding = rowStride - pixelStride * captureWidth;
        Bitmap padded = Bitmap.createBitmap(
            captureWidth + padding / pixelStride, captureHeight, Bitmap.Config.ARGB_8888);
        padded.copyPixelsFromBuffer(buffer);
        if (padding == 0) return padded;
        Bitmap cropped = Bitmap.createBitmap(padded, 0, 0, captureWidth, captureHeight);
        padded.recycle();
        return cropped;
    }

    private void handleText(Text text) {
        RideOfferTextExtractor.Result extracted = RideOfferTextExtractor.extract(text.getText());
        SharedPreferences prefs = prefs();
        RideCapturePayload payload = new RideCapturePayload();
        payload.appName = prefs.getString(KEY_APP_NAME, "");
        payload.packageName = prefs.getString(KEY_PACKAGE, "");
        payload.rawText = text.getText();
        payload.fareOffered = extracted.fareOffered;
        payload.distanceToPickupKm = extracted.distanceToPickupKm;
        payload.tripDistanceKm = extracted.tripDistanceKm;
        payload.pickupMinutes = extracted.pickupMinutes;
        payload.tripMinutes = extracted.tripMinutes;
        payload.complete = extracted.complete;
        payload.incompleteReason = extracted.incompleteReason;
        payload.capturedAt = System.currentTimeMillis();
        payload.fullScreen = prefs.getBoolean(KEY_FULL_SCREEN, false);

        prefs.edit().putString(KEY_LAST_RESULT, payload.toJsObject().toString()).apply();
        RideCaptureBus.emitResult(payload);
    }

    /**
     * Estimativa best-effort de tela inteira. Compara os bounds da região capturada com os
     * bounds máximos do display. Isto NÃO confirma qual janela o usuário escolheu: não existe
     * API para identificar o app compartilhado, e um app em tela cheia pode reportar bounds
     * iguais. Por isso apenas marcamos o estado para o frontend avisar o usuário — não
     * encerramos a sessão nem afirmamos isolamento.
     */
    private void handleCapturedContentResize(int width, int height) {
        if (width <= 0 || height <= 0) return;
        boolean likelyFullScreen = Math.abs(width - displayWidth) <= 4
            && Math.abs(height - displayHeight) <= 4;
        if (!likelyFullScreen) return;
        prefs().edit().putBoolean(KEY_FULL_SCREEN, true).apply();
    }

    private void stopBySystem() {
        prefs().edit()
            .putString(KEY_STOP_REASON, "A captura foi encerrada pelo Android.")
            .apply();
        RideCaptureBus.emitStopped("A captura foi encerrada pelo Android.");
        release(false);
        stopForegroundCompat();
        stopSelf();
    }

    private void fail(String reason) {
        prefs().edit().putString(KEY_STOP_REASON, reason).apply();
        RideCaptureBus.emitStopped(reason);
        release(true);
        stopForegroundCompat();
        stopSelf();
    }

    private void release(boolean stopProjection) {
        ImageReader localReader;
        VirtualDisplay localDisplay;
        MediaProjection localProjection;
        TextRecognizer localRecognizer;
        HandlerThread localThread;
        boolean taskInFlight;
        Bitmap localBitmap;
        synchronized (stateLock) {
            released = true;
            ocrInFlight = false;
            taskInFlight = ocrTask != null;
            ocrTask = null;
            localBitmap = ocrBitmap;
            ocrBitmap = null;
            localReader = imageReader;
            imageReader = null;
            localDisplay = virtualDisplay;
            virtualDisplay = null;
            localProjection = projection;
            projection = null;
            localRecognizer = recognizer;
            recognizer = null;
            localThread = captureThread;
            captureThread = null;
            captureHandler = null;
        }
        // O Task do GMS não expõe cancel(); fechar o recognizer cancela o OCR em andamento
        // e o listener de conclusão/cancelamento recicla o bitmap pendente em finishOcr.
        if (!taskInFlight && localBitmap != null && !localBitmap.isRecycled()) localBitmap.recycle();
        if (localReader != null) {
            localReader.setOnImageAvailableListener(null, null);
            localReader.close();
        }
        if (localDisplay != null) localDisplay.release();
        if (localProjection != null) {
            localProjection.unregisterCallback(projectionCallback);
            if (stopProjection) localProjection.stop();
        }
        if (localRecognizer != null) localRecognizer.close();
        if (localThread != null) localThread.quitSafely();
        prefs().edit().putBoolean(KEY_ACTIVE, false).apply();
    }

    private void startForegroundCompat(String appName) {
        createChannel();
        Notification notification = buildNotification(appName);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(
            CHANNEL_ID, "Copiloto (captura local)", NotificationManager.IMPORTANCE_LOW));
    }

    private Notification buildNotification(String appName) {
        Intent stopIntent = new Intent(this, RideCaptureService.class).setAction(ACTION_STOP);
        PendingIntent stopAction = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String target = appName == null || appName.isEmpty() ? "o app escolhido" : appName;
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Copiloto Giro Certo")
            .setContentText("Lendo a tela de " + target + " localmente. Toque em Parar para encerrar.")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(0, "Parar", stopAction)
            .build();
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(RideOfferPlugin.PREFS, Context.MODE_PRIVATE);
    }

    @Override
    public void onDestroy() {
        release(false);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
