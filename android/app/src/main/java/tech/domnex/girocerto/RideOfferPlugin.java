package tech.domnex.girocerto;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.projection.MediaProjectionConfig;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import androidx.core.app.NotificationCompat;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Ponte nativa do Copiloto Giro Certo.
 *
 * Ponte nativa do Copiloto Giro Certo. A leitura das ofertas é feita pelo
 * RideAccessibilityService (restrito à Uber, 99 e inDrive), pensado para ficar ligado só
 * durante a jornada. Não há NotificationListener nem permissão de sobreposição; a captura
 * por MediaProjection fica desativada.
 */
@CapacitorPlugin(name = "RideOffer")
public class RideOfferPlugin extends Plugin {
    static final String PREFS = "giro_certo_ride_offers";
    static final String ANALYZER_UNAVAILABLE = "Analisador automático temporariamente indisponível.";
    private static final boolean CAPTURE_ENABLED = false;
    private static final String CAPTURE_UNSUPPORTED = CAPTURE_ENABLED
        ? "Recurso disponível apenas no Android 14 ou superior."
        : "Captura de tela desativada: o Giro Certo analisa as ofertas pelas notificações.";

    private String pendingAppName = "";
    private String pendingPackage = "";

    private final RideCaptureBus.Listener captureListener = new RideCaptureBus.Listener() {
        @Override
        public void onCaptureResult(RideCapturePayload payload) {
            notifyListeners("rideCapture", payload.toJsObject());
        }

        @Override
        public void onCaptureStopped(String reason) {
            JSObject event = new JSObject();
            event.put("active", false);
            event.put("reason", reason == null ? "" : reason);
            notifyListeners("rideCaptureStopped", event);
        }
    };

    @Override
    public void load() {
        RideCaptureBus.setListener(captureListener);
    }

