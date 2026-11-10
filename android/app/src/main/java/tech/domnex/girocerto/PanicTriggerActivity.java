package tech.domnex.girocerto;

import android.app.Activity;
import android.os.Bundle;

/**
 * Tela invisível usada para disparar o pânico a partir da bolinha flutuante: por regra do
 * Android, câmera e GPS em segundo plano só podem começar com o app visível. Fecha na hora.
 */
public class PanicTriggerActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        PanicService.trigger(this);
        finish();
        overridePendingTransition(0, 0);
    }
}
