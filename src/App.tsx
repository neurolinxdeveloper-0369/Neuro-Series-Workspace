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
  Settings,
  QrCode,
  ChevronDown,
  Plus,
  MoreVertical,
  Check,
  SlidersHorizontal,
  Layers,
  Sun,
  Moon,
  Sparkles,
  Clock,
  Calendar,
  User
} from 'lucide-react';
import { ExploreCardSlider } from './components/ExploreCardSlider';
import { QuickDevicesCard } from './components/QuickDevicesCard';
import { MenuTabContent } from './components/MenuTabContent';
import { SignInScreen } from './components/SignInScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { SetupHomeScreen } from './components/SetupHomeScreen';
import { LocationQrModal } from './components/LocationQrModal';
import { InviteMemberModal } from './components/InviteMemberModal';
import { AddDeviceScreen, getRoomEmoji } from './components/AddDeviceScreen';
import { NeuroLoader } from './components/NeuroLoader';
import { getAssetUrl } from './utils/assets';
import { authStorage, authApi, type UserProfile } from './services/auth';
import { homeApi, homeStorage, type Home as UserHome, type Room } from './services/home';
import { deviceApi } from './services/device';
import { DynamicDeviceLayout } from './components/DynamicDeviceLayout';
import { realtimeSocket } from './services/socket';
import { SplashScreen } from '@capacitor/splash-screen';

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
  const [isInitializing, setIsInitializing] = useState<boolean>(() => authStorage.isAuthenticated());

  // Home Properties State & Onboarding
  const [homes, setHomes] = useState<UserHome[]>([]);
  const [activeHome, setActiveHome] = useState<UserHome | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isSetupHomeOpen, setIsSetupHomeOpen] = useState(false);
  const [allowSetupHomeClose, setAllowSetupHomeClose] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isInviteMemberOpen, setIsInviteMemberOpen] = useState(false);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);

  // Dropdown menus state (Reference 2 Header)
  const [isHomeDropdownOpen, setIsHomeDropdownOpen] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isDotsMenuOpen, setIsDotsMenuOpen] = useState(false);

  // Room Sub-Tabs & Explore Banner State
  const [activeRoomTab, setActiveRoomTab] = useState<string>('all');
  const [isExploreDismissed, setIsExploreDismissed] = useState(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('neuro_explore_dismissed') === 'true';
  });

  // Live Date & Time Clock for Desktop & Dashboard
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeFormatted = currentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dayName = currentDateTime.toLocaleDateString('en-US', { weekday: 'long' });
  const dateFormatted = currentDateTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const currentHour = currentDateTime.getHours();
  const timeGreeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : currentHour < 21 ? 'Good evening' : 'Good night';

  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDeviceForControl, setSelectedDeviceForControl] = useState<any | null>(null);

  // Load rooms and devices for a given home
  const loadRooms = async (homeId: string) => {
    try {
      const homeRooms = await homeApi.getRooms(homeId);
      setRooms(homeRooms);
    } catch {
      setRooms([]);
    }
  };

  const loadDevices = async (homeId: string) => {
    try {
      const homeDevices = await deviceApi.getDevicesByHome(homeId);
      setDevices(homeDevices);
    } catch {
      setDevices([]);
    }
  };

  useEffect(() => {
    if (activeHome) {
      loadRooms(activeHome.id);
      loadDevices(activeHome.id);
    } else {
      setRooms([]);
      setDevices([]);
    }
  }, [activeHome?.id]);

  // Real-time WebSocket listener for physical hardware switch telemetry & heartbeats
  useEffect(() => {
    const unsubscribe = realtimeSocket.subscribe((deviceId, incomingState) => {
      setDevices(prev => prev.map(dev => {
        if (dev.device_id === deviceId) {
          return {
            ...dev,
            is_online: incomingState.is_online !== undefined ? incomingState.is_online : dev.is_online,
            rssi: incomingState.rssi !== undefined ? incomingState.rssi : dev.rssi,
            switches: incomingState.switches ? { ...dev.switches, ...incomingState.switches } : dev.switches,
          };
        }
        return dev;
      }));

      setSelectedDeviceForControl((prev: any) => {
        if (prev && prev.device_id === deviceId) {
          return {
            ...prev,
            is_online: incomingState.is_online !== undefined ? incomingState.is_online : prev.is_online,
            rssi: incomingState.rssi !== undefined ? incomingState.rssi : prev.rssi,
            switches: incomingState.switches ? { ...prev.switches, ...incomingState.switches } : prev.switches,
          };
        }
        return prev;
      });
    });

    return unsubscribe;
  }, []);

  // Load user homes and trigger onboarding if 0 homes exist
  const loadHomes = async (openSetupIfEmpty = true) => {
    try {
      const userHomes = await homeApi.getHomes();
      setHomes(userHomes);
      if (userHomes.length === 0) {
        if (openSetupIfEmpty) {
          setIsSetupHomeOpen(true);
          setAllowSetupHomeClose(false);
        }
      } else {
        const storedId = homeStorage.getActiveHomeId();
        const found = userHomes.find((h) => h.id === storedId);
        const active = found || userHomes[0];
        setActiveHome(active);
        homeStorage.setActiveHomeId(active.id);
        setIsSetupHomeOpen(false);
      }
    } catch (err) {
      console.error('Failed to load homes:', err);
    }
  };

  // Sync profile & homes on mount if authenticated with 1s interval
  useEffect(() => {
    if (authStorage.isAuthenticated()) {
      setIsInitializing(true);
      Promise.all([
        authApi.getProfile(),
        homeApi.getHomes().catch(() => []),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ])
        .then(([profile, userHomes]) => {
          if (profile) {
            setCurrentUser(profile);
            setIsSignedIn(true);
          }
          if (Array.isArray(userHomes)) {
            setHomes(userHomes);
            if (userHomes.length === 0) {
              setIsSetupHomeOpen(true);
              setAllowSetupHomeClose(false);
            } else {
              const storedId = homeStorage.getActiveHomeId();
              const found = userHomes.find((h) => h.id === storedId);
              const active = found || userHomes[0];
              setActiveHome(active);
              homeStorage.setActiveHomeId(active.id);
            }
          }
        })
        .finally(() => {
          setIsInitializing(false);
        });
    }
  }, []);

  // Automatically dismiss native splash screen once dashboard has finished loading
  useEffect(() => {
    if (!isInitializing) {
      const timer = setTimeout(() => {
        SplashScreen.hide({ fadeOutDuration: 400 }).catch(() => {
          // Graceful fallback for web browser environment
        });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isInitializing]);

  // Close dropdown menus when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-dropdown]')) {
        setIsHomeDropdownOpen(false);
        setIsPlusMenuOpen(false);
        setIsDotsMenuOpen(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

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

  // Real-time Clock View with Date, Time, Day & Right-side User Details (Desktop & Laptops only)
  const renderRealTimeHeader = () => (
    <div 
      className="hidden lg:block w-full max-w-5xl rounded-3xl p-5 shadow-xl select-none pointer-events-auto transition-all"
      style={{
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(24px) saturate(190%)',
        WebkitBackdropFilter: 'blur(24px) saturate(190%)',
        border: '1px solid rgba(255, 255, 255, 0.95)',
        boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.12), 0 4px 14px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Clock Graphic + Live Time + Day + Date */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0284c7] to-[#38bdf8] p-2.5 text-white flex items-center justify-center shadow-md flex-shrink-0">
            <Clock className="w-7 h-7" strokeWidth={2.3} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                {timeFormatted}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-600 flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-[#0284c7]" />
              <span>{dayName}, {dateFormatted}</span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-[#0284c7] font-bold">{timeGreeting}</span>
            </p>
          </div>
        </div>

        {/* Right: User Details */}
        <div className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-slate-100/80 border border-slate-200/90 justify-start">
          <div className="flex items-center gap-3">
            {currentUser?.avatar_url ? (
              <img 
                src={currentUser.avatar_url} 
                alt="User Avatar" 
                className="w-10 h-10 rounded-full object-cover border-2 border-[#0284c7]/40 shadow-xs flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-sky-100 border-2 border-sky-200 flex items-center justify-center text-[#0284c7] flex-shrink-0">
                <User className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[140px] sm:max-w-[180px]">
                  {currentUser?.full_name || (isSignedIn ? 'User' : 'Guest Mode')}
                </h3>
                {isSignedIn && (
                  <span className="px-1.5 py-0.5 rounded-md bg-sky-100 text-[#0284c7] text-[10px] font-bold">
                    Owner
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-sans truncate max-w-[150px] sm:max-w-[200px]">
                {currentUser?.email || (isSignedIn ? 'Authenticated' : 'Tap to sign in')}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-600 font-medium mt-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {devices.length} {devices.length === 1 ? 'Device' : 'Devices'}
                </span>
                <span className="text-slate-300">&bull;</span>
                <span className="truncate max-w-[100px] text-slate-700 font-semibold">
                  {activeHome?.name || 'Home'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Room Sub-Tabs bar matching uploaded image
  const renderRoomTabsBar = () => {
    if (!isSignedIn) return null;
    if (rooms.length === 0) {
      return (
        <div className="w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-5xl px-2 py-1 select-none pointer-events-auto">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
            Devices
          </h2>
        </div>
      );
    }
    return (
      <div className="w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-5xl flex items-center gap-3.5 px-2 py-0.5 select-none pointer-events-auto overflow-x-auto no-scrollbar">
        <button 
          onClick={() => {}}
          className="p-1 rounded-full hover:bg-white/40 text-slate-700 transition-colors cursor-pointer flex-shrink-0"
          aria-label="Search devices"
        >
          <Search className="w-5 h-5 text-slate-800" strokeWidth={2.4} />
        </button>

        <div className="flex items-center gap-5 text-sm sm:text-base font-bold tracking-tight whitespace-nowrap">
          <button
            onClick={() => setActiveRoomTab('all')}
            className={`transition-colors cursor-pointer pb-0.5 ${
              activeRoomTab === 'all' 
                ? 'text-slate-900 border-b-2 border-slate-900 font-extrabold' 
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            All devices
          </button>

          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => setActiveRoomTab(room.name)}
              className={`transition-colors cursor-pointer pb-0.5 ${
                activeRoomTab === room.name 
                  ? 'text-slate-900 border-b-2 border-slate-900 font-extrabold' 
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              {room.name}
            </button>
          ))}
        </div>
      </div>
    );
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

      {/* 3. Unified Responsive Header */}
      {isSignedIn && activeTab === 'home' ? (
        /* Reference 2 Logged-In Header */
        <header className="fixed top-4 sm:top-5 inset-x-0 z-30 flex items-center justify-between px-4 sm:px-6 md:px-8 pointer-events-none">
          {/* Top-Left: QR Code Button + Home Selector Dropdown */}
          <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto select-none">
            {/* QR Code Icon Button */}
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm border border-white/80 cursor-pointer"
              title="Location QR code"
            >
              <QrCode className="w-5 h-5 text-slate-800" strokeWidth={2.3} />
            </button>

            {/* Home Selector Dropdown Capsule */}
            <div className="relative" data-dropdown>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsHomeDropdownOpen(!isHomeDropdownOpen);
                  setIsPlusMenuOpen(false);
                  setIsDotsMenuOpen(false);
                }}
                className="h-10 sm:h-11 px-4 sm:px-5 rounded-full bg-white/90 hover:bg-white text-slate-900 font-bold text-sm sm:text-base font-sans flex items-center gap-2 transition-all shadow-sm border border-white/80 cursor-pointer max-w-[170px] sm:max-w-xs"
              >
                <span className="truncate">
                  {activeHome?.name || (currentUser?.full_name ? `${currentUser.full_name.split(' ')[0]} Home` : 'My Home')}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-600 flex-shrink-0 transition-transform ${isHomeDropdownOpen ? 'rotate-180' : ''}`} strokeWidth={2.4} />
              </button>

              {/* Locations Dropdown Menu */}
              {isHomeDropdownOpen && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-0 mt-2 w-64 rounded-3xl bg-white shadow-xl border border-slate-100 p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    My Locations
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1">
                    {homes.map((h) => {
                      const isSelected = activeHome?.id === h.id;
                      return (
                        <button
                          key={h.id}
                          onClick={() => {
                            setActiveHome(h);
                            homeStorage.setActiveHomeId(h.id);
                            setIsHomeDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-left text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                            isSelected ? 'bg-sky-50 text-[#0284c7]' : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="flex flex-col truncate pr-2">
                            <span className="truncate">{h.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{h.property_type}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#0284c7] flex-shrink-0" strokeWidth={2.4} />}
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="h-px bg-slate-100 my-1.5" />

                  <button
                    onClick={() => {
                      setIsHomeDropdownOpen(false);
                      setAllowSetupHomeClose(true);
                      setIsSetupHomeOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl text-left text-xs sm:text-sm font-bold text-[#0284c7] hover:bg-sky-50 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" strokeWidth={2.4} />
                    <span>+ Add Another Location</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Top-Right: Plus and Three-Dots Action Capsule */}
          <div className="flex items-center pointer-events-auto select-none">
            <div className="relative flex items-center h-10 sm:h-11 rounded-full bg-white/90 hover:bg-white border border-white/80 shadow-sm px-1.5" data-dropdown>
              
              {/* Plus Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPlusMenuOpen(!isPlusMenuOpen);
                  setIsDotsMenuOpen(false);
                  setIsHomeDropdownOpen(false);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-800 transition-colors cursor-pointer"
                title="Add actions"
              >
                <Plus className="w-5 h-5 text-slate-800" strokeWidth={2.4} />
              </button>

              {/* Vertical divider */}
              <div className="w-px h-4 bg-slate-200 mx-1" />

              {/* Three Dots Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDotsMenuOpen(!isDotsMenuOpen);
                  setIsPlusMenuOpen(false);
                  setIsHomeDropdownOpen(false);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-800 transition-colors cursor-pointer"
                title="Options"
              >
                <MoreVertical className="w-4 h-4 text-slate-800" strokeWidth={2.4} />
              </button>

              {/* Plus Quick Actions Dropdown Menu (Reference 2) */}
              {isPlusMenuOpen && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-12 w-56 rounded-[28px] bg-white shadow-2xl border border-slate-100/90 p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    boxShadow: '0 20px 48px -10px rgba(15, 23, 42, 0.18), 0 4px 16px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <button
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-900 text-sm sm:text-base font-semibold transition-colors cursor-pointer"
                  >
                    Add favorites
                  </button>

                  <div className="h-px bg-slate-100 my-1 mx-2" />

                  <button
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      setIsAddDeviceOpen(true);
                    }}
                    className="w-full text-left px-4 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-900 text-sm sm:text-base font-semibold transition-colors cursor-pointer"
                  >
                    Add device
                  </button>

                  <button
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      setActiveTab('routines');
                    }}
                    className="w-full text-left px-4 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-900 text-sm sm:text-base font-semibold transition-colors cursor-pointer"
                  >
                    Create routine
                  </button>

                  <button
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      setIsInviteMemberOpen(true);
                    }}
                    className="w-full text-left px-4 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-900 text-sm sm:text-base font-semibold transition-colors cursor-pointer"
                  >
                    Invite member
                  </button>
                </div>
              )}

              {/* Three Dots Context Dropdown Menu */}
              {isDotsMenuOpen && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-12 w-48 rounded-3xl bg-white shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <button
                    onClick={() => {
                      setIsDotsMenuOpen(false);
                      setIsSettingsOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-slate-600" strokeWidth={2.2} />
                    <span>Location Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDotsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-slate-600" strokeWidth={2.2} />
                    <span>Edit Home Tab</span>
                  </button>
                </div>
              )}

            </div>
          </div>
        </header>
      ) : (
        /* Default Header for Guest & Other Tabs */
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
      )}

      {/* 4. Mobile & Tablet Content (Explore Slider + Pure White Cards based on activeTab; Menu has all content cleared) */}
      <main className="explore-slider-wrapper fixed inset-x-0 top-[4.5rem] sm:top-20 bottom-20 sm:bottom-6 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-start pointer-events-none z-20 px-4 sm:px-6 sm:pl-24 pb-8 space-y-3.5">
        {activeTab === 'home' && (
          <>
            {/* Real-time Clock View & User Details */}
            {renderRealTimeHeader()}

            {/* Room Sub-Tabs bar matching reference image */}
            {renderRoomTabsBar()}

            {/* "Explore" cards slider with dismiss (cross) button */}
            {!isExploreDismissed && (
              <ExploreCardSlider 
                onDismiss={() => {
                  setIsExploreDismissed(true);
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem('neuro_explore_dismissed', 'true');
                  }
                }} 
              />
            )}

            {/* When NO devices exist in home, show the Quick Devices onboarding card */}
            {devices.length === 0 ? (
              <QuickDevicesCard 
                isLoggedIn={isSignedIn}
                onAddDevice={() => handleProtectedAction(() => setIsAddDeviceOpen(true))} 
                onExplore={() => handleProtectedAction(() => setActiveTab('explore'))} 
              />
            ) : (
              /* Connected Devices View: No Explore banner or Quick card once devices exist */
              (() => {
                const filtered = activeRoomTab === 'all'
                  ? devices
                  : devices.filter(d => {
                      const room = rooms.find(r => r.name === activeRoomTab);
                      return room ? d.room_id === room.id : false;
                    });

                if (filtered.length === 0) {
                  return (
                    <div className="w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-5xl bg-white/80 backdrop-blur-md rounded-3xl p-6 text-center border border-white/80 shadow-xs pointer-events-auto">
                      <p className="text-sm font-semibold text-slate-700">No devices in {activeRoomTab}</p>
                      <p className="text-xs text-slate-400 mt-1">Assign devices to this room or add a new device</p>
                      <button
                        onClick={() => handleProtectedAction(() => setIsAddDeviceOpen(true))}
                        className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#0284c7] text-white hover:bg-sky-600 transition-colors shadow-xs cursor-pointer"
                      >
                        + Add device
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-5xl space-y-3 pointer-events-auto">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600 font-mono">
                        Connected Devices ({filtered.length})
                      </span>
                      <button
                        onClick={() => handleProtectedAction(() => setIsAddDeviceOpen(true))}
                        className="text-xs font-bold text-[#0284c7] hover:underline cursor-pointer"
                      >
                        + Add device
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filtered.map((dev) => {
                        const devRoom = rooms.find(r => r.id === dev.room_id);
                        const roomLabel = devRoom ? devRoom.name : 'Living room';

                        return (
                          <div
                            key={dev.id}
                            onClick={() => setSelectedDeviceForControl(dev)}
                            className="bg-white/90 backdrop-blur-md rounded-3xl p-4 sm:p-4.5 shadow-sm border border-slate-100 hover:border-sky-300 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-sky-50 flex items-center justify-center p-1.5 border border-sky-100 shadow-xs group-hover:scale-105 transition-transform flex-shrink-0">
                                  {dev.icon ? (
                                    <img
                                      src={getAssetUrl('ICONS/' + dev.icon)}
                                      alt={dev.custom_name}
                                      className="w-full h-full object-contain"
                                    />
                                  ) : (
                                    <span className="font-bold font-mono text-xs text-[#0284c7]">
                                      {dev.model_code}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#0284c7] transition-colors">
                                      {dev.custom_name}
                                    </h3>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-[#0284c7] border border-sky-100 font-mono">
                                      {dev.model_code}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 font-sans flex items-center gap-1.5 mt-0.5">
                                    <span>{getRoomEmoji(roomLabel)}</span>
                                    <span>{roomLabel}</span>
                                    <span className="text-slate-300">&bull;</span>
                                    <span className="font-mono text-slate-400">{dev.device_id || `NEURO-${dev.model_code}-${dev.mac_4}`}</span>
                                  </p>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1 flex-shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Online
                              </span>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                              <span>{dev.endpoints?.length || 0} Controls Available</span>
                              <span className="text-[#0284c7] font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                Tap to Open Layout &rarr;
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()
            )}
          </>
        )}

        {activeTab === 'devices' && (
          <>
            {/* Real-time Clock View & User Details */}
            {renderRealTimeHeader()}

            {/* Room Sub-Tabs bar matching reference image */}
            {renderRoomTabsBar()}

            {devices.length === 0 ? (
              <QuickDevicesCard 
                isLoggedIn={isSignedIn}
                onAddDevice={() => handleProtectedAction(() => setIsAddDeviceOpen(true))} 
                onExplore={() => handleProtectedAction(() => setActiveTab('explore'))} 
              />
            ) : (
              (() => {
                const filtered = activeRoomTab === 'all'
                  ? devices
                  : devices.filter(d => {
                      const room = rooms.find(r => r.name === activeRoomTab);
                      return room ? d.room_id === room.id : false;
                    });

                if (filtered.length === 0) {
                  return (
                    <div className="w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-5xl bg-white/80 backdrop-blur-md rounded-3xl p-6 text-center border border-white/80 shadow-xs pointer-events-auto">
                      <p className="text-sm font-semibold text-slate-700">No devices in {activeRoomTab}</p>
                      <p className="text-xs text-slate-400 mt-1">Assign devices to this room or add a new device</p>
                      <button
                        onClick={() => handleProtectedAction(() => setIsAddDeviceOpen(true))}
                        className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#0284c7] text-white hover:bg-sky-600 transition-colors shadow-xs cursor-pointer"
                      >
                        + Add device
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-5xl space-y-3 pointer-events-auto mb-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                        Hardware Devices ({filtered.length})
                      </span>
                      <button
                        onClick={() => handleProtectedAction(() => setIsAddDeviceOpen(true))}
                        className="text-xs font-bold text-[#0284c7] hover:underline cursor-pointer"
                      >
                        + Add device
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filtered.map((dev) => {
                        const devRoom = rooms.find(r => r.id === dev.room_id);
                        const roomLabel = devRoom ? devRoom.name : 'Living room';

                        return (
                          <div
                            key={dev.id}
                            onClick={() => setSelectedDeviceForControl(dev)}
                            className="bg-white/90 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/80 hover:border-sky-400 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center p-2 border border-sky-100 shadow-xs group-hover:scale-105 transition-transform flex-shrink-0">
                                  {dev.icon ? (
                                    <img
                                      src={getAssetUrl('ICONS/' + dev.icon)}
                                      alt={dev.custom_name}
                                      className="w-full h-full object-contain"
                                    />
                                  ) : (
                                    <span className="font-bold font-mono text-xs text-[#0284c7]">
                                      {dev.model_code}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#0284c7] transition-colors">
                                      {dev.custom_name}
                                    </h3>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-[#0284c7] border border-sky-100 font-mono">
                                      {dev.model_code}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 font-sans flex items-center gap-1.5 mt-0.5">
                                    <span>{getRoomEmoji(roomLabel)}</span>
                                    <span>{roomLabel}</span>
                                    <span className="text-slate-300">&bull;</span>
                                    <span className="font-mono text-slate-400">{dev.device_id || `NEURO-${dev.model_code}-${dev.mac_4}`}</span>
                                  </p>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1 flex-shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Online
                              </span>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                              <span>{dev.endpoints?.length || 0} Controls Available</span>
                              <span className="text-[#0284c7] font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                Open Switch Layout &rarr;
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()
            )}
          </>
        )}

        {activeTab === 'explore' && (
          <>
            {devices.length === 0 ? (
              <QuickDevicesCard 
                isLoggedIn={isSignedIn}
                onAddDevice={() => handleProtectedAction(() => setIsAddDeviceOpen(true))} 
                onExplore={() => handleProtectedAction(() => setActiveTab('explore'))} 
              />
            ) : (
              <ExploreCardSlider />
            )}
          </>
        )}

        {activeTab === 'routines' && (
          <>
            {/* Real-time Clock View & User Details */}
            {renderRealTimeHeader()}

            {devices.length === 0 ? (
              <QuickDevicesCard 
                isLoggedIn={isSignedIn}
                onAddDevice={() => handleProtectedAction(() => setIsAddDeviceOpen(true))} 
                onExplore={() => handleProtectedAction(() => setActiveTab('explore'))} 
              />
            ) : (
              <div className="w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl space-y-3 pointer-events-auto">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 font-mono">
                    Smart Automations ({rooms.length || 1} Rooms)
                  </span>
                  <button
                    onClick={() => handleProtectedAction()}
                    className="text-xs font-bold text-[#0284c7] hover:underline cursor-pointer"
                  >
                    + New Routine
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  <div className="bg-white rounded-3xl p-4 sm:p-4.5 shadow-sm border border-slate-100 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-100 flex-shrink-0">
                        <Sun className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900">Good Morning</h4>
                        <p className="text-xs text-slate-500">Turn on morning lighting across all rooms</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleProtectedAction()}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-sky-50 text-[#0284c7] border border-sky-100 hover:bg-sky-100 transition-colors cursor-pointer"
                    >
                      Run
                    </button>
                  </div>

                  <div className="bg-white rounded-3xl p-4 sm:p-4.5 shadow-sm border border-slate-100 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100 flex-shrink-0">
                        <Moon className="w-5 h-5 text-indigo-500" />
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900">All Switches Off</h4>
                        <p className="text-xs text-slate-500">Instantly switch off all {devices.length} device(s)</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleProtectedAction()}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-sky-50 text-[#0284c7] border border-sky-100 hover:bg-sky-100 transition-colors cursor-pointer"
                    >
                      Run
                    </button>
                  </div>

                  <div className="bg-white rounded-3xl p-4 sm:p-4.5 shadow-sm border border-slate-100 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100 flex-shrink-0">
                        <Sparkles className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900">Away / Energy Saver</h4>
                        <p className="text-xs text-slate-500">Conserve power across all connected endpoints</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleProtectedAction()}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-sky-50 text-[#0284c7] border border-sky-100 hover:bg-sky-100 transition-colors cursor-pointer"
                    >
                      Run
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'menu' && (
          <MenuTabContent 
            isSignedIn={isSignedIn}
            onSignOut={() => {
              authApi.logout();
              setCurrentUser(null);
              setIsSignedIn(false);
              setHomes([]);
              setActiveHome(null);
              homeStorage.clearActiveHomeId();
            }}
          />
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

      {/* Global Syncing Loader */}
      {isInitializing && <NeuroLoader message="Syncing Smart Workspace..." />}

      {/* 8. Full-Screen Neuro Series Account Authentication */}
      <SignInScreen 
        isOpen={isSignInOpen} 
        onClose={() => setIsSignInOpen(false)} 
        onSignInSuccess={(user) => {
          setCurrentUser(user);
          setIsSignedIn(true);
          loadHomes(true);
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
          setHomes([]);
          setActiveHome(null);
          homeStorage.clearActiveHomeId();
        }}
        onOpenSignIn={() => {
          setIsSettingsOpen(false);
          setIsSignInOpen(true);
        }} 
      />

      {/* 10. Dedicated Setup Your Home Onboarding Screen */}
      <SetupHomeScreen 
        isOpen={isSetupHomeOpen}
        allowClose={allowSetupHomeClose}
        onClose={() => setIsSetupHomeOpen(false)}
        onSuccess={(createdHome) => {
          setHomes((prev) => [...prev, createdHome]);
          setActiveHome(createdHome);
          homeStorage.setActiveHomeId(createdHome.id);
          setIsSetupHomeOpen(false);
        }}
      />

      {/* 11. Location QR Code Sharing Modal (Reference 3) */}
      <LocationQrModal 
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        home={activeHome}
      />

      {/* 12. Invite Member Flow (References 3, 4, 5) */}
      <InviteMemberModal 
        isOpen={isInviteMemberOpen}
        onClose={() => setIsInviteMemberOpen(false)}
        home={activeHome}
        currentUserName={currentUser?.full_name || 'Home Owner'}
        onOpenQrCode={() => setIsQrModalOpen(true)}
      />

      {/* 13. Add Device Screen Flow */}
      <AddDeviceScreen 
        isOpen={isAddDeviceOpen}
        onClose={() => setIsAddDeviceOpen(false)}
        homeId={activeHome?.id || null}
        activeHome={activeHome}
        defaultWifiSsid={activeHome?.default_wifi_ssid || ''}
        rooms={rooms}
        onDeviceAdded={(roomName, newDevice) => {
          if (activeHome) loadDevices(activeHome.id);
          if (newDevice) {
            setDevices((prev) => {
              const exists = prev.some((d) => d.id === newDevice.id || (d.mac_4 === newDevice.mac_4 && d.model_code === newDevice.model_code));
              return exists ? prev : [newDevice, ...prev];
            });
          }
          setActiveRoomTab(roomName);
          setActiveTab('devices');
        }}
        onRoomAdded={(newRoom) => {
          setRooms((prev) => {
            if (prev.some((r) => r.name.toLowerCase() === newRoom.name.toLowerCase())) {
              return prev;
            }
            return [...prev, newRoom];
          });
          setActiveRoomTab(newRoom.name);
        }}
      />

      {/* 14. Modal UI Layout for Hardware Device Control */}
      {selectedDeviceForControl && (() => {
        const devRoom = rooms.find(r => r.id === selectedDeviceForControl.room_id);
        const roomLabel = devRoom ? devRoom.name : 'Living room';

        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 select-none pointer-events-auto"
            onClick={() => setSelectedDeviceForControl(null)}
          >
            {/* Modal Dialog Card */}
            <div 
              className="relative w-full max-w-xl max-h-[92vh] overflow-hidden flex flex-col rounded-3xl shadow-2xl border border-white/80 animate-in zoom-in-95 duration-200"
              style={{
                backgroundColor: '#d4edf4',
                backgroundImage: `
                  radial-gradient(circle at 10% 10%, rgba(255, 255, 255, 0.95) 0%, transparent 50%),
                  radial-gradient(circle at 90% 90%, rgba(255, 255, 255, 0.90) 0%, transparent 50%)
                `,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <header className="sticky top-0 z-20 w-full bg-[#d4edf4]/95 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-sky-200/60 shadow-xs flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white shadow-xs border border-sky-100 flex items-center justify-center flex-shrink-0">
                    {selectedDeviceForControl.icon ? (
                      <img
                        src={getAssetUrl('ICONS/' + selectedDeviceForControl.icon)}
                        alt={selectedDeviceForControl.custom_name}
                        className="w-7 h-7 object-contain"
                      />
                    ) : (
                      <span className="font-bold font-mono text-xs text-[#0284c7]">
                        {selectedDeviceForControl.model_code}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight">
                      {selectedDeviceForControl.custom_name}
                    </h2>
                    <p className="text-xs text-slate-500 font-sans flex items-center gap-1.5 mt-0.5">
                      <span>{getRoomEmoji(roomLabel)}</span>
                      <span className="font-semibold text-slate-700">{roomLabel}</span>
                      <span className="text-slate-300">&bull;</span>
                      <span className="font-mono text-[11px] text-[#0284c7] font-bold">{selectedDeviceForControl.model_code}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-xs ${
                    selectedDeviceForControl.is_online !== false
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      selectedDeviceForControl.is_online !== false
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-slate-400'
                    }`} />
                    {selectedDeviceForControl.is_online !== false ? 'Online' : 'Offline'}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedDeviceForControl(null)}
                    className="w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 shadow-xs border border-slate-200 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5 text-slate-700" strokeWidth={2.5} />
                  </button>
                </div>
              </header>

              {/* Modal Meta Details */}
              <div className="px-4 sm:px-6 pt-3 pb-1 flex-shrink-0">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-2 px-3.5 border border-sky-100/80 flex items-center justify-between text-xs font-mono text-slate-600 shadow-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-sans font-medium text-[11px]">Device ID:</span>
                    <span className="font-bold text-[#0284c7]">{selectedDeviceForControl.device_id || `NEURO-${selectedDeviceForControl.model_code}-${selectedDeviceForControl.mac_4}`}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-sans font-medium text-[11px]">IP:</span>
                    <span className="text-slate-700 font-semibold">{selectedDeviceForControl.ip_address || '192.168.1.x'}</span>
                  </div>
                </div>
              </div>

              {/* Modal Body: Switch Controls */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <DynamicDeviceLayout 
                  modelCode={selectedDeviceForControl.model_code}
                  deviceName={selectedDeviceForControl.custom_name}
                  deviceId={selectedDeviceForControl.device_id || selectedDeviceForControl.id}
                  initialSwitches={selectedDeviceForControl.switches}
                />
              </div>
            </div>
          </div>
        );
      })()}


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
