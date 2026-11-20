import { useState } from 'react';
import { ArrowRight, LoaderCircle, Power, Sparkles, Zap } from 'lucide-react';
import { deviceApi, type Device } from '../services/device';
import { routineApi, type SmartRoutine } from '../services/routine';
import { getOffTargets } from '../../server/src/utils/quick-controls';

export function QuickControls({ devices, roomId, roomName, routines, onSeeAll }: {
  devices: Device[]; roomId: string | null; roomName: string;
  routines: SmartRoutine[]; onSeeAll: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const targets = getOffTargets(devices, roomId);
  const scenes = routines.filter(scene => scene.type === 'scene' && scene.isActive !== false &&
    (roomId === null || scene.roomId === roomId) && scene.actions.length > 0 && scene.actions.every(action =>
      devices.some(device => (device.device_id === action.deviceId || device.id === action.deviceId) &&
        device.can_control !== false && (roomId === null || device.room_id === roomId))));

  const allOff = async () => {
    if (busy || !targets.length) return;
    setBusy('all-off'); setMessage('Sending off commands…');
    let sent = 0;
    const failures = new Set<string>();
    // Keep a bounded number of requests in flight; never queue offline commands.
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, targets.length) }, async () => {
      while (next < targets.length) {
        const target = targets[next++];
        if (!target.online) { failures.add(target.deviceName + ' (offline)'); continue; }
        try {
          const result = await deviceApi.controlSwitch(target.deviceId, target.channel, 'off');
          if (!result.success) throw new Error('Command failed');
          sent++;
        } catch { failures.add(target.deviceName); }
      }
    }));
    setMessage(`${sent} off command${sent === 1 ? '' : 's'} sent. ${sent ? 'Device confirmation updates the controls.' : ''}${failures.size ? ' Could not switch off: ' + [...failures].join(', ') + '.' : ''}`);
    setBusy(null);
  };

  return <section aria-label={`Quick controls for ${roomName}`} className="w-full rounded-3xl bg-white/35 p-3 sm:p-4">
    <header className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Zap className="size-5 text-slate-500" />Quick Controls</h2>
      {scenes.length > 0 && <button type="button" onClick={onSeeAll} className="flex min-h-11 items-center gap-1 text-xs font-semibold text-slate-500">See all<ArrowRight className="size-3.5" /></button>}
    </header>
    <p className="sr-only">All Off controls {roomId === null ? 'all rooms in this home' : roomName}.</p>
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      <button type="button" onClick={() => void allOff()} disabled={busy !== null || targets.length === 0}
        aria-label={`Turn all devices off in ${roomName}`} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-3xl border border-white bg-white/80 px-2 py-3 text-xs font-semibold text-slate-600 shadow-sm disabled:opacity-50">
        {busy === 'all-off' ? <LoaderCircle className="size-6 animate-spin" /> : <Power className="size-6" />}All Off
      </button>
      {scenes.slice(0, 4).map(scene => <button key={scene.id} type="button" disabled={busy !== null}
        onClick={async () => {
          setBusy(scene.id); setMessage('Running ' + scene.name + '…');
          const ok = await routineApi.runRoutine(scene.id);
          setMessage(ok ? scene.name + ' commands sent. Device confirmation updates the controls.' : scene.name + ' could not run completely. Check device connections.');
          setBusy(null);
        }} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-3xl border border-white bg-white/80 px-2 py-3 text-xs font-semibold text-slate-600 shadow-sm disabled:opacity-50">
        {busy === scene.id ? <LoaderCircle className="size-6 animate-spin" /> : <Sparkles className="size-6" />}<span className="break-words text-center">{scene.name}</span>
      </button>)}
    </div>
    {message && <p role="status" className="mt-3 text-xs leading-relaxed text-slate-600">{message}</p>}
  </section>;
}
