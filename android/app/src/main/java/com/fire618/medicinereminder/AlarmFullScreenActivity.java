package com.fire618.medicinereminder;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

/**
 * Trampoline launched by the full-screen intent. Turns the screen on, shows
 * over the lock screen and immediately opens MainActivity with the alarm
 * context set (see FullScreenAlarm.launchReminderId). Back is blocked so the
 * user cannot dismiss the alarm without opening the app.
 */
public class AlarmFullScreenActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        String reminderId = getIntent().getStringExtra(FullScreenAlarm.EXTRA_REMINDER_ID);
        if (reminderId != null) {
            FullScreenAlarm.launchReminderId = reminderId;
        }

        Intent launch = new Intent(this, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(launch);
    }

    @Override
    public void onBackPressed() {
        // Blocked on purpose: the alarm must be handled in the app.
    }

    @Override
    protected void onStop() {
        super.onStop();
        finish();
    }
}