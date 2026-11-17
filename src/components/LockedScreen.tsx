import { LockKeyhole } from 'lucide-react';
import type { useBiometricLock } from '../hooks/useBiometricLock';

export function LockedScreen({ lock, onSignOut }: { lock: ReturnType<typeof useBiometricLock>; onSignOut: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--app-background)] p-5 text-slate-900">
      <section className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm">
        <LockKeyhole className="mx-auto size-8 text-sky-700" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-bold">Neuro Series is locked</h1>
        <p className="mt-2 text-sm text-slate-600">Use your enrolled face or fingerprint to continue.</p>
        {lock.error && <p role="alert" className="mt-3 text-sm text-rose-800">{lock.error}</p>}
        <button type="button" disabled={lock.busy} onClick={() => void lock.unlock()} className="mt-4 min-h-11 w-full rounded-xl bg-sky-700 px-4 font-semibold text-white">Unlock</button>
        <button type="button" disabled={lock.busy} onClick={onSignOut} className="mt-2 min-h-11 w-full text-sm font-semibold text-rose-700">Sign out and use account sign-in</button>
      </section>
    </main>
  );
}
