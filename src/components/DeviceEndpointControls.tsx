import { useEffect, useState } from 'react';
import { deviceApi, type Device } from '../services/device';

export function DeviceEndpointControls({ device, online }: { device: Device; online: boolean }) {
  const [pending, setPending] = useState<{ channel: number; target: boolean; expiresAt: number } | null>(null);
  const [confirm, setConfirm] = useState<{ channel: number; name: string; target: boolean } | null>(null);
  const [message, setMessage] = useState('');
  const endpoints = device?.endpoints ?? [];

  useEffect(() => {
    if (!pending) return;
    if (device.switches?.[String(pending.channel)] === pending.target) {
      const timer = setTimeout(() => setPending(current => current === pending ? null : current), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      setPending(null);
      setMessage('The device has not confirmed this change. Check the equipment before retrying.');
    }, Math.max(0, pending.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [pending, device.switches]);

  const awaiting = pending && device.switches?.[String(pending.channel)] !== pending.target;

  async function send(channel: number, target: boolean) {
    if (!online || awaiting) return;
    setConfirm(null);
    setMessage('');
    setPending({ channel, target, expiresAt: Date.now() + 15000 });
    try {
      await deviceApi.controlSwitch(device.device_id || device.id, channel, target ? 'on' : 'off');
    } catch {
      setPending(null);
      setMessage('The command could not be sent. Check your connection and try again.');
    }
  }

  return (
    <section className="space-y-4 rounded-3xl bg-white p-4 text-slate-900 shadow-sm sm:p-6">
      <div>
        <h2 className="text-lg font-bold">Controls and readings</h2>
        <p className="mt-1 text-sm text-slate-600">{online ? 'Values update when the device reports them.' : 'Device offline. Any readings shown are the last reported values.'}</p>
      </div>
      {endpoints.length === 0 && <p className="text-sm text-slate-600">No controls or sensors have been registered for this device.</p>}
      <ul className="divide-y divide-slate-200">
        {endpoints.map(endpoint => {
          const channel = endpoint.endpoint_index;
          const state = device.switches?.[String(channel)];
          const reading = endpoint.state?.reading;
          const reportedAt = reading?.reportedAt ? new Date(reading.reportedAt) : null;
          const switchText = state === undefined ? 'State unknown' : state ? 'On' : 'Off';
          return (
            <li key={endpoint.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <div>
                <p className="font-semibold">{endpoint.name}</p>
                <p className="text-sm text-slate-600">
                  {endpoint.endpoint_type === 'RELAY' ? switchText : reading
                    ? (typeof reading.value === 'boolean' ? (reading.value ? 'Active' : 'Inactive') : new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(reading.value)) + (reading.unit ? ' ' + reading.unit : '')
                    : 'No reading yet'}
                </p>
                {reportedAt && Number.isFinite(reportedAt.valueOf()) && <time className="text-xs text-slate-500" dateTime={reportedAt.toISOString()}>{reportedAt.toLocaleString()}</time>}
              </div>
              {endpoint.endpoint_type === 'RELAY' && (
                <div className="flex gap-2">
                  {[true, false].map(target => (
                    <button key={String(target)} type="button" aria-label={endpoint.name + (target ? ' on' : ' off')}
                      disabled={!online || !!awaiting || state === target}
                      className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold disabled:opacity-50"
                      onClick={() => setConfirm({ channel, name: endpoint.name, target })}>
                      {target ? 'On' : 'Off'}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {confirm && (
        <div className="rounded-xl bg-slate-100 p-3">
          <p className="text-sm">Turn {confirm.name} {confirm.target ? 'on' : 'off'}?</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="min-h-11 px-3 font-semibold" onClick={() => setConfirm(null)}>Cancel</button>
            <button type="button" disabled={!online} className="min-h-11 rounded-xl bg-sky-700 px-3 font-semibold text-white" onClick={() => void send(confirm.channel, confirm.target)}>Confirm</button>
          </div>
        </div>
      )}
      {awaiting && <p role="status" className="text-sm text-slate-700">Waiting for device confirmation?</p>}
      {message && <p role="alert" className="text-sm text-rose-800">{message}</p>}
    </section>
  );
}
