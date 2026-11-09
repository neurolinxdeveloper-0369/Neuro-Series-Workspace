import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, X, Loader2, AlertCircle, Mail, RotateCw, CheckCircle2 } from 'lucide-react';
import { getAssetUrl } from '../utils/assets';
import { authStorage, authApi, GOOGLE_WEB_CLIENT_ID, type UserProfile } from '../services/auth';
import { NeuroLoader } from './NeuroLoader';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

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

interface SignInScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onSignInSuccess?: (user: UserProfile) => void;
}

export const SignInScreen = ({ isOpen, onClose, onSignInSuccess }: SignInScreenProps) => {
  const [step, setStep] = useState<'identifier' | 'otp'>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [rememberId, setRememberId] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus first OTP field when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 150);
    }
  }, [step]);

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
    }).then((handler) => {
      removeListener = () => handler.remove();
    }).catch(() => {});

    return () => {
      window.removeEventListener('message', handleAuthMessage);
      if (removeListener) removeListener();
    };
  }, [isOpen, onClose, onSignInSuccess]);

  if (!isOpen) return null;

  // Handle Identifier Form Submit (Phone or Email)
  const handleIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const isEmail = cleanId.includes('@');

    try {
      if (isEmail) {
        // Send Email OTP
        const res = await authApi.sendEmailOtp(cleanId.toLowerCase());
        if (res.success) {
          setStep('otp');
          setOtp(['', '', '', '', '', '']);
          setResendCooldown(60);
          setSuccessMessage(`A 6-digit verification code has been sent to ${cleanId}`);
        } else {
          setErrorMessage(res.message || 'Failed to send OTP code');
        }
      } else {
        // Phone login flow
        const [res] = await Promise.all([
          authApi.loginWithPhone(cleanId),
          new Promise((resolve) => setTimeout(resolve, 800)),
        ]);
        if (res.success && res.user) {
          onSignInSuccess?.(res.user);
          onClose();
        } else {
          setErrorMessage(res.error || 'Authentication failed');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sign in';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP digit changes
  const handleOtpChange = (index: number, val: string) => {
    // Keep only the last character entered if user is replacing
    const char = val.slice(-1);
    if (char && !/^\d$/.test(char)) return;

    const newOtp = [...otp];
    newOtp[index] = char || '';
    setOtp(newOtp);

    // Auto-advance focus to next field if a digit was entered
    if (char && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  // Handle keyboard navigation in OTP inputs
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        otpInputsRef.current[index - 1]?.focus();
      }
    }
  };

  // Handle paste in OTP inputs
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    const digits = pasted.replace(/\D/g, '').slice(0, 6).split('');
    if (digits.length === 0) return;

    const newOtp = [...otp];
    digits.forEach((d, idx) => {
      newOtp[idx] = d;
    });
    setOtp(newOtp);

    const nextIndex = Math.min(digits.length, 5);
    otpInputsRef.current[nextIndex]?.focus();
  };

  // Verify OTP submission
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6 || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await authApi.verifyEmailOtp(identifier.trim().toLowerCase(), code);
      if (res.success && res.user) {
        onSignInSuccess?.(res.user);
        onClose();
      } else {
        setErrorMessage(res.error || 'Invalid or expired OTP code');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'OTP verification failed';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP code
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await authApi.sendEmailOtp(identifier.trim().toLowerCase());
      if (res.success) {
        setResendCooldown(60);
        setSuccessMessage('A new verification code has been sent!');
      } else {
        setErrorMessage(res.message || 'Failed to resend OTP');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not resend OTP';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Single Google Sign-In Handler
  const handleGoogleSignInClick = async () => {
    if (isLoading) return;
    setErrorMessage(null);

    // 1. On Native Mobile (Capacitor Android / iOS):
    // Embedded WebViews trigger Google's "400 Error: disallowed_useragent".
    // We MUST use the external Chrome Custom Tab via Browser.open().
    if (Capacitor.isNativePlatform()) {
      const authUrl = 'https://neurolinx.in/neuro-series/auth-mobile.html';
      try {
        await Browser.open({ url: authUrl, presentationStyle: 'popover' });
      } catch {
        window.open(authUrl, '_blank');
      }
      return;
    }

    // 2. On Web Desktop / Browser:
    if (window.google?.accounts?.oauth2) {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_WEB_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
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
                  new Promise((resolve) => setTimeout(resolve, 800)),
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

        client.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.warn('OAuth2 client init failed:', err);
      }
    }

    // 3. Fallback for Web if GIS script not ready
    const authUrl = 'https://neurolinx.in/neuro-series/auth-mobile.html';
    window.open(authUrl, '_blank', 'width=500,height=620');
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
      {isLoading && <NeuroLoader message={step === 'otp' ? 'Verifying code...' : 'Please wait...'} />}

      {/* Top Header */}
      <header className="w-full flex items-center justify-between px-5 sm:px-10 py-5 sm:py-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (step === 'otp') {
                setStep('identifier');
                setErrorMessage(null);
                setSuccessMessage(null);
              } else {
                onClose();
              }
            }}
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
        {/* Step 1: Identifier Entry */}
        {step === 'identifier' && (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-200">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 text-center leading-snug tracking-tight mb-8 max-w-sm sm:max-w-md font-sans">
              Every smart home begins with a single connection
            </h1>

            {/* Error banner */}
            {errorMessage && (
              <div className="w-full mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Identifier Form */}
            <form onSubmit={handleIdentifierSubmit} className="w-full space-y-4">
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

              {/* Remember my ID */}
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
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Next'}
                </button>
              </div>

              {/* Single Branded "Continue with Google" Button */}
              <div className="pt-3 w-full flex flex-col items-center justify-center">
                <button
                  type="button"
                  onClick={handleGoogleSignInClick}
                  disabled={isLoading}
                  className="group w-full flex items-center justify-center gap-3 py-3.5 px-5 rounded-2xl bg-white/95 hover:bg-white border border-slate-200/90 shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-60 active:scale-[0.99]"
                >
                  <img
                    src={getAssetUrl('google.svg')}
                    alt="Google"
                    className="w-5 h-5 object-contain flex-shrink-0"
                  />
                  <span className="text-xs sm:text-sm font-semibold text-slate-700 group-hover:text-slate-900 font-sans">
                    {isLoading ? 'Signing in with Google...' : 'Continue with Google'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Email OTP Verification */}
        {step === 'otp' && (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-200">
            {/* Branded Mail Icon badge */}
            <div className="w-16 h-16 rounded-full bg-white shadow-md border border-sky-100 flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-[#0284c7]" strokeWidth={2.2} />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 text-center leading-snug tracking-tight mb-2 font-sans">
              Verify your email
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 text-center mb-6 max-w-xs font-sans">
              Enter the 6-digit verification code sent to{' '}
              <span className="font-semibold text-slate-900 break-all">{identifier}</span>
            </p>

            {/* Error banner */}
            {errorMessage && (
              <div className="w-full mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Success notification banner */}
            {successMessage && !errorMessage && (
              <div className="w-full mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in duration-150">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="font-medium">{successMessage}</span>
              </div>
            )}

            {/* 6-box OTP Input */}
            <form onSubmit={handleOtpSubmit} className="w-full space-y-6">
              <div className="flex items-center justify-center gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputsRef.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    disabled={isLoading}
                    className="w-12 h-14 sm:w-13 sm:h-16 text-center text-xl sm:text-2xl font-bold text-slate-900 bg-white border-2 border-slate-300 rounded-2xl outline-none focus:border-[#0284c7] focus:ring-4 focus:ring-sky-100 shadow-xs transition-all disabled:opacity-60"
                  />
                ))}
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                disabled={isLoading || otp.join('').length < 6}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-sm sm:text-base tracking-wide transition-all duration-200 shadow-md shadow-sky-600/25 active:scale-[0.99] flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Sign In'}
              </button>

              {/* Resend and Edit Actions */}
              <div className="flex flex-col items-center gap-3 pt-2 text-xs sm:text-sm font-sans">
                {resendCooldown > 0 ? (
                  <span className="text-slate-500 font-medium">
                    Resend code in <strong className="text-slate-700">{resendCooldown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isLoading}
                    className="text-[#0284c7] hover:text-[#0369a1] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Resend code
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setStep('identifier');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Change email address
                </button>
              </div>
            </form>
          </div>
        )}
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

