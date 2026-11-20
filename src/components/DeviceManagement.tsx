import { useState, type FormEvent } from 'react';
import { deviceApi } from '../services/device';
import type { Room } from '../services/home';

interface DeviceManagementProps {
  device: { id: string; custom_name: string; room_id: string | null };
  rooms: Room[];
  onSaved: (updates: { custom_name: string; room_id: string | null }) => void;
  onRemoved: () => void;
}

export function DeviceManagement({ device, rooms, onSaved, onRemoved }: DeviceManagementProps) {
  const [name, setName] = useState(device.custom_name);
  const [room, setRoom] = useState(device.room_id ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await deviceApi.updateDetails(device.id, name.trim(), room || null);
      onSaved(updated);
      setName(updated.custom_name);
      setMessage('Device details saved.');
    } catch {
      setError('Unable to save changes. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await deviceApi.removeDevice(device.id);
      onRemoved();
    } catch {
      setError('Unable to remove the device. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm sm:p-5">
      <summary className="cursor-pointer font-semibold text-slate-900">Manage device</summary>
      <form onSubmit={save} className="mt-4 grid gap-3">
        <label className="grid gap-1.5 font-medium text-slate-800">
          Device name
          <input value={name} onChange={event => setName(event.target.value)} required maxLength={80}
            className="min-h-11 rounded-xl border border-slate-300 px-3 text-base" />
        </label>
        <label className="grid gap-1.5 font-medium text-slate-800">
          Room
          <select value={room} onChange={event => setRoom(event.target.value)}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-base">
            <option value="">Unassigned</option>
            {rooms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <button type="submit" disabled={busy || !name.trim()}
          className="min-h-11 rounded-xl bg-sky-700 px-4 font-semibold text-white disabled:opacity-50">
          Save changes
        </button>
      </form>
      <div className="mt-4 border-t border-slate-200 pt-3">
        {confirmRemove ? (
          <>
            <p className="mb-2 text-slate-700">Remove this device from the location? Routines can no longer control it.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirmRemove(false)} className="min-h-11 rounded-xl bg-slate-100 px-4 font-semibold">Cancel</button>
              <button type="button" disabled={busy} onClick={() => void remove()} className="min-h-11 rounded-xl bg-rose-700 px-4 font-semibold text-white">Confirm removal</button>
            </div>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => setConfirmRemove(true)} className="min-h-11 font-semibold text-rose-700">Remove device</button>
        )}
      </div>
      {message && <p role="status" className="mt-2 text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-2 text-rose-800">{error}</p>}
    </details>
  );
}
