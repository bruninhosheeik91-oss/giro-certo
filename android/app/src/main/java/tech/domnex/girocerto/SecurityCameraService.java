package tech.domnex.girocerto;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import androidx.annotation.Nullable;
import androidx.camera.core.CameraSelector;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.video.FileOutputOptions;
import androidx.camera.video.MediaStoreOutputOptions;
import androidx.camera.video.PendingRecording;
import androidx.camera.video.Quality;
import androidx.camera.video.QualitySelector;
import androidx.camera.video.FallbackStrategy;
import androidx.camera.video.Recorder;
import androidx.camera.video.Recording;
import androidx.camera.video.VideoCapture;
import androidx.camera.video.VideoRecordEvent;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.LifecycleService;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Câmera de segurança do motorista.
 *
 * Grava vídeo (e áudio, se permitido) sem pré-visualização na tela. Por regra do Android,
 * enquanto grava existe uma notificação do serviço e o indicador verde de câmera do sistema
 * — o app não esconde isso. Os vídeos vão para a galeria, em Filmes/GiroCerto, em trechos
 * de até 30 minutos (um novo trecho começa sozinho enquanto a gravação estiver ligada).
 */
public class SecurityCameraService extends LifecycleService {
    static final String ACTION_START = "tech.domnex.girocerto.camera.START";
    static final String ACTION_STOP = "tech.domnex.girocerto.camera.STOP";
    static final String PREFS = "giro_certo_security_camera";
    static final String KEY_RECORDING = "recording";
    static final String KEY_STARTED_AT = "startedAt";
    static final String KEY_LENS = "lens";
    static final String KEY_AUDIO = "audio";
    static final String KEY_LAST_NAME = "lastVideoName";
    static final String KEY_LAST_AT = "lastVideoAt";
    static final String KEY_ERROR = "lastError";

    private static final String CHANNEL_ID = "giro_certo_protecao";
    private static final int NOTIFICATION_ID = 9051;
    private static final long SEGMENT_MS = 30 * 60 * 1000L;

    private Recording recording;
    private VideoCapture<Recorder> videoCapture;
    private boolean stopRequested;
    private boolean silent;

    static boolean hasCameraPermission(Context context) {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean isRecording(Context context) {
        return context.getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(KEY_RECORDING, false);
    }

    static void start(Context context) {
        start(context, false);
    }

    /** silent = true: sem vibração (pânico com passageiro por perto). */
    static void start(Context context, boolean silent) {
        Intent intent = new Intent(context, SecurityCameraService.class).setAction(ACTION_START).putExtra("silent", silent);
        ContextCompat.startForegroundService(context, intent);
    }

    static void stop(Context context) {
        Intent intent = new Intent(context, SecurityCameraService.class).setAction(ACTION_STOP);
        context.startService(intent);
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        super.onStartCommand(intent, flags, startId);
        String action = intent == null ? ACTION_STOP : intent.getAction();
        if (ACTION_START.equals(action)) {
            if (!hasCameraPermission(this)) {
                prefs().edit().putString(KEY_ERROR, "Sem permissão de câmera").putBoolean(KEY_RECORDING, false).apply();
                stopSelf();
                return START_NOT_STICKY;
            }
            int types = ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
            if (audioAllowed()) types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
            try {
                ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(),
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? types : 0);
            } catch (RuntimeException error) {
                prefs().edit().putString(KEY_ERROR, "Android bloqueou a câmera em segundo plano: abra o Giro Certo e tente de novo")
                    .putBoolean(KEY_RECORDING, false).apply();
                stopSelf();
                return START_NOT_STICKY;
            }
            if (recording == null) {
                silent = intent.getBooleanExtra("silent", false);
                stopRequested = false;
                prefs().edit().putBoolean(KEY_RECORDING, true).putLong(KEY_STARTED_AT, System.currentTimeMillis())
                    .remove(KEY_ERROR).apply();
                vibrate(1);
                bindAndRecord();
            }
        } else {
            stopRequested = true;
            if (recording != null) {
                recording.stop();
            } else {
                finishService();
            }
        }
        return START_NOT_STICKY;
    }

