import { useState, useEffect } from 'react';
import { ArrowLeft, X, Loader2, AlertCircle } from 'lucide-react';
import { getAssetUrl } from '../utils/assets';
import { authStorage, authApi, GOOGLE_WEB_CLIENT_ID, type UserProfile } from '../services/auth';
import { NeuroLoader } from './NeuroLoader';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';

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
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
            }) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

// Singleton tracker to prevent multiple GSI initializations
let isGsiInitialized = false;
let gsiSuccessHandler: ((credential: string) => void) | null = null;

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

  // Keep gsiSuccessHandler updated with current component state/props
  useEffect(() => {
    if (!isOpen) return;

    gsiSuccessHandler = async (credential: string) => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [res] = await Promise.all([
          authApi.loginWithGoogle({ idToken: credential }),
          new Promise((resolve) => setTimeout(resolve, 1000)),
        ]);
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
    };
  }, [isOpen, onClose, onSignInSuccess]);

  // Initialize Google Identity Services exactly once
  useEffect(() => {
    if (!isOpen) return;

    let checkInterval: ReturnType<typeof setInterval> | null = null;

    const setupGoogle = () => {
      if (!window.google?.accounts?.id) return false;

      if (!isGsiInitialized) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_WEB_CLIENT_ID,
            callback: (response) => {
              if (response.credential && gsiSuccessHandler) {
                gsiSuccessHandler(response.credential);
              }
            },
          });
          isGsiInitialized = true;
        } catch (err) {
          console.error('GIS initialization error:', err);
        }
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
  }, [isOpen]);

  // Listen for authentication event from hosted auth popup (auth-mobile.html)
  // Supports both web postMessage AND native iOS/Android deep linking (in.neurolinx.neuroseries://auth)
  useEffect(() => {
    if (!isOpen) return;

    // 1. Web message listener (for multi-window popups)
    const handleAuthMessage = (e: MessageEvent) => {
      if (e.data?.type === 'NEURO_AUTH_SUCCESS' && e.data?.token && e.data?.user) {
        authStorage.setSession(e.data.token, e.data.user);
        Browser.close().catch(() => {});
        onSignInSuccess?.(e.data.user);
        onClose();
      }
    };
    window.addEventListener('message', handleAuthMessage);

    // 2. Native deep link listener (for iOS SFSafariViewController & Android deep link)
    let removeListener: (() => void) | null = null;
    CapApp.addListener('appUrlOpen', async (event) => {
      if (event.url && event.url.startsWith('in.neurolinx.neuroseries://auth')) {
        try {
          const urlObj = new URL(event.url);
          const token = urlObj.searchParams.get('token');
          const userParam = urlObj.searchParams.get('user');
          if (token) {
            const user = userParam ? JSON.parse(decodeURIComponent(userParam)) : null;
            if (user) {
              authStorage.setSession(token, user);
              onSignInSuccess?.(user);
            } else {
              // Fetch fresh profile with the received token
              localStorage.setItem('neuro_auth_token', token);
              const profile = await authApi.getProfile();
              if (profile) onSignInSuccess?.(profile);
            }
            await Browser.close().catch(() => {});
            onClose();
          }
        } catch (err) {
          console.error('Deep link auth parsing error:', err);
        }
      }
    }).then(handler => {
      removeListener = () => handler.remove();
    }).catch(() => {});

    return () => {
      window.removeEventListener('message', handleAuthMessage);
      if (removeListener) removeListener();
    };
  }, [isOpen, onClose, onSignInSuccess]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [res] = await Promise.all([
        authApi.loginWithPhone(identifier.trim()),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
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

  const handleGoogleSignInClick = async () => {
    if (isLoading) return;
    setErrorMessage(null);

    const isNativeMobile = Capacitor.isNativePlatform() || 
      window.location.protocol === 'capacitor:' || 
      (window.location.hostname === 'localhost' && !import.meta.env.DEV);

    // On mobile devices, launch the hosted auth-mobile.html bridge on neurolinx.in
    // via native SFSafariViewController on iOS / Chrome Custom Tabs on Android
    // to guarantee 100% Google origin verification and eliminate Error 400 origin_mismatch
    if (isNativeMobile) {
      const authUrl = 'https://neurolinx.in/neuro-series/auth-mobile.html';
      try {
        await Browser.open({ url: authUrl, presentationStyle: 'popover' });
      } catch {
        window.open(authUrl, '_blank');
      }
      return;
    }

    // 1. Preferred modern flow: Google OAuth2 popup dialog
    if (window.google?.accounts?.oauth2) {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_WEB_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              console.warn('Google OAuth response notice:', tokenResponse);
              if (tokenResponse.error !== 'popup_closed_by_user') {
                setErrorMessage(tokenResponse.error_description || tokenResponse.error || 'Google login cancelled');
              }
              return;
            }

            if (tokenResponse.access_token) {
              setIsLoading(true);
              try {
                const [res] = await Promise.all([
                  authApi.loginWithGoogle({ accessToken: tokenResponse.access_token }),
                  new Promise((resolve) => setTimeout(resolve, 1000)),
                ]);
                if (res.success && res.user) {
                  onSignInSuccess?.(res.user);
                  onClose();
                } else {
                  setErrorMessage(res.error || 'Google login failed');
                }
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Google authentication failed';
                setErrorMessage(msg);
              } finally {
                setIsLoading(false);
              }
            }
          },
        });

        // Request access token with account picker modal
        client.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.warn('Could not launch OAuth2 token client:', err);
      }
    }

    // 2. Fallback: prompt Google One Tap
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setErrorMessage('Google Sign-In is initializing. Please wait a moment and try again.');
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
      {/* Real-time Neuro Series Glowing Light Blue Loader */}
      {isLoading && <NeuroLoader message="Signing in..." />}

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
              className="group w-full flex items-center justify-center gap-3 py-3 px-5 rounded-2xl bg-white/90 hover:bg-white border border-slate-200/90 shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-60 active:scale-[0.99]"
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
