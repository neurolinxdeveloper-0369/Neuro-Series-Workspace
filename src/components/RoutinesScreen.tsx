import { useState } from 'react';
import { CalendarDays, Clock3, Filter, House, Layers, Moon, MoreVertical, Plus, Shield, Sparkles, Sun, Zap } from 'lucide-react';
import { formatScheduleTimeToIst, type SmartRoutine } from '../services/routine';
import type { Room } from '../services/home';
import { Modal } from './Modal';
import './RoutinesScreen.css';

export function RoutinesScreen({ routines, rooms, roomFilter, onRoomFilter, canManage, onCreate, onEdit, onToggle, onRun, onHistory, runningId }: {
  routines: SmartRoutine[]; rooms: Room[]; roomFilter: string; onRoomFilter: (room: string) => void;
  canManage: boolean; onCreate: () => void; onEdit: (routine: SmartRoutine) => void;
  onToggle: (routine: SmartRoutine) => Promise<void>; onRun: (routine: SmartRoutine) => Promise<void>;
  onHistory: () => void; runningId: string | null;
}) {
  const [filter, setFilter] = useState<'all' | 'active' | 'schedule' | 'scene'>('all');
  const [actions, setActions] = useState<SmartRoutine | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const scoped = routines.filter(routine => roomFilter === 'all' || routine.roomId === 'all' || routine.roomId === roomFilter);
  const filtered = scoped.filter(routine => filter === 'all' || (filter === 'active' ? routine.isActive !== false : routine.type === filter));
  const tabs = [
    { value: 'all', label: 'All', count: scoped.length, Icon: null },
    { value: 'active', label: 'Active', count: scoped.filter(routine => routine.isActive !== false).length, Icon: null },
    { value: 'schedule', label: 'Schedules', count: scoped.filter(routine => routine.type === 'schedule').length, Icon: CalendarDays },
    { value: 'scene', label: 'Scenes', count: scoped.filter(routine => routine.type === 'scene').length, Icon: Layers },
  ] as const;

  return <section className="routines-design">
    <header className="routines-heading"><div><h1>Routines</h1><p>Automate your space with smart routines</p></div>
      <label className="routines-room-filter"><Filter size={17} /><select value={roomFilter} aria-label="Filter routines by room" onChange={event => onRoomFilter(event.target.value)}><option value="all">All rooms</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
    </header>
    <div role="group" aria-label="Routine filters" className="routines-filter-chips">{tabs.map(({ value, label, count, Icon }) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{Icon && <Icon size={13} />}{label} ({count})</button>)}</div>
    {roomFilter !== 'all' && <p className="routines-room-label">{rooms.find(room => room.id === roomFilter)?.name || 'Selected room'}</p>}
    <div className="routines-list">
      {filtered.map(routine => {
        const Icon = ({ sun: Sun, moon: Moon, zap: Zap, home: House, shield: Shield, sparkles: Sparkles, clock: Clock3 })[routine.icon] || Sparkles;
        const theme = routine.icon === 'moon' ? 'blue' : ['sparkles', 'zap'].includes(routine.icon) ? 'green' : ['home', 'shield'].includes(routine.icon) ? 'purple' : 'amber';
        const allOff = routine.actions.length > 0 && routine.actions.every(action => !action.targetState);
        const description = routine.description || (routine.type === 'schedule' ? allOff ? 'Turn OFF selected devices' : 'Turn ON selected devices' : 'One-tap control for selected devices');
        const repeat = !routine.repeatDays?.length || routine.repeatDays.length === 7 ? 'Every day' : routine.repeatDays.join(', ');
        return <article key={routine.id} className="routine-reference-card">
          <span className={'routine-reference-icon ' + theme}><Icon aria-hidden="true" /></span>
          <div className="routine-reference-copy"><h2>{routine.name}</h2><p>{description}</p>
            <div className="routine-reference-tags">{routine.type === 'schedule' ? <><span><CalendarDays size={12} />{repeat}</span>{routine.scheduleTime && <span><Clock3 size={12} />ON {formatScheduleTimeToIst(routine.scheduleTime)}</span>}{routine.scheduleOffTime && <span><Clock3 size={12} />OFF {formatScheduleTimeToIst(routine.scheduleOffTime)}</span>}</> : <span><Layers size={12} />On tap</span>}</div>
          </div>
          <div className="routine-reference-actions"><button type="button" role="switch" aria-checked={routine.isActive !== false} aria-label={(routine.isActive === false ? 'Enable ' : 'Pause ') + routine.name} disabled={!canManage || busy === routine.id}
            className="routine-reference-switch" onClick={async () => { setBusy(routine.id); try { await onToggle(routine); } finally { setBusy(null); } }}><span /></button>
            {canManage && <button type="button" className="routine-more" aria-label={'Options for ' + routine.name} onClick={() => setActions(routine)}><MoreVertical size={18} /></button>}
          </div>
          {runningId === routine.id && <span className="routine-running" role="status">Sending commands…</span>}
        </article>;
      })}
      {!filtered.length && <div className="routine-empty"><Sparkles /><h2>{routines.length ? 'No routines match this filter' : 'No routines yet'}</h2><p>{routines.length ? 'Choose another filter to view your routines.' : 'Create your first scene or schedule for your home.'}</p></div>}
    </div>
    {canManage && <div className="routines-footer"><button type="button" className="routine-create" onClick={onCreate}><Plus size={23} />Create Routine</button><button type="button" className="routine-history" onClick={onHistory}>Routine history</button></div>}
    {actions && <Modal title={actions.name} onClose={() => setActions(null)}><div className="grid gap-3"><button type="button" className="min-h-11 rounded-xl bg-sky-50 px-4 text-left font-semibold text-sky-800" onClick={() => { setActions(null); onEdit(actions); }}>Edit routine</button>{actions.type === 'scene' && <button type="button" disabled={runningId === actions.id} className="min-h-11 rounded-xl bg-sky-500 px-4 text-left font-semibold text-white disabled:opacity-50" onClick={() => { const selected = actions; setActions(null); void onRun(selected); }}>Run now</button>}{actions.type === 'schedule' && <p className="text-sm leading-relaxed text-slate-600">Runs automatically at the saved ON/OFF times. Use its toggle to enable or pause the schedule.</p>}</div></Modal>}
  </section>;
}
