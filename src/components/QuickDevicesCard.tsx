import { Plus, ChevronRight, LayoutPanelTop, Search } from 'lucide-react';
import { getAssetUrl } from '../utils/assets';

interface QuickDevicesCardProps {
  onAddDevice?: () => void;
  onExplore?: () => void;
  isLoggedIn?: boolean;
}

export const QuickDevicesCard = ({ onAddDevice, onExplore, isLoggedIn = false }: QuickDevicesCardProps) => {
  return (
    <div 
      className="w-full max-w-sm sm:max-w-md md:max-w-lg rounded-3xl p-5 sm:p-6 shadow-md transition-all select-none pointer-events-auto"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.95)',
        boxShadow: '0 16px 36px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(0, 0, 0, 0.02)',
      }}
    >
      {/* Top Section */}
      <div className="flex items-center gap-4 sm:gap-5 mb-5">
        <div className="w-32 sm:w-40 md:w-44 flex-shrink-0">
          <img 
            src={getAssetUrl(isLoggedIn ? 'devicepage.png' : 'homepage.png')} 
            alt="Smart Living Devices" 
            className="w-full h-auto object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300"
          />
        </div>

        <div className="flex-1">
          <p className="text-sm sm:text-base font-medium text-slate-700 leading-snug font-sans">
            {isLoggedIn
              ? 'Add some devices to set up your smart home.'
              : 'Your smart living journey starts here—add a device.'}
          </p>
        </div>
      </div>

      {/* Bottom Action Rows */}
      <div className="space-y-2 pt-1">
        {isLoggedIn ? (
          <>
            {/* Reference 2 Row 1: Add device with circular + button */}
            <div 
              onClick={onAddDevice}
              className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  <LayoutPanelTop className="w-5 h-5 text-slate-800" strokeWidth={2.2} />
                </div>
                <span className="text-sm sm:text-base font-bold text-slate-900 font-sans tracking-tight">
                  Add device
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-[#0284c7]/10 flex items-center justify-center flex-shrink-0 transition-colors">
                <Plus className="w-4 h-4 text-slate-700 group-hover:text-[#0284c7]" strokeWidth={2.4} />
              </div>
            </div>

            {/* Reference 2 Row 2: Supported devices with circular chevron button */}
            <div 
              onClick={onExplore}
              className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  <Search className="w-5 h-5 text-slate-800" strokeWidth={2.2} />
                </div>
                <span className="text-sm sm:text-base font-bold text-slate-900 font-sans tracking-tight">
                  Supported devices
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-[#0284c7]/10 flex items-center justify-center flex-shrink-0 transition-colors">
                <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-[#0284c7]" strokeWidth={2.4} />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Guest Row 1: Explore Neuro Series */}
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

            {/* Guest Row 2: Plus Icon for Add Device */}
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
          </>
        )}
      </div>
    </div>
  );
};

