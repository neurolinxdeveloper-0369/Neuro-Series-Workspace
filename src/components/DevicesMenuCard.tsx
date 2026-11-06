import { LayoutPanelTop, Plus, BookSearch, ChevronRight } from 'lucide-react';
import { getAssetUrl } from '../utils/assets';

interface DevicesMenuCardProps {
  onAddDevice?: () => void;
  onSupportedDevices?: () => void;
}

export const DevicesMenuCard = ({ onAddDevice, onSupportedDevices }: DevicesMenuCardProps) => {
  return (
    <div 
      className="w-full max-w-sm sm:max-w-md md:max-w-lg rounded-3xl p-5 sm:p-6 shadow-md transition-all select-none pointer-events-auto"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.95)',
        boxShadow: '0 16px 36px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(0, 0, 0, 0.02)',
      }}
    >
      {/* Top Section: Left = devicepage.png image, Right = Journey text (normal font) */}
      <div className="flex items-center gap-4 sm:gap-5 mb-4">
        {/* Top Left: devicepage.png */}
        <div className="w-36 sm:w-44 md:w-48 flex-shrink-0">
          <img 
            src={getAssetUrl('devicepage.png')} 
            alt="Neuro Series Smart Devices" 
            className="w-full h-auto object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Top Right: "Connect, automate, and take complete control" (normal, not bold) */}
        <div className="flex-1">
          <p className="text-sm sm:text-base font-normal text-slate-700 leading-snug font-sans">
            Connect, automate, and take complete control
          </p>
        </div>
      </div>

      {/* Center borderline removed */}

      {/* Bottom Action Rows */}
      <div className="space-y-1 pt-1">
        {/* Row 1: Add device (device icon on left, Plus icon on right in place of right arrow) */}
        <div 
          onClick={onAddDevice}
          className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <LayoutPanelTop 
                className="w-5 h-5 text-[#0284c7]" 
                strokeWidth={2.2} 
              />
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-800 font-sans group-hover:text-[#0284c7] transition-colors">
              Add device
            </span>
          </div>
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
            <Plus className="w-4 h-4 text-[#0284c7] group-hover:scale-110 transition-transform" strokeWidth={2.4} />
          </div>
        </div>

        {/* Row 2: Supported devices (book-search icon on left, right arrow on right) */}
        <div 
          onClick={onSupportedDevices}
          className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <BookSearch 
                className="w-5 h-5 text-[#0284c7]" 
                strokeWidth={2.2} 
              />
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-800 font-sans group-hover:text-[#0284c7] transition-colors">
              Supported devices
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
