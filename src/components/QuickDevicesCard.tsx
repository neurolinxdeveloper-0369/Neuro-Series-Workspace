import { Plus, ChevronRight } from 'lucide-react';
import { getAssetUrl } from '../utils/assets';

interface QuickDevicesCardProps {
  onAddDevice?: () => void;
  onExplore?: () => void;
}

export const QuickDevicesCard = ({ onAddDevice, onExplore }: QuickDevicesCardProps) => {
  return (
    <div 
      className="w-full max-w-sm sm:max-w-md md:max-w-lg rounded-3xl p-5 sm:p-6 shadow-md transition-all select-none pointer-events-auto"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.95)',
        boxShadow: '0 16px 36px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(0, 0, 0, 0.02)',
      }}
    >
      {/* Top Section: Left = homepage.png image (increased size), Right = Journey text (normal font) */}
      <div className="flex items-center gap-4 sm:gap-5 mb-4">
        {/* Top Left: homepage.png (increased size) */}
        <div className="w-36 sm:w-44 md:w-48 flex-shrink-0">
          <img 
            src={getAssetUrl('homepage.png')} 
            alt="Smart Living Journey" 
            className="w-full h-auto object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Top Right: "Your smart living journey starts here—add a device." (normal, not bold) */}
        <div className="flex-1">
          <p className="text-sm sm:text-base font-normal text-slate-700 leading-snug font-sans">
            Your smart living journey starts here—add a device.
          </p>
        </div>
      </div>

      {/* Center borderline removed */}

      {/* Bottom Action Rows (Matched icon sizes, white outline, matching logo blue #39c0fc) */}
      <div className="space-y-1 pt-1">
        {/* Row 1: Neuro Series Logo (blue & black) + Explore Neuro Series + Right arrow */}
        <div 
          onClick={onExplore}
          className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <img 
                src={getAssetUrl('logo_black.png')} 
                alt="Neuro Series Logo" 
                className="w-5 h-5 object-contain"
              />
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-800 font-sans group-hover:text-[#0284c7] transition-colors">
              Explore Neuro Series
            </span>
          </div>
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0284c7] transition-colors" strokeWidth={2.2} />
          </div>
        </div>

        {/* Row 2: Plus Icon for Add Device (theme blue #0284c7, matched size) */}
        <div 
          onClick={onAddDevice}
          className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <Plus 
                className="w-5 h-5 text-[#0284c7] transition-transform group-hover:scale-110" 
                strokeWidth={2.5} 
              />
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-800 font-sans group-hover:text-[#0284c7] transition-colors">
              Add Device
            </span>
          </div>
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0284c7] transition-colors" strokeWidth={2.2} />
          </div>
        </div>
      </div>
    </div>
  );
};

