import { Capacitor, registerPlugin } from '@capacitor/core';

type Permission = 'granted' | 'denied' | 'prompt' | 'unavailable';

const plugin = registerPlugin<{
  biometricStatus(): Promise<{ available: boolean }>;
  authenticate(): Promise<void>;
  notificationPermission(): Promise<{ state: Permission }>;
  requestNotifications(): Promise<{ state: Permission }>;
  showNotification(): Promise<void>;
}>('DeviceFeatures');

export const isNativeDevice = Capacitor.isNativePlatform();

export const deviceFeatures = {
  async biometricsAvailable() {
    if (!isNativeDevice) return false;
    return (await plugin.biometricStatus()).available;
  },
  authenticate: () => plugin.authenticate(),

  async notificationPermission(request = false): Promise<Permission> {
    if (isNativeDevice) return (await (request ? plugin.requestNotifications() : plugin.notificationPermission())).state;
    if (typeof Notification === 'undefined' || !window.isSecureContext) return 'unavailable';
    const permission = request && Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    return permission === 'default' ? 'prompt' : permission;
  },

  async showNotification() {
    if (isNativeDevice) await plugin.showNotification();
    else if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      new Notification('Neuro Touch', { body: 'New device activity. Open Neuro Touch for details.', tag: 'device-alerts' });
    }
  },
};
