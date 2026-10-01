package tech.domnex.girocerto;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeCoachPlugin.class);
        registerPlugin(RideOfferPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
