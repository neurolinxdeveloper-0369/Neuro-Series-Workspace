import { useState, type FormEvent } from 'react';
import { homeApi } from '../services/home';

export function JoinHomeDialog({ initialCode, onJoined, onClose }: {
  initialCode: string;
  onJoined: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [input, setInput] = useState(initialCode);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function join(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    let code = value;
    try { code = new URLSearchParams(new URL(value).hash.slice(1)).get('invite') ?? ''; } catch {}
    if (!/^[A-Za-z0-9_-]{32}$/.test(code)) {
      setError('Paste a valid invitation link or app invite code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const id = await homeApi.joinLocation(code);
      await onJoined(id);
    } catch {
      setError('Could not join. The invitation may have expired, already been used, or belong to a different account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-300/55 p-4" role="dialog" aria-modal="true" aria-labelledby="join-title">
      <form onSubmit={join} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-5 text-slate-900 sm:p-6">
        <h2 id="join-title" className="text-lg font-bold">Join a location</h2>
        <label className="grid gap-1.5 text-sm font-medium">
          Invitation link or code
          <input value={input} onChange={event => setInput(event.target.value)} required autoFocus
            className="min-h-11 rounded-xl border border-slate-300 px-3 text-base" />
        </label>
        {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Joining?' : 'Join location'}
          </button>
        </div>
      </form>
    </div>
  );
}