    @Override
    protected void handleOnDestroy() {
        RideCaptureBus.clearListener(captureListener);
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private JSObject unavailable() {
        JSObject result = new JSObject();
        result.put("available", false);
        result.put("message", ANALYZER_UNAVAILABLE);
        return result;
    }

    @PluginMethod public void isNotificationAccessGranted(PluginCall call) {
        JSObject result = unavailable();
        result.put("granted", false);
        call.resolve(result);
    }

    @PluginMethod public void openNotificationAccessSettings(PluginCall call) {
        call.resolve(unavailable());
    }

    private static final String TARGET_CHANNEL_ID = "giro_certo_regua";
    private static final int TARGET_NOTIFICATION_ID = 9031;

    @PluginMethod public void showTargetBar(PluginCall call) {
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            JSObject result = new JSObject();
            result.put("shown", false);
            call.resolve(result);
            return;
        }
        Context context = getContext();
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                TARGET_CHANNEL_ID, "Régua de aceite", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            manager.createNotificationChannel(channel);
        }
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        android.app.PendingIntent tap = open == null ? null : android.app.PendingIntent.getActivity(
            context, 0, open, android.app.PendingIntent.FLAG_IMMUTABLE | android.app.PendingIntent.FLAG_UPDATE_CURRENT);
        String title = call.getString("title", "");
        String body = call.getString("body", "");
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, TARGET_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        if (tap != null) builder.setContentIntent(tap);
        manager.notify(TARGET_NOTIFICATION_ID, builder.build());
        JSObject result = new JSObject();
        result.put("shown", true);
        call.resolve(result);
    }

    @PluginMethod public void hideTargetBar(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(TARGET_NOTIFICATION_ID);
        call.resolve();
    }

    private boolean accessibilityEnabled() {
        String enabled = Settings.Secure.getString(
            getContext().getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (enabled == null) return false;
        String me = getContext().getPackageName() + "/";
        for (String item : enabled.split(":")) {
            if (item.startsWith(me) && item.endsWith("RideAccessibilityService")) return true;
        }
        return false;
    }

    @PluginMethod public void isAccessibilityAccessGranted(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", true);
        result.put("granted", accessibilityEnabled());
        call.resolve(result);
    }

    @PluginMethod public void openAccessibilitySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod public void disableAccessibility(PluginCall call) {
        prefs().edit().putBoolean("analyzerEnabled", false).apply();
        JSObject result = new JSObject();
        result.put("disabled", RideAccessibilityService.disableFromApp());
        call.resolve(result);
    }

    @PluginMethod public void requestAnalyzerNotificationPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        call.resolve(result);
    }

    @PluginMethod public void isOverlayPermissionGranted(PluginCall call) {
        JSObject result = unavailable();
        result.put("granted", false);
        call.resolve(result);
    }

    @PluginMethod public void openOverlaySettings(PluginCall call) {
        call.resolve(unavailable());
    }

    @PluginMethod public void testOverlay(PluginCall call) {
        call.resolve(unavailable());
    }

    @PluginMethod public void isScreenCaptureSupported(PluginCall call) {
        JSObject result = new JSObject();
        boolean supported = CAPTURE_ENABLED && Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE;
        result.put("supported", supported);
        result.put("reason", supported ? "" : CAPTURE_UNSUPPORTED);
        call.resolve(result);
    }

    @PluginMethod public void startScreenCapture(PluginCall call) {
        if (!CAPTURE_ENABLED || Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            JSObject result = new JSObject();
            result.put("started", false);
            result.put("message", CAPTURE_UNSUPPORTED);
            call.resolve(result);
            return;
        }
        pendingAppName = call.getString("appName", "");
        pendingPackage = call.getString("packageName", "");
        MediaProjectionManager manager =
            (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        Intent intent = manager.createScreenCaptureIntent(
            MediaProjectionConfig.createConfigForUserChoice());
        startActivityForResult(call, intent, "screenCaptureResult");
    }

    @ActivityCallback
    private void screenCaptureResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject response = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            response.put("started", false);
            response.put("message", "Consentimento de captura não concedido.");
            call.resolve(response);
            return;
        }
        Intent service = new Intent(getContext(), RideCaptureService.class)
            .setAction(RideCaptureService.ACTION_START)
            .putExtra(RideCaptureService.EXTRA_RESULT_CODE, result.getResultCode())
            .putExtra(RideCaptureService.EXTRA_RESULT_DATA, result.getData())
            .putExtra(RideCaptureService.EXTRA_APP_NAME, pendingAppName)
            .putExtra(RideCaptureService.EXTRA_PACKAGE, pendingPackage);
        ContextCompat.startForegroundService(getContext(), service);
        response.put("started", true);
        call.resolve(response);
    }

    @PluginMethod public void stopScreenCapture(PluginCall call) {
        Intent intent = new Intent(getContext(), RideCaptureService.class)
            .setAction(RideCaptureService.ACTION_STOP);
        try {
            getContext().startService(intent);
        } catch (Exception ignored) { }
        RideCaptureBus.emitStopped("Captura encerrada.");
        call.resolve();
    }

    @PluginMethod public void getCaptureStatus(PluginCall call) {
        SharedPreferences store = prefs();
        JSObject result = new JSObject();
        result.put("active", store.getBoolean(RideCaptureService.KEY_ACTIVE, false));
        result.put("appName", store.getString(RideCaptureService.KEY_APP_NAME, ""));
        result.put("fullScreen", store.getBoolean(RideCaptureService.KEY_FULL_SCREEN, false));
        String reason = store.getString(RideCaptureService.KEY_STOP_REASON, "");
        result.put("stopReason", reason == null ? "" : reason);
        call.resolve(result);
    }

    @PluginMethod public void getLatestCaptureResult(PluginCall call) {
        JSObject response = new JSObject();
        String stored = prefs().getString(RideCaptureService.KEY_LAST_RESULT, "");
        if (stored == null || stored.isEmpty()) {
            response.put("result", JSONObject.NULL);
            call.resolve(response);
            return;
        }
        try {
            response.put("result", new JSONObject(stored));
        } catch (Exception error) {
            response.put("result", JSONObject.NULL);
        }
        call.resolve(response);
    }

    @PluginMethod public void getAnalyzerEnabled(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", true);
        result.put("enabled", prefs().getBoolean("analyzerEnabled", false) && accessibilityEnabled());
        call.resolve(result);
    }

    @PluginMethod public void setAnalyzerEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        prefs().edit().putBoolean("analyzerEnabled", enabled).apply();
        JSObject result = new JSObject();
        result.put("available", true);
        result.put("enabled", enabled && accessibilityEnabled());
        call.resolve(result);
    }

    @PluginMethod public void setProEntitlement(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        long expiresAt = call.getLong("expiresAt", 0L);
        SharedPreferences.Editor editor = prefs().edit()
            .putBoolean("proEntitlement", enabled)
            .putLong("proEntitlementExpiresAt", expiresAt);
        if (!enabled) editor.putBoolean("analyzerEnabled", false);
        editor.apply();
        call.resolve();
    }

    @PluginMethod public void getOfferHistory(PluginCall call) {
        SharedPreferences store = prefs();
        JSArray offers = new JSArray();
        try {
            JSONArray stored = new JSONArray(store.getString("offerHistory", "[]"));
            for (int index = 0; index < stored.length(); index++) offers.put(stored.get(index));
        } catch (Exception ignored) { }
        JSObject result = new JSObject();
        result.put("offers", offers);
        call.resolve(result);
    }

    @PluginMethod public void clearOfferHistory(PluginCall call) {
        prefs().edit().remove("offerHistory").apply();
        call.resolve();
    }

    @PluginMethod public void markOfferConverted(PluginCall call) {
        String offerId = call.getString("offerId", "");
        if (offerId.isEmpty()) { call.reject("Oferta inválida"); return; }
        SharedPreferences store = prefs();
        try {
            JSONArray stored = new JSONArray(store.getString("offerHistory", "[]"));
            boolean found = false;
            for (int index = 0; index < stored.length(); index++) {
                JSONObject item = stored.getJSONObject(index);
                if (offerId.equals(item.optString("id"))) {
                    item.put("convertedAt", System.currentTimeMillis());
                    found = true;
                    break;
                }
            }
            if (!found) { call.reject("Oferta não encontrada"); return; }
            store.edit().putString("offerHistory", stored.toString()).apply();
            call.resolve();
        } catch (Exception error) {
            call.reject("Não foi possível atualizar a oferta");
        }
    }

    @PluginMethod public void getAnalyzerDiagnostic(PluginCall call) {
        SharedPreferences store = prefs();
        JSObject result = new JSObject();
        if (store.getLong("diagnosticAt", 0L) == 0L) {
            result.put("diagnostic", JSONObject.NULL);
        } else {
            JSObject diagnostic = new JSObject();
            diagnostic.put("analyzed", store.getBoolean("diagnosticAnalyzed", false));
            diagnostic.put("source", store.getString("diagnosticSource", "notification"));
            diagnostic.put("message", store.getString("diagnosticMessage", ""));
            diagnostic.put("preview", store.getString("diagnosticPreview", ""));
            diagnostic.put("at", store.getLong("diagnosticAt", 0L));
            result.put("diagnostic", diagnostic);
        }
        call.resolve(result);
    }

    @PluginMethod public void getLatestRideOffer(PluginCall call) {
        SharedPreferences store = prefs();
        JSObject result = new JSObject();
        if (store.getLong("receivedAt", 0L) == 0L) {
            result.put("offer", JSONObject.NULL);
        } else {
            JSObject offer = new JSObject();
            offer.put("packageName", store.getString("packageName", ""));
            offer.put("appName", store.getString("appName", ""));
            offer.put("title", store.getString("title", ""));
            offer.put("text", store.getString("text", ""));
            offer.put("receivedAt", store.getLong("receivedAt", 0L));
            result.put("offer", offer);
        }
        call.resolve(result);
    }

    @PluginMethod public void getCopilotLog(PluginCall call) {
        JSArray entries = new JSArray();
        try {
            JSONArray stored = new JSONArray(prefs().getString(CopilotLog.KEY, "[]"));
            for (int index = 0; index < stored.length(); index++) entries.put(stored.get(index));
        } catch (Exception ignored) { }
        JSObject result = new JSObject();
        result.put("entries", entries);
        call.resolve(result);
    }

    @PluginMethod public void clearCopilotLog(PluginCall call) {
        prefs().edit().remove(CopilotLog.KEY).apply();
        call.resolve();
    }

    @PluginMethod public void saveRideCriteria(PluginCall call) {
        prefs().edit()
            .putFloat("minProfitPerKm", call.getFloat("minProfitPerKm", 0.8f))
            .putFloat("minProfitPerHour", call.getFloat("minProfitPerHour", 25f))
            .putFloat("minAcceptableValue", call.getFloat("minAcceptableValue", 8f))
            .putFloat("costPerKm", call.getFloat("costPerKm", 0.28f))
            .putFloat("minPassengerRating", call.getFloat("minPassengerRating", 4.7f))
            .apply();
        call.resolve();
    }
}
