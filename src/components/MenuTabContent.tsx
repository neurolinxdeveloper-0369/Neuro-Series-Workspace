import { Bell, BookOpen, ChevronRight, CircleHelp, LogOut, Mic, Settings } from 'lucide-react';

interface MenuTabContentProps {
  isSignedIn?: boolean;
  onBrowse: () => void;
  onAssistant?: () => void;
  onJoin: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onNotifications?: () => void;
  unread?: number;
  onSignOut?: () => void;
}

export function MenuTabContent({ isSignedIn, onBrowse, onAssistant, onJoin, onSettings, onHelp, onNotifications, unread, onSignOut }: MenuTabContentProps) {
  const links = [
    { label: 'Supported devices', icon: BookOpen, onClick: onBrowse },
    ...(onAssistant ? [{ label: 'Neuro AI assistant', icon: Mic, onClick: onAssistant }] : []),
    { label: 'Join a location', icon: BookOpen, onClick: onJoin },
    ...(onNotifications ? [{ label: unread ? 'Notifications (' + unread + ' unread)' : 'Notifications', icon: Bell, onClick: onNotifications }] : []),
    { label: 'Help center', icon: CircleHelp, onClick: onHelp },
    { label: 'Settings', icon: Settings, onClick: onSettings },
  ];

  return (
    <div className="w-full max-w-lg space-y-4 text-slate-900 pointer-events-auto">
      <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm">
        {links.map(({ label, icon: Icon, onClick }) => (
          <button key={label} type="button" onClick={onClick}
            className="flex min-h-12 w-full items-center gap-3 px-5 py-3 text-left text-sm font-semibold hover:bg-slate-50">
            <Icon className="size-5 text-sky-700" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            <ChevronRight className="size-4 text-slate-500" aria-hidden="true" />
          </button>
        ))}
      </div>
      {isSignedIn && (
        <button type="button" onClick={onSignOut} className="flex min-h-12 w-full items-center gap-3 rounded-3xl bg-white px-5 py-3 text-sm font-semibold text-rose-700 shadow-sm">
          <LogOut className="size-5" aria-hidden="true" />Sign out
        </button>
      )}
    </div>
  );
}
