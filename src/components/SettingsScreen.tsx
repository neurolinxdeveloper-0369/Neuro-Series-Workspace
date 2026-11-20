import type { useBiometricLock } from '../hooks/useBiometricLock';
import type { useNotifications } from '../hooks/useNotifications';
import { ArrowLeft, LogOut } from 'lucide-react';

interface SettingsScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSignIn: () => void;
  isSignedIn?: boolean;
  currentUser?: {
    full_name?: string | null;
    email?: string | null;
    phone_number?: string | null;
    avatar_url?: string | null;
  } | null;
  onSignOut?: () => void;
  onNotifications: () => void;
  lock: ReturnType<typeof useBiometricLock>;
  notifications: ReturnType<typeof useNotifications>;
}

export function SettingsScreen({ isOpen, onClose, onOpenSignIn, isSignedIn, currentUser, onSignOut, onNotifications, lock, notifications }: SettingsScreenProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--app-background)] text-slate-900" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header className="sticky top-0 flex items-center gap-3 border-b border-slate-200 bg-[var(--app-background)] px-4 pb-3 pt-[calc(0.75rem+var(--safe-inset-top))] sm:px-6">
        <button type="button" aria-label="Close settings" onClick={onClose}
          className="grid size-11 place-items-center rounded-full bg-white">
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <h1 id="settings-title" className="text-lg font-bold">Neuro Touch Settings</h1>
      </header>
      <main className="mx-auto grid w-full max-w-lg gap-4 px-4 py-5 pb-[calc(1.25rem+var(--nav-inset-bottom))] sm:px-6">
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">{isSignedIn ? currentUser?.full_name || 'Your account' : 'Your account'}</h2>
          <p className="mt-1 break-words text-sm text-slate-600">
            {isSignedIn ? currentUser?.email || currentUser?.phone_number : 'Sign in to manage locations and devices.'}
          </p>
          {isSignedIn ? (
            <button type="button" onClick={() => { onSignOut?.(); onClose(); }} className="mt-2 flex min-h-11 items-center gap-2 text-sm font-semibold text-rose-700">
              <LogOut className="size-4" aria-hidden="true" /> Sign out
            </button>
          ) : (
            <button type="button" onClick={onOpenSignIn} className="mt-3 min-h-11 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white">
              Sign in
            </button>
          )}
        </section>
        {isSignedIn && (
          <>
            <section className="space-y-2 rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Notifications</h2>
              <p className="text-sm text-slate-700">Device activity is saved in the app. System alerts depend on your device or browser permissions.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onNotifications} className="min-h-11 rounded-xl bg-slate-100 px-3 text-sm font-semibold">View notifications</button>
                <button type="button" onClick={() => void notifications.setSystemEnabled(!notifications.enabled)}
                  className="min-h-11 rounded-xl bg-slate-100 px-3 text-sm font-semibold">
                  {notifications.enabled ? 'Turn off system alerts' : 'Enable system alerts'}
                </button>
              </div>
              {notifications.notice && <p role="status" className="text-sm text-slate-700">{notifications.notice}</p>}
            </section>
            <section className="space-y-2 rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="font-semibold">Biometric lock</h2>
              <p className="text-sm text-slate-700">
                {lock.supported ? 'Require your enrolled face or fingerprint each time you return to the app.' : 'Available in the installed Android and iOS apps.'}
              </p>
              {lock.supported && <button type="button" disabled={lock.busy} onClick={() => void lock.setEnabled(!lock.enabled)}
                className="min-h-11 rounded-xl bg-slate-100 px-3 text-sm font-semibold">
                {lock.enabled ? 'Turn off biometric lock' : 'Enable biometric lock'}
              </button>}
              {lock.error && <p role="alert" className="text-sm text-rose-800">{lock.error}</p>}
            </section>
          </>
        )}
        <section className="space-y-2 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Device permissions</h2>
          <p className="text-sm leading-relaxed text-slate-700">
            Manage permissions in your device or browser settings. Neuro Touch uses the camera for QR scanning, the microphone for voice input, and location for setup.
          </p>
        </section>
      </main>
    </div>
  );
}