    private void bindAndRecord() {
        ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(this);
        future.addListener(() -> {
            try {
                ProcessCameraProvider provider = future.get();
                Recorder recorder = new Recorder.Builder()
                    .setQualitySelector(QualitySelector.from(Quality.HD,
                        FallbackStrategy.lowerQualityOrHigherThan(Quality.SD)))
                    .build();
                videoCapture = VideoCapture.withOutput(recorder);
                CameraSelector selector = "back".equals(prefs().getString(KEY_LENS, "front"))
                    ? CameraSelector.DEFAULT_BACK_CAMERA : CameraSelector.DEFAULT_FRONT_CAMERA;
                if (!provider.hasCamera(selector)) selector = CameraSelector.DEFAULT_BACK_CAMERA;
                provider.unbindAll();
                provider.bindToLifecycle(this, selector, videoCapture);
                startSegment();
            } catch (Exception error) {
                fail("Não foi possível abrir a câmera: " + error.getMessage());
            }
        }, ContextCompat.getMainExecutor(this));
    }

    @SuppressLint("MissingPermission")
    private void startSegment() {
        String name = "GiroCerto_" + new SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.US).format(new Date());
        PendingRecording pending;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "video/mp4");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/GiroCerto");
            MediaStoreOutputOptions options = new MediaStoreOutputOptions.Builder(
                getContentResolver(), MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
                .setContentValues(values)
                .setDurationLimitMillis(SEGMENT_MS)
                .build();
            pending = videoCapture.getOutput().prepareRecording(this, options);
        } else {
            File dir = new File(getExternalFilesDir(Environment.DIRECTORY_MOVIES), "GiroCerto");
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
            FileOutputOptions options = new FileOutputOptions.Builder(new File(dir, name + ".mp4"))
                .setDurationLimitMillis(SEGMENT_MS)
                .build();
            pending = videoCapture.getOutput().prepareRecording(this, options);
        }
        if (audioAllowed()) pending = pending.withAudioEnabled();
        final String videoName = name;
        recording = pending.start(ContextCompat.getMainExecutor(this), event -> {
            if (!(event instanceof VideoRecordEvent.Finalize)) return;
            VideoRecordEvent.Finalize done = (VideoRecordEvent.Finalize) event;
            recording = null;
            int error = done.getError();
            boolean limit = error == VideoRecordEvent.Finalize.ERROR_DURATION_LIMIT_REACHED;
            if (error == VideoRecordEvent.Finalize.ERROR_NONE || limit) {
                prefs().edit().putString(KEY_LAST_NAME, videoName).putLong(KEY_LAST_AT, System.currentTimeMillis()).apply();
            } else {
                prefs().edit().putString(KEY_ERROR, "Erro ao salvar o vídeo (código " + error + ")").apply();
            }
            if (limit && !stopRequested) {
                startSegment();
            } else {
                finishService();
            }
        });
    }

    private void fail(String message) {
        prefs().edit().putString(KEY_ERROR, message).apply();
        finishService();
    }

    private void finishService() {
        prefs().edit().putBoolean(KEY_RECORDING, false).apply();
        vibrate(2);
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private boolean audioAllowed() {
        return prefs().getBoolean(KEY_AUDIO, true)
            && ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private Notification buildNotification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Proteção do motorista", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            channel.setSound(null, null);
            manager.createNotificationChannel(channel);
        }
        PendingIntent stopIntent = PendingIntent.getService(this, 1,
            new Intent(this, SecurityCameraService.class).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Giro Certo")
            .setContentText("Proteção ativa")
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .addAction(0, "Parar", stopIntent)
            .build();
    }

    @SuppressWarnings("deprecation")
    private void vibrate(int pulses) {
        if (silent) return;
        Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        long[] pattern = pulses == 1 ? new long[] { 0, 60 } : new long[] { 0, 60, 120, 60 };
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
        } else {
            vibrator.vibrate(pattern, -1);
        }
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    @Override
    public void onDestroy() {
        if (recording != null) {
            stopRequested = true;
            recording.stop();
            recording = null;
        }
        prefs().edit().putBoolean(KEY_RECORDING, false).apply();
        super.onDestroy();
    }
}
