import { useState } from 'react';
import { Modal } from './Modal';

export function DeviceRecovery({ name, lastSeen, online, onRefresh, onClose }:
  { name: string; lastSeen?: string; online: boolean; onRefresh: () => Promise<void>; onClose: () => void }) {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState('');
  async function refresh() {
    setChecking(true);
    setStatus('');
    try {
      await onRefresh();
      setStatus('Connection status refreshed.');
    } catch {
      setStatus('Could not refresh. Check your internet connection and try again.');
    } finally {
      setChecking(false);
    }
  }
  return <Modal title={'Connection help for ' + name} onClose={onClose}>
    <p className="text-sm font-semibold">{online ? 'Online' : 'Offline'}</p>
    <p className="mt-1 text-sm text-slate-600">{lastSeen ? 'Last seen ' + new Date(lastSeen).toLocaleString() : 'This device has not reported a connection yet.'}</p>
    <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-700">
      <li>Check that the device has power and your router is reachable. If the network details stayed the same, allow the device time to reconnect and refresh its status.</li>
      <li>After a router replacement, you can reuse the previous 2.4 GHz Wi-Fi name and password on the new router if appropriate. Many devices reconnect automatically when the network details match.</li>
      <li>If the Wi-Fi name or password changed, open your model?s setup instructions and select its Wi-Fi reconfiguration or setup mode. Keep the existing device record so you can check its routines and history.</li>
      <li>If the model only supports new-device pairing, check with support before resetting or deleting the original device. First confirm how that model keeps its identity and routine assignments.</li>
    </ol>
    <button type="button" disabled={checking} onClick={() => void refresh()} className="mt-4 min-h-11 rounded-lg bg-sky-700 px-3 text-sm font-semibold text-white">{checking ? 'Checking?' : 'Refresh connection status'}</button>
    {status && <p role="status" className="mt-2 text-sm text-slate-700">{status}</p>}
  </Modal>;
}
