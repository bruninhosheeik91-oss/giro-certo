package tech.domnex.girocerto;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Toast;

/**
 * Tela invisível aberta pelo atalho "Gravar câmera" do ícone do app.
 * Liga ou desliga a câmera de segurança. Sem permissão, abre o Giro Certo na aba Segurança.
 */
public class CameraShortcutActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!SecurityCameraService.hasCameraPermission(this)) {
            getSharedPreferences(SecurityCameraService.PREFS, MODE_PRIVATE)
                .edit().putBoolean("openSecurityTab", true).apply();
            startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            Toast.makeText(this, "Permita a câmera na aba Segurança", Toast.LENGTH_SHORT).show();
        } else if (SecurityCameraService.isRecording(this)) {
            SecurityCameraService.stop(this);
        } else {
            SecurityCameraService.start(this);
        }
        finish();
        overridePendingTransition(0, 0);
    }
}
