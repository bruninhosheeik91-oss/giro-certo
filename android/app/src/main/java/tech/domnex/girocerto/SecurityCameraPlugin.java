package tech.domnex.girocerto;

import android.Manifest;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "SecurityCamera",
    permissions = {
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }),
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class SecurityCameraPlugin extends Plugin {
    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(SecurityCameraService.PREFS, android.content.Context.MODE_PRIVATE);
    }

    @PluginMethod public void requestAccess(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED
            && getPermissionState("microphone") == PermissionState.GRANTED) {
            status(call);
            return;
        }
        requestAllPermissions(call, "accessResult");
    }

    @PermissionCallback private void accessResult(PluginCall call) {
        status(call);
    }

    @PluginMethod public void getStatus(PluginCall call) {
        status(call);
    }

    private void status(PluginCall call) {
        SharedPreferences store = prefs();
        JSObject result = new JSObject();
        result.put("cameraGranted", getPermissionState("camera") == PermissionState.GRANTED);
        result.put("microphoneGranted", getPermissionState("microphone") == PermissionState.GRANTED);
        result.put("recording", store.getBoolean(SecurityCameraService.KEY_RECORDING, false));
        result.put("startedAt", store.getLong(SecurityCameraService.KEY_STARTED_AT, 0L));
        result.put("lens", store.getString(SecurityCameraService.KEY_LENS, "front"));
        result.put("audio", store.getBoolean(SecurityCameraService.KEY_AUDIO, true));
        result.put("lastVideoName", store.getString(SecurityCameraService.KEY_LAST_NAME, ""));
        result.put("lastVideoAt", store.getLong(SecurityCameraService.KEY_LAST_AT, 0L));
        result.put("lastError", store.getString(SecurityCameraService.KEY_ERROR, ""));
        call.resolve(result);
    }

    @PluginMethod public void saveSettings(PluginCall call) {
        String lens = "back".equals(call.getString("lens")) ? "back" : "front";
        prefs().edit()
            .putString(SecurityCameraService.KEY_LENS, lens)
            .putBoolean(SecurityCameraService.KEY_AUDIO, Boolean.TRUE.equals(call.getBoolean("audio", true)))
            .apply();
        status(call);
    }

    @PluginMethod public void start(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            call.reject("Permissão de câmera não concedida");
            return;
        }
        SecurityCameraService.start(getContext());
        call.resolve();
    }

    @PluginMethod public void stop(PluginCall call) {
        SecurityCameraService.stop(getContext());
        call.resolve();
    }

    @PluginMethod public void getFloatingButton(PluginCall call) {
        JSObject result = new JSObject();
        result.put("canDraw", FloatingButtonService.canDraw(getContext()));
        result.put("enabled", FloatingButtonService.isEnabled(getContext()));
        call.resolve(result);
    }

    @PluginMethod public void setFloatingButton(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        FloatingButtonService.setEnabled(getContext(), enabled && FloatingButtonService.canDraw(getContext()));
        getFloatingButton(call);
    }

    @PluginMethod public void openOverlaySettings(PluginCall call) {
        android.content.Intent intent = new android.content.Intent(
            android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            android.net.Uri.parse("package:" + getContext().getPackageName()))
            .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /** Abre WhatsApp, SMS, discador ou mapa (links whatsapp:, https:, smsto:, tel:). */
    @PluginMethod public void openExternal(PluginCall call) {
        String url = call.getString("url", "");
        String pkg = call.getString("package", "");
        JSObject result = new JSObject();
        try {
            String action = url.startsWith("tel:") ? android.content.Intent.ACTION_DIAL
                : url.startsWith("smsto:") ? android.content.Intent.ACTION_SENDTO
                : android.content.Intent.ACTION_VIEW;
            android.content.Intent intent = new android.content.Intent(action, android.net.Uri.parse(url))
                .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            if (pkg != null && !pkg.isEmpty()) intent.setPackage(pkg);
            getContext().startActivity(intent);
            result.put("opened", true);
        } catch (RuntimeException error) {
            result.put("opened", false);
        }
        call.resolve(result);
    }

    @PluginMethod public void consumeOpenRequest(PluginCall call) {
        boolean open = prefs().getBoolean("openSecurityTab", false);
        if (open) prefs().edit().remove("openSecurityTab").apply();
        JSObject result = new JSObject();
        result.put("open", open);
        call.resolve(result);
    }
}
