package com.fire618.medicinereminder;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import androidx.activity.result.ActivityResult;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Custom Capacitor plugin that schedules real OS alarms using
 * AlarmManager.setAlarmClock() — exact, works in Doze and through silent/DND,
 * and keeps firing even when the app process is killed. When an alarm fires,
 * AlarmReceiver posts a full-screen intent notification that takes over the
 * screen until the dose is confirmed.
 */
@CapacitorPlugin(name = "FullScreenAlarm")
public class FullScreenAlarm extends Plugin {

    public static final String PREFS = "full_screen_alarm";
    public static final String KEY_ALARMS = "alarms";
    public static final String EXTRA_REMINDER_ID = "extra_reminder_id";
    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_BODY = "extra_body";
    public static final String EXTRA_GENTLE = "extra_gentle";
    public static final String ACTION_ALARM = "com.fire618.medicinereminder.ALARM";
    public static final String CHANNEL_ID = "medicine_alarms";
    public static final long REARM_MS = 60_000L;

    /** Set when the app is opened by a native alarm; consumed by JS on launch/resume. */
    public static volatile String launchReminderId = null;

    /** Non-null while a forced alarm is ringing; cleared when the dose is confirmed. */
    public static volatile String activeAlarmId = null;

    private static MediaPlayer ringtone = null;
    private static PowerManager.WakeLock wakeLock = null;

    /** Marks a forced alarm as active and keeps the screen on/lit so the user
     *  cannot turn it off with the power button until the dose is confirmed. */
    public static void setActiveAlarm(Context context, String reminderId) {
        activeAlarmId = reminderId;
        acquireWakeLock(context);
    }

