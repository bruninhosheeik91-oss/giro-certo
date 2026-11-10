package tech.domnex.girocerto;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/**
 * Pânico silencioso: abre o alerta no servidor (que avisa os contatos no Telegram) e envia a
 * posição a cada 30 s até o motorista encerrar. Funciona com o app fechado: usa a credencial
 * do aparelho criada na ativação. Nada aparece na tela além da notificação discreta exigida
 * pelo Android ("Proteção ativa").
 */
public class PanicService extends Service {
    static final String PREFS = "giro_certo_panic";
    static final String ACTION_START = "tech.domnex.girocerto.panic.START";
    static final String ACTION_END = "tech.domnex.girocerto.panic.END";
    static final String KEY_ENDPOINT = "endpoint";
    static final String KEY_ANON = "anonKey";
    static final String KEY_DEVICE = "deviceId";
    static final String KEY_SECRET = "secret";
    static final String KEY_ACTIVE = "active";
    static final String KEY_ALERT_ID = "alertId";
    static final String KEY_STARTED_AT = "startedAt";
    static final String KEY_STATUS = "status";

    private static final String CHANNEL_ID = "giro_certo_protecao";
    private static final int NOTIFICATION_ID = 9052;
    private static final long UPDATE_MS = 30000L;
    private static final long FIRST_FIX_TIMEOUT_MS = 12000L;
    private static final long RETRY_MS = 15000L;

    private HandlerThread thread;
    private Handler worker;
    private LocationManager locationManager;
    private Location lastLocation;
    private boolean startSent;
    private boolean ending;

    private final LocationListener listener = location -> lastLocation = location;

    static boolean isConfigured(Context context) {
        SharedPreferences p = context.getSharedPreferences(PREFS, MODE_PRIVATE);
        return !p.getString(KEY_SECRET, "").isEmpty() && !p.getString(KEY_ENDPOINT, "").isEmpty();
    }

    static boolean isActive(Context context) {
        return context.getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(KEY_ACTIVE, false);
    }

    /** Disparo completo: câmera silenciosa + alerta. Deve ser chamado com uma Activity visível. */
    static void trigger(Context context) {
        if (SecurityCameraService.hasCameraPermission(context) && !SecurityCameraService.isRecording(context)) {
            SecurityCameraService.start(context, true);
        }
        if (!isActive(context)) {
            ContextCompat.startForegroundService(context, new Intent(context, PanicService.class).setAction(ACTION_START));
        }
    }

