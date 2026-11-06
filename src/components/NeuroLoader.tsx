interface NeuroLoaderProps {
  message?: string;
}

export const NeuroLoader = ({ message = 'Connecting to Neuro Series...' }: NeuroLoaderProps) => {
  return (
    <div 
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center select-none pointer-events-auto font-sans animate-in fade-in duration-200"
      style={{
        backgroundColor: 'rgba(3, 7, 18, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Center White/Black Glass Card */}
      <div 
        className="relative flex flex-col items-center justify-center p-8 sm:p-10 rounded-3xl shadow-2xl"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.90) 0%, rgba(3, 7, 18, 0.95) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(56, 189, 248, 0.18)',
        }}
      >
        {/* Light Blue Glowing Rotating Ring Loader */}
        <div className="neuro-loader" />

        {/* Message label below loader */}
        {message && (
          <p className="mt-6 text-sm sm:text-base font-semibold text-sky-100 tracking-wide text-center font-sans drop-shadow-sm">
            {message}
          </p>
        )}
      </div>
    </div>
  );
};
