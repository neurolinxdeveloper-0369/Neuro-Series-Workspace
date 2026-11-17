import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../services/api';
import { Modal } from './Modal';

type Outcome = 'sent' | 'pending' | 'observed' | 'unconfirmed' | 'failed' | 'reported';
type Command = { id: string; channel: number; target: boolean; outcome: Outcome; created_at?: string; observed_at?: string; failure?: string; device?: string };
type Run = { id: string; name: string; created_at: string; scheduled_at?: string; results: { device?: string; channel?: number; sent: boolean; reason?: string }[] | null; commands: Command[] };
type Energy = { periods: { period: string; kwh: number }[]; watts: number | null };

const labels: Record<Outcome, string> = {
  pending: 'Sending', sent: 'Sent ? awaiting telemetry', observed: 'Matching state reported',
  unconfirmed: 'No matching state reported', failed: 'Failed', reported: 'State changed on device',
};

function when(date: string) {
  return new Date(date).toLocaleString();
}

function CommandList({ commands }: { commands: Command[] }) {
  return <ul className="divide-y divide-slate-200">
    {commands.map(item => <li key={item.id} className="space-y-1 py-3 text-sm">
      <p className="font-semibold">{item.device ? item.device + ' ? ' : ''}Switch {item.channel} {item.target ? 'on' : 'off'}</p>
      <p className="text-slate-700">{labels[item.outcome]}{item.failure ? ' ? ' + item.failure : ''}</p>
      {item.created_at && item.outcome !== 'reported' && <p className="text-xs text-slate-600">Requested {when(item.created_at)}</p>}
      {item.observed_at && <p className="text-xs text-slate-600">Reported {when(item.observed_at)}</p>}
    </li>)}
  </ul>;
}

export function HistoryPanel({ kind, id, canManage, onClose }: {
  kind: 'device' | 'routines' | 'energy'; id: string; canManage: boolean; onClose: () => void;
}) {
  const [period, setPeriod] = useState<'day' | 'month'>('day');
  const [revision, setRevision] = useState(0);
  const [commands, setCommands] = useState<Command[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [energy, setEnergy] = useState<Energy>();
  const [watts, setWatts] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const path = '/devices/' + encodeURIComponent(id);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        if (kind === 'device') {
          const response = await api.get<{ entries: Command[] }>(path + '/activity');
          if (active) setCommands(response.entries);
        } else if (kind === 'routines') {
          const response = await api.get<{ runs: Run[] }>('/routines/history/' + encodeURIComponent(id));
          if (active) setRuns(response.runs);
        } else {
          const response = await api.get<Energy>(path + '/energy?period=' + period);
          if (active) {
            setEnergy(response);
            setWatts(response.watts === null ? '' : String(response.watts));
          }
        }
      } catch {
        if (active) setError('Could not load history. Try refreshing.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [kind, path, id, period, revision]);

  async function save(event: FormEvent) {
    event.preventDefault();
    const value = watts.trim() ? Number(watts) : null;
    if (value !== null && (!Number.isFinite(value) || value <= 0 || value > 1e9)) {
      setError('Enter a positive number of watts.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.put(path + '/energy-threshold', { watts: value });
      setMessage(value === null ? 'Threshold removed.' : 'Threshold saved.');
    } catch {
      setError('Threshold could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const maxKwh = Math.max(0.001, ...(energy?.periods ?? []).map(point => point.kwh));

  return <Modal title={kind === 'device' ? 'Device activity' : kind === 'routines' ? 'Routine history' : 'Energy history'} onClose={onClose}>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setRevision(value => value + 1)} className="min-h-11 rounded-lg bg-slate-100 px-3 text-sm font-semibold">Refresh</button>
      {kind === 'energy' && (['day', 'month'] as const).map(value =>
        <button key={value} type="button" aria-pressed={value === period} onClick={() => setPeriod(value)}
          className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold aria-pressed:bg-sky-100">
          {value === 'day' ? 'Daily' : 'Monthly'}
        </button>
      )}
    </div>
    {loading && <p role="status" className="py-3 text-sm">Loading?</p>}
    {error && <p role="alert" className="py-2 text-sm text-rose-800">{error}</p>}
    {kind === 'device' && <>
      {!loading && !error && !commands.length && <p className="py-3 text-sm">No recorded commands yet.</p>}
      <CommandList commands={commands} />
    </>}
    {kind === 'routines' && <>
      {!loading && !error && !runs.length && <p className="py-3 text-sm">No routine runs recorded for this location yet.</p>}
      {runs.map(run => <details key={run.id} className="my-2 rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold">{run.name} ? {run.scheduled_at ? 'Scheduled' : 'Manual'} ? {when(run.scheduled_at ?? run.created_at)}</summary>
        <CommandList commands={run.commands} />
        {run.results?.filter(result => !result.sent).map((result, index) =>
          <p key={index} className="py-1 text-sm text-rose-800">{result.device || 'Device'}{result.channel ? ' ? Switch ' + result.channel : ''}: {result.reason}</p>
        )}
        {!run.results && <p className="py-2 text-sm">Run outcome has not been recorded yet.</p>}
      </details>)}
    </>}
    {kind === 'energy' && <>
      <p className="my-3 text-sm text-slate-600">Observed increases in the meter?s cumulative energy counter, grouped in IST. The first reading establishes a baseline, and resets start a new baseline.</p>
      {!loading && !error && !energy?.periods.length && <p className="py-2 text-sm">No energy readings collected yet.</p>}
      <ul className="space-y-2">
        {energy?.periods.map(point => <li key={point.period} className="grid grid-cols-[6rem_1fr_auto] items-center gap-2 text-xs sm:text-sm">
          <span>{point.period}</span>
          <span className="h-2 rounded-full bg-sky-100" aria-hidden="true"><span className="block h-full rounded-full bg-sky-700" style={{ width: `${point.kwh / maxKwh * 100}%` }} /></span>
          <span>{point.kwh.toLocaleString(undefined, { maximumFractionDigits: 4 })} kWh</span>
        </li>)}
      </ul>
      {canManage && energy && <form className="mt-5 space-y-2 border-t border-slate-200 pt-4" onSubmit={save}>
        <label className="grid gap-2 text-sm font-semibold">
          Power threshold (W)
          <input type="number" min="0.01" max="1000000000" step="any" value={watts} onChange={event => setWatts(event.target.value)}
            placeholder="Leave blank to turn off" className="min-h-11 rounded-lg border border-slate-300 px-3 text-base" />
        </label>
        <p className="text-xs text-slate-600">Creates an in-app alert when power crosses the threshold from below.</p>
        <button type="submit" disabled={saving || loading} className="min-h-11 rounded-lg bg-sky-700 px-3 text-sm font-semibold text-white">Save threshold</button>
      </form>}
      {message && <p role="status" className="pt-2 text-sm text-emerald-800">{message}</p>}
    </>}
  </Modal>;
}
