package tech.domnex.girocerto;

import android.location.Address;
import android.location.Geocoder;
import android.os.Build;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.gms.maps.StreetViewPanorama;
import com.google.android.gms.maps.StreetViewPanoramaOptions;
import com.google.android.gms.maps.StreetViewPanoramaView;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.gms.maps.model.StreetViewSource;
import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class StreetViewCardActivity extends AppCompatActivity {
    private StreetViewPanoramaView panoramaView;
    private TextView panoramaStatus;
    private final ExecutorService geocoderExecutor = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        overridePendingTransition(0, 0);

        String title = value("title", "ANÁLISE");
        double fare = getIntent().getDoubleExtra("fare", 0d);
        String body = value("body", "");
        String status = value("status", "ATENÇÃO");
        String destination = value("destination", "");
        int accent = accent(status);

        FrameLayout screen = new FrameLayout(this);
        screen.setBackgroundColor(Color.TRANSPARENT);
        screen.setOnClickListener(view -> closeCard());

        LinearLayout shell = new LinearLayout(this);
        shell.setOrientation(LinearLayout.HORIZONTAL);
        shell.setClickable(true);
        shell.setOnClickListener(view -> { });
        GradientDrawable shellBackground = new GradientDrawable(
            GradientDrawable.Orientation.LEFT_RIGHT,
            new int[] { Color.rgb(6, 18, 38), Color.rgb(11, 29, 55) }
        );
        shellBackground.setCornerRadius(dp(20));
        shellBackground.setStroke(dp(1), Color.argb(150, 71, 105, 148));
        shell.setBackground(shellBackground);
        shell.setElevation(dp(18));

        View rail = new View(this);
        GradientDrawable railBackground = new GradientDrawable();
        railBackground.setColor(accent);
        railBackground.setCornerRadii(new float[] {
            dp(20), dp(20), 0, 0, 0, 0, dp(20), dp(20)
        });
        rail.setBackground(railBackground);
        shell.addView(rail, new LinearLayout.LayoutParams(dp(5), LinearLayout.LayoutParams.MATCH_PARENT));

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(13), dp(10), dp(10), dp(12));
        shell.addView(content, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        content.addView(header, matchWrap());

        TextView monogram = label("GC", 11, Color.rgb(5, 20, 38), Typeface.BOLD);
        monogram.setGravity(Gravity.CENTER);
        GradientDrawable monogramBackground = new GradientDrawable();
        monogramBackground.setColor(Color.rgb(45, 212, 191));
        monogramBackground.setCornerRadius(dp(9));
        monogram.setBackground(monogramBackground);
        header.addView(monogram, new LinearLayout.LayoutParams(dp(30), dp(30)));

        LinearLayout brand = new LinearLayout(this);
        brand.setOrientation(LinearLayout.VERTICAL);
        brand.setPadding(dp(9), 0, 0, 0);
        TextView brandName = label("COPILOTO GIRO CERTO", 11, Color.WHITE, Typeface.BOLD);
        brandName.setLetterSpacing(0.08f);
        brand.addView(brandName);
        brand.addView(label("Rua do destino", 9, Color.rgb(148, 163, 184), Typeface.NORMAL));
        header.addView(brand, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        TextView close = label("×", 22, Color.rgb(148, 163, 184), Typeface.NORMAL);
        close.setGravity(Gravity.CENTER);
        close.setContentDescription("Fechar imagem da rua");
        close.setOnClickListener(view -> closeCard());
        header.addView(close, new LinearLayout.LayoutParams(dp(34), dp(34)));

        LinearLayout decision = new LinearLayout(this);
        decision.setGravity(Gravity.CENTER_VERTICAL);
        decision.setPadding(0, dp(8), 0, 0);
        content.addView(decision, matchWrap());

        LinearLayout amountBlock = new LinearLayout(this);
        amountBlock.setOrientation(LinearLayout.VERTICAL);
        TextView caption = label("OFERTA", 9, Color.rgb(100, 116, 139), Typeface.BOLD);
        caption.setLetterSpacing(0.12f);
        amountBlock.addView(caption);
        amountBlock.addView(label(
            String.format(Locale.forLanguageTag("pt-BR"), "R$ %.2f", fare),
            25,
            Color.WHITE,
            Typeface.BOLD
        ));
        decision.addView(amountBlock, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        TextView verdict = label(status, 11, accent, Typeface.BOLD);
        verdict.setGravity(Gravity.CENTER);
        verdict.setPadding(dp(12), dp(7), dp(12), dp(7));
        GradientDrawable verdictBackground = new GradientDrawable();
        verdictBackground.setColor(Color.argb(35, Color.red(accent), Color.green(accent), Color.blue(accent)));
        verdictBackground.setStroke(dp(1), Color.argb(150, Color.red(accent), Color.green(accent), Color.blue(accent)));
        verdictBackground.setCornerRadius(dp(14));
        verdict.setBackground(verdictBackground);
        decision.addView(verdict);

        TextView details = label(body, 11, Color.rgb(203, 213, 225), Typeface.NORMAL);
        details.setPadding(0, dp(7), 0, dp(8));
        content.addView(details);

        FrameLayout panoramaHolder = new FrameLayout(this);
        GradientDrawable panoramaBackground = new GradientDrawable();
        panoramaBackground.setColor(Color.rgb(15, 23, 42));
        panoramaBackground.setCornerRadius(dp(14));
        panoramaHolder.setBackground(panoramaBackground);
        panoramaHolder.setClipToOutline(true);
        content.addView(panoramaHolder, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(238)
        ));

        panoramaStatus = label("Localizando a rua do destino…", 11, Color.rgb(203, 213, 225), Typeface.BOLD);
        panoramaStatus.setGravity(Gravity.CENTER);
        panoramaStatus.setPadding(dp(20), dp(20), dp(20), dp(20));
        panoramaHolder.addView(panoramaStatus, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        StreetViewPanoramaOptions options = new StreetViewPanoramaOptions()
            .streetNamesEnabled(true)
            .userNavigationEnabled(true)
            .zoomGesturesEnabled(true)
            .panningGesturesEnabled(true);
        panoramaView = new StreetViewPanoramaView(this, options);
        panoramaView.onCreate(savedInstanceState);
        panoramaHolder.addView(panoramaView, 0, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        TextView destinationView = label(destination, 10, Color.rgb(191, 219, 254), Typeface.NORMAL);
        destinationView.setMaxLines(2);
        destinationView.setPadding(0, dp(8), 0, 0);
        content.addView(destinationView);

        TextView footer = label("TOQUE FORA DO CARD PARA VOLTAR À CORRIDA", 9, Color.rgb(94, 234, 212), Typeface.BOLD);
        footer.setLetterSpacing(0.04f);
        footer.setPadding(0, dp(7), 0, 0);
        content.addView(footer);

        FrameLayout.LayoutParams cardParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.TOP | Gravity.CENTER_HORIZONTAL
        );
        cardParams.setMargins(dp(14), dp(68), dp(14), dp(20));
        screen.addView(shell, cardParams);
        setContentView(screen);

        if (destination.isEmpty()) {
            showPanoramaError("Endereço do destino não identificado nesta oferta.");
        } else {
            locateDestination(destination);
        }
    }

    private void locateDestination(String destination) {
        Geocoder geocoder = new Geocoder(this, Locale.forLanguageTag("pt-BR"));
        if (!Geocoder.isPresent()) {
            showPanoramaError("Imagem da rua indisponível neste aparelho.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            geocoder.getFromLocationName(destination, 1, new Geocoder.GeocodeListener() {
                @Override public void onGeocode(@NonNull List<Address> addresses) {
                    runOnUiThread(() -> showAddress(addresses));
                }

                @Override public void onError(String errorMessage) {
                    showPanoramaError("Não foi possível localizar a rua deste destino.");
                }
            });
            return;
        }
        geocoderExecutor.execute(() -> {
            List<Address> addresses;
            try {
                List<Address> found = geocoder.getFromLocationName(destination, 1);
                addresses = found == null ? Collections.emptyList() : found;
            } catch (IOException | IllegalArgumentException ignored) {
                addresses = Collections.emptyList();
            }
            List<Address> result = addresses;
            runOnUiThread(() -> showAddress(result));
        });
    }

    private void showAddress(List<Address> addresses) {
        if (isFinishing() || isDestroyed()) return;
        if (addresses == null || addresses.isEmpty()) {
            showPanoramaError("Não encontramos uma imagem da rua para este destino.");
            return;
        }
        Address address = addresses.get(0);
        LatLng position = new LatLng(address.getLatitude(), address.getLongitude());
        panoramaView.getStreetViewPanoramaAsync(panorama -> {
            panorama.setOnStreetViewPanoramaChangeListener(location -> {
                if (location == null || location.links == null) {
                    showPanoramaError("O Google ainda não possui Street View próximo deste destino.");
                } else {
                    panoramaStatus.setVisibility(View.GONE);
                }
            });
            panorama.setPosition(position, 120, StreetViewSource.OUTDOOR);
        });
    }

    private void showPanoramaError(String message) {
        runOnUiThread(() -> {
            panoramaStatus.setText(message);
            panoramaStatus.setVisibility(View.VISIBLE);
            panoramaStatus.bringToFront();
        });
    }

    private String value(String key, String fallback) {
        String value = getIntent().getStringExtra(key);
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private int accent(String status) {
        if ("COMPENSA".equals(status)) return Color.rgb(45, 212, 191);
        if ("ATENÇÃO".equals(status)) return Color.rgb(251, 191, 36);
        return Color.rgb(251, 113, 133);
    }

    private TextView label(String text, float size, int color, int style) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setTypeface(Typeface.create("sans-serif", style));
        return view;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void closeCard() {
        finish();
        overridePendingTransition(0, 0);
    }

    @Override protected void onStart() { super.onStart(); panoramaView.onStart(); }
    @Override protected void onResume() { super.onResume(); panoramaView.onResume(); }
    @Override protected void onPause() { panoramaView.onPause(); super.onPause(); }
    @Override protected void onStop() { panoramaView.onStop(); super.onStop(); }

    @Override
    protected void onDestroy() {
        panoramaView.onDestroy();
        geocoderExecutor.shutdownNow();
        super.onDestroy();
    }

    @Override public void onLowMemory() { super.onLowMemory(); panoramaView.onLowMemory(); }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        panoramaView.onSaveInstanceState(outState);
        super.onSaveInstanceState(outState);
    }
}
