package tech.domnex.girocerto;

import android.Manifest;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
import android.net.Uri;
import android.media.projection.MediaProjectionManager;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "RideOffer",
    permissions = @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
)
public class RideOfferPlugin extends Plugin {
    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            notifyListeners("rideOffer", offerFromIntent(intent));
        }
    };

    @Override public void load() {
        IntentFilter filter = new IntentFilter(RideNotificationListenerService.ACTION_RIDE_OFFER);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(receiver, filter);
        }
    }

    @PluginMethod public void requestAnalyzerNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || getPermissionState("notifications") == PermissionState.GRANTED) {
            resolveNotificationPermission(call, true);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        boolean granted = getPermissionState("notifications") == PermissionState.GRANTED;
        resolveNotificationPermission(call, granted);
    }

    private void resolveNotificationPermission(PluginCall call, boolean granted) {
        if (granted) AnalyzerControlNotification.refresh(getContext());
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod public void isOverlayPermissionGranted(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext()));
        call.resolve(result);
    }

    @PluginMethod public void openOverlaySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getContext().getPackageName()))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod public void testOverlay(PluginCall call) {
        if (!hasValidProEntitlement()) {
            call.reject("Recurso exclusivo do Giro Certo Pro");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
            call.reject("Permissão para aparecer sobre outros apps não concedida");
            return;
        }
        double fare = call.getDouble("fare", 28.50);
        String body = call.getString("body", "Teste do cartão flutuante");
        String status = call.getString("status", "COMPENSA");
        String icon = status.equals("COMPENSA") ? "✅ " : status.equals("ATENÇÃO") ? "⚠️ " : "❌ ";
        RideOverlayView.show(
            getContext(),
            icon + "TESTE · " + status,
            fare,
            body,
            status
        );
        call.resolve();
    }

    @PluginMethod public void getOfferHistory(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(RideNotificationListenerService.PREFS, Context.MODE_PRIVATE);
        JSArray offers = new JSArray();
        try {
            JSONArray stored = new JSONArray(prefs.getString("offerHistory", "[]"));
            for (int index = 0; index < stored.length(); index++) offers.put(stored.get(index));
        } catch (Exception ignored) { }
        JSObject result = new JSObject();
        result.put("offers", offers);
        call.resolve(result);
    }

    @PluginMethod public void getAnalyzerDiagnostic(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(RideNotificationListenerService.PREFS, Context.MODE_PRIVATE);
        JSObject diagnostic = new JSObject();
        long at = prefs.getLong("diagnosticAt", 0L);
        if (at > 0L) {
            diagnostic.put("analyzed", prefs.getBoolean("diagnosticAnalyzed", false));
            diagnostic.put("source", prefs.getString("diagnosticSource", ""));
            diagnostic.put("message", prefs.getString("diagnosticMessage", ""));
            diagnostic.put("preview", prefs.getString("diagnosticPreview", ""));
            diagnostic.put("at", at);
        }
        JSObject result = new JSObject();
        result.put("diagnostic", at > 0L ? diagnostic : null);
        call.resolve(result);
    }

    @PluginMethod public void clearOfferHistory(PluginCall call) {
        getContext().getSharedPreferences(RideNotificationListenerService.PREFS, Context.MODE_PRIVATE)
            .edit().remove("offerHistory").apply();
        call.resolve();
    }

    @PluginMethod public void markOfferConverted(PluginCall call) {
        String offerId = call.getString("offerId", "");
        if (offerId.isEmpty()) { call.reject("Oferta inválida"); return; }
        SharedPreferences prefs = getContext().getSharedPreferences(RideNotificationListenerService.PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray stored = new JSONArray(prefs.getString("offerHistory", "[]"));
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
            prefs.edit().putString("offerHistory", stored.toString()).apply();
            call.resolve();
        } catch (Exception error) {
            call.reject("Não foi possível atualizar a oferta");
        }
    }

    @PluginMethod public void getAnalyzerEnabled(PluginCall call) {
        boolean enabled = getContext()
            .getSharedPreferences(RideNotificationListenerService.PREFS, Context.MODE_PRIVATE)
            .getBoolean("analyzerEnabled", false) && hasValidProEntitlement();
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @PluginMethod public void setAnalyzerEnabled(PluginCall call) {
        boolean requested = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        if (!requested) {
            stopScreenCapture();
            JSObject result = new JSObject();
            result.put("enabled", false);
            call.resolve(result);
            return;
        }
        if (!hasValidProEntitlement()) {
            call.reject("Recurso exclusivo do Giro Certo Pro");
            return;
        }
        MediaProjectionManager manager =
            (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        startActivityForResult(call, manager.createScreenCaptureIntent(), "screenCaptureResult");
    }

    @ActivityCallback
    private void screenCaptureResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;
        Intent data = activityResult.getData();
        if (activityResult.getResultCode() != Activity.RESULT_OK || data == null) {
            getContext().getSharedPreferences(RideNotificationListenerService.PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean("analyzerEnabled", false).apply();
            AnalyzerControlNotification.refresh(getContext());
            JSObject result = new JSObject();
            result.put("enabled", false);
            call.resolve(result);
            return;
        }
        Intent serviceIntent = new Intent(getContext(), RideScreenCaptureService.class)
            .setAction(RideScreenCaptureService.ACTION_START)
            .putExtra(RideScreenCaptureService.EXTRA_RESULT_CODE, activityResult.getResultCode())
            .putExtra(RideScreenCaptureService.EXTRA_RESULT_DATA, data);
        ContextCompat.startForegroundService(getContext(), serviceIntent);
        getContext().getSharedPreferences(RideNotificationListenerService.PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean("analyzerEnabled", true).apply();
        AnalyzerControlNotification.refresh(getContext());
        JSObject result = new JSObject();
        result.put("enabled", true);
        call.resolve(result);
    }

    private void stopScreenCapture() {
        getContext().getSharedPreferences(RideNotificationListenerService.PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean("analyzerEnabled", false).apply();
        Intent intent = new Intent(getContext(), RideScreenCaptureService.class)
            .setAction(RideScreenCaptureService.ACTION_STOP);
        getContext().startService(intent);
        AnalyzerControlNotification.refresh(getContext());
    }

    @PluginMethod public void setProEntitlement(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        long expiresAt = call.getLong("expiresAt", 0L);
        SharedPreferences.Editor editor = getContext()
            .getSharedPreferences(RideNotificationListenerService.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean("proEntitlement", enabled)
            .putLong("proEntitlementExpiresAt", expiresAt);
        if (!enabled) editor.putBoolean("analyzerEnabled", false);
        editor.apply();
        if (!enabled) stopScreenCapture();
        AnalyzerControlNotification.refresh(getContext());
        call.resolve();
    }

    private boolean hasValidProEntitlement() {
        SharedPreferences prefs = getContext()
            .getSharedPreferences(RideNotificationListenerService.PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean("proEntitlement", false)) return false;
        long expiresAt = prefs.getLong("proEntitlementExpiresAt", 0L);
        return expiresAt == 0L || expiresAt > System.currentTimeMillis();
    }

    @PluginMethod public void getLatestRideOffer(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(RideNotificationListenerService.PREFS, Context.MODE_PRIVATE);
        JSObject result = new JSObject();
        if (prefs.getLong("receivedAt", 0) > 0) result.put("offer", offerFromPreferences(prefs));
        call.resolve(result);
    }

    @PluginMethod public void saveRideCriteria(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(RideNotificationListenerService.PREFS, Context.MODE_PRIVATE);
        prefs.edit()
            .putFloat("minProfitPerKm", call.getFloat("minProfitPerKm", 0.8f))
            .putFloat("minProfitPerHour", call.getFloat("minProfitPerHour", 25f))
            .putFloat("minAcceptableValue", call.getFloat("minAcceptableValue", 8f))
            .putFloat("costPerKm", call.getFloat("costPerKm", 0.28f))
            .apply();
        call.resolve();
    }

    private JSObject offerFromIntent(Intent intent) {
        JSObject offer = new JSObject();
        offer.put("packageName", intent.getStringExtra("packageName"));
        offer.put("appName", intent.getStringExtra("appName"));
        offer.put("title", intent.getStringExtra("title"));
        offer.put("text", intent.getStringExtra("text"));
        offer.put("receivedAt", intent.getLongExtra("receivedAt", 0));
        return offer;
    }

    private JSObject offerFromPreferences(SharedPreferences prefs) {
        JSObject offer = new JSObject();
        offer.put("packageName", prefs.getString("packageName", ""));
        offer.put("appName", prefs.getString("appName", "Aplicativo de corrida"));
        offer.put("title", prefs.getString("title", ""));
        offer.put("text", prefs.getString("text", ""));
        offer.put("receivedAt", prefs.getLong("receivedAt", 0));
        return offer;
    }

    @Override protected void handleOnDestroy() {
        try { getContext().unregisterReceiver(receiver); } catch (IllegalArgumentException ignored) { }
    }
}
