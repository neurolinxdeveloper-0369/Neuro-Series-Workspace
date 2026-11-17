import { useEffect, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { deviceFeatures, isNativeDevice } from '../services/deviceFeatures';

const key = (account: string) => 'neuro_biometrics:' + account;

export function useBiometricLock(account?: string) {
  const enabledFor = (id?: string) => Boolean(isNativeDevice && id && localStorage.getItem(key(id)) === 'enabled');
  const [preference, setPreference] = useState(() => ({ account, enabled: enabledFor(account) }));
  const [unlockedAccount, setUnlockedAccount] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const authenticating = useRef(false);
  const currentAccount = useRef(account);
  useEffect(() => { currentAccount.current = account; }, [account]);

  const enabled = preference.account === account ? preference.enabled : enabledFor(account);
  const locked = !!account && enabled && account !== unlockedAccount;

  useEffect(() => {
    if (!isNativeDevice || !enabled || !account) return;
    let disposed = false;
    const change = (active: boolean) => {
      if (!disposed && !active && !authenticating.current) setUnlockedAccount(undefined);
    };
    const listeners = [
      NativeApp.addListener('appStateChange', ({ isActive }) => change(isActive)),
      NativeApp.addListener('pause', () => { if (!disposed) setUnlockedAccount(undefined); }),
    ];
    const hide = () => { if (document.hidden) change(false); };
    document.addEventListener('visibilitychange', hide);
    listeners.forEach(listener => { void listener.catch(() => {}); });
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', hide);
      listeners.forEach(listener => { void listener.then(handle => handle.remove(), () => {}); });
    };
  }, [account, enabled]);

  async function authenticate(nextEnabled?: boolean) {
    if (!account || authenticating.current || !isNativeDevice) return;
    authenticating.current = true;
    setBusy(true);
    setError('');
    try {
      if (!await deviceFeatures.biometricsAvailable()) throw new Error('Biometrics unavailable');
      await deviceFeatures.authenticate();
      if (currentAccount.current !== account) return;
      if (nextEnabled !== undefined) {
        if (nextEnabled) localStorage.setItem(key(account), 'enabled');
        else localStorage.removeItem(key(account));
        setPreference({ account, enabled: nextEnabled });
      }
      setUnlockedAccount(account);
    } catch {
      setError('Unlock failed. Check facial recognition or fingerprint enrollment in system settings, then try again.');
    } finally {
      authenticating.current = false;
      setBusy(false);
    }
  }

  return {
    supported: isNativeDevice, enabled, locked, busy, error,
    unlock: () => authenticate(),
    setEnabled: (value: boolean) => authenticate(value),
    resetUnlock: () => setUnlockedAccount(undefined),
    resetForAccountRecovery: () => {
      if (account) localStorage.removeItem(key(account));
      setPreference({ account, enabled: false });
      setUnlockedAccount(undefined);
    },
  };
}
