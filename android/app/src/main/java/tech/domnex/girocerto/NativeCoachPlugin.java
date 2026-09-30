package tech.domnex.girocerto;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.speech.tts.TextToSpeech;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.Locale;
import android.speech.tts.Voice;

@CapacitorPlugin(
    name = "NativeCoach",
    permissions = @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
)
public class NativeCoachPlugin extends Plugin {
    private static final String CHANNEL_ID = "giro_certo_metas";
    private TextToSpeech tts;

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        if (text.isEmpty()) { call.reject("Mensagem vazia"); return; }
        withTts(call, engine -> {
            String voiceId = call.getString("voiceId");
            if (voiceId != null) {
                for (Voice voice : engine.getVoices()) {
                    if (voice.getName().equals(voiceId)) { engine.setVoice(voice); break; }
                }
            }
            engine.setSpeechRate(call.getFloat("rate", 0.95f));
            engine.setPitch(call.getFloat("pitch", 0.92f));
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "giro-certo-coach");
            call.resolve();
        });
    }

    @PluginMethod
    public void listVoices(PluginCall call) {
        withTts(call, engine -> {
            JSArray voices = new JSArray();
            for (Voice voice : engine.getVoices()) {
                Locale locale = voice.getLocale();
                if (locale != null && "pt".equals(locale.getLanguage()) && "BR".equals(locale.getCountry())) {
                    JSObject item = new JSObject();
                    item.put("id", voice.getName());
                    item.put("name", "Português (Brasil) · " + voice.getName());
                    voices.put(item);
                }
            }
            JSObject result = new JSObject();
            result.put("voices", voices);
            call.resolve(result);
        });
    }

    private interface TtsReady { void run(TextToSpeech engine); }

    private void withTts(PluginCall call, TtsReady ready) {
        if (tts != null) {
            ready.run(tts);
            return;
        }
        tts = new TextToSpeech(getContext(), status -> {
            if (status != TextToSpeech.SUCCESS) { call.reject("Voz do sistema indisponível"); return; }
            tts.setLanguage(new Locale("pt", "BR"));
            ready.run(tts);
        });
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notifications") == PermissionState.GRANTED) {
            resolvePermission(call, true);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        resolvePermission(call, getPermissionState("notifications") == PermissionState.GRANTED);
    }

    private void resolvePermission(PluginCall call, boolean granted) {
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void notify(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") != PermissionState.GRANTED) {
            call.reject("Permissão de notificações não concedida");
            return;
        }
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL_ID, "Metas e incentivos", NotificationManager.IMPORTANCE_DEFAULT));
        }
        NotificationCompat.Builder notification = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(call.getString("title", "Giro Certo"))
            .setContentText(call.getString("body", ""))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(call.getString("body", "")))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        manager.notify((int) (System.currentTimeMillis() % Integer.MAX_VALUE), notification.build());
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
    }
}
