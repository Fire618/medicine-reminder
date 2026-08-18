package com.fire618.medicinereminder;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

import java.util.List;

/**
 * Receives OS alarm broadcasts. Forced alarms (gentle = false) play the loud
 * ringtone, post a full-screen intent notification and re-arm themselves every
 * 60 seconds so they keep nagging until the dose is confirmed. Gentle
 * reminders just post a normal audible notification. Also restores all alarms
 * after a reboot.
 */
public class AlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            restoreAfterReboot(context);
            return;
        }
        if (!FullScreenAlarm.ACTION_ALARM.equals(intent.getAction())) return;

        String reminderId = intent.getStringExtra(FullScreenAlarm.EXTRA_REMINDER_ID);
        if (reminderId == null) return;
        String title = intent.getStringExtra(FullScreenAlarm.EXTRA_TITLE);
        if (title == null) title = "Medicine Reminder";
        String body = intent.getStringExtra(FullScreenAlarm.EXTRA_BODY);
        if (body == null) body = "";
        boolean gentle = intent.getBooleanExtra(FullScreenAlarm.EXTRA_GENTLE, false);

        ensureChannel(context);

        if (gentle) {
            NotificationManagerCompat.from(context)
                .notify(FullScreenAlarm.idFrom(reminderId), buildNotification(context, reminderId, title, body, false));
            return;
        }

        FullScreenAlarm.setActiveAlarm(context, reminderId);
        FullScreenAlarm.startRingtone(context);
        postFullScreen(context, reminderId, title, body);
        reArm(context, reminderId, title, body);
    }

    private void postFullScreen(Context context, String reminderId, String title, String body) {
        Intent full = new Intent(context, AlarmFullScreenActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(FullScreenAlarm.EXTRA_REMINDER_ID, reminderId);
        PendingIntent fullPi = PendingIntent.getActivity(
            context,
            FullScreenAlarm.idFrom(reminderId) + 1000,
            full,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Intent app = new Intent(context, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent appPi = PendingIntent.getActivity(
            context,
            FullScreenAlarm.idFrom(reminderId) + 2000,
            app,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder b = new NotificationCompat.Builder(context, FullScreenAlarm.CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullPi, true)
            .setContentIntent(appPi);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        try {
            nm.notify(FullScreenAlarm.idFrom(reminderId), b.build());
        } catch (SecurityException e) {
            b.setFullScreenIntent(null, false);
            nm.notify(FullScreenAlarm.idFrom(reminderId), b.build());
        }
    }

    private Notification buildNotification(Context context, String reminderId, String title, String body, boolean fullScreen) {
        NotificationCompat.Builder b = new NotificationCompat.Builder(context, FullScreenAlarm.CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true);
        if (fullScreen) {
            Intent full = new Intent(context, AlarmFullScreenActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(FullScreenAlarm.EXTRA_REMINDER_ID, reminderId);
            PendingIntent fullPi = PendingIntent.getActivity(
                context,
                FullScreenAlarm.idFrom(reminderId) + 1000,
                full,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            b.setFullScreenIntent(fullPi, true);
        }
        Intent app = new Intent(context, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent appPi = PendingIntent.getActivity(
            context,
            FullScreenAlarm.idFrom(reminderId) + 2000,
            app,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        b.setContentIntent(appPi);
        return b.build();
    }

    private void reArm(Context context, String reminderId, String title, String body) {
        PendingIntent pi = FullScreenAlarm.alarmPendingIntent(context, reminderId, title, body, false);
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        try {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + FullScreenAlarm.REARM_MS, pi);
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + FullScreenAlarm.REARM_MS, pi);
        }
    }

    private void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.app.NotificationChannel channel = new android.app.NotificationChannel(
                FullScreenAlarm.CHANNEL_ID,
                "Medicine alarms",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Forced medicine reminders");
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            nm.createNotificationChannel(channel);
        }
    }

    private void restoreAfterReboot(Context context) {
        List<JSONObject> alarms = FullScreenAlarm.storedAlarms(context);
        for (JSONObject a : alarms) {
            String reminderId = a.optString("reminderId");
            if (reminderId.isEmpty()) continue;
            long at = a.optLong("at");
            if (at <= System.currentTimeMillis()) continue;
            String title = a.optString("title", "Medicine Reminder");
            String body = a.optString("body", "");
            boolean gentle = a.optBoolean("gentle");
            FullScreenAlarm.scheduleAlarm(context, reminderId, at, title, body, gentle);
        }
    }
}