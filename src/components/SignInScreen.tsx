import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, X, Loader2, AlertCircle } from 'lucide-react';
import { getAssetUrl } from '../utils/assets';
import { authApi, GOOGLE_WEB_CLIENT_ID, type UserProfile } from '../services/auth';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (notification?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
            }
          ) => void;
        };
      };
    };
  }
}

interface SignInScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onSignInSuccess?: (user: UserProfile) => void;
}

export const SignInScreen = ({ isOpen, onClose, onSignInSuccess }: SignInScreenProps) => {
  const [identifier, setIdentifier] = useState('');
  const [rememberId, setRememberId] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Google Identity Services
  useEffect(() => {
    if (!isOpen) return;

    let checkInterval: ReturnType<typeof setInterval> | null = null;

    const setupGoogle = () => {
      if (!window.google?.accounts?.id) return false;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_WEB_CLIENT_ID,
        callback: async (response) => {
          if (!response.credential) return;

          setIsLoading(true);
          setErrorMessage(null);

          try {
            const res = await authApi.loginWithGoogle(response.credential);
            if (res.success && res.user) {
              onSignInSuccess?.(res.user);
              onClose();
            } else {
              setErrorMessage(res.error || 'Google Sign-In failed');
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Google authentication failed';
            setErrorMessage(msg);
          } finally {
            setIsLoading(false);
          }
        },
      });

      // Render official Google button into container if mounted
      if (googleBtnContainerRef.current) {
        googleBtnContainerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          width: 320,
        });
      }

      return true;
    };

    if (!setupGoogle()) {
      checkInterval = setInterval(() => {
        if (setupGoogle() && checkInterval) {
          clearInterval(checkInterval);
        }
      }, 300);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [isOpen, onClose, onSignInSuccess]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await authApi.loginWithPhone(identifier.trim());
      if (res.success && res.user) {
        onSignInSuccess?.(res.user);
        onClose();
      } else {
        setErrorMessage(res.error || 'Authentication failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sign in';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignInClick = () => {
    if (isLoading) return;
    setErrorMessage(null);

    if (window.google?.accounts?.id) {
      // Trigger Google One Tap or prompt
      window.google.accounts.id.prompt();
      // If the rendered button exists, simulate click for direct popup
      const renderedBtn = googleBtnContainerRef.current?.querySelector('div[role="button"]') as HTMLElement | null;
      if (renderedBtn) {
        renderedBtn.click();
      }
    } else {
      setErrorMessage('Google Sign-In service is still loading. Please check your internet connection and try again.');
    }
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
      {/* Top Header */}
      <header className="w-full flex items-center justify-between px-5 sm:px-10 py-5 sm:py-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full text-slate-700 hover:text-slate-900 hover:bg-white/60 transition-colors cursor-pointer"
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
          className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-colors cursor-pointer"
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

        {/* Error notification banner */}
        {errorMessage && (
          <div className="w-full mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* Phone number or email input field */}
          <div>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Phone number or email"
              disabled={isLoading}
              required
              className="w-full px-4 py-3.5 rounded-2xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 font-sans text-sm sm:text-base outline-none focus:border-[#0284c7] focus:ring-4 focus:ring-sky-100 shadow-xs transition-all disabled:opacity-60"
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
              disabled={isLoading}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-sm sm:text-base tracking-wide transition-all duration-200 shadow-md shadow-sky-600/25 active:scale-[0.99] flex items-center justify-center cursor-pointer disabled:opacity-70"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Next'
              )}
            </button>
          </div>

          {/* Trying to sign in with Google? with transparent google image */}
          <div className="pt-3">
            <button
              type="button"
              onClick={handleGoogleSignInClick}
              disabled={isLoading}
              className="group w-full flex items-center justify-center gap-3 py-3 px-5 rounded-2xl bg-white/90 hover:bg-white border border-slate-200/90 shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-60"
            >
              <img 
                src={getAssetUrl('google.svg')} 
                alt="Google" 
                className="w-5 h-5 object-contain flex-shrink-0"
              />
              <span className="text-xs sm:text-sm font-semibold text-slate-700 group-hover:text-slate-900 font-sans">
                {isLoading ? 'Signing in with Google...' : 'Trying to sign in with Google?'}
              </span>
            </button>
          </div>

          {/* Hidden/Offscreen Google GIS rendered button for official popup click */}
          <div 
            ref={googleBtnContainerRef} 
            className="flex justify-center pt-2 opacity-90 scale-95" 
          />
        </form>
      </main>

      {/* Footer */}
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
