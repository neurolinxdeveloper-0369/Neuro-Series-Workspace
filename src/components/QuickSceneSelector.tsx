import { 
  Sparkles, 
  Moon, 
  Target, 
  Sun, 
  Film, 
  Layers 
} from 'lucide-react';

interface QuickSceneSelectorProps {
  activeScene: string;
  setActiveScene: (scene: string) => void;
}

export const QuickSceneSelector = ({ 
  activeScene, 
  setActiveScene 
}: QuickSceneSelectorProps) => {
  const scenes = [
    {
      id: 'Cyber Neon',
      label: 'Cyber Neon',
      desc: 'Cyan & Violet Aura',
      icon: Sparkles,
      activeClass: 'from-cyan-500/20 via-fuchsia-500/10 to-transparent border-cyan-400/40 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.3)]',
      dotColor: 'bg-cyan-400'
    },
    {
      id: 'Midnight Obsidian',
      label: 'Midnight Obsidian',
      desc: 'Stealth Black & Deep Blue',
      icon: Moon,
      activeClass: 'from-blue-600/20 via-indigo-900/10 to-transparent border-blue-400/40 text-blue-200 shadow-[0_0_20px_rgba(59,130,246,0.3)]',
      dotColor: 'bg-blue-400'
    },
    {
      id: 'Deep Focus',
      label: 'Deep Focus',
      desc: 'Emerald & 432Hz Calm',
      icon: Target,
      activeClass: 'from-emerald-500/20 via-teal-900/10 to-transparent border-emerald-400/40 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.3)]',
      dotColor: 'bg-emerald-400'
    },
    {
      id: 'Solar Awakening',
      label: 'Solar Awakening',
      desc: 'Warm Amber Sunrise',
      icon: Sun,
      activeClass: 'from-amber-500/20 via-orange-900/10 to-transparent border-amber-400/40 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.3)]',
      dotColor: 'bg-amber-400'
    },
    {
      id: 'Cinema Dome',
      label: 'Cinema Dome',
      desc: '98% Blackout & Atmos',
      icon: Film,
      activeClass: 'from-purple-900/30 via-indigo-950/20 to-transparent border-purple-400/40 text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.3)]',
      dotColor: 'bg-purple-400'
    },
  ];

  return (
    <div className="glass-panel p-4 mb-8">
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Atmospheric Mood Environments
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          Refracts Background Glass Light
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {scenes.map((scene) => {
          const isActive = activeScene === scene.id;
          const Icon = scene.icon;

          return (
            <button
              key={scene.id}
              onClick={() => setActiveScene(scene.id)}
              className={`p-3.5 rounded-2xl flex flex-col items-start gap-2 text-left transition-all duration-300 relative overflow-hidden group ${
                isActive
                  ? `bg-gradient-to-br ${scene.activeClass} border`
                  : 'bg-white/[0.03] border border-white/5 hover:bg-white/[0.07] hover:border-white/15 text-slate-300'
              }`}
            >
              {/* Top reflection line */}
              <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />

              <div className="flex items-center justify-between w-full">
                <div className={`p-2 rounded-xl ${
                  isActive ? 'bg-white/10 text-white' : 'bg-black/30 text-slate-400 group-hover:text-white'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                {isActive && (
                  <span className={`w-2 h-2 rounded-full ${scene.dotColor} shadow-[0_0_8px_currentColor]`} />
                )}
              </div>

              <div>
                <div className={`text-xs font-bold tracking-wide ${isActive ? 'text-white' : 'text-slate-200'}`}>
                  {scene.label}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {scene.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
