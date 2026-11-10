package tech.domnex.girocerto;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeCoachPlugin.class);
        registerPlugin(RideOfferPlugin.class);
        registerPlugin(SecurityCameraPlugin.class);
        super.onCreate(savedInstanceState);
        if (FloatingButtonService.isEnabled(this)) FloatingButtonService.setEnabled(this, true);
    }

    @Override
    public void onResume() {
        super.onResume();
        FloatingButtonService.onAppVisibilityChanged(true);
    }

    @Override
    public void onPause() {
        FloatingButtonService.onAppVisibilityChanged(false);
        super.onPause();
    }
}