    private static void acquireWakeLock(Context context) {
        try {
            if (wakeLock != null) return;
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            wakeLock = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK
                    | PowerManager.ACQUIRE_CAUSES_WAKEUP
                    | PowerManager.ON_AFTER_RELEASE,
                "medicine-reminder:alarm"
            );
            // Renewed on every re-arm, so the alarm keeps the screen on until done.
            wakeLock.acquire(30 * 60 * 1000L);
        } catch (Exception ignored) {
        }
    }

    private static void releaseWakeLock() {
        if (wakeLock != null) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {
            }
            wakeLock = null;
        }
    }

    public static int idFrom(String reminderId) {
        return reminderId.hashCode() & 0x7fffffff;
    }

    public static void stopRingtone() {
        MediaPlayer player = ringtone;
        ringtone = null;
        if (player != null) {
            try {
                if (player.isPlaying()) player.stop();
            } catch (Exception ignored) {
            }
            player.release();
        }
    }

    public static void startRingtone(Context context) {
        stopRingtone();
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            MediaPlayer player = new MediaPlayer();
            player.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build()
            );
            player.setDataSource(context, uri);
            player.setLooping(true);
            player.prepare();
            player.start();
            ringtone = player;
        } catch (Exception ignored) {
            ringtone = null;
        }
    }

    private static Intent alarmIntent(Context context, String reminderId, String title, String body, boolean gentle) {
        return new Intent(context, AlarmReceiver.class)
            .setAction(ACTION_ALARM)
            .putExtra(EXTRA_REMINDER_ID, reminderId)
            .putExtra(EXTRA_TITLE, title)
            .putExtra(EXTRA_BODY, body)
            .putExtra(EXTRA_GENTLE, gentle);
    }

    static PendingIntent alarmPendingIntent(Context context, String reminderId, String title, String body, boolean gentle) {
        return PendingIntent.getBroadcast(
            context,
            idFrom(reminderId),
            alarmIntent(context, reminderId, title, body, gentle),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    public static List<JSONObject> storedAlarms(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_ALARMS, "[]");
        JSONArray arr;
        try {
            arr = new JSONArray(raw);
        } catch (Exception e) {
            arr = new JSONArray();
        }
        List<JSONObject> list = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null) list.add(o);
        }
        return list;
    }

    public static void scheduleAlarm(Context context, String reminderId, long at, String title, String body, boolean gentle) {
        PendingIntent pi = alarmPendingIntent(context, reminderId, title, body, gentle);
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        try {
            if (at <= System.currentTimeMillis()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 500, pi);
            } else {
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, pi), pi);
            }
        } catch (Exception e) {
            try {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } catch (Exception ignored) {
            }
        }
        saveAlarm(context, reminderId, at, title, body, gentle);
    }

    private static void saveAlarm(Context context, String reminderId, long at, String title, String body, boolean gentle) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_ALARMS, "[]");
        JSONArray arr;
        try {
            arr = new JSONArray(raw);
        } catch (Exception e) {
            arr = new JSONArray();
        }
        JSONArray out = new JSONArray();
        boolean found = false;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o == null) continue;
            if (reminderId.equals(o.optString("reminderId"))) {
                try {
                    o.put("at", at).put("title", title).put("body", body).put("gentle", gentle);
                } catch (Exception ignored) {
                }
                found = true;
            }
            out.put(o);
        }
        if (!found) {
            JSONObject o = new JSONObject();
            try {
                o.put("reminderId", reminderId)
                    .put("at", at)
                    .put("title", title)
                    .put("body", body)
                    .put("gentle", gentle);
            } catch (Exception ignored) {
            }
            out.put(o);
        }
        prefs.edit().putString(KEY_ALARMS, out.toString()).apply();
    }

    public static void cancel(Context context, String reminderId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_ALARMS, "[]");
        JSONArray arr;
        try {
            arr = new JSONArray(raw);
        } catch (Exception e) {
            arr = new JSONArray();
        }
        JSONArray out = new JSONArray();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o == null) continue;
            if (!reminderId.equals(o.optString("reminderId"))) out.put(o);
        }
        prefs.edit().putString(KEY_ALARMS, out.toString()).apply();

        PendingIntent pi = alarmPendingIntent(context, reminderId, "Medicine Reminder", "", false);
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        am.cancel(pi);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(idFrom(reminderId));
        stopRingtone();
        if (reminderId.equals(activeAlarmId)) {
            activeAlarmId = null;
            releaseWakeLock();
        }
    }

    private static boolean isFullScreenAllowed(Context context) {
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                return nm.canUseFullScreenIntent();
            } catch (Exception e) {
                return true;
            }
        }
        return true;
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        String reminderId = call.getString("reminderId");
        if (reminderId == null) {
            call.reject("missing reminderId");
            return;
        }
        Long at = call.getLong("at");
        if (at == null) {
            call.reject("missing at");
            return;
        }
        String title = call.getString("title");
        if (title == null) title = "Medicine Reminder";
        String body = call.getString("body");
        if (body == null) body = "";
        boolean gentle = call.getBoolean("gentle", false);
        scheduleAlarm(getContext(), reminderId, at, title, body, gentle);
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String reminderId = call.getString("reminderId");
        if (reminderId != null) cancel(getContext(), reminderId);
        call.resolve();
    }

    @PluginMethod
    public void stopRingtone(PluginCall call) {
        stopRingtone();
        call.resolve();
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        for (JSONObject a : storedAlarms(getContext())) {
            String rid = a.optString("reminderId");
            if (!rid.isEmpty()) cancel(getContext(), rid);
        }
        call.resolve();
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSArray arr = new JSArray();
        long now = System.currentTimeMillis();
        for (JSONObject a : storedAlarms(getContext())) {
            JSObject obj = new JSObject();
            obj.put("reminderId", a.optString("reminderId"));
            obj.put("at", a.optLong("at"));
            obj.put("title", a.optString("title"));
            obj.put("body", a.optString("body"));
            obj.put("gentle", a.optBoolean("gentle"));
            obj.put("future", a.optLong("at") > now);
            arr.put(obj);
        }
        JSObject ret = new JSObject();
        ret.put("alarms", arr);
        call.resolve(ret);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        JSObject ret = new JSObject();
        ret.put("notifications", nm.areNotificationsEnabled() ? "granted" : "denied");
        ret.put("exactAlarm", canExactAlarm() ? "granted" : "denied");
        ret.put("fullScreen", isFullScreenAllowed(getContext()));
        ret.put("pending", storedAlarms(getContext()).size());
        call.resolve(ret);
    }

    private boolean canExactAlarm() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            return am.canScheduleExactAlarms();
        }
        return true;
    }

    @PluginMethod
    public void isFullScreenAllowed(PluginCall call) {
        call.resolve(new JSObject().put("allowed", isFullScreenAllowed(getContext())));
    }

    @PluginMethod
    public void requestFullScreen(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 34 && !isFullScreenAllowed(getContext())) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                Uri.parse("package:" + getBridge().getActivity().getPackageName())
            );
            startActivityForResult(call, intent, "requestFullScreenCallback");
        } else {
            call.resolve(new JSObject().put("allowed", true));
        }
    }

    @ActivityCallback
    private void requestFullScreenCallback(PluginCall call, ActivityResult result) {
        call.resolve(new JSObject().put("allowed", isFullScreenAllowed(getContext())));
    }

    @PluginMethod
    public void isAlarmActive(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("active", activeAlarmId != null);
        if (activeAlarmId != null) ret.put("reminderId", activeAlarmId);
        call.resolve(ret);
    }

    /**
     * While a forced alarm is on screen, keeps the display on and hides the
     * status/navigation bars (immersive mode) so the user stays on the alarm
     * until the dose is confirmed. Toggled off by JS when the dose is done.
     */
    @PluginMethod
    public void setAlarmUi(PluginCall call) {
        boolean on = call.getBoolean("on", false);
        if (getActivity() == null) {
            call.resolve();
            return;
        }
        // Capacitor invokes plugin methods on a background handler thread, but
        // window/view calls must run on the main thread or the process crashes.
        getActivity().runOnUiThread(() -> {
            View decor = getActivity().getWindow().getDecorView();
            if (on) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                decor.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                );
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
            }
        });
        call.resolve();
    }

    @PluginMethod
    public void consumeLaunchReminder(PluginCall call) {
        String id = launchReminderId;
        launchReminderId = null;
        JSObject ret = new JSObject();
        if (id != null) ret.put("reminderId", id);
        call.resolve(ret);
    }
}