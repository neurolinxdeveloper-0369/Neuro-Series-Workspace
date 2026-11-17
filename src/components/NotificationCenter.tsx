import type { useNotifications } from '../hooks/useNotifications';
import { Modal } from './Modal';

const messages = {
  offline: 'went offline',
  online: 'came online',
  alert: 'reported a protection alert',
};

export function NotificationCenter({ notifications, onClose }: { notifications: ReturnType<typeof useNotifications>; onClose: () => void }) {
  const unread = notifications.items.filter(item => !item.read);
  return (
    <Modal title="Notifications" onClose={onClose}>
      <p className="text-sm text-slate-600">Recent connection changes and protection alerts from locations you can access.</p>
      <div className="my-3 flex flex-wrap gap-2">
        <button type="button" onClick={notifications.refresh} className="min-h-11 rounded-xl bg-slate-100 px-3 text-sm font-semibold">Refresh</button>
        {!!unread.length && <button type="button" onClick={() => void notifications.markRead(unread.map(item => item.id))}
          className="min-h-11 rounded-xl bg-sky-700 px-3 text-sm font-semibold text-white">Mark all as read</button>}
      </div>
      {notifications.error && <p role="alert" className="mb-3 text-sm text-rose-800">{notifications.error}</p>}
      {!notifications.items.length && !notifications.error && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">No notifications yet.</p>}
      <ul className="divide-y divide-slate-200">
        {notifications.items.map(item => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className={item.read ? 'text-sm' : 'text-sm font-semibold'}>{item.device_name} {messages[item.kind]}</p>
              {item.detail && <p className="text-sm text-slate-700">{item.detail}</p>}
              <p className="mt-1 text-xs text-slate-600">{item.home_name} ? <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></p>
            </div>
            {!item.read && (
              <button type="button" className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-sky-800"
                aria-label={'Mark notification from ' + item.device_name + ' as read'} onClick={() => void notifications.markRead([item.id])}>
                Mark read
              </button>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
