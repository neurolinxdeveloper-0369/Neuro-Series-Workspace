import { useState } from 'react';
import { 
  Zap, 
  Sun, 
  BatteryCharging, 
  TrendingDown 
} from 'lucide-react';

export const EnergyGraphCard = () => {
  const [timeframe, setTimeframe] = useState<'1h' | '24h' | '7d'>('24h');
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // Dynamic sample data points based on timeframe
  const getData = () => {
    switch (timeframe) {
      case '1h':
        return [
          { time: '11:00', val: 1.8, label: '1.8 kW' },
          { time: '11:10', val: 2.1, label: '2.1 kW' },
          { time: '11:20', val: 1.4, label: '1.4 kW' },
          { time: '11:30', val: 1.7, label: '1.7 kW' },
          { time: '11:40', val: 1.2, label: '1.2 kW' },
          { time: '11:50', val: 1.4, label: '1.4 kW' },
        ];
      case '7d':
        return [
          { time: 'Mon', val: 24.2, label: '24.2 kWh' },
          { time: 'Tue', val: 21.0, label: '21.0 kWh' },
          { time: 'Wed', val: 19.8, label: '19.8 kWh' },
          { time: 'Thu', val: 26.5, label: '26.5 kWh' },
          { time: 'Fri', val: 22.4, label: '22.4 kWh' },
          { time: 'Sat', val: 18.0, label: '18.0 kWh' },
          { time: 'Sun', val: 16.5, label: '16.5 kWh' },
        ];
      default: // 24h
        return [
          { time: '00:00', val: 0.9, label: '0.9 kW' },
          { time: '04:00', val: 0.7, label: '0.7 kW' },
          { time: '08:00', val: 2.8, label: '2.8 kW' },
          { time: '12:00', val: 3.4, label: '3.4 kW' },
          { time: '16:00', val: 2.2, label: '2.2 kW' },
          { time: '20:00', val: 3.1, label: '3.1 kW' },
          { time: '23:59', val: 1.4, label: '1.4 kW' },
        ];
    }
  };

  const points = getData();
  const maxVal = Math.max(...points.map(p => p.val)) * 1.25;

  // Generate SVG curve points
  const width = 500;
  const height = 140;
  const svgCoords = points.map((p, idx) => {
    const x = (idx / (points.length - 1)) * (width - 40) + 20;
    const y = height - (p.val / maxVal) * (height - 30) - 15;
    return { x, y, ...p };
  });

  // Simple smooth bezier path
  const pathD = svgCoords.reduce((acc, curr, i, arr) => {
    if (i === 0) return `M ${curr.x} ${curr.y}`;
    const prev = arr[i - 1];
    const cp1x = prev.x + (curr.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (curr.x - prev.x) / 2;
    const cp2y = curr.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
  }, '');

  const areaD = `${pathD} L ${svgCoords[svgCoords.length - 1].x} ${height} L ${svgCoords[0].x} ${height} Z`;

  return (
    <div className="glass-card p-6 flex flex-col justify-between relative overflow-hidden h-full">
      {/* Glossy top highlight */}
      <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />

      {/* Header and timeframe selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">Energy & Microgrid</h3>
            <p className="text-xs text-slate-400 font-mono">Quantum Solid-State Storage Active</p>
          </div>
        </div>

        {/* Time tabs */}
        <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/5 font-mono text-xs">
          {(['1h', '24h', '7d'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-2.5 py-1 rounded-lg uppercase transition-all duration-200 ${
                timeframe === t
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Tiles Row */}
      <div className="grid grid-cols-3 gap-3 mb-4 font-mono">
        <div className="p-3 rounded-xl bg-black/30 border border-white/5 relative">
          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
            <span>CONSUMPTION</span>
            <span className="text-emerald-400 text-[9px] flex items-center">
              <TrendingDown className="w-3 h-3 mr-0.5" /> -14%
            </span>
          </div>
          <div className="text-lg font-bold text-white">1.42 <span className="text-xs text-slate-400">kW</span></div>
        </div>

        <div className="p-3 rounded-xl bg-black/30 border border-white/5 relative">
          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
            <span className="flex items-center gap-1">
              <Sun className="w-3 h-3 text-amber-400" /> SOLAR
            </span>
            <span className="text-amber-400 text-[9px]">Peak</span>
          </div>
          <div className="text-lg font-bold text-amber-300">3.85 <span className="text-xs text-slate-400">kW</span></div>
        </div>

        <div className="p-3 rounded-xl bg-black/30 border border-white/5 relative">
          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
            <span className="flex items-center gap-1">
              <BatteryCharging className="w-3 h-3 text-cyan-400" /> BATTERY
            </span>
            <span className="text-cyan-400 text-[9px]">96%</span>
          </div>
          <div className="text-lg font-bold text-cyan-300">18.4 <span className="text-xs text-slate-400">kWh</span></div>
        </div>
      </div>

      {/* Glass SVG Chart */}
      <div className="relative w-full h-36 bg-black/20 rounded-xl p-2 border border-white/5 overflow-hidden flex flex-col justify-end">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="energyAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="energyLineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>

            <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Area Fill */}
          <path d={areaD} fill="url(#energyAreaGradient)" />

          {/* Glowing Line */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#energyLineGradient)"
            strokeWidth="3"
            filter="url(#glowEffect)"
            strokeLinecap="round"
          />

          {/* Interactive Data Points */}
          {svgCoords.map((pt, idx) => {
            const isHovered = hoveredPoint === idx;
            return (
              <g 
                key={idx} 
                onMouseEnter={() => setHoveredPoint(idx)}
                onMouseLeave={() => setHoveredPoint(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 6 : 4}
                  fill="#ffffff"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  className="transition-all duration-150"
                />
                {isHovered && (
                  <g>
                    <rect
                      x={pt.x - 30}
                      y={pt.y - 28}
                      width="60"
                      height="20"
                      rx="4"
                      fill="rgba(10, 14, 22, 0.9)"
                      stroke="rgba(245, 158, 11, 0.5)"
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 14}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {pt.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between items-center px-2 pt-1 border-t border-white/5 text-[10px] font-mono text-slate-500">
          {points.map((p, idx) => (
            <span key={idx}>{p.time}</span>
          ))}
        </div>
      </div>

    </div>
  );
};
