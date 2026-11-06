import { useState } from 'react';
import { ArrowLeft, ChevronRight, X } from 'lucide-react';

interface SettingsScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSignIn: () => void;
  isSignedIn?: boolean;
}

export const SettingsScreen = ({ isOpen, onClose, onOpenSignIn, isSignedIn = false }: SettingsScreenProps) => {
  const [featureSuggestions, setFeatureSuggestions] = useState(true);
  const [biometricLock, setBiometricLock] = useState(false);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto flex flex-col select-none pointer-events-auto font-sans animate-in fade-in duration-200"
      style={{
        backgroundColor: '#d4edf4',
        backgroundImage: `
          radial-gradient(circle at 10% 0%, rgba(255, 255, 255, 0.45) 0%, transparent 45%),
          radial-gradient(circle at 90% 100%, rgba(255, 255, 255, 0.45) 0%, transparent 45%)
        `,
      }}
    >
      {/* Top Header: Back Button + Neuro Series Settings */}
      <header className="sticky top-0 z-30 w-full flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5 bg-transparent backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full text-slate-700 hover:text-slate-900 hover:bg-white/40 transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.2} />
          </button>
          <span className="text-base sm:text-xl font-bold text-slate-900 tracking-tight font-sans">
            Neuro Series Settings
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-white/40 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.2} />
        </button>
      </header>

      {/* Main Content: White Cards */}
      <main className="w-full max-w-sm sm:max-w-md md:max-w-lg mx-auto px-4 sm:px-6 py-2 pb-16 space-y-3.5 flex-1">
        
        {/* Card 1: Pure White Card - Sign in heading, description & right arrow */}
        <div 
          onClick={() => {
            onOpenSignIn();
          }}
          className="group w-full rounded-3xl p-5 shadow-md transition-all cursor-pointer hover:bg-slate-50 active:scale-[0.99]"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.95)',
            boxShadow: '0 16px 36px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(0, 0, 0, 0.02)',
          }}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 pr-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 font-sans tracking-tight group-hover:text-[#0284c7] transition-colors">
                {isSignedIn ? 'Neuro Series Account' : 'Sign in'}
              </h3>
              <p className="text-xs sm:text-sm font-normal text-slate-600 leading-snug mt-1 font-sans">
                {isSignedIn
                  ? 'Your smart home is connected and active'
                  : 'Sign in to your neuro series account to make your home into smart'}
              </p>
            </div>
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:text-[#0284c7] transition-colors">
              <ChevronRight className="w-5 h-5" strokeWidth={2.2} />
            </div>
          </div>
        </div>

        {/* Card 2: Pure White Card - Notifications, Feature suggestions with toggle, Biometric lock with toggle (Disabled when not signed in) */}
        <div 
          className={`w-full rounded-3xl p-3.5 sm:p-4 shadow-md transition-all ${
            !isSignedIn ? 'opacity-40 pointer-events-none select-none filter grayscale-[35%]' : ''
          }`}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.95)',
            boxShadow: '0 16px 36px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(0, 0, 0, 0.02)',
          }}
          aria-disabled={!isSignedIn}
        >
          {/* Row 1: Notifications + Right Arrow */}
          <div 
            className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
            role="button"
            tabIndex={isSignedIn ? 0 : -1}
          >
            <span className={`text-xs sm:text-sm font-medium font-sans ${
              !isSignedIn ? 'text-slate-500' : 'text-slate-800 group-hover:text-[#0284c7]'
            } transition-colors`}>
              Notifications
            </span>
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:text-[#0284c7] transition-colors">
              <ChevronRight className="w-4 h-4" strokeWidth={2.2} />
            </div>
          </div>

          {/* Line Divider */}
          <div className="h-px bg-slate-100 w-full my-1" />

          {/* Row 2: Feature suggestions with toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl">
            <span className={`text-xs sm:text-sm font-medium font-sans ${
              !isSignedIn ? 'text-slate-500' : 'text-slate-800'
            }`}>
              Feature suggestions
            </span>
            <button
              type="button"
              disabled={!isSignedIn}
              onClick={() => setFeatureSuggestions(!featureSuggestions)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                !isSignedIn ? 'bg-slate-300' : (featureSuggestions ? 'bg-[#0284c7]' : 'bg-slate-300')
              }`}
              role="switch"
              aria-checked={featureSuggestions}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  featureSuggestions && isSignedIn ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Line Divider */}
          <div className="h-px bg-slate-100 w-full my-1" />

          {/* Row 3: Biometric screen lock with toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl">
            <span className={`text-xs sm:text-sm font-medium font-sans ${
              !isSignedIn ? 'text-slate-500' : 'text-slate-800'
            }`}>
              Biometric screen lock
            </span>
            <button
              type="button"
              disabled={!isSignedIn}
              onClick={() => setBiometricLock(!biometricLock)}
              className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-slate-300"
              role="switch"
              aria-checked={biometricLock}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  biometricLock && isSignedIn ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Card 3: Pure White Card - Privacy Notice, Permissions, Reset app data, About Neuro Series (Disabled when not signed in) */}
        <div 
          className={`w-full rounded-3xl p-3.5 sm:p-4 shadow-md transition-all ${
            !isSignedIn ? 'opacity-40 pointer-events-none select-none filter grayscale-[35%]' : ''
          }`}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.95)',
            boxShadow: '0 16px 36px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(0, 0, 0, 0.02)',
          }}
          aria-disabled={!isSignedIn}
        >
          {/* Row 1: Privacy Notice + Right Arrow */}
          <div 
            className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
            role="button"
            tabIndex={isSignedIn ? 0 : -1}
          >
            <span className={`text-xs sm:text-sm font-medium font-sans ${
              !isSignedIn ? 'text-slate-500' : 'text-slate-800 group-hover:text-[#0284c7]'
            } transition-colors`}>
              Privacy Notice
            </span>
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:text-[#0284c7] transition-colors">
              <ChevronRight className="w-4 h-4" strokeWidth={2.2} />
            </div>
          </div>

          {/* Line Divider */}
          <div className="h-px bg-slate-100 w-full my-1" />

          {/* Row 2: Permissions + Right Arrow */}
          <div 
            className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
            role="button"
            tabIndex={isSignedIn ? 0 : -1}
          >
            <span className={`text-xs sm:text-sm font-medium font-sans ${
              !isSignedIn ? 'text-slate-500' : 'text-slate-800 group-hover:text-[#0284c7]'
            } transition-colors`}>
              Permissions
            </span>
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:text-[#0284c7] transition-colors">
              <ChevronRight className="w-4 h-4" strokeWidth={2.2} />
            </div>
          </div>

          {/* Line Divider */}
          <div className="h-px bg-slate-100 w-full my-1" />

          {/* Row 3: Reset app data */}
          <div 
            className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
            role="button"
            tabIndex={isSignedIn ? 0 : -1}
          >
            <span className={`text-xs sm:text-sm font-medium font-sans ${
              !isSignedIn ? 'text-slate-500' : 'text-red-600 group-hover:text-red-700'
            } transition-colors`}>
              Reset app data
            </span>
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:text-red-600 transition-colors">
              <ChevronRight className="w-4 h-4" strokeWidth={2.2} />
            </div>
          </div>

          {/* Line Divider */}
          <div className="h-px bg-slate-100 w-full my-1" />

          {/* Row 4: About Neuro Series */}
          <div 
            className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
            role="button"
            tabIndex={isSignedIn ? 0 : -1}
          >
            <span className={`text-xs sm:text-sm font-medium font-sans ${
              !isSignedIn ? 'text-slate-500' : 'text-slate-800 group-hover:text-[#0284c7]'
            } transition-colors`}>
              About Neuro Series
            </span>
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:text-[#0284c7] transition-colors">
              <ChevronRight className="w-4 h-4" strokeWidth={2.2} />
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};
