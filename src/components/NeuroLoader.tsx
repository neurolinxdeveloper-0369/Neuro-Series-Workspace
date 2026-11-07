interface NeuroLoaderProps {
  message?: string;
}

export const NeuroLoader = ({ message = 'Connecting to Neuro Series...' }: NeuroLoaderProps) => {
  return (
    <div 
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center select-none pointer-events-auto font-sans animate-in fade-in duration-200"
      style={{
        backgroundColor: 'transparent',
      }}
    >
      {/* Center Transparent Loader without background colors or boxes */}
      <div className="relative flex flex-col items-center justify-center bg-transparent">
        {/* Light Blue Glowing Rotating Ring Loader */}
        <div className="neuro-loader" />

        {/* Message label below loader */}
        {message && (
          <p className="mt-6 text-sm sm:text-base font-semibold text-slate-800 tracking-wide text-center font-sans drop-shadow-sm">
            {message}
          </p>
        )}
      </div>
    </div>
  );
};
