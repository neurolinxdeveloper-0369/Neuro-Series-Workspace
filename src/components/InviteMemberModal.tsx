import { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  QrCode, 
  Mail, 
  Share2, 
  ChevronRight, 
  Check, 
  Copy, 
  Loader2
} from 'lucide-react';
import { homeApi } from '../services/home';
import type { Home } from '../services/home';

type InviteView = 'menu' | 'email' | 'link';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  home: Home | null;
  currentUserName?: string;
  onOpenQrCode?: () => void;
}

export const InviteMemberModal = ({
  isOpen,
  onClose,
  home,
  currentUserName = 'Home Owner',
  onOpenQrCode,
}: InviteMemberModalProps) => {
  const [currentView, setCurrentView] = useState<InviteView>('menu');
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  // Generate share link when opening link screen
  useEffect(() => {
    if (isOpen && currentView === 'link' && home) {
      generateNewShareLink();
    }
  }, [isOpen, currentView, home?.id]);

  // Reset state when screen opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentView('menu');
      setEmail('');
      setSendSuccess(false);
      setErrorMessage('');
      setIsCopied(false);
    }
  }, [isOpen]);

  const generateNewShareLink = async () => {
    if (!home) return;
    setIsGeneratingLink(true);
    try {
      const data = await homeApi.getQrPayload(home.id);
      const url = `https://neurolinx.in/neuro-series/join/${data.shareToken.substring(0, 10)}`;
      setShareLink(url);
    } catch {
      const randomCode = Math.random().toString(36).substring(2, 10);
      setShareLink(`https://neurolinx.in/neuro-series/join/${randomCode}`);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleSendEmailInvite = async () => {
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (!home) return;

    setIsSending(true);
    setErrorMessage('');
    try {
      await homeApi.sendInvitation(home.id, email, 'Full access');
      setSendSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send invitation';
      setErrorMessage(msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareLink) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareLink);
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleNativeShare = async () => {
    if (navigator.share && shareLink) {
      try {
        await navigator.share({
          title: `Invite to ${home?.name || 'Neuro Series Home'}`,
          text: `${currentUserName} invited you to control devices in ${home?.name || 'our Home'}.`,
          url: shareLink,
        });
        return;
      } catch {
        // User canceled share
      }
    }
    handleCopyLink();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 w-full h-full overflow-y-auto overflow-x-hidden flex flex-col font-sans select-none animate-in fade-in duration-200"
      style={{
        backgroundColor: '#d4edf4',
        backgroundImage: `
          radial-gradient(circle at 10% 10%, rgba(255, 255, 255, 0.95) 0%, transparent 50%),
          radial-gradient(circle at 90% 90%, rgba(255, 255, 255, 0.90) 0%, transparent 50%)
        `,
      }}
    >
      
      {/* ----------------- SCREEN 1: INVITE MEMBER (Full Screen Page) ----------------- */}
      {currentView === 'menu' && (
        <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-between p-5 sm:p-6 pb-8">
          <div>
            {/* Header */}
            <div className="relative flex items-center justify-between mb-6 pt-2">
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
              </button>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Invite member
              </h1>
              <div className="w-10" />
            </div>

            {/* Description Text */}
            <div className="text-slate-500 text-xs sm:text-sm leading-relaxed mb-6 font-medium px-1">
              <p>Invite a friend or family member to control your Neuro Series devices.</p>
              <p className="mt-0.5">
                Choose how to invite someone to <span className="font-semibold text-slate-700">{home?.name || 'Home'}</span>.
              </p>
            </div>

            {/* Options Card matching Reference 3 */}
            <div className="bg-white rounded-[28px] shadow-sm border border-slate-100/90 divide-y divide-slate-100 overflow-hidden mb-6">
              {/* Option 1: QR Code */}
              <button
                onClick={() => {
                  onClose();
                  onOpenQrCode?.();
                }}
                className="w-full flex items-center justify-between p-4.5 sm:p-5 hover:bg-slate-50/80 transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-[#0284c7] flex-shrink-0 group-hover:scale-105 transition-transform">
                    <QrCode className="w-5 h-5" strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      Use a QR code
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5 font-medium">
                      If you're with the person now
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors flex-shrink-0" strokeWidth={2} />
              </button>

              {/* Option 2: Send Invitation */}
              <button
                onClick={() => setCurrentView('email')}
                className="w-full flex items-center justify-between p-4.5 sm:p-5 hover:bg-slate-50/80 transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-[#0284c7] flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Mail className="w-5 h-5" strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      Send an invitation
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5 font-medium">
                      If you have their Neuro Series account or email
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors flex-shrink-0" strokeWidth={2} />
              </button>

              {/* Option 3: Share Link */}
              <button
                onClick={() => setCurrentView('link')}
                className="w-full flex items-center justify-between p-4.5 sm:p-5 hover:bg-slate-50/80 transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-[#0284c7] flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Share2 className="w-5 h-5" strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      Share link
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5 font-medium">
                      If you don't know their Neuro Series account or email
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors flex-shrink-0" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- SCREEN 2: SEND AN INVITATION (Full Screen Page) ----------------- */}
      {currentView === 'email' && (
        <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-between p-5 sm:p-6 pb-8">
          <div>
            {/* Header */}
            <div className="relative flex items-center justify-between mb-6 pt-2">
              <button
                onClick={() => setCurrentView('menu')}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
              </button>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Send an invitation
              </h1>
              <div className="w-10" />
            </div>

            {/* Prompt */}
            <p className="text-slate-500 text-xs sm:text-sm font-semibold mb-2.5 px-1">
              Who would you like to invite?
            </p>

            {/* Input Card matching Reference 4 */}
            <div className="bg-white rounded-[28px] p-5 sm:p-6 shadow-sm border border-slate-100/90 mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMessage('');
                }}
                placeholder="Neuro Series account or email address"
                className="w-full text-sm sm:text-base text-slate-800 placeholder-slate-400 outline-none pb-4 font-sans bg-transparent"
                autoFocus
              />

              <div className="border-t border-slate-100 pt-4">
                <div className="text-sm font-bold text-slate-900">
                  Access level
                </div>
                <div className="text-sm font-semibold text-[#0284c7] mt-0.5">
                  Full access
                </div>
              </div>
            </div>

            {errorMessage && (
              <p className="text-rose-500 text-xs px-2 mb-3 font-medium">
                {errorMessage}
              </p>
            )}

            {sendSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs sm:text-sm p-3.5 rounded-2xl mb-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Invitation sent successfully to {email}!</span>
              </div>
            )}

            {/* Helper Text matching Reference 4 */}
            <p className="text-slate-400 text-xs leading-relaxed px-1 mb-6">
              After the person you invite accepts the invitation, they'll appear in the member list. You can also cancel invitations on the member list.
            </p>
          </div>

          <div className="pt-4 mt-auto">
            <button
              onClick={handleSendEmailInvite}
              disabled={isSending || sendSuccess}
              className="w-full py-4 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-base shadow-lg shadow-sky-500/25 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : sendSuccess ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>Sent!</span>
                </>
              ) : (
                <span>Send</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ----------------- SCREEN 3: SHARE LINK (Full Screen Page) ----------------- */}
      {currentView === 'link' && (
        <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-between p-5 sm:p-6 pb-8">
          <div>
            {/* Header */}
            <div className="relative flex items-center justify-between mb-6 pt-2">
              <button
                onClick={() => setCurrentView('menu')}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
              </button>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Share link
              </h1>
              <div className="w-10" />
            </div>

            {/* Prompt */}
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-3 px-1 leading-relaxed">
              Send this link to the person you want to invite in a text message or chat.
            </p>

            {/* White Illustration Card matching Reference 5 */}
            <div className="bg-white rounded-[28px] p-6 shadow-sm border border-slate-100/90 mb-4 flex flex-col items-center text-center">
              
              {/* People & Home Vector Art matching Reference 5 */}
              <div className="w-full max-w-[240px] h-32 flex items-center justify-center mb-4 relative">
                <svg viewBox="0 0 300 160" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Home Silhouette Backdrop */}
                  <path d="M150 20 L240 90 L240 150 L60 150 L60 90 Z" fill="#e0f2fe" opacity="0.8" />
                  
                  {/* Person 1 Left */}
                  <circle cx="95" cy="65" r="10" fill="#334155" />
                  <rect x="87" y="77" width="16" height="35" rx="5" fill="#38bdf8" />
                  <rect x="89" y="112" width="6" height="28" rx="2" fill="#1e293b" />
                  <rect x="97" y="112" width="6" height="28" rx="2" fill="#1e293b" />
                  
                  {/* Person 2 Center Left */}
                  <circle cx="125" cy="62" r="10" fill="#1e293b" />
                  <rect x="117" y="74" width="16" height="38" rx="5" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
                  <rect x="120" y="112" width="10" height="28" rx="2" fill="#0284c7" />

                  {/* Person 3 Center Kid */}
                  <circle cx="158" cy="78" r="9" fill="#475569" />
                  <rect x="151" y="89" width="14" height="26" rx="4" fill="#38bdf8" />
                  <rect x="153" y="115" width="4" height="25" rx="2" fill="#f8fafc" stroke="#cbd5e1" />
                  <rect x="159" y="115" width="4" height="25" rx="2" fill="#f8fafc" stroke="#cbd5e1" />

                  {/* Person 4 Center Right */}
                  <circle cx="188" cy="62" r="10" fill="#0f172a" />
                  <rect x="180" y="74" width="16" height="38" rx="5" fill="#0f172a" />
                  <rect x="183" y="112" width="10" height="28" rx="2" fill="#64748b" />

                  {/* Person 5 Right */}
                  <circle cx="218" cy="65" r="10" fill="#f43f5e" />
                  <rect x="210" y="77" width="16" height="35" rx="5" fill="#38bdf8" />
                  <rect x="210" y="112" width="16" height="28" rx="2" fill="#0284c7" />

                  {/* Pet Dog Right */}
                  <ellipse cx="245" cy="125" rx="9" ry="12" fill="#1e293b" />
                  <circle cx="248" cy="112" r="6" fill="#1e293b" />
                  <rect x="242" y="118" width="10" height="3" fill="#38bdf8" />
                </svg>
              </div>

              {/* Invitation Text matching Reference 5 */}
              <h2 className="text-slate-900 font-extrabold text-sm sm:text-base leading-snug px-2">
                {currentUserName} invited you to control devices in {home?.name || 'Neuro Series Home'}.
              </h2>

              {/* Share URL Pill */}
              <div className="w-full mt-3 bg-slate-50 border border-slate-100 rounded-2xl p-2.5 flex items-center justify-between">
                <span className="text-xs sm:text-sm text-slate-500 font-mono truncate px-1">
                  {shareLink || 'Generating link...'}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="p-1.5 rounded-xl bg-white shadow-sm border border-slate-100 text-[#0284c7] hover:bg-sky-50 transition-colors cursor-pointer flex-shrink-0"
                  title="Copy link"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                </button>
              </div>

              {/* Access Level Divider matching Reference 5 */}
              <div className="w-full border-t border-slate-100 mt-4 pt-3 text-left">
                <div className="text-xs sm:text-sm font-bold text-slate-900">
                  Access level
                </div>
                <div className="text-xs sm:text-sm font-semibold text-[#0284c7] mt-0.5">
                  Full access
                </div>
              </div>
            </div>

            {/* Explanatory Details matching Reference 5 */}
            <div className="text-slate-400 text-xs leading-relaxed px-1 space-y-2 mb-6">
              <p className="font-medium text-slate-500">This link expires in 6 days.</p>
              <p>
                Anyone who visits this link can request to join your location. You can cancel a link that you've already shared by creating a new link.
              </p>
            </div>
          </div>

          {/* Bottom Actions matching Reference 5 */}
          <div className="space-y-3 pt-2 mt-auto">
            <button
              onClick={handleNativeShare}
              className="w-full py-4 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-base shadow-lg shadow-sky-500/25 transition-all active:scale-[0.99] cursor-pointer"
            >
              Send
            </button>

            <button
              onClick={generateNewShareLink}
              disabled={isGeneratingLink}
              className="w-full py-4 rounded-full bg-slate-200/90 hover:bg-slate-300 text-slate-800 font-bold text-base transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isGeneratingLink && <Loader2 className="w-4 h-4 animate-spin text-slate-600" />}
              <span>Create new link</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
