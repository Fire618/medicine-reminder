package com.fire618.medicinereminder;

import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FullScreenAlarm.class);
        super.onCreate(savedInstanceState);
        // Keep the alarm screen visible above the lock screen.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
    }

    @Override
    public void onBackPressed() {
        // While a forced alarm is ringing the user must take the photo first —
        // pressing Back is a no-op so the alarm cannot be escaped.
        if (FullScreenAlarm.activeAlarmId != null) return;
        super.onBackPressed();
    }
}
