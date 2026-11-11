import { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, X, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { homeApi, type Home } from '../services/home';

interface LocationQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  home: Home | null;
}

export const LocationQrModal = ({ isOpen, onClose, home }: LocationQrModalProps) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const generateCode = async () => {
    if (!home) return;
    setIsLoading(true);
    try {
      let qrString = '';
      try {
        const payload = await homeApi.getQrPayload(home.id);
        qrString = payload.qrData;
      } catch {
        // Fallback offline payload if API token route takes time
        qrString = JSON.stringify({
          schema: 'neurolinx://invite',
          homeId: home.id,
          name: home.name,
          access: 'Full access',
          ts: Date.now(),
        });
      }

      const url = await QRCode.toDataURL(qrString, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('Failed to render QR Code:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && home) {
      generateCode();
    }
  }, [isOpen, home?.id]);

  if (!isOpen || !home) return null;

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
      {/* Top Header: Back Button + Title */}
      <header className="screen-top-header w-full flex items-center justify-between px-5 sm:px-8 py-5 sm:py-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/80 hover:bg-white text-slate-800 flex items-center justify-center transition-colors shadow-xs cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2.4} />
          </button>
          <span className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-sans">
            Location QR code
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

      {/* Main Container - Matches Reference 3 */}
      <main className="w-full max-w-sm sm:max-w-md mx-auto px-5 py-2 pb-16 flex flex-col items-center justify-center flex-1">
        
        {/* Pure White Card matching Reference 3 */}
        <div 
          className="w-full rounded-3xl p-6 sm:p-7 shadow-lg bg-white flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.95)',
            boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(0, 0, 0, 0.02)',
          }}
        >
          {/* QR Code Graphic Container */}
          <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-2xl p-2 flex items-center justify-center relative bg-white">
            {qrDataUrl ? (
              <img 
                src={qrDataUrl} 
                alt="Location Invite QR Code" 
                className="w-full h-full object-contain select-none"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mb-2" />
                <span className="text-xs">Generating QR...</span>
              </div>
            )}
          </div>

          {/* Refresh Action Pill */}
          <div className="mt-4 mb-3">
            <button
              onClick={generateCode}
              disabled={isLoading}
              className="px-6 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0284c7] font-bold text-xs sm:text-sm tracking-wide transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Instruction Note */}
          <p className="text-xs sm:text-sm text-slate-600 font-medium px-4 mt-1 leading-snug">
            Ask the person you want to invite to scan the QR code.
          </p>

          {/* Divider */}
          <div className="w-full h-px bg-slate-100 my-5" />

          {/* Access Level Section */}
          <div className="w-full flex flex-col items-start text-left px-1">
            <span className="text-sm font-bold text-slate-900 font-sans tracking-tight">
              Access level
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="w-4 h-4 text-[#0284c7]" />
              <span className="text-sm font-bold text-[#0284c7] font-sans">
                Full access
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5">
              Invited member can control devices and view routines in {home.name}.
            </span>
          </div>

        </div>

        {/* Home Name Badge Below Card */}
        <div className="mt-4 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-white/60 text-xs font-semibold text-slate-700 shadow-2xs">
          Sharing: <strong>{home.name}</strong>
        </div>

      </main>
    </div>
  );
};
