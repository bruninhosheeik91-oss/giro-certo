package tech.domnex.girocerto;

import android.content.SharedPreferences;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** Registro local das últimas leituras do Copiloto, para diagnóstico. Nada sai do aparelho. */
final class CopilotLog {
    static final String KEY = "copilotLog";
    private static final int MAX = 30;

    private CopilotLog() { }

    static void add(SharedPreferences prefs, String event, String source, String detail, String raw) {
        try {
            JSONArray current = new JSONArray(prefs.getString(KEY, "[]"));
            JSONArray updated = new JSONArray();
            JSONObject item = new JSONObject();
            item.put("at", new SimpleDateFormat("HH:mm:ss", Locale.US).format(new Date()));
            item.put("event", event);
            item.put("source", source);
            item.put("detail", detail == null ? "" : detail);
            String text = raw == null ? "" : raw.replaceAll("\\s+", " ").trim();
            item.put("raw", text.length() > 400 ? text.substring(0, 400) : text);
            updated.put(item);
            for (int i = 0; i < current.length() && updated.length() < MAX; i++) updated.put(current.get(i));
            prefs.edit().putString(KEY, updated.toString()).apply();
        } catch (Exception ignored) { }
    }
}
