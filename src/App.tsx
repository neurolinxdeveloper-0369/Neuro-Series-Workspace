import { useState, useEffect, useRef } from 'react';
import { 
  Home,
  LayoutPanelTop, 
  BookText, 
  CirclePlay, 
  Menu,
  Search,
  X,
  LogIn,
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
  User,
  ArrowLeft,
  Zap,
  Edit2,
  Trash2,
  Play,
  CheckCircle2,
  FolderPlus
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
import { routineApi, routineStorage, formatScheduleTimeToIst, type SmartRoutine, type RoutineAction } from './services/routine';
import { formatIstTime, formatIstDate, isScheduleTimeMatch, isScheduleDayMatch } from './utils/time';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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

  // Room Creation Modal State (Saves directly to DB via /homes/:homeId/rooms)
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // Smart Routines & Automations State (Saves scenes / group control & time schedules)
  const [routines, setRoutines] = useState<SmartRoutine[]>(() => routineStorage.getRoutines());
  const [routineRoomFilter, setRoutineRoomFilter] = useState<string>('all');
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<SmartRoutine | null>(null);
  const [routineDraftName, setRoutineDraftName] = useState('');
  const [routineDraftType, setRoutineDraftType] = useState<'scene' | 'schedule'>('scene');
  const [routineDraftIcon, setRoutineDraftIcon] = useState<SmartRoutine['icon']>('sun');
  const [routineDraftRoomId, setRoutineDraftRoomId] = useState<string>('all');
  const [routineDraftScheduleTime, setRoutineDraftScheduleTime] = useState<string>('06:30');
  const [routineDraftScheduleOffTime, setRoutineDraftScheduleOffTime] = useState<string>('22:00');
  const [routineDraftRepeatDays, setRoutineDraftRepeatDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [routineDraftActions, setRoutineDraftActions] = useState<RoutineAction[]>([]);
  const [runningRoutineId, setRunningRoutineId] = useState<string | null>(null);

  // Live Date & Time Clock for Desktop & Dashboard in Indian Standard Time (IST)
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeFormatted = formatIstTime(currentDateTime);
  const dayName = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(currentDateTime);
  const dateFormatted = formatIstDate(currentDateTime);
  const currentHour = parseInt(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(currentDateTime), 10);
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
      const now = Date.now();
      const mapped = (homeDevices || []).map((d: any) => {
        const isOnline = Boolean(d.is_online) && d.last_seen_at && (now - new Date(d.last_seen_at).getTime() <= 12000);
        return {
          ...d,
          is_online: Boolean(isOnline),
          last_seen_at: d.last_seen_at || null,
        };
      });
      setDevices(mapped);
    } catch {
      setDevices([]);
    }
  };

  const loadRoutines = async (homeId?: string) => {
    try {
      const dbRoutines = await routineApi.getRoutines(homeId);
      setRoutines(dbRoutines);
    } catch {
      setRoutines([]);
    }
  };

  useEffect(() => {
    if (activeHome) {
      loadRooms(activeHome.id);
      loadDevices(activeHome.id);
      loadRoutines(activeHome.id);
    } else {
      setRooms([]);
      setDevices([]);
      setRoutines([]);
    }
  }, [activeHome?.id]);

  // Real-time WebSocket listener for physical hardware switch telemetry & heartbeats
  useEffect(() => {
    const unsubscribe = realtimeSocket.subscribe((deviceId, incomingState) => {
      const nowIso = new Date().toISOString();
      // Hardware telemetry with RSSI or heartbeat signifies device is online
      const isOnline = incomingState.is_online !== undefined 
        ? Boolean(incomingState.is_online) 
        : true;

      setDevices(prev => prev.map(dev => {
        if (dev.device_id === deviceId || dev.id === deviceId) {
          return {
            ...dev,
            is_online: isOnline,
            rssi: incomingState.rssi !== undefined ? incomingState.rssi : dev.rssi,
            last_seen_at: incomingState.last_seen_at || nowIso,
            switches: incomingState.switches ? { ...dev.switches, ...incomingState.switches } : dev.switches,
            switch_configs: incomingState.switchConfigs || dev.switch_configs,
          };
        }
        return dev;
      }));

      setSelectedDeviceForControl((prev: any) => {
        if (prev && (prev.device_id === deviceId || prev.id === deviceId)) {
          return {
            ...prev,
            is_online: isOnline,
            rssi: incomingState.rssi !== undefined ? incomingState.rssi : prev.rssi,
            last_seen_at: incomingState.last_seen_at || nowIso,
            switches: incomingState.switches ? { ...prev.switches, ...incomingState.switches } : prev.switches,
            switch_configs: incomingState.switchConfigs || prev.switch_configs,
          };
        }
        return prev;
      });
    });

    return unsubscribe;
  }, []);

  // 12-second watchdog timer: If hardware hasn't sent RSSI/telemetry within 12 seconds, flip status to offline
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setDevices(prev => {
        let changed = false;
        const updated = prev.map(dev => {
          if (!dev.is_online) return dev;
          if (dev.last_seen_at) {
            const diff = now - new Date(dev.last_seen_at).getTime();
            if (diff > 12000) {
              changed = true;
              return { ...dev, is_online: false };
            }
          } else {
            changed = true;
            return { ...dev, is_online: false };
          }
          return dev;
        });
        return changed ? updated : prev;
      });

      setSelectedDeviceForControl((prev: any) => {
        if (prev && prev.is_online) {
          if (prev.last_seen_at) {
            const diff = now - new Date(prev.last_seen_at).getTime();
            if (diff > 12000) {
              return { ...prev, is_online: false };
            }
          } else {
            return { ...prev, is_online: false };
          }
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
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

  // Dynamically detect phone insets: Status bar at top & navigation mode at bottom
  useEffect(() => {
    const updateNavInsets = () => {
      try {
        const bridge = (window as any).AndroidWifiBridge;
        let navHeight = 0;
        let statusBarHeight = 0;
        if (bridge) {
          if (typeof bridge.getNavigationBarHeight === 'function') {
            navHeight = bridge.getNavigationBarHeight();
          }
          if (typeof bridge.getStatusBarHeight === 'function') {
            statusBarHeight = bridge.getStatusBarHeight();
          }
        }

        const isGesture = bridge && typeof bridge.isGestureNavigation === 'function' ? bridge.isGestureNavigation() : false;

        // Status bar top inset (typically 24px - 44px on phones)
        if (statusBarHeight > 0) {
          document.documentElement.style.setProperty('--android-status-top', `${statusBarHeight}px`);
        } else {
          document.documentElement.style.setProperty('--android-status-top', '0px');
        }

        // If phone has 3-button navigation icons (Back, Home, Recents), ensure at least 48px to prevent collision
        if (!isGesture && navHeight > 0) {
          const finalHeight = Math.max(navHeight, 48);
          document.documentElement.style.setProperty('--android-nav-bottom', `${finalHeight}px`);
        } else if (navHeight > 0) {
          document.documentElement.style.setProperty('--android-nav-bottom', `${navHeight}px`);
        } else {
          document.documentElement.style.setProperty('--android-nav-bottom', '0px');
        }
      } catch {
        document.documentElement.style.setProperty('--android-status-top', '0px');
        document.documentElement.style.setProperty('--android-nav-bottom', '0px');
      }
    };

    updateNavInsets();
    try {
      StatusBar.setStyle({ style: Style.Dark });
      StatusBar.setBackgroundColor({ color: '#d4edf4' });
    } catch {
      // web fallback
    }
    window.addEventListener('resize', updateNavInsets);
    return () => window.removeEventListener('resize', updateNavInsets);
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

  // Create Room: Saves directly to PostgreSQL via /homes/:homeId/rooms
  const handleCreateRoom = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsCreatingRoom(true);
    try {
      if (activeHome) {
        const created = await homeApi.createRoom(activeHome.id, trimmed);
        setRooms(prev => [...prev, created]);
      } else {
        const fallbackRoom: Room = {
          id: `room_${Date.now()}`,
          home_id: 'default',
          name: trimmed,
          created_at: new Date().toISOString(),
        };
        setRooms(prev => [...prev, fallbackRoom]);
      }
      setActiveRoomTab(trimmed);
      setIsCreateRoomOpen(false);
      setNewRoomName('');
    } catch (err: any) {
      alert(err.message || 'Failed to create room in database.');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleOpenCreateRoutine = (initialType: 'scene' | 'schedule' = 'scene') => {
    setEditingRoutine(null);
    setRoutineDraftName('');
    setRoutineDraftType(initialType);
    setRoutineDraftIcon(initialType === 'scene' ? 'sun' : 'clock');
    setRoutineDraftRoomId('all');
    setRoutineDraftScheduleTime('06:30');
    setRoutineDraftScheduleOffTime('22:00');
    setRoutineDraftRepeatDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setRoutineDraftActions([]);
    setIsRoutineModalOpen(true);
  };

  const handleOpenEditRoutine = (routine: SmartRoutine) => {
    setEditingRoutine(routine);
    setRoutineDraftName(routine.name);
    setRoutineDraftType(routine.type || 'scene');
    setRoutineDraftIcon(routine.icon || 'sun');
    setRoutineDraftRoomId(routine.roomId || 'all');
    setRoutineDraftScheduleTime(routine.scheduleTime ? routine.scheduleTime.replace(/ IST/i, '') : '06:30');
    setRoutineDraftScheduleOffTime(routine.scheduleOffTime ? routine.scheduleOffTime.replace(/ IST/i, '') : '22:00');
    setRoutineDraftRepeatDays(routine.repeatDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    setRoutineDraftActions(routine.actions ? [...routine.actions] : []);
    setIsRoutineModalOpen(true);
  };

  const handleSaveRoutine = async () => {
    const finalName = routineDraftName.trim() || (routineDraftType === 'scene' ? 'Custom Scene' : 'Timed Schedule');
    const onTimeIst = routineDraftType === 'schedule' ? formatScheduleTimeToIst(routineDraftScheduleTime) : undefined;
    const offTimeIst = routineDraftType === 'schedule' && routineDraftScheduleOffTime ? formatScheduleTimeToIst(routineDraftScheduleOffTime) : undefined;

    try {
      if (editingRoutine) {
        await routineApi.updateRoutine(editingRoutine.id, {
          name: finalName,
          type: routineDraftType,
          icon: routineDraftIcon,
          roomId: routineDraftRoomId,
          scheduleTime: onTimeIst,
          scheduleOffTime: offTimeIst,
          repeatDays: routineDraftType === 'schedule' ? routineDraftRepeatDays : undefined,
          actions: routineDraftActions,
        });
      } else {
        await routineApi.createRoutine({
          name: finalName,
          type: routineDraftType,
          icon: routineDraftIcon,
          roomId: routineDraftRoomId,
          scheduleTime: onTimeIst,
          scheduleOffTime: offTimeIst,
          repeatDays: routineDraftType === 'schedule' ? routineDraftRepeatDays : undefined,
          actions: routineDraftActions,
          isActive: true,
        }, activeHome?.id || undefined);
      }
      const updated = await routineApi.getRoutines(activeHome?.id || undefined);
      setRoutines(updated);
    } catch (err) {
      console.error('Failed to save routine:', err);
    } finally {
      setIsRoutineModalOpen(false);
    }
  };

  const handleDeleteRoutine = async (id: string) => {
    try {
      await routineApi.deleteRoutine(id);
      const updated = await routineApi.getRoutines(activeHome?.id || undefined);
      setRoutines(updated);
    } catch (err) {
      console.error('Failed to delete routine:', err);
    } finally {
      setIsRoutineModalOpen(false);
    }
  };

  const handleRunRoutine = async (routine: SmartRoutine) => {
    setRunningRoutineId(routine.id);
    try {
      if (routine.actions && routine.actions.length > 0) {
        for (const action of routine.actions) {
          const target = routine.type === 'schedule' ? 'on' : (action.targetState ? 'on' : 'off');
          deviceApi.controlSwitch(action.deviceId, action.channel, target).catch(() => {});
        }
      }
      await routineApi.runRoutine(routine.id).catch(() => {});
    } finally {
      setTimeout(() => setRunningRoutineId(null), 1200);
    }
  };

  // Automated Time Scheduler Engine (Checks active schedules every 10s in Indian Standard Time)
  const lastFiredScheduleRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkSchedules = () => {
      const now = new Date();
      const currentMinuteKey = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);

      const activeSchedules = routines.filter(r => r.isActive && r.type === 'schedule');

      for (const schedule of activeSchedules) {
        if (!isScheduleDayMatch(schedule.repeatDays, now)) continue;

        // Check Turn ON Time (IST)
        if (schedule.scheduleTime && isScheduleTimeMatch(schedule.scheduleTime, now)) {
          const fireKey = `${schedule.id}_on_${currentMinuteKey}`;
          if (!lastFiredScheduleRef.current.has(fireKey)) {
            lastFiredScheduleRef.current.add(fireKey);
            console.log(`⏰ [CLIENT SCHEDULER] Triggering ON: "${schedule.name}" at ${currentMinuteKey} IST`);
            if (schedule.actions && schedule.actions.length > 0) {
              for (const act of schedule.actions) {
                deviceApi.controlSwitch(act.deviceId, act.channel, 'on').catch(() => {});
              }
            }
            routineApi.runRoutine(schedule.id).catch(() => {});
          }
        }

        // Check Turn OFF Time (IST)
        if (schedule.scheduleOffTime && isScheduleTimeMatch(schedule.scheduleOffTime, now)) {
          const fireKey = `${schedule.id}_off_${currentMinuteKey}`;
          if (!lastFiredScheduleRef.current.has(fireKey)) {
            lastFiredScheduleRef.current.add(fireKey);
            console.log(`⏰ [CLIENT SCHEDULER] Triggering OFF: "${schedule.name}" at ${currentMinuteKey} IST`);
            if (schedule.actions && schedule.actions.length > 0) {
              for (const act of schedule.actions) {
                deviceApi.controlSwitch(act.deviceId, act.channel, 'off').catch(() => {});
              }
            }
            routineApi.runRoutine(schedule.id).catch(() => {});
          }
        }
      }

      if (lastFiredScheduleRef.current.size > 200) {
        lastFiredScheduleRef.current.clear();
      }
    };

    const timer = setInterval(checkSchedules, 10000);
    checkSchedules();
    return () => clearInterval(timer);
  }, [routines]);

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

  // Home Selector Dropdown Capsule (Used across all screen headers)
  const renderHomeSelectorDropdown = () => (
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
  );

  // Contextual Plus Button & Dropdown for Top-Right Header across all screens
  const renderContextualPlusDropdown = () => (
    <div className="relative" data-dropdown>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsPlusMenuOpen(!isPlusMenuOpen);
          setIsDotsMenuOpen(false);
          setIsHomeDropdownOpen(false);
        }}
        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm border border-white/80 cursor-pointer"
        title="Add actions"
      >
        <Plus className="w-5 h-5 text-slate-800" strokeWidth={2.4} />
      </button>

      {isPlusMenuOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-12 w-56 rounded-3xl bg-white shadow-2xl border border-slate-100/90 p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
          style={{
            boxShadow: '0 20px 48px -10px rgba(15, 23, 42, 0.18), 0 4px 16px rgba(0, 0, 0, 0.04)',
          }}
        >
          {activeTab === 'devices' && (
            <>
              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  handleProtectedAction(() => setIsCreateRoomOpen(true));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors cursor-pointer"
              >
                <FolderPlus className="w-4 h-4 text-[#0284c7]" strokeWidth={2.3} />
                <span>Add Room</span>
              </button>

              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  handleProtectedAction(() => setIsAddDeviceOpen(true));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#0284c7]" strokeWidth={2.3} />
                <span>Add Device</span>
              </button>
            </>
          )}

          {activeTab === 'routines' && (
            <>
              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  handleProtectedAction(() => handleOpenCreateRoutine('scene'));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-500" strokeWidth={2.3} />
                <span>Add Scene</span>
              </button>

              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  handleProtectedAction(() => handleOpenCreateRoutine('schedule'));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors cursor-pointer"
              >
                <Clock className="w-4 h-4 text-[#0284c7]" strokeWidth={2.3} />
                <span>Add Schedule</span>
              </button>
            </>
          )}

          {activeTab === 'explore' && (
            <>
              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  setIsExploreDismissed(false);
                  if (typeof window !== 'undefined') {
                    sessionStorage.removeItem('neuro_explore_dismissed');
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-500" strokeWidth={2.3} />
                <span>Smart Feature</span>
              </button>

              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  setIsExploreDismissed(false);
                  if (typeof window !== 'undefined') {
                    sessionStorage.removeItem('neuro_explore_dismissed');
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors cursor-pointer"
              >
                <Layers className="w-4 h-4 text-[#0284c7]" strokeWidth={2.3} />
                <span>Explore Features</span>
              </button>
            </>
          )}

          {(activeTab === 'home' || activeTab === 'menu') && (
            <>
              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  handleProtectedAction(() => setIsAddDeviceOpen(true));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#0284c7]" strokeWidth={2.3} />
                <span>Add Device</span>
              </button>

              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  handleProtectedAction(() => setIsCreateRoomOpen(true));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors cursor-pointer"
              >
                <FolderPlus className="w-4 h-4 text-[#0284c7]" strokeWidth={2.3} />
                <span>Add Room</span>
              </button>

              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  handleProtectedAction(() => handleOpenCreateRoutine('scene'));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-500" strokeWidth={2.3} />
                <span>Add Routine</span>
              </button>

              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  handleProtectedAction(() => setIsInviteMemberOpen(true));
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors cursor-pointer"
              >
                <User className="w-4 h-4 text-emerald-500" strokeWidth={2.3} />
                <span>Invite Member</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  // Room Sub-Tabs bar with integrated mobile & desktop search
  const renderRoomTabsBar = () => {
    if (!isSignedIn) return null;

    return (
      <div className="w-full flex items-center select-none pointer-events-auto">
        {isSearchOpen ? (
          <div className="w-full flex items-center gap-2 bg-white/95 backdrop-blur-md rounded-full px-3.5 py-1.5 shadow-sm border border-sky-200 animate-in fade-in duration-150">
            <Search className="w-4 h-4 text-[#0284c7] flex-shrink-0" strokeWidth={2.4} />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search devices, rooms..."
              className="w-full bg-transparent text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer flex-shrink-0"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
              }}
              className="text-xs font-bold text-[#0284c7] hover:text-sky-700 px-2 py-0.5 rounded-full hover:bg-sky-50 transition-colors cursor-pointer flex-shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="w-full flex items-center gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar py-0.5">
            {/* Search Toggle Button */}
            <button 
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-[#0284c7] shadow-xs border border-white/80 flex items-center justify-center transition-all cursor-pointer flex-shrink-0 active:scale-95"
              aria-label="Search devices"
              title="Search devices"
            >
              <Search className="w-4 h-4" strokeWidth={2.4} />
            </button>

            {/* Room Tabs */}
            <div className="flex items-center gap-4 sm:gap-5 text-sm sm:text-base font-bold tracking-tight whitespace-nowrap">
              <button
                type="button"
                onClick={() => setActiveRoomTab('all')}
                className={`transition-all cursor-pointer pb-0.5 relative ${
                  activeRoomTab === 'all' 
                    ? 'text-slate-900 font-extrabold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-slate-900 after:rounded-full' 
                    : 'text-slate-500 hover:text-slate-700 font-medium'
                }`}
              >
                All devices
              </button>

              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setActiveRoomTab(room.name)}
                  className={`transition-all cursor-pointer pb-0.5 relative ${
                    activeRoomTab === room.name 
                      ? 'text-slate-900 font-extrabold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-slate-900 after:rounded-full' 
                      : 'text-slate-500 hover:text-slate-700 font-medium'
                  }`}
                >
                  {room.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Your Space Connectivity Transparent Card (Ultra-Transparent Glassmorphism)
  const renderConnectivityCard = (totalCount: number, liveCount: number, inactiveCount: number) => (
    <div 
      className="w-full rounded-2xl sm:rounded-3xl p-3 sm:p-4 select-none relative overflow-hidden transition-all"
      style={{
        background: 'rgba(255, 255, 255, 0.22)',
        backdropFilter: 'blur(28px) saturate(170%)',
        WebkitBackdropFilter: 'blur(28px) saturate(170%)',
        border: '1px solid rgba(255, 255, 255, 0.60)',
        boxShadow: '0 8px 32px 0 rgba(2, 132, 199, 0.05), inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.70)',
      }}
    >
      {/* Specular Glare Curve Overlay */}
      <div 
        className="absolute inset-0 rounded-2xl sm:rounded-3xl pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%)'
        }}
      />

      {/* Top Row: YOUR SPACE CONNECTIVITY */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[#0284c7] shadow-[0_0_8px_#38bdf8] flex-shrink-0" />
          <h2 className="text-[11px] sm:text-xs md:text-sm font-extrabold tracking-wider uppercase text-slate-900 font-mono truncate">
            Your Space Connectivity
          </h2>
        </div>
      </div>

      {/* Divider */}
      <div className="relative z-10 h-px bg-white/40 my-2 sm:my-2.5" />

      {/* Bottom Row: Total, Live, Inactive */}
      <div className="relative z-10 flex items-center justify-between text-xs sm:text-sm px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-600 font-medium text-[11px] sm:text-xs">Total:</span>
          <span className="font-bold text-slate-900 font-mono text-xs sm:text-sm">{totalCount}</span>
        </div>

        <div className="h-3 w-px bg-white/60" />

        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <span className="text-slate-600 font-medium text-[11px] sm:text-xs">Live:</span>
          <span className="font-bold text-emerald-600 font-mono text-xs sm:text-sm">{liveCount}</span>
        </div>

        <div className="h-3 w-px bg-white/60" />

        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
          <span className="text-slate-600 font-medium text-[11px] sm:text-xs">Inactive:</span>
          <span className={`font-bold font-mono text-xs sm:text-sm ${inactiveCount > 0 ? 'text-rose-500' : 'text-slate-700'}`}>
            {inactiveCount}
          </span>
        </div>
      </div>
    </div>
  );

  // Compact Device Card (2 per row on mobile, reduced height, clean UI)
  const renderCompactDeviceCard = (dev: any, roomLabel: string) => (
    <div
      key={dev.id}
      onClick={() => setSelectedDeviceForControl(dev)}
      className="group relative overflow-hidden bg-white/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xs border border-white/80 hover:border-sky-300 hover:shadow-md transition-all cursor-pointer active:scale-[0.98] flex flex-col justify-between"
    >
      {/* Top Compact Hero Showcase: reduced height h-18 sm:h-22 */}
      <div className="relative w-full h-18 sm:h-22 bg-gradient-to-b from-sky-50/70 via-sky-50/30 to-white/10 flex items-center justify-center overflow-hidden p-1.5 border-b border-slate-100/70">
        {dev.model_code === 'GATE' ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-0.5 opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-xs text-white relative flex-shrink-0">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18" />
                <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
                <path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
              </svg>
              <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded-full bg-emerald-500 text-[6px] font-black text-white shadow-xs">
                1 CH
              </span>
            </div>
            <span className="text-[7.5px] sm:text-[8.5px] font-bold text-slate-600 tracking-wider uppercase mt-1 font-mono truncate max-w-full">
              Gate Motor
            </span>
          </div>
        ) : (
          <img
            src={getAssetUrl('8S.png')}
            alt={dev.custom_name}
            className="w-full h-full max-h-12 sm:max-h-14 object-contain opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
          />
        )}

        {/* Overlaid Room Name Pill (Top-Left) */}
        <div className="absolute top-1.5 left-1.5 flex items-center max-w-[50%]">
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-white/95 backdrop-blur-md text-slate-700 shadow-2xs border border-white/80 flex items-center gap-1 truncate">
            <span className="flex-shrink-0">{getRoomEmoji(roomLabel)}</span>
            <span className="truncate">{roomLabel}</span>
          </span>
        </div>

        {/* Overlaid Status Pill (Top-Right) */}
        <div className="absolute top-1.5 right-1.5 flex items-center">
          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 backdrop-blur-md shadow-2xs ${
            dev.is_online
              ? 'bg-emerald-50/95 text-emerald-700 border-emerald-200'
              : 'bg-rose-50/95 text-rose-700 border-rose-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              dev.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'
            }`} />
            <span>{dev.is_online ? 'Online' : 'Offline'}</span>
          </span>
        </div>
      </div>

      {/* Bottom Details Section (Device name, model, Action) */}
      <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-1">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#0284c7] transition-colors leading-tight truncate">
              {dev.custom_name}
            </h3>
            <span className="px-1 py-0.2 rounded-md text-[8px] sm:text-[9px] font-bold bg-sky-50 text-[#0284c7] border border-sky-100 font-mono flex-shrink-0">
              {dev.model_code || 'TP8'}
            </span>
          </div>
          <p className="text-[9px] text-slate-400 font-mono truncate mt-0.5">
            {dev.device_id || `NEURO-${dev.model_code}-${dev.mac_4}`}
          </p>
        </div>

        <div className="mt-1.5 pt-1.5 border-t border-slate-100/90 flex items-center justify-between text-[9px] sm:text-[10px]">
          <span className="font-medium text-slate-400 truncate">
            {dev.is_online ? 'Ready' : 'Offline'}
          </span>
          <span className={`font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform flex-shrink-0 ${
            dev.is_online ? 'text-[#0284c7]' : 'text-slate-400'
          }`}>
            <span>Open</span>
            <span>&rarr;</span>
          </span>
        </div>
      </div>
    </div>
  );

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

      {/* 3. Unified Responsive Header: Only shown on Home tab */}
      {isSignedIn && activeTab === 'home' ? (
        /* Logged-In Header: Row 1 = Quick Actions & Home Switcher; Row 2 = Search & Room Tabs */
        <header className="app-top-header fixed top-4 sm:top-5 inset-x-0 z-30 flex flex-col pointer-events-none px-4 sm:px-6 md:px-8">
          {/* Row 1: Quick Actions & Home Selector */}
          <div className="w-full flex items-center justify-between">
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
            {renderHomeSelectorDropdown()}
          </div>

          {/* Top-Right: Plus and Three-Dots Action Capsules */}
          <div className="flex items-center pointer-events-auto select-none gap-2">
            {renderContextualPlusDropdown()}

            {/* Three Dots Button */}
            <div className="relative flex items-center h-10 sm:h-11 rounded-full bg-white/90 hover:bg-white border border-white/80 shadow-sm px-1.5" data-dropdown>
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
          </div>

          {/* Row 2: Search + Room Tabs (Always positioned cleanly below Row 1 without overlapping) */}
          <div className="w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-5xl mx-auto mt-2 sm:mt-2.5 pointer-events-auto">
            {renderRoomTabsBar()}
          </div>
        </header>
      ) : isSignedIn ? (
        /* When Signed In on other tabs (Devices, Explore, Routines, Menu): Display Home Selector Capsule & Contextual Plus Dropdown */
        <header className="app-top-header fixed top-4 sm:top-5 inset-x-0 z-30 flex items-center justify-between px-4 sm:px-6 md:px-8 pointer-events-none">
          <div className="flex items-center pointer-events-auto select-none">
            {renderHomeSelectorDropdown()}
          </div>
          <div className="flex items-center pointer-events-auto select-none">
            {renderContextualPlusDropdown()}
          </div>
        </header>
      ) : (
        /* Default Header for Guests (Not Signed In) */
        <header className="app-top-header fixed top-4 sm:top-5 inset-x-0 z-30 flex items-center justify-between px-4 sm:px-6 md:px-8 pointer-events-none">
          <div className="flex items-center gap-2 sm:gap-2.5 select-none pointer-events-auto flex-shrink-0">
            <span className="brand-text-responsive font-extrabold text-base sm:text-lg md:text-xl tracking-wider font-sans select-none whitespace-nowrap">
              Neuro Series
            </span>
          </div>

          <div className="flex items-center justify-end pointer-events-auto flex-shrink-0">
            <button
              onClick={() => setIsSignInOpen(true)}
              data-bg-light="true"
              className="glass-signin-btn group flex items-center justify-center select-none rounded-full cursor-pointer"
              title="Sign In"
            >
              <div className="relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2">
                <LogIn className="signin-icon w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0284c7] sm:text-white transition-colors group-hover:scale-110" strokeWidth={2.3} />
                <span className="signin-text text-xs sm:text-sm font-bold text-[#0284c7] sm:text-white tracking-wide font-sans select-none">
                  Sign In
                </span>
              </div>
            </button>
          </div>
        </header>
      )}

      {/* 4. Mobile & Tablet Content (Explore Slider + Pure White Cards based on activeTab; Menu has all content cleared) */}
      <main className={`explore-slider-wrapper ${isSignedIn && activeTab === 'home' ? 'top-header-2rows' : 'top-header-1row'} fixed inset-x-0 top-[6.75rem] sm:top-28 bottom-20 sm:bottom-6 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-start pointer-events-none z-20 px-4 sm:px-6 sm:pl-24 pb-8 space-y-3.5`}>
        {activeTab === 'home' && (
          <>
            {/* Real-time Clock View & User Details */}
            {renderRealTimeHeader()}

            {/* "Explore" cards slider: ONLY when NO devices exist in home */}
            {devices.length === 0 && !isExploreDismissed && (
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
                const filtered = devices
                  .filter(d => activeRoomTab === 'all' || (rooms.find(r => r.name === activeRoomTab)?.id === d.room_id))
                  .filter(d => !searchQuery.trim() || 
                    d.custom_name.toLowerCase().includes(searchQuery.trim().toLowerCase()) || 
                    d.model_code.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                    (d.device_id && d.device_id.toLowerCase().includes(searchQuery.trim().toLowerCase())) ||
                    (rooms.find(r => r.id === d.room_id)?.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
                  );

                const onlineCount = filtered.filter(d => Boolean(d.is_online)).length;
                const offlineCount = filtered.filter(d => !d.is_online).length;

                return (
                  <div className="w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-5xl space-y-3 pointer-events-auto pt-1 sm:pt-2">
                    {/* Transparent Card: Your Space Connectivity */}
                    {renderConnectivityCard(filtered.length, onlineCount, offlineCount)}

                    {filtered.length === 0 ? (
                      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 text-center border border-white/80 shadow-xs space-y-1.5">
                        {searchQuery.trim() ? (
                          <>
                            <Search className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                            <p className="text-sm font-semibold text-slate-800">No devices found</p>
                            <p className="text-xs text-slate-500">No devices matched "{searchQuery}"</p>
                            <button
                              type="button"
                              onClick={() => setSearchQuery('')}
                              className="mt-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[#0284c7] text-white hover:bg-sky-600 transition-colors cursor-pointer"
                            >
                              Clear search
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-slate-700">No devices in {activeRoomTab}</p>
                            <p className="text-xs text-slate-400 mt-1">Assign devices to this room or add a new device</p>
                            <button
                              onClick={() => handleProtectedAction(() => setIsAddDeviceOpen(true))}
                              className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#0284c7] text-white hover:bg-sky-600 transition-colors shadow-xs cursor-pointer"
                            >
                              + Add device
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
                        {filtered.map((dev) => {
                          const devRoom = rooms.find(r => r.id === dev.room_id);
                          const roomLabel = devRoom ? devRoom.name : 'Living room';
                          return renderCompactDeviceCard(dev, roomLabel);
                        })}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </>
        )}

        {activeTab === 'devices' && (
          <>
            {/* Dedicated Top Action Bar for Devices & Rooms */}
            <div className="w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-5xl pointer-events-auto pt-2">
              <div className="flex items-center justify-between bg-white/35 backdrop-blur-2xl rounded-3xl p-3 sm:p-4 border border-white/60 shadow-xs mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 text-[#0284c7] flex items-center justify-center border border-sky-100 shadow-xs">
                    <LayoutPanelTop className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                      All Devices & Rooms
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {devices.length} Devices &bull; {rooms.length} Rooms
                    </p>
                  </div>
                </div>
              </div>

              {/* Room Tabs & Search Bar for filtering devices */}
              {renderRoomTabsBar()}
            </div>

            {devices.length === 0 ? (
              <QuickDevicesCard 
                isLoggedIn={isSignedIn}
                onAddDevice={() => handleProtectedAction(() => setIsAddDeviceOpen(true))} 
                onExplore={() => handleProtectedAction(() => setActiveTab('explore'))} 
              />
            ) : (
              (() => {
                const filtered = devices
                  .filter(d => activeRoomTab === 'all' || (rooms.find(r => r.name === activeRoomTab)?.id === d.room_id))
                  .filter(d => !searchQuery.trim() || 
                    d.custom_name.toLowerCase().includes(searchQuery.trim().toLowerCase()) || 
                    d.model_code.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                    (d.device_id && d.device_id.toLowerCase().includes(searchQuery.trim().toLowerCase())) ||
                    (rooms.find(r => r.id === d.room_id)?.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
                  );

                const onlineCount = filtered.filter(d => Boolean(d.is_online)).length;
                const offlineCount = filtered.filter(d => !d.is_online).length;

                return (
                  <div className="w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-5xl space-y-3 pointer-events-auto mb-2">
                    {/* Transparent Card: Your Space Connectivity */}
                    {renderConnectivityCard(filtered.length, onlineCount, offlineCount)}

                    {filtered.length === 0 ? (
                      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 text-center border border-white/80 shadow-xs space-y-1.5">
                        {searchQuery.trim() ? (
                          <>
                            <Search className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                            <p className="text-sm font-semibold text-slate-800">No devices found</p>
                            <p className="text-xs text-slate-500">No devices matched "{searchQuery}"</p>
                            <button
                              type="button"
                              onClick={() => setSearchQuery('')}
                              className="mt-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[#0284c7] text-white hover:bg-sky-600 transition-colors cursor-pointer"
                            >
                              Clear search
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-slate-700">No devices in {activeRoomTab}</p>
                            <p className="text-xs text-slate-400 mt-1">Assign devices to this room or add a new device</p>
                            <button
                              onClick={() => handleProtectedAction(() => setIsAddDeviceOpen(true))}
                              className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#0284c7] text-white hover:bg-sky-600 transition-colors shadow-xs cursor-pointer"
                            >
                              + Add device
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
                        {filtered.map((dev) => {
                          const devRoom = rooms.find(r => r.id === dev.room_id);
                          const roomLabel = devRoom ? devRoom.name : 'Living room';
                          return renderCompactDeviceCard(dev, roomLabel);
                        })}
                      </div>
                    )}
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
            <div className="w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-5xl space-y-3 pointer-events-auto pt-2">
              {/* Routines Top Header Bar (Transparent Glassmorphism) */}
              <div className="flex items-center justify-between bg-white/35 backdrop-blur-2xl rounded-3xl p-3 sm:p-4 border border-white/60 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-100 shadow-xs">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                      Smart Automations & Scenes
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {routines.length} Routines &bull; {rooms.length || 1} Rooms &bull; {devices.length} Devices ({devices.filter(d => Boolean(d.is_online)).length} Live)
                    </p>
                  </div>
                </div>
              </div>

              {/* Room Filter Pills Bar: "All Devices" + List of Rooms */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setRoutineRoomFilter('all')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    routineRoomFilter === 'all'
                      ? 'bg-[#0284c7] text-white shadow-xs'
                      : 'bg-white/40 text-slate-700 hover:bg-white/60 border border-white/60 backdrop-blur-md'
                  }`}
                >
                  All Devices
                </button>
                {rooms.map(r => {
                  const isSelected = routineRoomFilter === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRoutineRoomFilter(r.id)}
                      className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#0284c7] text-white shadow-xs'
                          : 'bg-white/40 text-slate-700 hover:bg-white/60 border border-white/60 backdrop-blur-md'
                      }`}
                    >
                      <span>{getRoomEmoji(r.name)}</span>
                      <span>{r.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Routines 2x2 Grid (Side-by-side on mobile screens) or Real-Time Space Overview */}
              {(() => {
                const filteredRoutines = routines.filter(r => 
                  routineRoomFilter === 'all' || r.roomId === 'all' || r.roomId === routineRoomFilter
                );

                if (filteredRoutines.length === 0) {
                  const onlineCount = devices.filter(d => Boolean(d.is_online)).length;
                  const offlineCount = devices.filter(d => !d.is_online).length;

                  return (
                    <div className="w-full bg-white/40 backdrop-blur-2xl rounded-3xl p-5 border border-white/70 shadow-sm space-y-4">
                      {/* Top: Space & User Live Identity */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-[#0284c7] text-white flex items-center justify-center font-extrabold text-sm shadow-xs">
                            {(currentUser?.full_name || currentUser?.email || 'N')[0].toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 leading-tight">
                              {currentUser?.full_name || currentUser?.email || 'Smart Workspace User'}
                            </h3>
                            <p className="text-[11px] text-slate-500 font-medium">
                              {activeHome?.name || 'Neurolinx Space'} &bull; {activeHome?.property_type || 'Residential'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-slate-800 block">
                            {timeFormatted}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {dateFormatted}
                          </span>
                        </div>
                      </div>

                      {/* Real-time Device Live Counters */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white/70 rounded-2xl p-2.5 text-center border border-white/80 shadow-2xs">
                          <span className="text-xs font-bold text-slate-800 block">{devices.length}</span>
                          <span className="text-[10px] text-slate-500 font-medium">Total Devices</span>
                        </div>
                        <div className="bg-white/70 rounded-2xl p-2.5 text-center border border-white/80 shadow-2xs">
                          <div className="flex items-center justify-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                            <span className="text-xs font-bold text-emerald-600">{onlineCount}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium">Live Online</span>
                        </div>
                        <div className="bg-white/70 rounded-2xl p-2.5 text-center border border-white/80 shadow-2xs">
                          <span className="text-xs font-bold text-slate-800 block">{offlineCount}</span>
                          <span className="text-[10px] text-slate-500 font-medium">Inactive</span>
                        </div>
                      </div>

                      {/* Subtle Database Status Notice */}
                      <div className="py-2 text-center text-slate-400 space-y-0.5">
                        <p className="text-xs font-semibold text-slate-600">No scenes or schedules saved in database</p>
                        <p className="text-[11px] text-slate-400">Use the + button at the top right to create a Scene or Schedule</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
                    {filteredRoutines.map((routine) => {
                      const isRunning = runningRoutineId === routine.id;
                      const roomObj = rooms.find(r => r.id === routine.roomId);
                      const targetLabel = routine.roomId === 'all' ? 'All Rooms' : (roomObj ? roomObj.name : 'Custom Room');

                      const IconCmp = routine.icon === 'moon' ? Moon
                        : routine.icon === 'sparkles' ? Sparkles
                        : routine.icon === 'zap' ? Zap
                        : routine.icon === 'clock' ? Clock
                        : Sun;

                      const iconBg = routine.icon === 'moon' ? 'bg-indigo-50 border-indigo-100 text-indigo-500'
                        : routine.icon === 'sparkles' ? 'bg-emerald-50 border-emerald-100 text-emerald-500'
                        : routine.icon === 'zap' ? 'bg-amber-50 border-amber-100 text-amber-500'
                        : routine.icon === 'clock' ? 'bg-sky-50 border-sky-100 text-sky-500'
                        : 'bg-amber-50 border-amber-100 text-amber-500';

                      return (
                        <div
                          key={routine.id}
                          className="group relative bg-white/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-xs border border-white/80 hover:border-sky-300 hover:shadow-md transition-all flex flex-col justify-between"
                        >
                          <div>
                            {/* Card Top Row: Icon + Type Badge + Edit Button */}
                            <div className="flex items-center justify-between mb-2">
                              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center border shadow-xs flex-shrink-0 ${iconBg}`}>
                                <IconCmp className="w-5 h-5" />
                              </div>

                              <div className="flex items-center gap-1">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-[#0284c7] border border-sky-100 font-mono">
                                  {routine.type === 'schedule' 
                                    ? `ON ${formatScheduleTimeToIst(routine.scheduleTime)}` 
                                    : 'Scene'}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => handleProtectedAction(() => handleOpenEditRoutine(routine))}
                                  className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 hover:text-[#0284c7] flex items-center justify-center transition-colors cursor-pointer"
                                  title="Edit / Modify Routine"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Title & Description */}
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#0284c7] transition-colors leading-tight line-clamp-1">
                              {routine.name}
                            </h4>

                            <p className="text-[10px] sm:text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                              {routine.type === 'schedule' && routine.scheduleOffTime
                                ? `ON ${formatScheduleTimeToIst(routine.scheduleTime)} • OFF ${formatScheduleTimeToIst(routine.scheduleOffTime)}`
                                : routine.actions && routine.actions.length > 0 
                                  ? `${targetLabel} • ${routine.actions.length} action(s)` 
                                  : (routine.description || `${targetLabel} • Instant`)}
                            </p>
                          </div>

                          {/* Bottom Action: Run Button */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-mono text-slate-400">
                              {routine.type === 'schedule' ? 'Auto Run' : 'One-tap'}
                            </span>

                            <button
                              type="button"
                              disabled={isRunning}
                              onClick={() => handleProtectedAction(() => handleRunRoutine(routine))}
                              className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-xs flex items-center gap-1 active:scale-95 cursor-pointer ${
                                isRunning
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-sky-50 hover:bg-[#0284c7] text-[#0284c7] hover:text-white border border-sky-200/80'
                              }`}
                            >
                              {isRunning ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>Done!</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>Run</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
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

      {/* 14. Create Room Modal (Direct DB persistence via homeApi.createRoom) */}
      {isCreateRoomOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in select-none">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-5 sm:p-6 shadow-2xl border border-white/80 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-sky-50 text-[#0284c7] flex items-center justify-center border border-sky-100">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Create New Room</h3>
                  <p className="text-[11px] text-slate-400">Add a space to {activeHome?.name || 'your home'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateRoomOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Room Name
              </label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="e.g. Master Bedroom, Living Room..."
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-sans text-slate-900 outline-none focus:border-[#0284c7] focus:bg-white transition-all"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateRoom(newRoomName);
                  }
                }}
              />
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-400 block mb-1.5">Quick Suggestions:</span>
              <div className="flex flex-wrap gap-1.5">
                {['Living Room', 'Master Bedroom', 'Kitchen', 'Office', 'Guest Room', 'Balcony', 'Dining Area', 'Kids Room'].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setNewRoomName(suggestion)}
                    className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-sky-50 hover:text-[#0284c7] text-slate-700 border border-slate-200/80 transition-colors cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateRoomOpen(false)}
                className="flex-1 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newRoomName.trim() || isCreatingRoom}
                onClick={() => handleCreateRoom(newRoomName)}
                className="flex-1 py-2.5 rounded-full bg-[#0284c7] hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isCreatingRoom ? 'Saving...' : 'Save Room'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 15. Create / Edit Routine Modal (Scene & Time Schedule Automations) */}
      {isRoutineModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in select-none">
          <div className="bg-white rounded-t-[32px] sm:rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl border border-white/90 max-h-[92vh] flex flex-col justify-between overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-100 shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingRoutine ? 'Edit Routine / Scene' : 'Create Routine / Scene'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Configure scene group or scheduled action</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRoutineModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="overflow-y-auto space-y-4 py-3 pr-1 flex-1">
              {/* Routine Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Routine Name
                </label>
                <input
                  type="text"
                  value={routineDraftName}
                  onChange={(e) => setRoutineDraftName(e.target.value)}
                  placeholder="e.g. Movie Night, All Lights ON, Sleep Mode..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-sans text-slate-900 outline-none focus:border-[#0284c7] focus:bg-white transition-all"
                />
              </div>

              {/* Automation Type Switcher: Scene vs Time Schedule */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Automation Type
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setRoutineDraftType('scene')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      routineDraftType === 'scene'
                        ? 'bg-white text-[#0284c7] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Scene / Group</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoutineDraftType('schedule')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      routineDraftType === 'schedule'
                        ? 'bg-white text-[#0284c7] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Time Schedule</span>
                  </button>
                </div>
              </div>

              {/* Target Room Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Select Room
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setRoutineDraftRoomId('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      routineDraftRoomId === 'all'
                        ? 'bg-[#0284c7] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Rooms
                  </button>
                  {rooms.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRoutineDraftRoomId(r.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        routineDraftRoomId === r.id
                          ? 'bg-[#0284c7] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>{getRoomEmoji(r.name)}</span>
                      <span>{r.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Schedule Options (if schedule selected) */}
              {routineDraftType === 'schedule' && (
                <div className="bg-sky-50/70 rounded-2xl p-3.5 border border-sky-100 space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-sky-100">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Switch State Schedule (IST)</span>
                      <span className="text-[10px] text-slate-500 font-mono">Indian Standard Time (UTC+05:30)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-sky-100 text-[#0284c7] font-bold text-[10px] font-mono">
                      IST Schedule
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Turn ON Time */}
                    <div className="bg-white rounded-xl p-2.5 border border-sky-200/80 shadow-2xs">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Turn ON Time (IST)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          value={routineDraftScheduleTime}
                          onChange={(e) => setRoutineDraftScheduleTime(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-800"
                        />
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold text-[10px] font-mono">
                          ON
                        </span>
                      </div>
                    </div>

                    {/* Turn OFF Time */}
                    <div className="bg-white rounded-xl p-2.5 border border-sky-200/80 shadow-2xs">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Turn OFF Time (IST)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          value={routineDraftScheduleOffTime}
                          onChange={(e) => setRoutineDraftScheduleOffTime(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-800"
                        />
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[10px] font-mono">
                          OFF
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block mb-1">Repeat Days:</span>
                    <div className="flex items-center gap-1">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                        const isDaySelected = routineDraftRepeatDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              if (isDaySelected) {
                                setRoutineDraftRepeatDays(routineDraftRepeatDays.filter(d => d !== day));
                              } else {
                                setRoutineDraftRepeatDays([...routineDraftRepeatDays, day]);
                              }
                            }}
                            className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              isDaySelected
                                ? 'bg-[#0284c7] text-white'
                                : 'bg-white text-slate-600 border border-slate-200'
                            }`}
                          >
                            {day[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Device and Switch Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Select Devices & Switches (ON / OFF)
                </label>
                
                {(() => {
                  const targetDevices = devices.filter(d => 
                    routineDraftRoomId === 'all' || d.room_id === routineDraftRoomId
                  );

                  if (targetDevices.length === 0) {
                    return (
                      <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-2xl text-center">
                        No devices available in selected room.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {targetDevices.map(dev => {
                        const switchCount = dev.model_code === 'GATE' ? 1 : 8;
                        return (
                          <div key={dev.id} className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">{dev.custom_name}</span>
                              <span className="text-[10px] font-mono text-slate-400">{dev.model_code || 'TP8'}</span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              {Array.from({ length: switchCount }, (_, i) => {
                                const ch = i + 1;
                                const swName = `Switch ${ch}`;
                                const existingAction = routineDraftActions.find(
                                  a => a.deviceId === dev.id && a.channel === ch
                                );
                                const currentState = existingAction ? (existingAction.targetState ? 'ON' : 'OFF') : 'SKIP';

                                return (
                                  <div key={ch} className="bg-white rounded-xl p-1.5 border border-slate-200/90 flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-slate-700 truncate pr-1">SW {ch}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (currentState === 'SKIP') {
                                          setRoutineDraftActions(prev => [
                                            ...prev,
                                            { deviceId: dev.id, deviceName: dev.custom_name, channel: ch, switchName: swName, targetState: true }
                                          ]);
                                        } else if (currentState === 'ON') {
                                          setRoutineDraftActions(prev => prev.map(a => 
                                            a.deviceId === dev.id && a.channel === ch ? { ...a, targetState: false } : a
                                          ));
                                        } else {
                                          setRoutineDraftActions(prev => prev.filter(a => !(a.deviceId === dev.id && a.channel === ch)));
                                        }
                                      }}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                                        currentState === 'ON'
                                          ? 'bg-emerald-500 text-white'
                                          : currentState === 'OFF'
                                          ? 'bg-rose-500 text-white'
                                          : 'bg-slate-100 text-slate-400 hover:text-slate-600'
                                      }`}
                                    >
                                      {currentState}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100 flex-shrink-0">
              {editingRoutine && (
                <button
                  type="button"
                  onClick={() => handleDeleteRoutine(editingRoutine.id)}
                  className="p-2.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                  title="Delete Routine"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsRoutineModalOpen(false)}
                className="flex-1 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRoutine}
                className="flex-1 py-2.5 rounded-full bg-[#0284c7] hover:bg-sky-600 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Routine</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 16. Dedicated Full Screen Layout for Hardware Device Control ("New Screen") */}
      {selectedDeviceForControl && (() => {
        const devRoom = rooms.find(r => r.id === selectedDeviceForControl.room_id);
        const roomLabel = devRoom ? devRoom.name : 'Living room';

        return (
          <div 
            className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden flex flex-col select-none pointer-events-auto animate-in fade-in slide-in-from-right-3 duration-200"
            style={{
              backgroundColor: '#d4edf4',
              backgroundImage: `
                radial-gradient(circle at 10% 10%, rgba(255, 255, 255, 0.95) 0%, transparent 50%),
                radial-gradient(circle at 90% 90%, rgba(255, 255, 255, 0.90) 0%, transparent 50%)
              `,
            }}
          >
            {/* Top Navigation Bar: Back Button, Room Name (Left), Online Status (Right) */}
            <header className="dedicated-device-header sticky top-0 z-30 w-full bg-[#d4edf4]/95 backdrop-blur-xl px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between border-b border-sky-200/60 shadow-xs flex-shrink-0 gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {/* Compact Round Back Button */}
                <button
                  type="button"
                  onClick={() => setSelectedDeviceForControl(null)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 hover:bg-white text-slate-800 shadow-xs border border-white/80 flex items-center justify-center cursor-pointer active:scale-95 transition-all flex-shrink-0"
                  aria-label="Back to devices"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-700" strokeWidth={2.4} />
                </button>

                {/* Left Side: Room Name */}
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-base sm:text-lg flex-shrink-0">{getRoomEmoji(roomLabel)}</span>
                  <span className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight truncate">
                    {roomLabel}
                  </span>
                </div>
              </div>

              {/* Right Side: Online Status Badge */}
              <div className="flex items-center flex-shrink-0 pl-1">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 shadow-xs whitespace-nowrap ${
                  selectedDeviceForControl.is_online !== false
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    selectedDeviceForControl.is_online !== false
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-rose-400'
                  }`} />
                  <span>{selectedDeviceForControl.is_online !== false ? 'Online' : 'Offline'}</span>
                  {selectedDeviceForControl.is_online !== false && typeof selectedDeviceForControl.rssi === 'number' && (
                    <span className="text-[10px] text-emerald-600/90 font-mono">({selectedDeviceForControl.rssi} dBm)</span>
                  )}
                </span>
              </div>
            </header>

            {/* Screen Content Body */}
            <main className="w-full max-w-2xl mx-auto px-3.5 sm:px-6 py-3 sm:py-4 flex-1 flex flex-col gap-3 pb-[calc(3.5rem+max(var(--android-nav-bottom,0px),env(safe-area-inset-bottom,0px)))]">
              {/* Device Name and Model Name (Device ID hidden, IP deleted) */}
              <div className="flex items-center gap-2.5 px-1 py-1">
                <div className="w-9 h-9 rounded-xl bg-white/90 shadow-xs border border-white flex items-center justify-center p-1.5 flex-shrink-0">
                  {selectedDeviceForControl.model_code === 'GATE' ? (
                    <div className="w-full h-full rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 21h18" />
                        <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
                        <path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
                      </svg>
                    </div>
                  ) : (
                    <img
                      src={getAssetUrl('8S.png')}
                      alt={selectedDeviceForControl.custom_name}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight truncate">
                    {selectedDeviceForControl.custom_name}
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#0284c7] text-white shadow-2xs font-mono flex-shrink-0">
                    {selectedDeviceForControl.model_code || 'TP8'}
                  </span>
                </div>
              </div>

              {/* Dynamic Switch Controls (Without nested white background card) */}
              <div className="w-full">
                <DynamicDeviceLayout 
                  modelCode={selectedDeviceForControl.model_code || 'TP8'}
                  deviceName={selectedDeviceForControl.custom_name}
                  deviceId={selectedDeviceForControl.device_id || selectedDeviceForControl.id}
                  initialSwitches={selectedDeviceForControl.switches}
                  switchConfigs={selectedDeviceForControl.switch_configs}
                  isOnline={selectedDeviceForControl.is_online !== false}
                />
              </div>
            </main>
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
