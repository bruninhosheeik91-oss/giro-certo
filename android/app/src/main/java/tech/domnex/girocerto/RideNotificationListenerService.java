package tech.domnex.girocerto;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Build;
import android.provider.Settings;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;
import java.util.Locale;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;

public class RideNotificationListenerService extends NotificationListenerService {
    public static final String ACTION_RIDE_OFFER = "tech.domnex.girocerto.RIDE_OFFER";
    public static final String PREFS = "giro_certo_ride_offers";
    private static final String CHANNEL_ID = "giro_certo_ofertas";
    private WindowManager windowManager;
    private View overlayView;

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();
        if (!isSupportedRideApp(packageName)) return;

        Bundle extras = sbn.getNotification().extras;
        String title = stringValue(extras.get(Notification.EXTRA_TITLE));
        String text = stringValue(extras.get(Notification.EXTRA_BIG_TEXT));
        if (text.isEmpty()) text = stringValue(extras.get(Notification.EXTRA_TEXT));
        CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines != null && lines.length > 0) text = TextUtils.join(" · ", lines);
        if (title.isEmpty() && text.isEmpty()) return;
        String searchable = (title + " " + text).toLowerCase(Locale.ROOT);
        if (!searchable.contains("r$") || (!searchable.contains("km") && !searchable.contains("corrida") && !searchable.contains("entrega"))) return;

        long receivedAt = System.currentTimeMillis();
        String appName = resolveAppName(packageName);
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String fingerprint = Integer.toHexString((packageName + "|" + title + "|" + text).hashCode());
        if (fingerprint.equals(prefs.getString("lastFingerprint", ""))
            && receivedAt - prefs.getLong("lastFingerprintAt", 0) < 60000) return;
        prefs.edit()
            .putString("packageName", packageName)
            .putString("appName", appName)
            .putString("title", title)
            .putString("text", text)
            .putLong("receivedAt", receivedAt)
            .putString("lastFingerprint", fingerprint)
            .putLong("lastFingerprintAt", receivedAt)
            .apply();

        showRideAnalysis(appName, title + " " + text, prefs);

        Intent intent = new Intent(ACTION_RIDE_OFFER).setPackage(getPackageName());
        intent.putExtra("packageName", packageName);
        intent.putExtra("appName", appName);
        intent.putExtra("title", title);
        intent.putExtra("text", text);
        intent.putExtra("receivedAt", receivedAt);
        sendBroadcast(intent);
    }

    private void showRideAnalysis(String appName, String content, SharedPreferences prefs) {
        double fare = firstMatch(content, "R\\$\\s*([\\d.]+(?:,\\d{1,2})?)");
        java.util.regex.Matcher kmMatcher = java.util.regex.Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*km", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(content);
        double totalKm = 0;
        while (kmMatcher.find()) totalKm += decimal(kmMatcher.group(1));
        double minutes = firstMatch(content, "(\\d+(?:[.,]\\d+)?)\\s*(?:min|minutos?)");
        if (fare <= 0 || totalKm <= 0) return;

        double cost = totalKm * prefs.getFloat("costPerKm", 0.28f);
        double profit = fare - cost;
        double profitPerKm = profit / totalKm;
        double profitPerHour = minutes > 0 ? profit / (minutes / 60d) : 0;
        double minKm = prefs.getFloat("minProfitPerKm", 0.8f);
        double minHour = prefs.getFloat("minProfitPerHour", 25f);
        double minValue = prefs.getFloat("minAcceptableValue", 8f);
        boolean kmOk = profitPerKm >= minKm;
        boolean hourOk = minutes <= 0 || profitPerHour >= minHour;
        String status = fare < minValue || profit <= 0 ? "NÃO COMPENSA" : kmOk && hourOk ? "COMPENSA" : kmOk || hourOk ? "ATENÇÃO" : "NÃO COMPENSA";
        String icon = status.equals("COMPENSA") ? "✅ " : status.equals("ATENÇÃO") ? "⚠️ " : "❌ ";
        String body = String.format(Locale.forLanguageTag("pt-BR"), "%s • Lucro R$ %.2f • R$ %.2f/km%s", appName, profit, profitPerKm, minutes > 0 ? String.format(Locale.forLanguageTag("pt-BR"), " • R$ %.2f/h", profitPerHour) : "");

        saveHistory(prefs, appName, fare, totalKm, minutes, profit, profitPerKm, profitPerHour, status);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)) {
            RideOverlayView.show(this, icon + status, fare, body, status);
        }

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL_ID, "Análise de ofertas", NotificationManager.IMPORTANCE_HIGH));
        }
        NotificationCompat.Builder notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(icon + status + " — " + String.format(Locale.forLanguageTag("pt-BR"), "R$ %.2f", fare))
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
            .setTimeoutAfter(12000)
            .setAutoCancel(true);
        manager.notify(9021, notification.build());
    }

    private void saveHistory(SharedPreferences prefs, String appName, double fare, double totalKm,
                             double minutes, double profit, double profitPerKm,
                             double profitPerHour, String status) {
        try {
            JSONArray current = new JSONArray(prefs.getString("offerHistory", "[]"));
            JSONArray updated = new JSONArray();
            JSONObject item = new JSONObject();
            item.put("id", String.valueOf(System.currentTimeMillis()));
            item.put("appName", appName);
            item.put("fare", fare);
            item.put("totalKm", totalKm);
            item.put("minutes", minutes);
            item.put("profit", profit);
            item.put("profitPerKm", profitPerKm);
            item.put("profitPerHour", profitPerHour);
            item.put("status", status);
            item.put("analyzedAt", System.currentTimeMillis());
            updated.put(item);
            for (int index = 0; index < current.length() && updated.length() < 30; index++) {
                updated.put(current.get(index));
            }
            prefs.edit().putString("offerHistory", updated.toString()).apply();
        } catch (Exception ignored) { }
    }

    private void showOverlay(String title, double fare, String body, String status) {
        new Handler(Looper.getMainLooper()).post(() -> {
            removeOverlay();
            windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(dp(16), dp(12), dp(16), dp(12));
            GradientDrawable background = new GradientDrawable();
            background.setColor(Color.rgb(15, 23, 42));
            background.setCornerRadius(dp(16));
            int accent = status.equals("COMPENSA") ? Color.rgb(16, 185, 129)
                : status.equals("ATENÇÃO") ? Color.rgb(245, 158, 11) : Color.rgb(244, 63, 94);
            background.setStroke(dp(2), accent);
            card.setBackground(background);
            card.setElevation(dp(12));

            TextView heading = new TextView(this);
            heading.setText(title + "  •  " + String.format(Locale.forLanguageTag("pt-BR"), "R$ %.2f", fare));
            heading.setTextColor(accent);
            heading.setTextSize(16);
            heading.setTypeface(null, android.graphics.Typeface.BOLD);
            card.addView(heading);

            TextView details = new TextView(this);
            details.setText(body);
            details.setTextColor(Color.rgb(226, 232, 240));
            details.setTextSize(12);
            details.setPadding(0, dp(5), 0, 0);
            card.addView(details);

            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                getResources().getDisplayMetrics().widthPixels - dp(24),
                WindowManager.LayoutParams.WRAP_CONTENT,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                    | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT);
            params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            params.y = dp(72);
            overlayView = card;
            try {
                windowManager.addView(card, params);
                new Handler(Looper.getMainLooper()).postDelayed(this::removeOverlay, 12000);
            } catch (RuntimeException ignored) {
                overlayView = null;
            }
        });
    }

    private void removeOverlay() {
        if (windowManager != null && overlayView != null) {
            try { windowManager.removeView(overlayView); } catch (RuntimeException ignored) { }
        }
        overlayView = null;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override public void onDestroy() {
        removeOverlay();
        super.onDestroy();
    }

    private double firstMatch(String content, String regex) {
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile(regex, java.util.regex.Pattern.CASE_INSENSITIVE).matcher(content);
        return matcher.find() ? decimal(matcher.group(1)) : 0;
    }

    private double decimal(String value) {
        String normalized = value.contains(",") ? value.replace(".", "").replace(',', '.') : value;
        try { return Double.parseDouble(normalized); }
        catch (NumberFormatException ignored) { return 0; }
    }

    private boolean isSupportedRideApp(String packageName) {
        String value = packageName.toLowerCase(Locale.ROOT);
        return value.contains("uber") || value.contains("didi") || value.contains("99")
            || value.contains("ifood") || value.contains("lalamove")
            || value.contains("rappi") || value.contains("borzo");
    }

    private String resolveAppName(String packageName) {
        String value = packageName.toLowerCase(Locale.ROOT);
        if (value.contains("uber")) return "Uber";
        if (value.contains("didi") || value.contains("99")) return "99";
        if (value.contains("ifood")) return "iFood";
        if (value.contains("lalamove")) return "Lalamove";
        if (value.contains("rappi")) return "Rappi";
        if (value.contains("borzo")) return "Borzo";
        return "Aplicativo de corrida";
    }

    private String stringValue(Object value) {
        return value == null ? "" : value.toString().trim();
    }
}
