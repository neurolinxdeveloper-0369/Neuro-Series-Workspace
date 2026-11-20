package in.neurolinx.neuroseries;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "DeviceFeatures", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class DeviceFeaturesPlugin extends Plugin {
    private static final String CHANNEL = "device-alerts";

    private boolean biometricsAvailable() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false;
        BiometricManager manager = getContext().getSystemService(BiometricManager.class);
        if (manager == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL) == BiometricManager.BIOMETRIC_SUCCESS;
        }
        return manager.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS;
    }

    @PluginMethod
    public void biometricStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", biometricsAvailable());
        call.resolve(result);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!biometricsAvailable()) {
                call.reject("Enroll fingerprint or face authentication in Android Settings.");
                return;
            }
            try {
                AtomicBoolean finished = new AtomicBoolean();
                BiometricPrompt.Builder builder = new BiometricPrompt.Builder(getActivity())
                    .setTitle("Unlock Neuro Touch");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    builder.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
                } else {
                    builder.setNegativeButton("Cancel", getContext().getMainExecutor(), (dialog, which) -> {
                        if (finished.compareAndSet(false, true)) call.reject("Authentication cancelled");
                    });
                }
                builder.build().authenticate(new CancellationSignal(), getContext().getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                    @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        if (finished.compareAndSet(false, true)) call.resolve();
                    }
                    @Override public void onAuthenticationError(int errorCode, CharSequence reason) {
                        if (finished.compareAndSet(false, true)) call.reject(reason.toString());
                    }
                });
            } catch (RuntimeException error) {
                call.reject("Unable to start biometric authentication");
            }
        });
    }

    @PluginMethod
    public void notificationPermission(PluginCall call) {
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        String state = "denied";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") != PermissionState.GRANTED) {
            PermissionState permission = getPermissionState("notifications");
            state = permission == PermissionState.DENIED ? "denied" : "prompt";
        } else if (manager != null && manager.areNotificationsEnabled()) {
            state = "granted";
        }
        JSObject result = new JSObject();
        result.put("state", state);
        call.resolve(result);
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermissionResult");
        } else {
            notificationPermission(call);
        }
    }

    @PermissionCallback
    private void notificationPermissionResult(PluginCall call) {
        notificationPermission(call);
    }

    @PluginMethod
    public void showNotification(PluginCall call) {
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        if (manager == null || !manager.areNotificationsEnabled() ||
            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") != PermissionState.GRANTED)) {
            call.resolve();
            return;
        }
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Device alerts", NotificationManager.IMPORTANCE_DEFAULT));
            builder = new Notification.Builder(getContext(), CHANNEL);
        } else {
            builder = new Notification.Builder(getContext());
        }
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open = PendingIntent.getActivity(getContext(), 0, intent, PendingIntent.FLAG_IMMUTABLE);
        Notification notification = builder.setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Neuro Series")
            .setContentText("New device activity. Open Neuro Series for details.")
            .setContentIntent(open).setAutoCancel(true).build();
        manager.notify(CHANNEL, 1, notification);
        call.resolve();
    }
}
