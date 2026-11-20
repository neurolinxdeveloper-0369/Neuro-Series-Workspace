import { useState } from 'react';
import { Bell, ChevronRight, Grid2X2, Headset, House, Layers, Power, Settings, UserRound } from 'lucide-react';
import type { UserProfile } from '../services/auth';
import type { Room } from '../services/home';
import { Modal } from './Modal';
import './MenuTabContent.css';

interface MenuTabContentProps {
  isSignedIn?: boolean; user?: UserProfile | null; homeName?: string; rooms?: Room[];
  onBrowse: () => void; onExplore?: () => void; onAssistant?: () => void; onJoin: () => void;
  onSettings: () => void; onHelp: () => void; onNotifications?: () => void; unread?: number; onSignOut?: () => void;
}
export function MenuTabContent({ isSignedIn, user, homeName, rooms = [], onBrowse, onExplore, onAssistant, onJoin, onSettings, onHelp, onNotifications, unread = 0, onSignOut }: MenuTabContentProps) {
  const [panel, setPanel] = useState<'profile' | 'home' | 'integrations' | null>(null);
  const row = (label: string, description: string, Icon: typeof House, action: () => void, count = 0) =>
    <button type="button" className="menu-settings-row" onClick={action}>
      <span className="menu-row-icon"><Icon aria-hidden="true" /></span>
      <span className="menu-row-copy"><strong>{label}</strong><span>{description}</span></span>
      {count > 0 && <span className="menu-unread" aria-label={count + ' unread notifications'}>{count > 99 ? '99+' : count}</span>}
      <ChevronRight aria-hidden="true" className="menu-row-arrow" />
    </button>;
  return <div className="menu-design">
    <header><h1>Menu</h1><p>Manage your account, home and app settings.</p></header>
    <button type="button" className="menu-profile" onClick={() => isSignedIn ? setPanel('profile') : onSettings()}>
      <span className="menu-avatar"><UserRound aria-hidden="true" /></span>
      <span className="menu-profile-copy"><strong>{user?.full_name || (isSignedIn ? 'Your account' : 'Welcome to Neuro Touch')}</strong>
        <span>{user?.email || user?.phone_number || (isSignedIn ? 'Manage your profile' : 'Sign in to manage your home')}</span></span>
      <ChevronRight aria-hidden="true" /><span aria-hidden="true" className="menu-profile-wave" />
    </button>
    <section><h2>HOME &amp; SPACES</h2><div className="menu-row-group">{row('Home Management', 'Homes, rooms, members', House, () => setPanel('home'))}</div></section>
    <section><h2>APP &amp; SERVICES</h2><div className="menu-row-group">
      {row('Notifications', 'Alerts, device status, updates', Bell, onNotifications || onSettings, unread)}
      {row('Integrations', 'Third-party services & voice assistants', Layers, () => setPanel('integrations'))}
      {row('Explore', 'Discover features, templates & more', Grid2X2, onExplore || onBrowse)}
    </div></section>
    <section><h2>SUPPORT &amp; PREFERENCES</h2><div className="menu-row-group">
      {row('Help & Support', 'FAQs, guides and contact us', Headset, onHelp)}
      {row('Settings', 'App, privacy, and device preferences', Settings, onSettings)}
    </div></section>
    {isSignedIn && <button type="button" className="menu-logout" onClick={onSignOut}><Power aria-hidden="true" /><span>Logout</span><ChevronRight aria-hidden="true" /></button>}
    {panel && <Modal title={panel === 'profile' ? 'Your account' : panel === 'home' ? 'Home Management' : 'Integrations'} onClose={() => setPanel(null)}>
      {panel === 'profile' && <div className="space-y-3 text-sm text-slate-600"><p className="font-bold text-slate-900">{user?.full_name || 'Your account'}</p><p>{user?.email || user?.phone_number}</p><button type="button" onClick={() => { setPanel(null); onSettings(); }} className="min-h-11 rounded-full bg-sky-500 px-5 font-bold text-white">Account settings</button></div>}
      {panel === 'home' && <div className="space-y-3 text-sm text-slate-600"><p className="font-bold text-slate-900">{homeName || 'Your home'}</p><p>{rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}</p><div className="flex flex-wrap gap-2">{rooms.map(room => <span key={room.id} className="rounded-full bg-sky-50 px-3 py-2">{room.name}</span>)}</div><button type="button" onClick={() => { setPanel(null); onJoin(); }} className="min-h-11 rounded-full bg-sky-500 px-5 font-bold text-white">Join a location</button></div>}
      {panel === 'integrations' && <div className="space-y-3 text-sm text-slate-600"><p>Discover connected devices and voice assistant options for your home.</p><button type="button" onClick={() => { setPanel(null); onBrowse(); }} className="min-h-11 rounded-full bg-sky-500 px-5 font-bold text-white">Supported devices</button>{onAssistant && <button type="button" onClick={() => { setPanel(null); onAssistant(); }} className="ml-2 min-h-11 rounded-full bg-sky-50 px-5 font-bold text-sky-700">Neuro AI assistant</button>}<p className="text-xs">Additional third-party integrations are coming soon.</p></div>}
    </Modal>}
  </div>;
}
