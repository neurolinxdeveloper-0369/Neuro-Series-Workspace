import { useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { getAssetUrl } from '../utils/assets';

interface SignInScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onSignInSuccess?: (identifier?: string) => void;
}

export const SignInScreen = ({ isOpen, onClose, onSignInSuccess }: SignInScreenProps) => {
  const [identifier, setIdentifier] = useState('');
  const [rememberId, setRememberId] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    onSignInSuccess?.(identifier);
    onClose();
  };

  const handleGoogleSignIn = () => {
    onSignInSuccess?.('Google User');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto flex flex-col justify-between select-none pointer-events-auto font-sans animate-in fade-in duration-200"
      style={{
        backgroundColor: '#d4edf4',
        backgroundImage: `
          radial-gradient(circle at 10% 10%, rgba(255, 255, 255, 0.95) 0%, transparent 50%),
          radial-gradient(circle at 90% 90%, rgba(255, 255, 255, 0.90) 0%, transparent 50%)
        `,
      }}
    >
      {/* Top Header: Left side "Neuro Series Account" with back arrow, Right side close button */}
      <header className="w-full flex items-center justify-between px-5 sm:px-10 py-5 sm:py-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full text-slate-700 hover:text-slate-900 hover:bg-white/60 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.2} />
          </button>
          <span className="text-base sm:text-xl font-bold text-slate-900 tracking-tight font-sans">
            Neuro Series Account
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.2} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-md mx-auto px-6 py-6 sm:py-10 flex flex-col items-center justify-center flex-1">
        {/* Center Subtitle/Headline Text */}
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 text-center leading-snug tracking-tight mb-8 max-w-sm sm:max-w-md font-sans">
          Every smart home begins with a single connection
        </h1>

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* Phone number or email input field */}
          <div>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Phone number or email"
              required
              className="w-full px-4 py-3.5 rounded-2xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 font-sans text-sm sm:text-base outline-none focus:border-[#0284c7] focus:ring-4 focus:ring-sky-100 shadow-xs transition-all"
            />
          </div>

          {/* Remember my ID checkbox */}
          <div className="flex items-center pt-0.5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberId}
                onChange={(e) => setRememberId(e.target.checked)}
                className="w-4 h-4 rounded text-[#0284c7] focus:ring-[#0284c7] border-slate-300 accent-[#0284c7] cursor-pointer"
              />
              <span className="text-xs sm:text-sm font-medium text-slate-700 font-sans">
                Remember my ID
              </span>
            </label>
          </div>

          {/* Next Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-2xl bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-sm sm:text-base tracking-wide transition-all duration-200 shadow-md shadow-sky-600/25 active:scale-[0.99] flex items-center justify-center cursor-pointer"
            >
              Next
            </button>
          </div>

          {/* Trying to sign in with Google? with transparent google image */}
          <div className="pt-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="group w-full flex items-center justify-center gap-3 py-3 px-5 rounded-2xl bg-white/90 hover:bg-white border border-slate-200/90 shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer"
            >
              <img 
                src={getAssetUrl('google.svg')} 
                alt="Google" 
                className="w-5 h-5 object-contain flex-shrink-0"
              />
              <span className="text-xs sm:text-sm font-semibold text-slate-700 group-hover:text-slate-900 font-sans">
                Trying to sign in with Google?
              </span>
            </button>
          </div>
        </form>
      </main>

      {/* Footer: Terms and conditions, Neuro Series Account privacy notice, Contact us */}
      <footer className="w-full py-6 px-4 text-center mt-auto">
        <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 gap-y-2 text-xs text-slate-500 font-sans max-w-2xl mx-auto">
          <a href="#terms" onClick={(e) => e.preventDefault()} className="hover:text-slate-900 transition-colors">
            Terms and Conditions
          </a>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <a href="#privacy" onClick={(e) => e.preventDefault()} className="hover:text-slate-900 transition-colors">
            Neuro Series Account Privacy Notice
          </a>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <a href="#contact" onClick={(e) => e.preventDefault()} className="hover:text-slate-900 transition-colors">
            Contact us
          </a>
        </div>
      </footer>
    </div>
  );
};
