import './DevicesToolbar.css';
import { Filter, LayoutGrid, List, Search, X } from 'lucide-react';
import type { Room } from '../services/home';

export function DevicesToolbar({ rooms, room, onRoom, search, onSearch, status, onStatus, view, onView }: {
  rooms: Room[]; room: string; onRoom: (name: string) => void;
  search: string; onSearch: (value: string) => void;
  status: 'all' | 'online' | 'offline'; onStatus: (value: 'all' | 'online' | 'offline') => void;
  view: 'grid' | 'list'; onView: (value: 'grid' | 'list') => void;
}) {
  return <section aria-label="Find devices" className="devices-reference-toolbar w-full max-w-sm shrink-0 space-y-3 sm:max-w-md md:max-w-2xl lg:max-w-5xl">
    <div className="flex items-center gap-2">
      <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-sky-100 bg-white/80 px-3 shadow-sm">
        <Search aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
        <input type="search" value={search} onChange={event => onSearch(event.target.value)} aria-label="Search devices"
          placeholder="Search devices…" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500" />
        {search && <button type="button" onClick={() => onSearch('')} aria-label="Clear device search" className="grid size-8 shrink-0 place-items-center text-slate-500"><X className="size-4" /></button>}
      </label>
      <label className={'relative grid size-11 shrink-0 place-items-center rounded-2xl border border-sky-100 bg-white/90 shadow-sm ' + (status === 'all' ? 'text-slate-700' : 'text-sky-600')}>
        <Filter aria-hidden="true" className="size-5" />
        <select aria-label="Filter devices by connection status" value={status} onChange={event => onStatus(event.target.value as typeof status)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
          <option value="all">All connection states</option><option value="online">Online only</option><option value="offline">Offline only</option>
        </select>
      </label>
      <button type="button" onClick={() => onView(view === 'grid' ? 'list' : 'grid')} aria-label={view === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
        className="grid size-11 shrink-0 place-items-center rounded-2xl border border-sky-100 bg-white/90 text-slate-700 shadow-sm">
        {view === 'grid' ? <LayoutGrid className="size-5" /> : <List className="size-5" />}
      </button>
    </div>
    <div role="group" aria-label="Filter devices by room" className="flex gap-2 overflow-x-auto pb-1">
      {[{ id: 'all', name: 'All devices' }, ...rooms].map(item => {
        const value = item.id === 'all' ? 'all' : item.name;
        return <button key={item.id} type="button" aria-pressed={room === value} onClick={() => onRoom(value)}
          className={'min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-xs font-semibold shadow-sm ' + (room === value ? 'border-sky-500 bg-sky-500 text-white' : 'border-sky-100 bg-white/70 text-slate-600')}>{item.name}</button>;
      })}
    </div>
    {status !== 'all' && <p className="px-1 text-xs font-semibold text-sky-700">Showing {status} devices</p>}
  </section>;
}
