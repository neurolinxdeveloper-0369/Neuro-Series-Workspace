interface AmbientBackgroundProps {
  scene: string;
}

export const AmbientBackground = ({ scene }: AmbientBackgroundProps) => {
  // Dynamic color accents based on active scene
  const getGlowColors = () => {
    switch (scene) {
      case 'Cyber Neon':
        return {
          orb1: 'bg-cyan-500/25',
          orb2: 'bg-fuchsia-600/25',
          orb3: 'bg-blue-600/20',
          orb4: 'bg-violet-500/20',
        };
      case 'Midnight Obsidian':
        return {
          orb1: 'bg-blue-600/15',
          orb2: 'bg-indigo-700/15',
          orb3: 'bg-slate-700/20',
          orb4: 'bg-cyan-800/15',
        };
      case 'Deep Focus':
        return {
          orb1: 'bg-emerald-500/20',
          orb2: 'bg-teal-600/20',
          orb3: 'bg-cyan-600/15',
          orb4: 'bg-sky-700/15',
        };
      case 'Solar Awakening':
        return {
          orb1: 'bg-amber-500/25',
          orb2: 'bg-orange-600/20',
          orb3: 'bg-rose-600/20',
          orb4: 'bg-yellow-500/15',
        };
      case 'Cinema Dome':
        return {
          orb1: 'bg-purple-900/25',
          orb2: 'bg-indigo-900/25',
          orb3: 'bg-red-950/20',
          orb4: 'bg-blue-950/20',
        };
      default:
        return {
          orb1: 'bg-cyan-500/20',
          orb2: 'bg-violet-600/20',
          orb3: 'bg-blue-600/18',
          orb4: 'bg-indigo-500/18',
        };
    }
  };

  const colors = getGlowColors();

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Deep Obsidian Canvas */}
      <div className="absolute inset-0 bg-[#040507]" />

      {/* Atmospheric Glowing Orbs under the Glass */}
      <div
        className={`absolute -top-32 -left-28 w-[550px] h-[550px] rounded-full blur-[130px] transition-colors duration-1000 ${colors.orb1} animate-float-1`}
      />
      <div
        className={`absolute top-1/4 -right-36 w-[620px] h-[620px] rounded-full blur-[150px] transition-colors duration-1000 ${colors.orb2} animate-float-2`}
      />
      <div
        className={`absolute -bottom-40 left-1/3 w-[580px] h-[580px] rounded-full blur-[140px] transition-colors duration-1000 ${colors.orb3} animate-float-3`}
      />
      <div
        className={`absolute top-2/3 -left-32 w-[480px] h-[480px] rounded-full blur-[125px] transition-colors duration-1000 ${colors.orb4} animate-float-1`}
      />

      {/* Radial Obsidian Vignette to concentrate focus */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 30%, transparent 20%, rgba(4, 5, 7, 0.75) 80%, #040507 100%)'
        }}
      />

      {/* Micro Tech Grid Overlay for physical glass depth */}
      <div 
        className="absolute inset-0 opacity-[0.035] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]"
      />
    </div>
  );
};
