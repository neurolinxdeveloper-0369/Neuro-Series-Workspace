import { useState } from 'react';
import { 
  Thermometer, 
  Wind, 
  Droplets, 
  Activity, 
  Plus, 
  Minus, 
  Flame, 
  Snowflake, 
  Leaf, 
  Sparkles 
} from 'lucide-react';

export const ClimateControlCard = () => {
  const [temperature, setTemperature] = useState<number>(21.5);
  const [activeMode, setActiveMode] = useState<'cool' | 'eco' | 'breeze' | 'heat'>('cool');
  const [fanSpeed, setFanSpeed] = useState<number>(3);

  const increaseTemp = () => {
    if (temperature < 30) setTemperature(prev => +(prev + 0.5).toFixed(1));
  };

  const decreaseTemp = () => {
    if (temperature > 16) setTemperature(prev => +(prev - 0.5).toFixed(1));
  };

  // Calculate arc stroke offset for circular gauge
  // Range: 16 to 30 -> 14 degree span
  const percentage = Math.min(Math.max((temperature - 16) / 14, 0), 1);
  const strokeDashoffset = 314 - percentage * 235; // 3/4 circle representation

  return (
    <div className="glass-card p-6 flex flex-col justify-between h-full relative group">
      {/* Specular glare overlay */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-white/[0.08] to-transparent pointer-events-none rounded-tr-2xl" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Thermometer className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">Atmosphere & Thermal</h3>
            <p className="text-xs text-slate-400 font-mono">HVAC Node #03 • Bio-Comfort</p>
          </div>
        </div>
        <div className="px-2.5 py-1 rounded-full bg-cyan-950/70 border border-cyan-400/30 text-cyan-300 text-[11px] font-mono font-medium flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Active Regulating</span>
        </div>
      </div>

      {/* Center Interactive Circular Thermostat */}
      <div className="relative my-4 flex flex-col items-center justify-center">
        <div className="relative w-52 h-52 flex items-center justify-center">
          
          {/* Circular SVG Gauge */}
          <svg className="w-full h-full transform -rotate-135" viewBox="0 0 120 120">
            {/* Background Track */}
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.07)"
              strokeWidth="6"
              strokeDasharray="235"
              strokeDashoffset="0"
              strokeLinecap="round"
            />
            {/* Active Luminous Temperature Arc */}
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="transparent"
              stroke="url(#tempGradient)"
              strokeWidth="7"
              strokeDasharray="314"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-300 ease-out"
            />
            <defs>
              <linearGradient id="tempGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>

          {/* Central Glass Hub */}
          <div className="absolute inset-8 rounded-full bg-gradient-to-b from-[#101522]/90 to-[#07090e]/95 border border-white/10 shadow-[inset_0_2px_4px_rgba(255,255,255,0.2),0_10px_25px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col items-center justify-center text-center">
            
            <span className="text-[10px] tracking-widest text-slate-400 uppercase font-mono mb-0.5">
              Target Ambient
            </span>
            <div className="flex items-baseline">
              <span className="text-4xl font-extrabold tracking-tight text-white font-mono drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]">
                {temperature}
              </span>
              <span className="text-xl font-bold text-cyan-400 ml-0.5">°C</span>
            </div>
            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Optimal Purity
            </span>
          </div>

          {/* Minus & Plus Buttons embedded next to the dial */}
          <div className="absolute inset-x-0 bottom-1 flex items-center justify-between px-3">
            <button
              onClick={decreaseTemp}
              className="w-10 h-10 rounded-xl glass-btn flex items-center justify-center text-slate-200 hover:text-cyan-400 active:scale-95 transition-all shadow-lg"
              title="Lower Temperature"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={increaseTemp}
              className="w-10 h-10 rounded-xl glass-btn flex items-center justify-center text-slate-200 hover:text-cyan-400 active:scale-95 transition-all shadow-lg"
              title="Raise Temperature"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modes Bar */}
      <div className="grid grid-cols-4 gap-2 my-3">
        {[
          { id: 'cool', label: 'Arctic', icon: Snowflake, color: 'text-cyan-400' },
          { id: 'eco', label: 'Eco Mind', icon: Leaf, color: 'text-emerald-400' },
          { id: 'breeze', label: 'Breeze', icon: Wind, color: 'text-sky-400' },
          { id: 'heat', label: 'Warmth', icon: Flame, color: 'text-amber-400' },
        ].map((mode) => {
          const isSelected = activeMode === mode.id;
          const Icon = mode.icon;
          return (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id as any)}
              className={`py-2 px-2 rounded-xl flex flex-col items-center gap-1 transition-all duration-300 ${
                isSelected
                  ? 'bg-white/10 border border-white/25 shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),0_0_15px_rgba(6,182,212,0.2)] text-white'
                  : 'bg-black/20 border border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? mode.color : 'text-slate-400'}`} />
              <span className="text-[10px] font-medium tracking-wide">{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Atmospheric Micro Stats Footer */}
      <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-white/10 font-mono">
        <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex flex-col">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] mb-1">
            <Droplets className="w-3 h-3 text-cyan-400" />
            <span>HUMIDITY</span>
          </div>
          <span className="text-sm font-semibold text-white">48%</span>
        </div>

        <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex flex-col">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] mb-1">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span>AIR AQI</span>
          </div>
          <span className="text-sm font-semibold text-emerald-400">11 • Pure</span>
        </div>

        <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
            <span className="flex items-center gap-1">
              <Wind className="w-3 h-3 text-sky-400" />
              <span>FAN</span>
            </span>
            <span className="text-cyan-400 font-bold">{fanSpeed}/5</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <div
                key={lvl}
                onClick={() => setFanSpeed(lvl)}
                className={`h-1.5 flex-1 rounded-full cursor-pointer transition-all ${
                  lvl <= fanSpeed ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
