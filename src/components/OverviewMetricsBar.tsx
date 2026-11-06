import { 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Wind, 
  ArrowUpRight 
} from 'lucide-react';

export const OverviewMetricsBar = () => {
  const metrics = [
    {
      title: 'Atmospheric Health',
      value: '99.4',
      unit: '/100',
      status: 'Pristine Bio-Climate',
      icon: Sparkles,
      color: 'text-cyan-400',
      bgGlow: 'from-cyan-500/10 to-transparent',
      borderColor: 'border-cyan-500/20',
      trend: '+2.1% efficiency'
    },
    {
      title: 'Current Power Draw',
      value: '1.42',
      unit: 'kW',
      status: 'Solar Microgrid Active',
      icon: Zap,
      color: 'text-amber-400',
      bgGlow: 'from-amber-500/10 to-transparent',
      borderColor: 'border-amber-500/20',
      trend: '-18% vs avg'
    },
    {
      title: 'Vault Security',
      value: '100%',
      unit: 'Secure',
      status: '14 Biometric Gates Armed',
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bgGlow: 'from-emerald-500/10 to-transparent',
      borderColor: 'border-emerald-500/20',
      trend: 'Zero alerts'
    },
    {
      title: 'Clean Air Index',
      value: '2.1',
      unit: 'µg/m³',
      status: 'HEPA Ionizer Operating',
      icon: Wind,
      color: 'text-violet-400',
      bgGlow: 'from-violet-500/10 to-transparent',
      borderColor: 'border-violet-500/20',
      trend: 'AQI 11 Ultra Pure'
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {metrics.map((m, idx) => {
        const Icon = m.icon;
        return (
          <div
            key={idx}
            className={`glass-card p-4 relative overflow-hidden group cursor-pointer border ${m.borderColor}`}
          >
            {/* Top Gloss Reflection */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />

            {/* Subtle Colored Aura Corner */}
            <div className={`absolute -top-12 -right-12 w-28 h-28 rounded-full bg-gradient-to-br ${m.bgGlow} blur-xl pointer-events-none`} />

            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                {m.title}
              </span>
              <div className={`p-1.5 rounded-lg bg-black/40 ${m.color} border border-white/5`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="flex items-baseline gap-1 my-1">
              <span className="text-2xl font-extrabold font-mono tracking-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                {m.value}
              </span>
              <span className="text-xs font-mono text-slate-400 font-medium">
                {m.unit}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] font-mono">
              <span className="text-slate-300 font-medium">{m.status}</span>
              <span className="text-emerald-400 flex items-center">
                <ArrowUpRight className="w-3 h-3" /> {m.trend}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
