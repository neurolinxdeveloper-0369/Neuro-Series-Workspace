import { useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Disc, 
  Headphones
} from 'lucide-react';

export const MediaWidget = () => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(42);
  const [volume, setVolume] = useState(78);
  const [isMuted, setIsMuted] = useState(false);

  const formatTime = (percentage: number) => {
    const totalSeconds = 248; // 4m 08s
    const current = Math.floor((percentage / 100) * totalSeconds);
    const m = Math.floor(current / 60);
    const s = current % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="glass-card p-6 flex flex-col justify-between relative overflow-hidden h-full">
      {/* Specular curved reflection overlay */}
      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/[0.07] to-transparent pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <Headphones className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Spatial Soundstage</h3>
            <p className="text-[11px] text-slate-400 font-mono">Dolby Atmos • 24-bit 192kHz</p>
          </div>
        </div>

        {/* Dynamic Glass Equalizer */}
        <div className="flex items-end gap-1 h-5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5">
          <span className={`w-1 rounded-full bg-cyan-400 ${isPlaying ? 'animate-eq-1 shadow-[0_0_6px_#22d3ee]' : 'h-1'}`} />
          <span className={`w-1 rounded-full bg-blue-400 ${isPlaying ? 'animate-eq-2 shadow-[0_0_6px_#60a5fa]' : 'h-1'}`} />
          <span className={`w-1 rounded-full bg-violet-400 ${isPlaying ? 'animate-eq-3 shadow-[0_0_6px_#a78bfa]' : 'h-1'}`} />
          <span className={`w-1 rounded-full bg-pink-400 ${isPlaying ? 'animate-eq-4 shadow-[0_0_6px_#f472b6]' : 'h-1'}`} />
        </div>
      </div>

      {/* Main Track Presentation */}
      <div className="flex items-center gap-4 my-2">
        {/* Glossy Album Art with Glass Glare */}
        <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border border-white/20 shadow-[0_10px_25px_rgba(0,0,0,0.8)] group">
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-900 via-indigo-950 to-purple-900 flex items-center justify-center">
            <Disc className={`w-10 h-10 text-cyan-300/80 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
          </div>
          {/* Specular Diagonal Reflection Sheen */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-1 right-1 px-1 rounded bg-black/70 text-[9px] font-mono text-cyan-300">
            HI-RES
          </div>
        </div>

        {/* Track Title and Artist */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-400">
              Lofi Neural
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Master Stream</span>
          </div>
          <h4 className="text-base font-bold text-white truncate tracking-wide">
            Obsidian Echoes & Chill
          </h4>
          <p className="text-xs text-slate-400 truncate">Kavinsky • Cyber Ambient Edition</p>
        </div>
      </div>

      {/* Scrubber Progress Bar */}
      <div className="space-y-1.5 my-2">
        <div 
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const newPct = Math.round((clickX / rect.width) * 100);
            setProgress(Math.max(0, Math.min(100, newPct)));
          }}
          className="h-2 w-full rounded-full bg-white/10 relative cursor-pointer overflow-hidden group shadow-inner"
        >
          {/* Progress fill with gradient and glow */}
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full relative transition-all duration-150 shadow-[0_0_10px_rgba(6,182,212,0.6)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>{formatTime(progress)}</span>
          <span>4:08</span>
        </div>
      </div>

      {/* Control Buttons & Volume */}
      <div className="flex items-center justify-between pt-2">
        
        {/* Playback Controls */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setProgress(prev => Math.max(0, prev - 10))}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
            title="Rewind 10s"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Primary Glossy Play/Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-12 h-12 rounded-2xl glass-btn flex items-center justify-center text-white border border-cyan-400/40 bg-gradient-to-b from-cyan-500/20 to-blue-600/10 shadow-[0_0_20px_rgba(6,182,212,0.35)] active:scale-95 transition-all"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-cyan-200 fill-cyan-200" />
            ) : (
              <Play className="w-5 h-5 text-cyan-200 fill-cyan-200 translate-x-0.5" />
            )}
          </button>

          <button 
            onClick={() => setProgress(prev => Math.min(100, prev + 10))}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
            title="Fast Forward 10s"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Volume Glass Slider */}
        <div className="flex items-center gap-2 pl-3 border-l border-white/10">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            className="w-20 glass-slider"
          />
        </div>

      </div>
    </div>
  );
};