    static void end(Context context) {
        context.startService(new Intent(context, PanicService.class).setAction(ACTION_END));
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        ensureWorker();
        if (ACTION_END.equals(action)) {
            if (!prefs().getBoolean(KEY_ACTIVE, false) && worker == null) { stopSelf(); return START_NOT_STICKY; }
            ending = true;
            worker.removeCallbacksAndMessages(null);
            worker.post(this::sendEnd);
            return START_NOT_STICKY;
        }
        int type = hasLocationPermission() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
            ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0;
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification(), type);
        } catch (RuntimeException error) {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification(), 0);
        }
        if (!prefs().getBoolean(KEY_ACTIVE, false)) {
            prefs().edit().putBoolean(KEY_ACTIVE, true).putLong(KEY_STARTED_AT, System.currentTimeMillis())
                .remove(KEY_ALERT_ID).putString(KEY_STATUS, "Acionado, buscando GPS…").apply();
            startSent = false;
            ending = false;
            startLocation();
            worker.postDelayed(this::sendStart, FIRST_FIX_TIMEOUT_MS);
            worker.postDelayed(this::sendStartIfFix, 1500L);
        }
        return START_REDELIVER_INTENT;
    }

    private void ensureWorker() {
        if (thread != null) return;
        thread = new HandlerThread("giro-certo-panic");
        thread.start();
        worker = new Handler(thread.getLooper());
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @SuppressLint("MissingPermission")
    private void startLocation() {
        if (!hasLocationPermission()) return;
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        for (String provider : new String[] { LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER }) {
            try {
                if (!locationManager.isProviderEnabled(provider)) continue;
                Location known = locationManager.getLastKnownLocation(provider);
                if (known != null && (lastLocation == null || known.getTime() > lastLocation.getTime())) lastLocation = known;
                locationManager.requestLocationUpdates(provider, 10000L, 0f, listener, Looper.getMainLooper());
            } catch (RuntimeException ignored) { }
        }
    }

    private boolean freshFix() {
        return lastLocation != null && System.currentTimeMillis() - lastLocation.getTime() < 60000L;
    }

    private void sendStartIfFix() {
        if (startSent || ending) return;
        if (freshFix()) sendStart(); else worker.postDelayed(this::sendStartIfFix, 1500L);
    }

    private void sendStart() {
        if (startSent || ending) return;
        startSent = true;
        worker.removeCallbacksAndMessages(null);
        try {
            JSONObject body = new JSONObject().put("action", "start");
            putLocation(body);
            JSONObject res = post(body);
            String alertId = res.optString("alertId", "");
            if (alertId.isEmpty()) throw new IllegalStateException(res.optString("error", "sem resposta"));
            int sent = res.optInt("sent", 0);
            int total = res.optInt("total", 0);
            prefs().edit().putString(KEY_ALERT_ID, alertId)
                .putString(KEY_STATUS, res.optBoolean("reused") ? "Alerta já ativo" : "Avisados " + sent + " de " + total + " contatos")
                .apply();
            worker.postDelayed(this::sendUpdate, UPDATE_MS);
        } catch (Exception error) {
            startSent = false;
            prefs().edit().putString(KEY_STATUS, "Sem conexão, tentando de novo… (" + error.getMessage() + ")").apply();
            worker.postDelayed(this::sendStart, RETRY_MS);
        }
    }

    private void sendUpdate() {
        if (ending) return;
        String alertId = prefs().getString(KEY_ALERT_ID, "");
        if (!alertId.isEmpty() && freshFix()) {
            try {
                JSONObject body = new JSONObject().put("action", "update").put("alertId", alertId);
                putLocation(body);
                JSONObject res = post(body);
                if (res.optBoolean("ended")) { finish(); return; }
            } catch (Exception ignored) { }
        }
        worker.postDelayed(this::sendUpdate, UPDATE_MS);
    }

    private void sendEnd() {
        String alertId = prefs().getString(KEY_ALERT_ID, "");
        if (!alertId.isEmpty()) {
            try { post(new JSONObject().put("action", "end").put("alertId", alertId)); } catch (Exception ignored) { }
        }
        finish();
    }

    private void finish() {
        prefs().edit().putBoolean(KEY_ACTIVE, false).putString(KEY_STATUS, "Encerrado").apply();
        new Handler(Looper.getMainLooper()).post(() -> {
            if (locationManager != null) {
                try { locationManager.removeUpdates(listener); } catch (RuntimeException ignored) { }
            }
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
            stopSelf();
        });
    }

    private void putLocation(JSONObject body) throws Exception {
        if (lastLocation == null) return;
        body.put("lat", lastLocation.getLatitude()).put("lng", lastLocation.getLongitude());
        if (lastLocation.hasAccuracy()) body.put("accuracy", (double) lastLocation.getAccuracy());
    }

    private JSONObject post(JSONObject body) throws Exception {
        SharedPreferences p = prefs();
        HttpURLConnection conn = (HttpURLConnection) new URL(p.getString(KEY_ENDPOINT, "")).openConnection();
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(20000);
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("apikey", p.getString(KEY_ANON, ""));
        conn.setRequestProperty("x-panic-device", p.getString(KEY_DEVICE, ""));
        conn.setRequestProperty("x-panic-secret", p.getString(KEY_SECRET, ""));
        try (OutputStream out = conn.getOutputStream()) {
            out.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }
        int code = conn.getResponseCode();
        InputStream in = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        if (in != null) {
            byte[] chunk = new byte[4096];
            int n;
            while ((n = in.read(chunk)) > 0) buffer.write(chunk, 0, n);
            in.close();
        }
        conn.disconnect();
        String text = buffer.toString("UTF-8");
        JSONObject res = text.isEmpty() ? new JSONObject() : new JSONObject(text);
        if (code >= 400 && !res.has("error")) res.put("error", "HTTP " + code);
        return res;
    }

    private Notification notification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Proteção do motorista", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            channel.setSound(null, null);
            manager.createNotificationChannel(channel);
        }
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Giro Certo")
            .setContentText("Proteção ativa")
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .build();
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    @Override
    public void onDestroy() {
        if (thread != null) thread.quitSafely();
        super.onDestroy();
    }
}
