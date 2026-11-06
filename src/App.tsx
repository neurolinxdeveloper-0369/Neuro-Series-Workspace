import { useState, useEffect } from 'react';
import { 
  Home,
  LayoutPanelTop, 
  BookText, 
  CirclePlay, 
  Menu,
  Search,
  X,
  LogIn,
  UserCheck,
  Settings
} from 'lucide-react';
import { ExploreCardSlider } from './components/ExploreCardSlider';
import { QuickDevicesCard } from './components/QuickDevicesCard';
import { DevicesMenuCard } from './components/DevicesMenuCard';
import { RoutinesMenuCard } from './components/RoutinesMenuCard';
import { MenuTabContent } from './components/MenuTabContent';
import { SignInScreen } from './components/SignInScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { getAssetUrl } from './utils/assets';
import { authStorage, authApi, type UserProfile } from './services/auth';

export function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [isHovered, setIsHovered] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isHoveringElement, setIsHoveringElement] = useState(false);
  const [isHoveringLight, setIsHoveringLight] = useState(false);
  
  // Sign In & User Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => authStorage.getUser());
  const [isSignedIn, setIsSignedIn] = useState<boolean>(() => authStorage.isAuthenticated());
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  // Settings Screen State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Total 5 navigation items as requested
  const [activeTab, setActiveTab] = useState<'home' | 'devices' | 'explore' | 'routines' | 'menu'>('home');

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
      setIsHoveringElement(false);
      setIsHoveringLight(false);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        // Detect white or light background
        let isLight = false;
        let curr: HTMLElement | null = target;
        while (curr && curr !== document.body) {
          if (
            curr.classList.contains('bg-white') ||
            curr.getAttribute('data-bg-light') === 'true'
          ) {
            isLight = true;
            break;
          }
          const bg = window.getComputedStyle(curr).backgroundColor;
          if (
            bg === 'rgb(255, 255, 255)' ||
            bg.startsWith('rgba(255, 255, 255')
          ) {
            isLight = true;
            break;
          }
          curr = curr.parentElement;
        }
        setIsHoveringLight(isLight);

        if (target.closest('button, a, img, svg, input, [role="button"]')) {
          setIsHoveringElement(true);
        } else {
          setIsHoveringElement(false);
        }
      }
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mouseover', handleMouseOver);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Exactly 5 Menu Items
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'devices', label: 'Devices', icon: LayoutPanelTop },
    { id: 'explore', label: 'Explore', icon: BookText },
    { id: 'routines', label: 'Routines', icon: CirclePlay },
    { id: 'menu', label: 'Menu', icon: Menu },
  ] as const;

  // Guard actions requiring user authentication
  const handleProtectedAction = (action?: () => void) => {
    if (!isSignedIn) {
      setIsSignInOpen(true);
    } else {
      action?.();
    }
  };

  return (
    <div className="bg-app-container fixed inset-0 w-screen h-screen overflow-hidden select-none cursor-none font-sans">
      
      {/* 1. Mobile & Tabs (<1200px or portrait or touch): Light Blue #d4edf4 with top-left & bottom-right white gradients */}
      <div className="bg-mobile-tab" />

      {/* 2. Desktop Landscape (>=1200px fine pointer): Villa Architecture Backdrop with frosted glass & dark obsidian sheen */}
      <div className="bg-desktop absolute inset-0 pointer-events-none overflow-hidden">
        <img
          src={getAssetUrl('background.png')}
          alt="Modern Villa Glass Architecture"
          className="absolute inset-0 w-full h-full object-cover object-center scale-105"
        />
        {/* Frosted Blur & Refraction Layer */}
        <div 
          className="absolute inset-0"
          style={{
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          }}
        />
        {/* Dark Obsidian Glass Tint */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(3, 5, 10, 0.45) 0%, rgba(5, 7, 14, 0.65) 100%)',
          }}
        />
        {/* Diagonal Glossy Specular Glass Sheen */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(125deg, rgba(255, 255, 255, 0.09) 0%, rgba(255, 255, 255, 0.015) 35%, transparent 65%)'
          }}
        />
        {/* Top Specular Edge Glare */}
        <div 
          className="absolute top-0 inset-x-0 h-44"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.02) 40%, transparent 100%)'
          }}
        />
        {/* Subtle Edge Vignette (desktop only, never on mobile/tabs) */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.5) 85%, rgba(0, 0, 0, 0.85) 100%)'
          }}
        />
      </div>

      {/* 3. Unified Responsive Header: Brand (Left) + Search (Center) */}
      <header className="fixed top-4 sm:top-5 inset-x-0 z-30 flex items-center justify-between px-4 sm:px-6 md:px-8 pointer-events-none">
        
        {/* Left Brand: Recolored Logo + "Neuro Series" */}
        <div className="flex items-center gap-2 sm:gap-2.5 select-none pointer-events-auto flex-shrink-0">
          {/* Logo Icon: Hidden on small mobile screens (< 640px), visible on tablets and desktop */}
          <div className="hidden sm:flex items-center justify-center w-8 h-8 md:w-9 md:h-9 flex-shrink-0 transition-transform hover:scale-105">
            <img 
              src={getAssetUrl('logo.png')} 
              alt="Neuro Series Logo" 
              className="w-full h-full object-contain drop-shadow-[0_2px_8px_rgba(56,189,248,0.45)]"
            />
          </div>

          {/* Brand Name: Always visible across all screens, dot removed */}
          <span className="brand-text-responsive font-extrabold text-base sm:text-lg md:text-xl tracking-wider font-sans select-none whitespace-nowrap">
            Neuro Series
          </span>
        </div>

        {/* Center Search Bar: Hidden on small mobile screens (< 640px) and hidden in Menu option */}
        {activeTab !== 'menu' && (
          <div className="hidden sm:flex items-center justify-center flex-1 max-w-xs md:max-w-sm lg:max-w-md mx-3 md:mx-6 pointer-events-auto">
            <div 
              className="search-container-responsive w-full flex items-center rounded-full transition-all duration-300 focus-within:ring-2 focus-within:ring-sky-400/40"
            >
              <Search className="search-icon-responsive w-4 h-4 ml-4 mr-2.5 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search devices, routines, scenes..."
                className="search-input-responsive bg-transparent text-sm outline-none w-full py-2.5 font-sans"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mr-3 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="search-kbd-responsive mr-3 px-2 py-0.5 rounded-lg border text-[10px] font-mono pointer-events-none select-none">
                  ⌘K
                </kbd>
              )}
            </div>
          </div>
        )}

        {/* Right Side at Top: In Menu Option = Settings Icon + Settings text, Otherwise = Sign In Button */}
        <div className="flex items-center justify-end pointer-events-auto flex-shrink-0">
          {activeTab === 'menu' ? (
            <button
              onClick={() => setIsSettingsOpen(true)}
              data-bg-light="true"
              className="glass-signin-btn group flex items-center justify-center select-none rounded-full w-9 h-9 sm:w-10 sm:h-10 cursor-pointer"
              title="Settings"
            >
              {/* Top Specular Glare Curve matching the Menu Bar */}
              <div 
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%)'
                }}
              />
              <div className="relative z-10 flex items-center justify-center">
                <Settings className="signin-icon w-4 h-4 sm:w-5 sm:h-5 text-[#0284c7] sm:text-white transition-transform group-hover:rotate-45" strokeWidth={2.3} />
              </div>
            </button>
          ) : (
            <button
              onClick={() => {
                if (isSignedIn) {
                  setIsSettingsOpen(true);
                } else {
                  setIsSignInOpen(true);
                }
              }}
              data-bg-light="true"
              className="glass-signin-btn group flex items-center justify-center select-none rounded-full cursor-pointer"
              title={isSignedIn ? (currentUser?.full_name || "Account Profile") : "Sign In"}
            >
              {/* Top Specular Glare Curve matching the Menu Bar */}
              <div 
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%)'
                }}
              />
              <div className="relative z-10 flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2">
                {isSignedIn ? (
                  <>
                    {currentUser?.avatar_url ? (
                      <img 
                        src={currentUser.avatar_url} 
                        alt="Profile" 
                        className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover border border-white/60"
                      />
                    ) : (
                      <UserCheck className="signin-icon w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0284c7] sm:text-white transition-colors" strokeWidth={2.3} />
                    )}
                    <span className="signin-text text-xs sm:text-sm font-bold text-[#0284c7] sm:text-white tracking-wide font-sans select-none max-w-[100px] truncate">
                      {currentUser?.full_name ? currentUser.full_name.split(' ')[0] : 'Profile'}
                    </span>
                  </>
                ) : (
                  <>
                    <LogIn className="signin-icon w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0284c7] sm:text-white transition-colors group-hover:scale-110" strokeWidth={2.3} />
                    <span className="signin-text text-xs sm:text-sm font-bold text-[#0284c7] sm:text-white tracking-wide font-sans select-none">
                      Sign In
                    </span>
                  </>
                )}
              </div>
            </button>
          )}
        </div>
      </header>

      {/* 4. Mobile & Tablet Content (Explore Slider + Pure White Cards based on activeTab; Menu has all content cleared) */}
      <main className="explore-slider-wrapper fixed inset-x-0 top-[4.5rem] sm:top-20 bottom-20 sm:bottom-6 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-start pointer-events-none z-20 px-4 sm:px-6 sm:pl-24 pb-8 space-y-3.5">
        {activeTab === 'home' && (
          <>
            <ExploreCardSlider />
            <QuickDevicesCard 
              onAddDevice={() => handleProtectedAction(() => setActiveTab('devices'))} 
              onExplore={() => handleProtectedAction(() => setActiveTab('explore'))} 
            />
          </>
        )}

        {activeTab === 'devices' && (
          <DevicesMenuCard 
            onAddDevice={() => handleProtectedAction()}
            onSupportedDevices={() => handleProtectedAction()}
          />
        )}

        {activeTab === 'explore' && (
          <ExploreCardSlider />
        )}

        {activeTab === 'routines' && (
          <RoutinesMenuCard 
            onCreateRoutine={() => handleProtectedAction()}
            onLearnRoutines={() => handleProtectedAction()}
          />
        )}

        {activeTab === 'menu' && (
          <MenuTabContent />
        )}
      </main>

      {/* 7. Responsive Navigation Bar: Horizontal on Mobile (< 640px), Vertical on Tabs & Desktop (>= 640px) */}
      <nav 
        className="nav-bar-responsive fixed z-40 transition-all duration-300 rounded-full flex flex-row sm:flex-col items-center justify-between sm:justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(142, 197, 252, 0.78) 0%, rgba(120, 182, 252, 0.58) 100%)',
          backdropFilter: 'blur(28px) saturate(190%)',
          WebkitBackdropFilter: 'blur(28px) saturate(190%)',
          border: '1px solid rgba(255, 255, 255, 0.60)',
          boxShadow: `
            0 20px 45px -8px rgba(0, 0, 0, 0.65),
            0 0 35px 2px rgba(130, 187, 251, 0.40),
            inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.75),
            inset 0 -1.5px 2px 0 rgba(0, 0, 0, 0.15)
          `,
        }}
      >
        {/* Specular glare curve on the blue glass pill */}
        <div 
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.40) 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%)'
          }}
        />

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <div key={item.id} className="relative flex items-center justify-center group flex-shrink-0">
              <button
                onClick={() => {
                  if (!isSignedIn && (item.id === 'explore' || item.id === 'routines')) {
                    setIsSignInOpen(true);
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                data-bg-light="true"
                className={`
                  nav-item-btn relative z-10 flex flex-col items-center justify-center transition-all duration-200 active:scale-95
                  /* Mobile: soft rounded pill capsule matching reference image. Desktop/Tabs: sleek circle */
                  px-3.5 py-1.5 sm:px-4 sm:py-2 md:w-12 md:h-12 md:p-0 rounded-full
                  ${isActive ? 'nav-item-active shadow-sm' : 'nav-item-inactive hover:bg-white/10'}
                `}
                style={
                  isActive
                    ? {
                        background: 'rgba(255, 255, 255, 0.48)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), inset 0 1px 1.5px rgba(255, 255, 255, 0.85)',
                      }
                    : undefined
                }
              >
                {/* Icon */}
                <Icon 
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive 
                      ? 'text-[#0284c7]' 
                      : 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]'
                  }`}
                  strokeWidth={2.2}
                />
                
                {/* Text Label: ONLY visible on mobile screens (< 640px) */}
                <span 
                  className={`
                    text-[11px] font-bold tracking-tight mt-0.5 leading-tight
                    block sm:hidden
                    ${isActive 
                      ? 'text-[#0284c7]' 
                      : 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]'
                    }
                  `}
                >
                  {item.label}
                </span>
              </button>

              {/* Right-Side Tooltip: Visible only on landscape when hovering */}
              <div 
                className="hidden [media(orientation:landscape)]:block absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 z-50 whitespace-nowrap"
              >
                <div 
                  className="px-3 py-1.5 rounded-xl font-sans text-xs font-semibold text-white tracking-wide flex items-center shadow-lg"
                  style={{
                    background: 'rgba(2, 132, 199, 0.90)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.40)',
                    boxShadow: '0 8px 20px -2px rgba(56, 189, 248, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.5)',
                  }}
                >
                  <div 
                    className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45"
                    style={{ background: 'rgba(2, 132, 199, 0.90)' }}
                  />
                  {item.label}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* 8. Full-Screen Neuro Series Account Authentication */}
      <SignInScreen 
        isOpen={isSignInOpen} 
        onClose={() => setIsSignInOpen(false)} 
        onSignInSuccess={(user) => {
          setCurrentUser(user);
          setIsSignedIn(true);
        }} 
      />

      {/* 9. Full-Screen Neuro Series Settings */}
      <SettingsScreen 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        isSignedIn={isSignedIn}
        currentUser={currentUser}
        onSignOut={() => {
          authApi.logout();
          setCurrentUser(null);
          setIsSignedIn(false);
        }}
        onOpenSignIn={() => {
          setIsSettingsOpen(false);
          setIsSignInOpen(true);
        }} 
      />


      {/* 8. Light Blue Energy Symbol Cursor (Red replaced with Light Blue #38bdf8 / #7dd3fc) */}
      {isHovered && (
        <div
          className="cursor-pointer-custom fixed pointer-events-none z-50"
          style={{
            left: `${mousePos.x}px`,
            top: `${mousePos.y}px`,
            transform: `translate(-50%, -20%) scale(${isClicking ? 0.9 : 1})`,
            transition: 'transform 0.08s ease',
          }}
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polygon
              points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
              fill={
                isHoveringLight 
                  ? '#0284c7' 
                  : isHoveringElement 
                  ? '#38bdf8' 
                  : 'transparent'
              }
              stroke={isHoveringLight ? '#0284c7' : '#7dd3fc'}
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transition: 'fill 0.15s ease, stroke 0.15s ease' }}
            />
          </svg>
        </div>
      )}

    </div>
  );
}

export default App;
