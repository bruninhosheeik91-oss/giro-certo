package tech.domnex.girocerto;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RideOffer")
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

    @PluginMethod public void isNotificationAccessGranted(PluginCall call) {
        String enabled = Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        ComponentName component = new ComponentName(getContext(), RideNotificationListenerService.class);
        JSObject result = new JSObject();
        result.put("granted", enabled != null && enabled.contains(component.flattenToString()));
        call.resolve(result);
    }

    @PluginMethod public void openNotificationAccessSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
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
