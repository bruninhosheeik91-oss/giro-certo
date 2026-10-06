package tech.domnex.girocerto;

import android.app.Activity;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.WindowManager;
import androidx.annotation.Nullable;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.nio.ByteBuffer;
import java.util.Locale;

public class RideScreenCaptureService extends Service {
    static final String ACTION_START = "tech.domnex.girocerto.START_SCREEN_CAPTURE";
    static final String ACTION_STOP = "tech.domnex.girocerto.STOP_SCREEN_CAPTURE";
    static final String EXTRA_RESULT_CODE = "resultCode";
    static final String EXTRA_RESULT_DATA = "resultData";
    private static final long OCR_INTERVAL_MS = 2500L;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private boolean ocrRunning;
    private long lastOcrAt;

    @Override
    public void onCreate() {
        super.onCreate();
        startForeground(
            AnalyzerControlNotification.NOTIFICATION_ID,
            AnalyzerControlNotification.build(this, true)
        );
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || ACTION_STOP.equals(intent.getAction())) {
            stopCapture();
            return START_NOT_STICKY;
        }
        if (!ACTION_START.equals(intent.getAction()) || mediaProjection != null) {
            return START_NOT_STICKY;
        }

        int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED);
        Intent resultData = intent.getParcelableExtra(EXTRA_RESULT_DATA);
        if (resultCode != Activity.RESULT_OK || resultData == null || !hasValidEntitlement()) {
            stopCapture();
            return START_NOT_STICKY;
        }

        MediaProjectionManager manager =
            (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        mediaProjection = manager.getMediaProjection(resultCode, resultData);
        if (mediaProjection == null) {
            stopCapture();
            return START_NOT_STICKY;
        }
        mediaProjection.registerCallback(new MediaProjection.Callback() {
            @Override public void onStop() {
                mediaProjection = null;
                mainHandler.post(() -> stopCapture());
            }
        }, mainHandler);
        createVirtualDisplay();
        getSharedPreferences(RideNotificationListenerService.PREFS, MODE_PRIVATE)
            .edit().putBoolean("analyzerEnabled", true).apply();
        AnalyzerControlNotification.refresh(this);
        return START_NOT_STICKY;
    }

    private void createVirtualDisplay() {
        WindowManager windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        DisplayMetrics metrics = new DisplayMetrics();
        windowManager.getDefaultDisplay().getRealMetrics(metrics);
        int width = metrics.widthPixels;
        int height = metrics.heightPixels;
        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2);
        imageReader.setOnImageAvailableListener(this::handleImage, mainHandler);
        virtualDisplay = mediaProjection.createVirtualDisplay(
            "GiroCertoRideAnalyzer",
            width,
            height,
            metrics.densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader.getSurface(),
            null,
            mainHandler
        );
    }

    private void handleImage(ImageReader reader) {
        Image image = reader.acquireLatestImage();
        if (image == null) return;
        long now = System.currentTimeMillis();
        if (ocrRunning || now - lastOcrAt < OCR_INTERVAL_MS || !isAnalyzerEnabled()) {
            image.close();
            return;
        }
        lastOcrAt = now;
        Bitmap bitmap;
        try {
            bitmap = bitmapFromImage(image);
        } finally {
            image.close();
        }
        if (bitmap == null) return;

        ocrRunning = true;
        recognizer.process(InputImage.fromBitmap(bitmap, 0))
            .addOnSuccessListener(text -> analyzeRecognizedText(text.getText()))
            .addOnFailureListener(error -> RideNotificationListenerService.recordDiagnostic(
                getSharedPreferences(RideNotificationListenerService.PREFS, MODE_PRIVATE),
                false,
                "screen_capture",
                "Não foi possível processar a tela da oferta.",
                ""
            ))
            .addOnCompleteListener(task -> {
                bitmap.recycle();
                ocrRunning = false;
            });
    }

    private Bitmap bitmapFromImage(Image image) {
        Image.Plane[] planes = image.getPlanes();
        if (planes.length == 0) return null;
        Image.Plane plane = planes[0];
        ByteBuffer buffer = plane.getBuffer();
        int pixelStride = plane.getPixelStride();
        int rowStride = plane.getRowStride();
        int rowPadding = rowStride - pixelStride * image.getWidth();
        Bitmap padded = Bitmap.createBitmap(
            image.getWidth() + rowPadding / pixelStride,
            image.getHeight(),
            Bitmap.Config.ARGB_8888
        );
        padded.copyPixelsFromBuffer(buffer);
        Bitmap cropped = Bitmap.createBitmap(padded, 0, 0, image.getWidth(), image.getHeight());
        if (cropped != padded) padded.recycle();
        return cropped;
    }

    private void analyzeRecognizedText(String content) {
        String searchable = content.toLowerCase(Locale.ROOT);
        SharedPreferences prefs = getSharedPreferences(RideNotificationListenerService.PREFS, MODE_PRIVATE);
        if (!searchable.contains("r$") || !searchable.contains("km")
            || (!searchable.contains("aceitar") && !searchable.contains("corrida")
                && !searchable.contains("entrega"))) {
            return;
        }
        String fingerprint = Integer.toHexString(content.hashCode());
        long now = System.currentTimeMillis();
        if (fingerprint.equals(prefs.getString("lastScreenCaptureFingerprint", ""))
            && now - prefs.getLong("lastScreenCaptureFingerprintAt", 0L) < 60000L) return;
        prefs.edit()
            .putString("lastScreenCaptureFingerprint", fingerprint)
            .putLong("lastScreenCaptureFingerprintAt", now)
            .apply();
        RideNotificationListenerService.analyzeOfferContent(this, "99", content, "screen_capture");
    }

    private boolean isAnalyzerEnabled() {
        SharedPreferences prefs = getSharedPreferences(RideNotificationListenerService.PREFS, MODE_PRIVATE);
        return prefs.getBoolean("analyzerEnabled", false) && hasValidEntitlement();
    }

    private boolean hasValidEntitlement() {
        SharedPreferences prefs = getSharedPreferences(RideNotificationListenerService.PREFS, MODE_PRIVATE);
        if (!prefs.getBoolean("proEntitlement", false)) return false;
        long expiresAt = prefs.getLong("proEntitlementExpiresAt", 0L);
        return expiresAt == 0L || expiresAt > System.currentTimeMillis();
    }

    private void stopCapture() {
        getSharedPreferences(RideNotificationListenerService.PREFS, MODE_PRIVATE)
            .edit().putBoolean("analyzerEnabled", false).apply();
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        if (imageReader != null) {
            imageReader.close();
            imageReader = null;
        }
        if (mediaProjection != null) {
            MediaProjection projection = mediaProjection;
            mediaProjection = null;
            projection.stop();
        }
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
        AnalyzerControlNotification.refresh(this);
    }

    @Override
    public void onDestroy() {
        getSharedPreferences(RideNotificationListenerService.PREFS, MODE_PRIVATE)
            .edit().putBoolean("analyzerEnabled", false).apply();
        if (virtualDisplay != null) virtualDisplay.release();
        if (imageReader != null) imageReader.close();
        if (mediaProjection != null) {
            MediaProjection projection = mediaProjection;
            mediaProjection = null;
            projection.stop();
        }
        recognizer.close();
        AnalyzerControlNotification.refresh(this);
        super.onDestroy();
    }

    @Nullable
    @Override public IBinder onBind(Intent intent) { return null; }
}
