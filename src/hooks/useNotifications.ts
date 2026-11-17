import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { deviceFeatures } from '../services/deviceFeatures';

export interface DeviceNotification {
  id: string;
  device_name: string;
  home_name: string;
  kind: 'offline' | 'online' | 'alert';
  created_at: string;
  read: boolean;
}

export function useNotifications(account?: string) {
  const [entries, setEntries] = useState<{ account?: string; items: DeviceNotification[] }>({ items: [] });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const prefKey = 'neuro_system_alerts:' + account;
  const [permission, setPermission] = useState('prompt');
  const [pref, setPref] = useState<{ account?: string; enabled: boolean }>();
  const enabled = !!account && (pref?.account === account ? !!pref?.enabled : localStorage.getItem(prefKey) === 'on');
  const lastSeen = useRef<{ account: string; id: bigint } | null>(null);
  const items = entries.account === account ? entries.items : [];

  useEffect(() => {
    if (!account) return;
    let active = true;
    void deviceFeatures.notificationPermission().then(state => { if (active) setPermission(state); }, () => { if (active) setPermission('unavailable'); });
    return () => { active = false; };
  }, [account]);

  useEffect(() => {
    if (!account) return;
    let active = true;
    let busy = false;
    async function load() {
      if (busy) return;
      busy = true;
      try {
        const response = await api.get<{ notifications: DeviceNotification[] }>('/notifications');
        if (!active || !account) return;
        const incoming = response.notifications;
        if (!Array.isArray(incoming)) throw new Error('Unexpected notification response');
        setEntries({ account, items: incoming });
        setError('');
        const latest = incoming[0]?.id ? BigInt(incoming[0].id) : null;
        const previous = lastSeen.current;
        if (latest !== null) {
          if (enabled && previous?.account === account && latest > previous.id && incoming.some(item => !item.read && BigInt(item.id) > previous.id)) {
            void deviceFeatures.showNotification().catch(() => {});
          }
          lastSeen.current = { account, id: latest };
        } else if (previous?.account !== account) {
          lastSeen.current = { account, id: 0n };
        }
      } catch {
        if (active) setError('Notifications could not be refreshed.');
      } finally {
        busy = false;
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), 15000);
    window.addEventListener('focus', load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, [account, enabled, refresh]);

  async function setSystemEnabled(value: boolean) {
    if (!account) return;
    setNotice('');
    try {
      const state = value ? await deviceFeatures.notificationPermission(true) : permission;
      setPermission(state);
      const checked = value && state === 'granted';
      localStorage.setItem(prefKey, checked ? 'on' : 'off');
      setPref({ account, enabled: checked });
      if (value && !checked) setNotice('System alerts are unavailable or disabled. Check notification permissions in system settings.');
    } catch {
      setNotice('Could not change system alerts. Check notification permissions in system settings.');
    }
  }

  async function markRead(ids: string[]) {
    try {
      await api.post('/notifications/read', { ids });
      setEntries(previous => previous.account === account ? {
        ...previous, items: previous.items.map(item => ids.includes(item.id) ? { ...item, read: true } : item),
      } : previous);
      setRefresh(value => value + 1);
    } catch {
      setError('Could not mark notifications as read.');
    }
  }

  return { items, unread: items.filter(item => !item.read).length, error, notice, enabled, setSystemEnabled, markRead, refresh: () => setRefresh(value => value + 1) };
}
