import { 
  HouseWifi, 
  Mic, 
  CircleQuestionMark, 
  UserCog, 
  CloudExclamationPoint,
  ChevronRight,
  LogOut 
} from 'lucide-react';

interface MenuTabContentProps {
  isSignedIn?: boolean;
  onSignOut?: () => void;
}

export const MenuTabContent = ({ isSignedIn = false, onSignOut }: MenuTabContentProps) => {
  return (
    <div className="w-full flex flex-col items-center space-y-3.5 select-none pointer-events-auto">
      {/* Top Transparent Card: Supported Device */}
      <div 
        className="group w-full max-w-sm sm:max-w-md md:max-w-lg rounded-3xl p-4 sm:p-5 transition-all cursor-pointer hover:bg-white/30 active:scale-[0.99]"
        style={{
          background: 'rgba(255, 255, 255, 0.22)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.55)',
          boxShadow: '0 8px 32px 0 rgba(15, 23, 42, 0.05), inset 0 1px 1px rgba(255, 255, 255, 0.6)',
        }}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 pr-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 font-sans tracking-tight group-hover:text-[#0284c7] transition-colors">
              Supported Device
            </h3>
            <p className="text-xs sm:text-sm font-normal text-slate-600 leading-snug mt-1 font-sans">
              Find out which devices work with Neuro Series
            </p>
          </div>
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-slate-500/70 group-hover:text-[#0284c7] transition-colors">
            <ChevronRight className="w-5 h-5" strokeWidth={2.2} />
          </div>
        </div>
      </div>
      {/* Card 1: Virtual Home & Voice assistant */}
      <div 
        className="w-full max-w-sm sm:max-w-md md:max-w-lg rounded-3xl p-3.5 sm:p-4 shadow-md transition-all"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.95)',
          boxShadow: '0 16px 36px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(0, 0, 0, 0.02)',
        }}
      >
        {/* Item 1: Virtual Home with house-wifi icon */}
        <div 
          className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <HouseWifi className="w-5 h-5 text-[#0284c7]" strokeWidth={2.2} />
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-800 font-sans group-hover:text-[#0284c7] transition-colors">
              Virtual Home
            </span>
          </div>
        </div>

        {/* Line Divider */}
        <div className="h-px bg-slate-100 w-full my-1" />

        {/* Item 2: Voice assistant with mic icon */}
        <div 
          className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <Mic className="w-5 h-5 text-[#0284c7]" strokeWidth={2.2} />
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-800 font-sans group-hover:text-[#0284c7] transition-colors">
              Voice assistant
            </span>
          </div>
        </div>
      </div>

      {/* Card 2: How to use, Contact us & Offline diagnostics */}
      <div 
        className="w-full max-w-sm sm:max-w-md md:max-w-lg rounded-3xl p-3.5 sm:p-4 shadow-md transition-all"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.95)',
          boxShadow: '0 16px 36px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(0, 0, 0, 0.02)',
        }}
      >
        {/* Item 1: How to use with circle-question-mark icon */}
        <div 
          className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <CircleQuestionMark className="w-5 h-5 text-[#0284c7]" strokeWidth={2.2} />
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-800 font-sans group-hover:text-[#0284c7] transition-colors">
              How to use
            </span>
          </div>
        </div>

        {/* Line Divider */}
        <div className="h-px bg-slate-100 w-full my-1" />

        {/* Item 2: Contact us with user-cog icon */}
        <div 
          className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <UserCog className="w-5 h-5 text-[#0284c7]" strokeWidth={2.2} />
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-800 font-sans group-hover:text-[#0284c7] transition-colors">
              Contact us
            </span>
          </div>
        </div>

        {/* Line Divider */}
        <div className="h-px bg-slate-100 w-full my-1" />

        {/* Item 3: Offline diagnostics with cloud-exclamation-point icon */}
        <div 
          className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
              <CloudExclamationPoint className="w-5 h-5 text-[#0284c7]" strokeWidth={2.2} />
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-800 font-sans group-hover:text-[#0284c7] transition-colors">
              Offline diagnostics
            </span>
          </div>
        </div>
      </div>

      {/* Card 3: Sign out option (ONLY shown after login, hidden without login) */}
      {isSignedIn && (
        <div 
          onClick={onSignOut}
          className="w-full max-w-sm sm:max-w-md md:max-w-lg rounded-3xl p-3.5 sm:p-4 shadow-md transition-all bg-white cursor-pointer hover:bg-rose-50/50 active:scale-[0.99] animate-in fade-in duration-200"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.95)',
            boxShadow: '0 16px 36px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(0, 0, 0, 0.02)',
          }}
          role="button"
          tabIndex={0}
        >
          <div className="group flex items-center justify-between p-2.5 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                <LogOut className="w-5 h-5 text-rose-600" strokeWidth={2.2} />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-rose-600 font-sans group-hover:text-rose-700 transition-colors">
                Sign out
              </span>
            </div>
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:text-rose-600 transition-colors">
              <ChevronRight className="w-4 h-4" strokeWidth={2.2} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
