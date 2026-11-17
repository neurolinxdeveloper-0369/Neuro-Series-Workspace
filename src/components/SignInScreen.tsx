import type { HelpTopic } from './HelpCenter';
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, X, Loader2, AlertCircle, Mail, RotateCw, CheckCircle2 } from 'lucide-react';
import { getAssetUrl } from '../utils/assets';
import { authStorage, authApi, GOOGLE_WEB_CLIENT_ID, type UserProfile } from '../services/auth';
import { NeuroLoader } from './NeuroLoader';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Brand-accurate WhatsApp SVG Icon
const WhatsAppIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

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
  onHelp: (topic: HelpTopic) => void;
  onSignInSuccess?: (user: UserProfile) => void;
}

export const SignInScreen = ({ isOpen, onClose, onSignInSuccess, onHelp }: SignInScreenProps) => {
  const [step, setStep] = useState<'identifier' | 'otp'>('identifier');
  const [authMethod, setAuthMethod] = useState<'whatsapp' | 'email'>('whatsapp');
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
    const effectiveMethod = isEmail ? 'email' : authMethod;

    try {
      if (effectiveMethod === 'email') {
        // Send Email OTP
        setAuthMethod('email');
        const res = await authApi.sendEmailOtp(cleanId.toLowerCase());
        if (res.success) {
          setStep('otp');
          setOtp(['', '', '', '', '', '']);
          setSuccessMessage(`A 6-digit verification code has been sent to ${cleanId}`);
          setResendCooldown(60);
        } else {
          setErrorMessage(res.message || 'Failed to send OTP code');
        }
      } else {
        // WhatsApp OTP flow via OpenWA Gateway
        setAuthMethod('whatsapp');
        const res = await authApi.sendWhatsAppOtp(cleanId);
        if (res.success) {
          setStep('otp');
          setOtp(['', '', '', '', '', '']);
          setSuccessMessage(`A 6-digit verification code has been sent to your WhatsApp at ${res.phoneNumber || cleanId}`);
          setResendCooldown(60);
        } else {
          setErrorMessage(res.message || 'Failed to send WhatsApp verification code');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send verification code';
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

  // Verify OTP submission (Supports both WhatsApp and Email)
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6 || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const isEmail = identifier.includes('@') || authMethod === 'email';
      const res = isEmail
        ? await authApi.verifyEmailOtp(identifier.trim().toLowerCase(), code)
        : await authApi.verifyWhatsAppOtp(identifier.trim(), code);

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
      const isEmail = identifier.includes('@') || authMethod === 'email';
      if (isEmail) {
        const res = await authApi.sendEmailOtp(identifier.trim().toLowerCase());
        if (res.success) {
          setResendCooldown(60);
          setSuccessMessage('A new verification code has been sent to your email!');
        } else {
          setErrorMessage(res.message || 'Failed to resend OTP');
        }
      } else {
        const res = await authApi.sendWhatsAppOtp(identifier.trim());
        if (res.success) {
          setResendCooldown(60);
          setSuccessMessage(`A new verification code has been sent to your WhatsApp at ${res.phoneNumber || identifier}`);
        } else {
          setErrorMessage(res.message || 'Failed to resend WhatsApp OTP');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not resend OTP';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Single Direct Google Sign-In Handler
  const handleGoogleSignInClick = async () => {
    if (isLoading) return;
    setErrorMessage(null);

    // Direct Google OAuth 2.0 authorization endpoint registered for https://neurolinx.in/neuro-series/
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_WEB_CLIENT_ID}&redirect_uri=${encodeURIComponent('https://neurolinx.in/neuro-series/')}&response_type=token&scope=${encodeURIComponent('openid profile email')}&prompt=select_account`;

    // 1. On Native Mobile (Capacitor Android / iOS):
    // Directly opens Google's official account selector dialog without ANY intermediate website
    if (Capacitor.isNativePlatform()) {
      try {
        await Browser.open({ url: googleAuthUrl, presentationStyle: 'popover' });
      } catch {
        window.open(googleAuthUrl, '_blank');
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
    window.location.href = googleAuthUrl;
  };

  return (
    <div
      className="app-screen fixed inset-0 z-50 overflow-y-auto flex flex-col justify-between select-none pointer-events-auto font-sans animate-in fade-in duration-200"
    >
      {/* Real-time Neuro Series Glowing Light Blue Loader */}
      {isLoading && <NeuroLoader message={step === 'otp' ? 'Verifying code...' : 'Please wait...'} />}

      {/* Top Header */}
      <header className="screen-top-header w-full flex items-center justify-between px-5 sm:px-10 py-5 sm:py-6">
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
            aria-label="Go back" data-screen-back
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
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 text-center leading-snug tracking-tight mb-6 max-w-sm sm:max-w-md font-sans">
              Every smart home begins with a single connection
            </h1>

            {/* Error banner */}
            {errorMessage && (
              <div className="w-full mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* WhatsApp OTP vs Email OTP Method Tabs */}
            <div className="flex items-center justify-center p-1 bg-white/80 backdrop-blur-md rounded-2xl border border-white/90 shadow-2xs mb-5 w-full">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('whatsapp');
                  setErrorMessage(null);
                  if (identifier.includes('@')) setIdentifier('');
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                  authMethod === 'whatsapp'
                    ? 'bg-[#25D366] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                <WhatsAppIcon className="w-4 h-4" />
                <span>WhatsApp OTP</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('email');
                  setErrorMessage(null);
                  if (!identifier.includes('@') && /^\d+$/.test(identifier)) setIdentifier('');
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                  authMethod === 'email'
                    ? 'bg-[#0284c7] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>Email OTP</span>
              </button>
            </div>

            {/* Identifier Form */}
            <form onSubmit={handleIdentifierSubmit} className="w-full space-y-4">
              {authMethod === 'whatsapp' ? (
                <div>
                  <div className="relative flex items-center bg-white rounded-2xl border border-slate-300 focus-within:border-[#25D366] focus-within:ring-4 focus-within:ring-emerald-100 shadow-xs transition-all">
                    <div className="pl-4 pr-2.5 flex items-center gap-1.5 text-slate-600 font-semibold text-xs sm:text-sm select-none border-r border-slate-200 my-2">
                      <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                      <span>+91</span>
                    </div>
                    <input
                      type="tel"
                      value={identifier}
                      onChange={(e) => {
                        const val = e.target.value;
                        setIdentifier(val);
                        if (val.includes('@')) setAuthMethod('email');
                      }}
                      placeholder="Enter 10-digit mobile number"
                      disabled={isLoading}
                      required
                      autoFocus
                      className="w-full px-3.5 py-3.5 bg-transparent text-slate-900 placeholder:text-slate-400 font-sans text-sm sm:text-base outline-none disabled:opacity-60 font-medium"
                    />
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1.5 px-1">
                    A 6-digit login OTP will be sent directly to your WhatsApp.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="relative flex items-center bg-white rounded-2xl border border-slate-300 focus-within:border-[#0284c7] focus-within:ring-4 focus-within:ring-sky-100 shadow-xs transition-all">
                    <div className="pl-4 pr-2 text-slate-400">
                      <Mail className="w-4 h-4 text-[#0284c7]" />
                    </div>
                    <input
                      type="email"
                      value={identifier}
                      onChange={(e) => {
                        const val = e.target.value;
                        setIdentifier(val);
                        if (!val.includes('@') && /^\d{3,}$/.test(val)) setAuthMethod('whatsapp');
                      }}
                      placeholder="name@example.com"
                      disabled={isLoading}
                      required
                      autoFocus
                      className="w-full px-3 py-3.5 bg-transparent text-slate-900 placeholder:text-slate-400 font-sans text-sm sm:text-base outline-none disabled:opacity-60"
                    />
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1.5 px-1">
                    A 6-digit verification code will be sent to your email.
                  </p>
                </div>
              )}

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
                  className={`w-full py-3.5 px-6 rounded-2xl text-white font-bold text-sm sm:text-base tracking-wide transition-all duration-200 shadow-md active:scale-[0.99] flex items-center justify-center cursor-pointer disabled:opacity-70 ${
                    authMethod === 'whatsapp'
                      ? 'bg-[#25D366] hover:bg-[#1ebd59] shadow-emerald-600/25'
                      : 'bg-[#0284c7] hover:bg-[#0369a1] shadow-sky-600/25'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : authMethod === 'whatsapp' ? (
                    <span className="flex items-center gap-2">
                      <WhatsAppIcon className="w-4 h-4" />
                      <span>Send WhatsApp OTP</span>
                    </span>
                  ) : (
                    'Send Email OTP'
                  )}
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

        {/* Step 2: OTP Verification (WhatsApp or Email) */}
        {step === 'otp' && (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-200">
            {/* Branded Icon badge */}
            {authMethod === 'whatsapp' ? (
              <div className="w-16 h-16 rounded-full bg-emerald-50 shadow-md border-2 border-emerald-400/50 flex items-center justify-center mb-4 text-[#25D366]">
                <WhatsAppIcon className="w-8 h-8" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-white shadow-md border border-sky-100 flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-[#0284c7]" strokeWidth={2.2} />
              </div>
            )}

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 text-center leading-snug tracking-tight mb-2 font-sans">
              {authMethod === 'whatsapp' ? 'Verify your WhatsApp' : 'Verify your email'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 text-center mb-6 max-w-xs font-sans">
              Enter the 6-digit verification code sent to{' '}
              {authMethod === 'whatsapp' ? 'your WhatsApp at ' : ''}
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
                    aria-label={`Verification code digit ${idx + 1}`}
                    autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    disabled={isLoading}
                    className={`w-full min-w-0 max-w-12 h-12 sm:max-w-13 sm:h-16 text-center text-xl sm:text-2xl font-bold text-slate-900 bg-white border-2 rounded-2xl outline-none shadow-xs transition-all disabled:opacity-60 ${
                      authMethod === 'whatsapp'
                        ? 'border-slate-300 focus:border-[#25D366] focus:ring-4 focus:ring-emerald-100'
                        : 'border-slate-300 focus:border-[#0284c7] focus:ring-4 focus:ring-sky-100'
                    }`}
                  />
                ))}
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                disabled={isLoading || otp.join('').length < 6}
                className={`w-full py-3.5 px-6 rounded-2xl text-white font-bold text-sm sm:text-base tracking-wide transition-all duration-200 shadow-md active:scale-[0.99] flex items-center justify-center cursor-pointer disabled:opacity-50 ${
                  authMethod === 'whatsapp'
                    ? 'bg-[#25D366] hover:bg-[#1ebd59] shadow-emerald-600/25'
                    : 'bg-[#0284c7] hover:bg-[#0369a1] shadow-sky-600/25'
                }`}
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
                    className={`font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                      authMethod === 'whatsapp'
                        ? 'text-emerald-600 hover:text-emerald-700'
                        : 'text-[#0284c7] hover:text-[#0369a1]'
                    }`}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Resend code {authMethod === 'whatsapp' ? 'via WhatsApp' : 'via email'}</span>
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
                  Change {authMethod === 'whatsapp' ? 'phone number' : 'email address'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-6 px-4 text-center mt-auto">
        <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 gap-y-2 text-xs text-slate-500 font-sans max-w-2xl mx-auto">
          <button type="button" className="min-h-10 hover:text-slate-900" onClick={() => onHelp('account')}>Sign-in help</button>
          <button type="button" className="min-h-10 hover:text-slate-900" onClick={() => onHelp('privacy')}>Account and device data</button>
          <button type="button" className="min-h-10 hover:text-slate-900" onClick={() => onHelp('contact')}>Contact support</button>
        </div>
      </footer>
    </div>
  );
};

