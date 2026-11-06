import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Bell, 
  Sparkles
} from 'lucide-react';

interface GlassNavbarProps {
  activeRoom: string;
  setActiveRoom: (room: string) => void;
  activeScene: string;
}

export const GlassNavbar = ({ 
  activeRoom, 
  setActiveRoom,
  activeScene 
}: GlassNavbarProps) => {
  const [time, setTime] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      setDateStr(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const rooms = [
    'Penthouse Core',
    'Sky Lounge',
    'Master Sanctuary',
    'Observatory'
  ];

  return (
    <header className="relative z-30 w-full mb-8 pt-4">
      <div className="glass-panel px-6 py-4 flex flex-wrap items-center justify-between gap-4 border border-white/10 shadow-[0_15px_35px_rgba(0,0,0,0.85)]">
        
        {/* Brand & System Status */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400/20 via-blue-500/10 to-transparent border border-cyan-400/30 shadow-[0_0_20px_rgba(6,182,212,0.35)]">
            <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse" />
            <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-30 pointer-events-none" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                OBSIDIAN
              </span>
              <span className="text-[10px] font-mono tracking-widest px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 font-semibold">
                NEURA v4.8
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping" />
              <span className="text-[11px] text-emerald-400/90 font-medium">Neural Hub Online</span>
              <span className="text-white/20">•</span>
              <span className="text-[11px] text-slate-400">Mode: {activeScene}</span>
            </div>
          </div>
        </div>

        {/* Room Navigation Glass Pills */}
        <nav className="flex items-center p-1 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-md">
          {rooms.map((room) => {
            const isActive = activeRoom === room;
            return (
              <button
                key={room}
                onClick={() => setActiveRoom(room)}
                className={`relative px-4 py-2 rounded-xl text-xs font-medium transition-all duration-300 ${
                  isActive
                    ? 'text-white glass-pill-active shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {room}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Live Clock & Telemetry Controls */}
        <div className="flex items-center gap-3">
          {/* Live Digital Clock */}
          <div className="hidden sm:flex flex-col items-end px-3.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 font-mono">
            <span className="text-sm font-semibold tracking-wider text-slate-200">
              {time || '00:00:00'}
            </span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">
              {dateStr || 'LOC 00:00'}
            </span>
          </div>

          {/* Quick Security Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px]">ENCRYPTED</span>
          </div>

          {/* Notifications Glass Button */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2.5 rounded-xl glass-btn text-slate-300 hover:text-white"
              title="Alerts & Telemetry"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8]" />
            </button>

            {/* Notification Dropdown Modal */}
            {notificationsOpen && (
              <div className="absolute right-0 mt-3 w-80 glass-card p-4 border border-white/15 z-50 shadow-[0_25px_50px_rgba(0,0,0,0.95)] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-cyan-400" /> System Log
                  </span>
                  <span className="text-[10px] text-cyan-400/80 font-mono">3 New</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                    <p className="text-slate-200 font-medium">Quantum Smart Tint adjusted</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Sky Lounge tint set to 85% opacity</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/[0.07] border border-emerald-500/20">
                    <p className="text-emerald-300 font-medium">Air Purity Optimal</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">AQI 8 • Pure Hepa Circulation Active</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                    <p className="text-slate-200 font-medium">Perimeter Scan Complete</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">All 14 biometric sensors synchronized</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Profile Glass Avatar */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
            <div className="relative group cursor-pointer">
              <div className="w-10 h-10 rounded-xl overflow-hidden p-0.5 bg-gradient-to-tr from-cyan-500 via-indigo-500 to-fuchsia-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                <div className="w-full h-full rounded-[10px] bg-slate-900 flex items-center justify-center font-bold text-xs text-cyan-200">
                  AD
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950" />
            </div>
          </div>
        </div>

      </div>
    </header>
  );
};
