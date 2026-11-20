import { useState } from 'react';
import { Eye, EyeOff, Wifi } from 'lucide-react';
import { homeApi, type Home } from '../services/home';

export function HomeWifiSettings({ home, onSaved }: { home: Home; onSaved: (home: Home) => void }) {
  const [ssid, setSsid] = useState(home.default_wifi_ssid || '');
  const [password, setPassword] = useState('');
  const [openNetwork, setOpenNetwork] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  return <section className="rounded-3xl bg-white p-5 shadow-sm">
    <h2 className="flex items-center gap-2 font-semibold"><Wifi className="size-5 text-sky-600" />Home Wi-Fi network</h2>
    <p className="mt-2 text-sm text-slate-600">Update the saved network for {home.name}. These details will be used for future device setup. Existing devices need to be reconnected separately.</p>
    <form className="mt-4 space-y-3" onSubmit={async event => {
      event.preventDefault(); if (busy) return; setError(''); setMessage('');
      if (!ssid.trim() || new TextEncoder().encode(ssid).length > 32) { setError('Enter a Wi-Fi name of up to 32 bytes.'); return; }
      if (!openNetwork && !password && (ssid !== home.default_wifi_ssid || !home.has_wifi_configured)) { setError('Enter the new network password, or select a network with no password.'); return; }
      if (!openNetwork && password && !((password.length >= 8 && password.length <= 63) || /^[a-fA-F0-9]{64}$/.test(password))) { setError('Use an 8–63 character password or a 64-digit hexadecimal key.'); return; }
      setBusy(true);
      try {
        const updated = await homeApi.updateHomeWifi(home.id, ssid, openNetwork ? '' : password || undefined);
        onSaved(updated); setPassword(''); setVisible(false); setOpenNetwork(false); setMessage('Home Wi-Fi details saved.');
      } catch (err) { setError(err instanceof Error ? err.message.replace(/^API Error \[\d+\]:\s*/i, '') : 'Could not save Wi-Fi details. Try again.'); }
      finally { setBusy(false); }
    }}>
      <label className="block text-sm font-semibold">Wi-Fi network name (SSID)<input value={ssid} disabled={busy} onChange={event => setSsid(event.target.value)} autoComplete="off" required className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-normal" /></label>
      <label className="block text-sm font-semibold">Wi-Fi password<div className="mt-1 flex min-h-11 rounded-xl border border-slate-200 bg-slate-50"><input type={visible ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} disabled={busy || openNetwork} autoComplete="new-password" placeholder="Enter a new password" className="min-w-0 flex-1 bg-transparent px-3 font-normal" /><button type="button" onClick={() => setVisible(value => !value)} disabled={busy || openNetwork} aria-label={visible ? 'Hide Wi-Fi password' : 'Show Wi-Fi password'} className="grid size-11 place-items-center text-slate-500">{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>
      <p className="text-xs text-slate-500">Leave the password blank to keep it when the network name stays the same.</p>
      <label className="flex min-h-11 items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={openNetwork} disabled={busy} onChange={event => setOpenNetwork(event.target.checked)} />This network has no password</label>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-sky-600 px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save home Wi-Fi'}</button>
    </form>
  </section>;
}
