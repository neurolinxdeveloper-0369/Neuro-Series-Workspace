import { useState } from 'react';
import { 
  Lightbulb, 
  Eye, 
  Lock, 
  Unlock, 
  Radio, 
  SunDim, 
  CheckCircle2
} from 'lucide-react';

export const DeviceToggleGrid = () => {
  // Device States
  const [lightsOn, setLightsOn] = useState(true);
  const [lightBrightness, setLightBrightness] = useState(85);
  const [selectedColor, setSelectedColor] = useState('#06b6d4');

  const [glassTintActive, setGlassTintActive] = useState(true);
  const [glassTintLevel, setGlassTintLevel] = useState(70);

  const [lockSecure, setLockSecure] = useState(true);
  
  const [noiseCancelOn, setNoiseCancelOn] = useState(true);

  const [curtainState, setCurtainState] = useState<'open' | 'half' | 'closed'>('half');

  const colorPresets = [
    { name: 'Cyan Glow', hex: '#06b6d4', glow: 'rgba(6,182,212,0.4)' },
    { name: 'Violet Ray', hex: '#8b5cf6', glow: 'rgba(139,92,246,0.4)' },
    { name: 'Magenta Pulse', hex: '#ec4899', glow: 'rgba(236,72,153,0.4)' },
    { name: 'Amber Warmth', hex: '#f59e0b', glow: 'rgba(245,158,11,0.4)' },
    { name: 'Emerald Forest', hex: '#10b981', glow: 'rgba(16,185,129,0.4)' },
    { name: 'Pure Obsidian', hex: '#f8fafc', glow: 'rgba(248,250,252,0.4)' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      
      {/* 1. Architectural Ambient Neon Lighting */}
      <div className={`glass-card p-5 relative overflow-hidden transition-all duration-300 ${
        lightsOn ? 'border-cyan-500/30' : 'opacity-80'
      }`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div 
              className="p-2.5 rounded-xl border transition-all duration-300"
              style={{
                backgroundColor: lightsOn ? `${selectedColor}18` : 'rgba(255,255,255,0.03)',
                borderColor: lightsOn ? `${selectedColor}50` : 'rgba(255,255,255,0.08)',
                boxShadow: lightsOn ? `0 0 16px ${selectedColor}40` : 'none',
                color: lightsOn ? selectedColor : '#64748b'
              }}
            >
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white tracking-wide">Ambient Architecture</h4>
              <p className="text-xs text-slate-400 font-mono">
                {lightsOn ? `${lightBrightness}% Luminous • ${colorPresets.find(c => c.hex === selectedColor)?.name}` : 'Powered Off'}
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            onClick={() => setLightsOn(!lightsOn)}
            className={`w-12 h-6 rounded-full transition-colors duration-300 p-0.5 relative ${
              lightsOn ? 'bg-cyan-500/80 shadow-[0_0_12px_rgba(6,182,212,0.6)]' : 'bg-white/10'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                lightsOn ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Brightness slider & Color Palette */}
        {lightsOn && (
          <div className="space-y-3 pt-2 border-t border-white/5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <SunDim className="w-3.5 h-3.5 text-cyan-400" /> Brightness
              </span>
              <span className="text-white font-medium">{lightBrightness}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              value={lightBrightness}
              onChange={(e) => setLightBrightness(Number(e.target.value))}
              className="w-full glass-slider"
            />

            {/* Color swatches */}
            <div className="flex items-center justify-between pt-1">
              {colorPresets.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setSelectedColor(c.hex)}
                  className={`w-6 h-6 rounded-full transition-all duration-200 relative ${
                    selectedColor === c.hex ? 'scale-125 ring-2 ring-white shadow-lg' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: c.hex,
                    boxShadow: selectedColor === c.hex ? `0 0 10px ${c.glow}` : 'none'
                  }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Quantum Electrochromic Smart Glass Tint */}
      <div className={`glass-card p-5 relative overflow-hidden transition-all duration-300 ${
        glassTintActive ? 'border-sky-500/30' : 'opacity-80'
      }`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.2)]">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white tracking-wide">Quantum Glass Tint</h4>
              <p className="text-xs text-slate-400 font-mono">
                {glassTintActive ? `${glassTintLevel}% Privacy Opacity` : '100% Transparent'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setGlassTintActive(!glassTintActive)}
            className={`w-12 h-6 rounded-full transition-colors duration-300 p-0.5 relative ${
              glassTintActive ? 'bg-sky-500/80 shadow-[0_0_12px_rgba(14,165,233,0.6)]' : 'bg-white/10'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                glassTintActive ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {glassTintActive && (
          <div className="space-y-3 pt-2 border-t border-white/5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>UV & Privacy Filter Level</span>
              <span className="text-white font-medium">{glassTintLevel}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="98"
              value={glassTintLevel}
              onChange={(e) => setGlassTintLevel(Number(e.target.value))}
              className="w-full glass-slider"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>Crystal Clear (10%)</span>
              <span>Ultra Obsidian (98%)</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Biometric Security & Lock Shield */}
      <div className={`glass-card p-5 relative overflow-hidden transition-all duration-300 ${
        lockSecure ? 'border-emerald-500/30' : 'border-rose-500/40'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
              lockSecure 
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]' 
                : 'bg-rose-500/10 border-rose-500/25 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
            }`}>
              {lockSecure ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white tracking-wide">Perimeter Biometrics</h4>
              <p className="text-xs text-slate-400 font-mono">
                {lockSecure ? 'Vault Engaged • Encrypted Lock' : 'Warning: Access Disarmed'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setLockSecure(!lockSecure)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all duration-300 flex items-center gap-1.5 ${
              lockSecure
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-rose-950/60 border border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
            }`}
          >
            {lockSecure ? 'LOCKED' : 'UNLOCKED'}
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Iris & Neural Key Active
          </span>
          <span className="text-slate-500 text-[10px] font-mono">Node #81-G</span>
        </div>
      </div>

      {/* 4. Acoustic Spatial Noise Cancellation */}
      <div className="glass-card p-5 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/25 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.25)]">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white tracking-wide">Acoustic Shielding</h4>
              <p className="text-xs text-slate-400 font-mono">
                {noiseCancelOn ? 'Active Damping -42dB' : 'Translucent Pass-through'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setNoiseCancelOn(!noiseCancelOn)}
            className={`w-12 h-6 rounded-full transition-colors duration-300 p-0.5 relative ${
              noiseCancelOn ? 'bg-violet-600/80 shadow-[0_0_12px_rgba(139,92,246,0.6)]' : 'bg-white/10'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                noiseCancelOn ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Motorized Curtain / Glass Shading bar */}
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">Curtain Preset</span>
          <div className="flex items-center gap-1.5">
            {(['open', 'half', 'closed'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setCurtainState(mode)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase transition-all ${
                  curtainState === mode
                    ? 'bg-white/15 border border-white/20 text-white font-bold'
                    : 'bg-black/20 text-slate-400 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};
