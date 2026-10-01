package tech.domnex.girocerto;

import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.Locale;

public final class RideOverlayView {
    private RideOverlayView() { }

    public static void show(Context context, String title, double fare, String body, String status) {
        new Handler(Looper.getMainLooper()).post(() -> {
            WindowManager manager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
            LinearLayout card = new LinearLayout(context);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(dp(context, 16), dp(context, 12), dp(context, 16), dp(context, 12));
            int accent = status.equals("COMPENSA") ? Color.rgb(16, 185, 129)
                : status.equals("ATENÇÃO") ? Color.rgb(245, 158, 11) : Color.rgb(244, 63, 94);
            GradientDrawable background = new GradientDrawable();
            background.setColor(Color.rgb(15, 23, 42));
            background.setCornerRadius(dp(context, 16));
            background.setStroke(dp(context, 2), accent);
            card.setBackground(background);
            card.setElevation(dp(context, 12));

            TextView heading = new TextView(context);
            heading.setText(title + "  •  " + String.format(Locale.forLanguageTag("pt-BR"), "R$ %.2f", fare));
            heading.setTextColor(accent);
            heading.setTextSize(16);
            heading.setTypeface(null, android.graphics.Typeface.BOLD);
            card.addView(heading);

            TextView details = new TextView(context);
            details.setText(body);
            details.setTextColor(Color.rgb(226, 232, 240));
            details.setTextSize(12);
            details.setPadding(0, dp(context, 5), 0, 0);
            card.addView(details);

            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                context.getResources().getDisplayMetrics().widthPixels - dp(context, 24),
                WindowManager.LayoutParams.WRAP_CONTENT,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                    | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT);
            params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            params.y = dp(context, 72);
            try {
                manager.addView(card, params);
                new Handler(Looper.getMainLooper()).postDelayed(() -> remove(manager, card), 12000);
            } catch (RuntimeException ignored) { }
        });
    }

    private static void remove(WindowManager manager, View view) {
        try { manager.removeView(view); } catch (RuntimeException ignored) { }
    }

    private static int dp(Context context, int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }
}
