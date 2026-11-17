import type { MemberAccess, Room } from '../services/home';

export type AccessDevice = { id: string; custom_name: string };

export function PermissionEditor({ value, onChange, rooms, devices }: {
  value: MemberAccess; onChange: (value: MemberAccess) => void; rooms: Room[]; devices: AccessDevice[];
}) {
  const restricted = value.roomIds !== null || value.deviceIds !== null;

  function toggle(key: 'roomIds' | 'deviceIds', id: string) {
    const current = value[key] ?? [];
    onChange({ ...value, [key]: current.includes(id) ? current.filter(item => item !== id) : [...current, id] });
  }

  return <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm">
    <legend className="px-1 font-semibold">Permissions</legend>
    <label className="grid gap-1">Role
      <select value={value.role} onChange={event => onChange({ ...value, role: event.target.value === 'view' ? 'view' : 'control' })}
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-2">
        <option value="view">View only</option>
        <option value="control">View and control devices</option>
      </select>
    </label>
    <label className="grid gap-1">Access scope
      <select value={restricted ? 'selected' : 'all'}
        onChange={event => onChange({ ...value, roomIds: event.target.value === 'all' ? null : [], deviceIds: event.target.value === 'all' ? null : [] })}
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-2">
        <option value="all">Entire location</option>
        <option value="selected">Selected rooms or devices</option>
      </select>
    </label>
    {restricted && <div className="max-h-52 space-y-1 overflow-y-auto">
      {rooms.map(room => <label key={room.id} className="flex min-h-10 items-center gap-2">
        <input type="checkbox" checked={value.roomIds?.includes(room.id) ?? false} onChange={() => toggle('roomIds', room.id)} />Room: {room.name}
      </label>)}
      {devices.map(device => <label key={device.id} className="flex min-h-10 items-center gap-2">
        <input type="checkbox" checked={value.deviceIds?.includes(device.id) ?? false} onChange={() => toggle('deviceIds', device.id)} />Device: {device.custom_name}
      </label>)}
      {!rooms.length && !devices.length && <p>Add rooms or devices to this location before restricting access.</p>}
    </div>}
  </fieldset>;
}
