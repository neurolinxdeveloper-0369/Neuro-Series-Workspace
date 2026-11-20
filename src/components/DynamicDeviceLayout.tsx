import { ApplianceIcon } from './ApplianceIcon';
import { SwitchCommandState } from '../../server/src/utils/switch-command-state';
import { DeviceEndpointControls } from './DeviceEndpointControls';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Zap, 
  Gauge, 
  Waves, 
  Sliders, 
  Power, 
  Tv, 
  Activity, 
  Lightbulb, 
  Wind, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  RotateCw, 
  X, 
  Search, 
  CheckCircle2, 
  Info,
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
  Wifi
} from 'lucide-react';
import { HARDWARE_ICONS } from '../utils/icons';
import { deviceApi } from '../services/device';
import { realtimeSocket } from '../services/socket';
import { formatIstTime } from '../utils/time';

export interface ResolvedDeviceMeta {
  modelCode: string;
  mac4: string;
  name: string;
  category: string;
  layoutType: 'touch_panel' | 'energy_meter' | 'water_tank' | 'ir_blaster' | 'sensor' | 'motor_agri' | 'heavy_plug' | 'curtain' | 'lighting' | 'hub' | 'console' | 'gate_controller';
  switchCount?: number;
  isThreePhase?: boolean;
  hasSwitch?: boolean;
}

// Model lookup table based on official hardware catalog
export const MODEL_REGISTRY: Record<string, {
  name: string;
  category: string;
  layoutType: ResolvedDeviceMeta['layoutType'];
  switchCount?: number;
  isThreePhase?: boolean;
  hasSwitch?: boolean;
}> = {
  // Gate Controller
  'GATE': { name: 'Smart Gate Controller', category: 'Smart Switches', layoutType: 'gate_controller', switchCount: 1 },

  // Touch Panels & Switches
  'TP4': { name: '4 Gang Touch Panel', category: 'Smart Switches', layoutType: 'touch_panel', switchCount: 4 },
  'TP6': { name: '6 Gang Touch Panel', category: 'Smart Switches', layoutType: 'touch_panel', switchCount: 6 },
  'TP8': { name: '8 Gang Touch Panel', category: 'Smart Switches', layoutType: 'touch_panel', switchCount: 8 },
  'TP12': { name: '12 Gang Touch Panel', category: 'Smart Switches', layoutType: 'touch_panel', switchCount: 12 },
  'SN': { name: 'Socket Node', category: 'Touch switches', layoutType: 'touch_panel', switchCount: 1 },
  'PN': { name: 'Plain Node', category: 'Touch switches', layoutType: 'touch_panel', switchCount: 2 },

  // Energy Meters
  'EM1': { name: 'Single Phase Energy Meter', category: 'Energy Meters', layoutType: 'energy_meter', isThreePhase: false, hasSwitch: false },
  'EMS1': { name: '1 Switch Single Phase Energy Meter', category: 'Energy Meters', layoutType: 'energy_meter', isThreePhase: false, hasSwitch: true },
  'EM3': { name: 'Three Phase Energy Meter', category: 'Energy Meters', layoutType: 'energy_meter', isThreePhase: true, hasSwitch: false },
  'EMS3': { name: 'Three Phase Energy Meter with 1 Switch', category: 'Energy Meters', layoutType: 'energy_meter', isThreePhase: true, hasSwitch: true },

  // Water Tank
  'TNK': { name: 'Smart Tank Control (Basic)', category: 'Smart Water Tank', layoutType: 'water_tank' },
  'TNKP': { name: 'Smart Tank Control Pro', category: 'Smart Water Tank', layoutType: 'water_tank' },

  // IR Blasters
  'IR1': { name: 'Smart IR Blaster', category: 'IR Blasters', layoutType: 'ir_blaster' },
  'IRP': { name: 'IR Blaster Plus', category: 'IR Blasters', layoutType: 'ir_blaster' },

  // Sensors
  'SHUB': { name: 'Sensor Hub (Temperature & Humidity)', category: 'Sensors', layoutType: 'sensor' },
  'MSEN': { name: 'Motion Sensor', category: 'Sensors', layoutType: 'sensor' },

  // Industry & Agriculture
  'MTR': { name: 'Motor Controller', category: 'Industry & Agriculture', layoutType: 'motor_agri' },
  'AQUA': { name: 'Aqua Smart Controller', category: 'Industry & Agriculture', layoutType: 'motor_agri' },

  // Heavy Duty Plugs
  'HP16': { name: 'Smart Heavy Plug (16A)', category: 'Heavy Duty Plugs', layoutType: 'heavy_plug' },
  'HA1': { name: 'Hi Amp 1 Load (30A)', category: 'Heavy Duty Plugs', layoutType: 'heavy_plug' },

  // Curtains
  'CRT': { name: 'Curtain Driver', category: 'Curtains', layoutType: 'curtain' },
  'CRTT': { name: 'Touch Curtain Driver', category: 'Curtains', layoutType: 'curtain' },

  // Lighting
  'LTCL': { name: 'Ceiling Lights', category: 'Lighting', layoutType: 'lighting' },
  'LTRGB': { name: 'RGB Lights', category: 'Lighting', layoutType: 'lighting' },
  'LTC3': { name: 'Tri-color Theme Lights', category: 'Lighting', layoutType: 'lighting' },

  // Hubs / Connectivity
  'HUB': { name: 'Smart Hub Gateway', category: 'Hubs / Connectivity', layoutType: 'hub' },
  'SHA': { name: 'Smart Home Adapter', category: 'Hubs / Connectivity', layoutType: 'hub' },

  // Others
  'CONS': { name: 'Home Console', category: 'Others', layoutType: 'console' },
  'CUST': { name: 'Custom IoT Controller', category: 'Others', layoutType: 'console' },
};

/**
 * SSID Layout Resolver
 * Reads an SSID scanned via camera QR or picked from Wi-Fi list,
 * extracts the model notation, and resolves the layout configuration.
 */
export function resolveDeviceFromSsid(rawInput: string): ResolvedDeviceMeta {
  let clean = (rawInput || '').trim();

  // Handle standard Wi-Fi QR code format: WIFI:S:NEURO-TP8-BC88;T:WPA;P:password;;
  if (clean.toUpperCase().startsWith('WIFI:')) {
    const ssidMatch = clean.match(/S:([^;]+)/i);
    if (ssidMatch) clean = ssidMatch[1].trim();
  }

  // Handle possible QR JSON payload: {"ssid": "NEURO-TP8-BC88"}
  if (clean.startsWith('{') && clean.endsWith('}')) {
    try {
      const parsed = JSON.parse(clean);
      if (parsed.ssid) clean = parsed.ssid;
      else if (parsed.modelCode) clean = `NEURO-${parsed.modelCode}-${parsed.mac4 || 'BC88'}`;
      else if (parsed.device_id) clean = parsed.device_id;
    } catch {
      // ignore
    }
  }

  // Handle URL format: https://neurolinx.in/device?ssid=NEURO-TP8-BC88 or ?device_id=NEURO-TP8-BC88
  if (clean.includes('ssid=')) {
    const match = clean.match(/ssid=([^&]+)/i);
    if (match) clean = decodeURIComponent(match[1]);
  } else if (clean.includes('device_id=')) {
    const match = clean.match(/device_id=([^&]+)/i);
    if (match) clean = decodeURIComponent(match[1]);
  }

  // Pattern 1: NEURO-[MODEL]-[MAC4] or NEURO_[MODEL]_[MAC4] (with or without BLE)
  let modelCode = 'TP8';
  let mac4 = 'BC88';

  const neuroMatch = clean.match(/NEURO[-_](?:BLE[-_])?([A-Za-z0-9]+)[-_]([A-Fa-f0-9]{4})/i);
  if (neuroMatch) {
    modelCode = neuroMatch[1].toUpperCase();
    mac4 = neuroMatch[2].toUpperCase();
  } else {
    // Pattern 2: [MODEL]-[MAC4] or [MODEL]_[MAC4]
    const shortMatch = clean.match(/^([A-Za-z0-9]+)[-_]([A-Fa-f0-9]{4})$/i);
    if (shortMatch) {
      modelCode = shortMatch[1].toUpperCase();
      mac4 = shortMatch[2].toUpperCase();
    } else {
      // Pattern 3: direct model match in text
      for (const code of Object.keys(MODEL_REGISTRY)) {
        if (clean.toUpperCase().includes(code)) {
          modelCode = code;
          break;
        }
      }
    }
  }

  const registered = MODEL_REGISTRY[modelCode];

  return {
    modelCode,
    mac4,
    name: registered.name,
    category: registered.category,
    layoutType: registered.layoutType,
    switchCount: registered.switchCount,
    isThreePhase: registered.isThreePhase,
    hasSwitch: registered.hasSwitch,
  };
}

// -------------------------------------------------------------
// 1. TOUCH PANEL / SMART SWITCHES DYNAMIC UI (e.g. TP8: 8 switches)
// -------------------------------------------------------------
interface TouchPanelProps {
  switchCount: number;
  modelCode: string;
  deviceName?: string;
  deviceId?: string;
  initialSwitches?: Record<string, boolean>;
  switchConfigs?: Array<{ index: number; name: string; iconPath?: string }>;
  isOnline?: boolean;
  lastSeenAt?: string;
}

export interface SwitchItemConfig {
  index: number;
  name: string;
  iconPath: string;
  state: boolean;
}

export const TouchPanelLayout = ({ 
  switchCount, 
  modelCode, 
  deviceName: _deviceName,
  lastSeenAt,
  deviceId, 
  initialSwitches,
  switchConfigs,
  isOnline = true
}: TouchPanelProps) => {
  // Initialize default switch names strictly as "Switch 1", "Switch 2", "Switch 3"...
  const [switches, setSwitches] = useState<SwitchItemConfig[]>(() => {
    // 1. Check switchConfigs prop from server (PostgreSQL)
    if (Array.isArray(switchConfigs) && switchConfigs.length > 0) {
      return Array.from({ length: switchCount }, (_, i) => {
        const found = switchConfigs.find((c: any) => c.index === i);
        return {
          index: i,
          name: found?.name || `Switch ${i + 1}`,
          iconPath: found?.iconPath || '',
          state: initialSwitches?.[String(i + 1)] !== undefined 
            ? Boolean(initialSwitches[String(i + 1)]) 
            : false,
        };
      });
    }

    // 2. Check localStorage (per-device fallback)
    try {
      const storageKey = deviceId ? `neuro_switch_configs_${deviceId}` : `neuro_touch_panel_${modelCode}_${switchCount}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === switchCount) {
          return parsed.map((item: any, i: number) => ({
            ...item,
            state: initialSwitches?.[String(i + 1)] !== undefined 
              ? Boolean(initialSwitches[String(i + 1)]) 
              : item.state,
          }));
        }
      }
    } catch {
      // ignore
    }

    return Array.from({ length: switchCount }, (_, i) => ({
      index: i,
      name: `Switch ${i + 1}`,
      iconPath: '',
      state: initialSwitches?.[String(i + 1)] !== undefined ? Boolean(initialSwitches[String(i + 1)]) : false,
    }));
  });

  // Sync state if switchConfigs prop updates (e.g. loaded after initial render)
  useEffect(() => {
    if (Array.isArray(switchConfigs) && switchConfigs.length > 0) {
      setSwitches(prev => prev.map((sw, i) => {
        const found = switchConfigs.find((c: any) => c.index === i);
        if (found) {
          return {
            ...sw,
            name: found.name || sw.name,
            iconPath: found.iconPath !== undefined ? found.iconPath : sw.iconPath,
          };
        }
        return sw;
      }));
    }
  }, [switchConfigs]);

  const commandState = useRef<SwitchCommandState | null>(null);
  const [switchErrors, setSwitchErrors] = useState<Record<number, string>>({});
  useEffect(() => {
    const initial = Object.fromEntries(switches.map((sw, index) => [String(index + 1), initialSwitches?.[String(index + 1)] ?? sw.state]));
    const controller = new SwitchCommandState(initial, {
      send: async (channel, target) => {
        if (!deviceId) throw new Error('Device unavailable');
        const result = await deviceApi.controlSwitch(deviceId, channel, target ? 'on' : 'off');
        if (!result.success) throw new Error('Command rejected');
      },
      display: (channel, state) => {
        setSwitches(previous => previous.map((sw, index) => index + 1 === channel ? { ...sw, state } : sw));
        setSwitchErrors(previous => {
          if (!(channel in previous)) return previous;
          const next = { ...previous }; delete next[channel]; return next;
        });
      },
      fail: (channel, reason) => setSwitchErrors(previous => ({ ...previous, [channel]: reason })),
    });
    commandState.current = controller;
    return () => { controller.dispose(); if (commandState.current === controller) commandState.current = null; };
  }, [deviceId, switchCount]);

  useEffect(() => {
    const stamp = lastSeenAt ? Date.parse(lastSeenAt) : NaN;
    for (const [channel, state] of Object.entries(initialSwitches ?? {})) {
      if (typeof state === 'boolean') commandState.current?.observe(Number(channel), state, Number.isFinite(stamp) ? stamp : undefined);
    }
  }, [initialSwitches, lastSeenAt]);

  useEffect(() => {
    if (!isOnline) commandState.current?.cancel('Device is offline. Reconnect it before trying again.');
  }, [isOnline]);

  useEffect(() => {
    if (!deviceId) return;
    return realtimeSocket.subscribe((incomingDeviceId, state) => {
      if (incomingDeviceId !== deviceId || !state) return;
      if (Array.isArray(state.switchConfigs)) {
        setSwitches(previous => previous.map((sw, index) => {
          const config = state.switchConfigs.find((item: any) => item.index === index);
          return config ? { ...sw, name: config.name || sw.name, iconPath: config.iconPath ?? sw.iconPath } : sw;
        }));
      }
      const stamp = state.last_seen_at ? Date.parse(state.last_seen_at) : NaN;
      const switches = state.switches || state.payload || (typeof state.state === 'object' ? state.state : null);
      if (switches && typeof switches === 'object') {
        for (const [channel, value] of Object.entries(switches)) {
          if (typeof value === 'boolean') commandState.current?.observe(Number(channel), value, Number.isFinite(stamp) ? stamp : undefined);
        }
      } else if (state.channel !== undefined && typeof state.state === 'boolean') {
        commandState.current?.observe(Number(state.channel), state.state, Number.isFinite(stamp) ? stamp : undefined);
      }
    });
  }, [deviceId]);

  // Long press timer & flag
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  // Customize modal state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftIconPath, setDraftIconPath] = useState('');
  const [iconSearch, setIconSearch] = useState('');
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);
  const [namingStyle, setNamingStyle] = useState<'numbered' | 'prefixed'>('numbered');

  // Save to localStorage whenever switches are modified
  const persistSwitches = (updated: SwitchItemConfig[]) => {
    setSwitches(updated);
    try {
      if (deviceId) {
        localStorage.setItem(`neuro_switch_configs_${deviceId}`, JSON.stringify(updated));
      }
      localStorage.setItem(`neuro_touch_panel_${modelCode}_${switchCount}`, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const requestSwitch = (index: number, target?: boolean) => {
    const channel = index + 1;
    if (!isOnline || !navigator.onLine) {
      setSwitchErrors(previous => ({ ...previous, [channel]: !navigator.onLine ? 'No internet connection. Reconnect and try again.' : 'Device is offline. Reconnect it before trying again.' }));
      return;
    }
    setSwitchErrors(previous => { const next = { ...previous }; delete next[channel]; return next; });
    if (target === undefined) commandState.current?.toggle(channel);
    else commandState.current?.set(channel, target);
  };
  const toggleSwitch = (index: number) => requestSwitch(index);
  const allOff = () => { for (let index = 0; index < switchCount; index++) requestSwitch(index, false); };

  // Long-press start
  const handleTouchStart = (index: number) => {
    if (!isOnline) return;
    isLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(50); } catch {}
      }
      openCustomizeModal(index);
    }, 500);
  };

  // Long-press end
  const handleTouchEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleClick = (index: number) => {
    if (!isOnline) return;
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    toggleSwitch(index);
  };

  // Open customization modal
  const openCustomizeModal = (index: number) => {
    const sw = switches[index];
    if (!sw) return;
    setEditingIndex(index);
    setDraftName(sw.name);
    setDraftIconPath(sw.iconPath || '');
    setIconSearch('');
    setConflictNotice(null);
  };

  // Smart naming conflict resolver
  // If "Light" exists on Switch 1, auto-names next to "Light 2", or "Switch 2 - Light"
  const applyPresetName = (preset: string) => {
    if (editingIndex === null) return;
    
    // Check other switches for same base name
    const otherSwitches = switches.filter((_, idx) => idx !== editingIndex);
    const existingMatches = otherSwitches.filter(s => {
      const lower = s.name.toLowerCase();
      return lower === preset.toLowerCase() || 
             lower.startsWith(`${preset.toLowerCase()} `) || 
             lower.includes(`- ${preset.toLowerCase()}`);
    });

    if (existingMatches.length === 0) {
      if (namingStyle === 'prefixed') {
        setDraftName(`Switch ${editingIndex + 1} - ${preset}`);
      } else {
        setDraftName(`${preset} 1`);
      }
      setConflictNotice(null);
    } else {
      // Conflict detected! Auto-number as Light 2, Light 3...
      const existingNums = existingMatches.map(s => {
        const numMatch = s.name.match(/\d+$/);
        return numMatch ? parseInt(numMatch[0], 10) : 1;
      });
      const nextNum = Math.max(1, ...existingNums) + 1;

      if (namingStyle === 'prefixed') {
        const newName = `Switch ${editingIndex + 1} - ${preset}`;
        setDraftName(newName);
        setConflictNotice(`Multiple "${preset}" nodes: Formatted as "${newName}".`);
      } else {
        const newName = `${preset} ${nextNum}`;
        setDraftName(newName);
        setConflictNotice(`"${preset} 1" is already in use. Auto-numbered as "${newName}" to keep controls distinct.`);
      }
    }
  };

  const handleSaveCustomization = async () => {
    if (editingIndex === null) return;
    const finalName = draftName.trim() || `Switch ${editingIndex + 1}`;
    
    const updated = switches.map((sw, idx) => {
      if (idx === editingIndex) {
        return {
          ...sw,
          name: finalName,
          iconPath: draftIconPath,
        };
      }
      return sw;
    });

    persistSwitches(updated);
    setEditingIndex(null);

    // Sync to PostgreSQL backend & broadcast to all active sessions (e.g. browser)
    if (deviceId) {
      try {
        const configsToSync = updated.map(s => ({
          index: s.index,
          name: s.name,
          iconPath: s.iconPath || '',
        }));
        await deviceApi.updateSwitchConfigs(deviceId, configsToSync);
      } catch (err) {
        console.warn('Failed to sync switch configs to backend:', err);
      }
    }
  };

  // Quick preset labels
  const PRESET_APPLIANCES = [
    'Light',
    'Fan',
    'Socket',
    'Lamp',
    'Chandelier',
    'Wall Lamp',
    'Spotlight',
    'Night Lamp',
    'AC',
    'TV',
    'Heater',
    'Exhaust'
  ];

  // Filtered hardware icons from public/ICONS
  const filteredIcons = HARDWARE_ICONS.filter(f => 
    !iconSearch || f.toLowerCase().includes(iconSearch.toLowerCase())
  );

  // Group switches into lines matching user's layout specification (3 in line 1, 3 in line 2, 2 in line 3 for 8-gang)
  const getSwitchRows = (totalCount: number): number[][] => {
    if (totalCount === 8) {
      return [
        [0, 1, 2], // 3 in line 1
        [3, 4, 5], // 3 in line 2
        [6, 7],    // 2 in line 3 (centered)
      ];
    }
    if (totalCount === 6) {
      return [
        [0, 1, 2],
        [3, 4, 5],
      ];
    }
    if (totalCount === 4) {
      return [
        [0, 1],
        [2, 3],
      ];
    }
    if (totalCount === 12) {
      return [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [9, 10, 11],
      ];
    }
    if (totalCount <= 3) {
      return [Array.from({ length: totalCount }, (_, i) => i)];
    }
    const rows: number[][] = [];
    for (let i = 0; i < totalCount; i += 3) {
      const row: number[] = [];
      for (let j = i; j < Math.min(i + 3, totalCount); j++) {
        row.push(j);
      }
      rows.push(row);
    }
    return rows;
  };

  const switchRows = getSwitchRows(switches.length);
  const renderApplianceIcon = (sw: SwitchItemConfig, idx: number, isOn: boolean) => {
    if (sw.iconPath) {
      return (
        <ApplianceIcon filename={sw.iconPath} className="h-full w-full pointer-events-none" />
      );
    }

    const lower = (sw.name || '').toLowerCase();
    let IconComp = Power;
    if (lower.includes('fan') || lower.includes('exhaust')) IconComp = Wind;
    else if (lower.includes('light') || lower.includes('lamp') || lower.includes('bulb') || lower.includes('spot') || lower.includes('chandelier')) IconComp = Lightbulb;
    else if (lower.includes('plug') || lower.includes('socket')) IconComp = Zap;
    else if (lower.includes('tv')) IconComp = Tv;
    else if (lower.includes('ac')) IconComp = Waves;
    else if (idx === 0) IconComp = Lightbulb;
    else if (idx === 1) IconComp = Wind;
    else if (idx === 2) IconComp = Lightbulb;
    else if (idx === 3) IconComp = Zap;
    else if (idx === 4) IconComp = Lightbulb;
    else if (idx === 5) IconComp = Tv;
    else if (idx === 6) IconComp = Lightbulb;
    else if (idx === 7) IconComp = Power;

    return (
      <IconComp 
        className={`w-9 h-9 sm:w-11 sm:h-11 transition-all duration-300 pointer-events-none text-white ${
          isOn 
            ? 'drop-shadow-[0_0_14px_rgba(56,189,248,1)] opacity-100 scale-105' 
            : 'opacity-90 group-hover:opacity-100'
        }`}
        strokeWidth={2.4}
      />
    );
  };

  // Dedicated Full-Screen Switch Customization View (Pushed to New Screen on Long Press)
  if (editingIndex !== null && typeof document !== 'undefined') {
    return createPortal(
      <div 
        className="app-screen fixed inset-0 z-[100] flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-3 duration-200"
      >
        {/* Dedicated Screen Top Header */}
        <header className="screen-top-header w-full bg-white/90 border-b border-white/80 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-xs z-10">
          <button
            type="button"
            data-device-dismiss
            onClick={() => setEditingIndex(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold border border-slate-200/90 shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#0284c7]" strokeWidth={2.4} />
            <span>Back</span>
          </button>

          <div className="text-center px-2">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
              Edit Switch {editingIndex + 1}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-[#0284c7] font-mono font-bold">
              {modelCode} &bull; Channel {editingIndex + 1}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveCustomization}
            className="px-4 py-1.5 rounded-full bg-[#0284c7] hover:bg-sky-600 text-white text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save</span>
          </button>
        </header>

        {/* Dedicated Screen Scrollable Body */}
        <main className="min-h-0 flex-1 overflow-y-auto px-3.5 sm:px-6 py-4 space-y-3.5 max-w-2xl mx-auto w-full pb-[calc(2.5rem+max(var(--android-nav-bottom,0px),env(safe-area-inset-bottom,0px)))]">
          
          {/* Live Switch Preview Card */}
          <div className="bg-white/75 backdrop-blur-xl rounded-3xl p-4 border border-white/90 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="relative rounded-full aspect-square w-16 h-16 bg-[#298fb6] border-2 border-white ring-4 ring-[#0284c7] flex items-center justify-center shadow-[0_0_18px_rgba(2,132,199,0.35)]">
                {draftIconPath ? (
                  <ApplianceIcon filename={draftIconPath} alt="Preview" className="w-[88%] h-[88%]" />
                ) : (
                  <Power className="w-9 h-9 text-white drop-shadow-[0_0_10px_rgba(56,189,248,1)]" />
                )}
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Preview</span>
                <span className="text-base font-extrabold text-slate-900 font-sans">
                  {draftName.trim() || `Switch ${editingIndex + 1}`}
                </span>
              </div>
            </div>
            <span className="text-xs text-[#0284c7] font-bold bg-sky-50 px-3 py-1 rounded-full border border-sky-200/80 font-mono shadow-2xs">
              Active ON
            </span>
          </div>

          {/* Switch Name Input Field */}
          <div className="bg-white/75 backdrop-blur-xl rounded-3xl p-4 border border-white/90 shadow-xs space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              Switch Name
            </label>
            <div className="flex items-center gap-2 bg-slate-50 rounded-2xl border border-slate-200/90 px-3.5 py-2.5 focus-within:border-[#0284c7] focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-100 transition-all">
              <input
                type="text"
                value={draftName}
                onChange={(e) => {
                  setDraftName(e.target.value);
                  setConflictNotice(null);
                }}
                placeholder={`e.g. Switch ${editingIndex + 1}`}
                className="w-full bg-transparent text-sm text-slate-900 font-sans outline-none placeholder:text-slate-400"
                autoFocus
              />
              {draftName && (
                <button
                  type="button"
                  onClick={() => setDraftName('')}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {conflictNotice && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-2.5 flex items-start gap-2 text-xs text-amber-800 mt-2">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>{conflictNotice}</span>
              </div>
            )}
          </div>

          {/* Quick Preset Labels */}
          <div className="bg-white/75 backdrop-blur-xl rounded-3xl p-4 border border-white/90 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Quick Preset Names:
              </span>
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setNamingStyle('numbered')}
                  className={`px-2.5 py-1 rounded-full cursor-pointer font-bold transition-all ${
                    namingStyle === 'numbered' 
                      ? 'bg-[#0284c7] text-white shadow-2xs' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Light 1, 2
                </button>
                <button
                  type="button"
                  onClick={() => setNamingStyle('prefixed')}
                  className={`px-2.5 py-1 rounded-full cursor-pointer font-bold transition-all ${
                    namingStyle === 'prefixed' 
                      ? 'bg-[#0284c7] text-white shadow-2xs' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  SW 1 - Light
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESET_APPLIANCES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPresetName(preset)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100/90 hover:bg-sky-50 text-slate-700 hover:text-[#0284c7] text-xs font-semibold border border-slate-200/80 transition-colors cursor-pointer active:scale-95"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Appliance Icon Picker */}
          <div className="bg-white/75 backdrop-blur-xl rounded-3xl p-4 border border-white/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Select Icon ({HARDWARE_ICONS.length} Appliance Icons)
              </label>
              {draftIconPath && (
                <button
                  type="button"
                  onClick={() => setDraftIconPath('')}
                  className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                >
                  Reset to Default
                </button>
              )}
            </div>

            {/* Icon Search */}
            <div className="flex items-center gap-2 bg-slate-50 rounded-2xl border border-slate-200/90 px-3.5 py-2 focus-within:border-[#0284c7] focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-100 transition-all">
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                placeholder="Search appliance icons..."
                className="w-full bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400"
              />
              {iconSearch && (
                <button type="button" onClick={() => setIconSearch('')} className="p-0.5 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Grid of transparent PNG icons */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 max-h-80 overflow-y-auto p-3 bg-sky-50 rounded-2xl border border-slate-200/80">
              {/* Default Power Icon */}
              <button
                type="button"
                onClick={() => setDraftIconPath('')}
                className={`aspect-square rounded-2xl p-1.5 flex flex-col items-center justify-center transition-all cursor-pointer border ${
                  !draftIconPath
                    ? 'bg-[#0284c7] border-white ring-2 ring-[#0284c7] shadow-[0_0_14px_rgba(2,132,199,0.45)] scale-105'
                    : 'bg-[#0284c7] border-sky-200 hover:bg-[#0377ad]'
                }`}
                title="Default Power Icon"
              >
                <Power className="w-7 h-7 text-white" />
              </button>

              {filteredIcons.map((iconName) => {
                const isSelected = draftIconPath === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setDraftIconPath(iconName)}
                    className={`aspect-square rounded-2xl p-1.5 flex items-center justify-center transition-all cursor-pointer relative group border ${
                      isSelected
                        ? 'bg-[#0284c7] border-white ring-2 ring-[#0284c7] shadow-[0_0_14px_rgba(2,132,199,0.45)] scale-105'
                        : 'bg-[#0284c7] border-sky-200 hover:bg-[#0377ad] hover:border-[#0284c7]'
                    }`}
                    title={iconName} aria-label={iconName} aria-pressed={isSelected}
                  >
                    <ApplianceIcon filename={iconName} alt={iconName} lazy className="w-full h-full" />
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center shadow-xs">
                        <Check className="w-2.5 h-2.5 text-[#0284c7]" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          </main>
        <footer className="flex shrink-0 items-center gap-3 border-t border-sky-100 bg-[var(--app-background)] px-4 pt-3" style={{ paddingBottom: 'calc(0.75rem + var(--nav-inset-bottom))' }}>
            <button
              type="button"
              onClick={() => setEditingIndex(null)}
              className="flex-1 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200/80 shadow-2xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCustomization}
              className="flex-1 py-3 rounded-2xl bg-[#0284c7] hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/25 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Switch</span>
            </button>
        </footer>
      </div>,
      document.body
    );
  }

  return (
    <div className="w-full select-none">
      {/* Top Header: Heading Name with Capacitive Touch Panel & Batch Actions */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-sky-200/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#0284c7] font-mono bg-white/70 px-2 py-0.5 rounded-md border border-sky-200/60 shadow-2xs">
            {modelCode}
          </span>
          <span className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wider font-sans">
            Capacitive Touch Panel
          </span>
        </div>

        {/* Quick Batch Action: All OFF with transparent bg (All ON removed) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!isOnline}
            onClick={allOff}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
              isOnline
                ? 'bg-transparent hover:bg-white/40 text-slate-700 border-slate-300/80 active:scale-95 cursor-pointer backdrop-blur-xs'
                : 'bg-transparent text-slate-400 border-slate-200/50 cursor-not-allowed opacity-60'
            }`}
          >
            All OFF
          </button>
        </div>
      </div>

      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
          <span>Device is offline. All switches are disabled until device reconnects.</span>
        </div>
      )}

      {/* Circular Switches Rows (3 in line 1, 3 in line 2, 2 in line 3 for 8-gang) */}
      <div className="flex flex-col items-center gap-6 sm:gap-7 py-3 my-3">
        {switchRows.map((rowIndices, rowIdx) => (
          <div key={rowIdx} className="flex items-center justify-center gap-5 sm:gap-7 w-full">
            {rowIndices.map((idx) => {
              const sw = switches[idx];
              if (!sw) return null;
              const isOn = sw.state;

              return (
                <div key={idx} className="flex flex-col items-center gap-1.5 flex-1 max-w-[88px] sm:max-w-[100px]">
                  <div
                    onTouchStart={() => handleTouchStart(idx)}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                    onMouseDown={() => handleTouchStart(idx)}
                    onMouseUp={handleTouchEnd}
                    onMouseLeave={handleTouchEnd}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (isOnline) openCustomizeModal(idx);
                    }}
                    onClick={() => handleClick(idx)}
                    className={`group relative rounded-full aspect-square w-[80px] h-[80px] sm:w-24 sm:h-24 flex items-center justify-center select-none transition-all duration-300 ease-out ${
                      !isOnline
                        ? 'cursor-not-allowed pointer-events-none bg-[#7babc0] border-2 border-slate-300'
                        : isOn
                          ? 'cursor-pointer active:scale-95 bg-[#168db7] border-2 border-white ring-4 ring-sky-400 shadow-md shadow-sky-200'
                          : 'cursor-pointer active:scale-95 bg-gradient-to-br from-[#baddec] to-[#8bbbd0] hover:to-[#7eafc4] border-2 border-[#c9e4f0] shadow-sm'
                    }`}
                    title={!isOnline ? 'Device is offline - switch disabled' : `${sw.name || `Switch ${idx + 1}`} • Tap to toggle, Long-press to edit`}
                  >
                    {/* Luminous Inner Glow Aura when ON */}
                    {isOn && isOnline && (
                      <div className="absolute inset-1 rounded-full bg-radial from-sky-400/25 via-transparent to-transparent pointer-events-none animate-pulse" />
                    )}

                    {/* Original appliance image, contained within the circle */}
                    <div className="relative z-10 w-[88%] h-[88%] flex items-center justify-center">
                      {renderApplianceIcon(sw, idx, isOn && isOnline)}
                    </div>
                  </div>

                  {/* Switch name below the circular button */}
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-800 text-center truncate max-w-[85px] px-0.5 select-none leading-tight">
                    {sw.name || `Switch ${idx + 1}`}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {Object.entries(switchErrors).map(([channel, message]) => <p key={channel} role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">Switch {channel}: {message}</p>)}
      {/* Footer Status Hint */}
      <div className="mt-6 mb-4 rounded-2xl border border-sky-100/70 bg-white/45 px-3 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-slate-500 font-sans">
        <span className="flex items-center gap-1.5 text-slate-600">
          <Info className="w-3.5 h-3.5 text-[#0284c7]" />
          <span>Tap circle to toggle &bull; Long-press to customize</span>
        </span>
        <span className="whitespace-nowrap font-mono font-bold text-[#0284c7]">
          {switches.filter(s => s.state).length} / {switchCount} ON
        </span>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 2. ENERGY METER DYNAMIC UI (Single Phase & Three Phase)
// -------------------------------------------------------------
interface EnergyMeterProps {
  isThreePhase?: boolean;
  hasSwitch?: boolean;
  modelCode: string;
  deviceName?: string;
  deviceId?: string;
  isOnline?: boolean;
  device?: any;
  initialSwitches?: Record<string, boolean>;
}

export const EnergyMeterLayout = ({ 
  isThreePhase = false, 
  hasSwitch = false, 
  modelCode,
  deviceName,
  deviceId,
  isOnline = true,
  device,
  initialSwitches
}: EnergyMeterProps) => {
  // Missing telemetry remains unknown until the meter reports it.
  const [voltage, setVoltage] = useState<number>(Number(device?.voltage ?? Number.NaN));
  const [current, setCurrent] = useState<number>(Number(device?.current ?? Number.NaN));
  const [power, setPower] = useState<number>(Number(device?.power ?? Number.NaN));
  const [apparentPower, setApparentPower] = useState<number>(Number(device?.apparent_power ?? Number.NaN));
  const [reactivePower, setReactivePower] = useState<number>(Number(device?.reactive_power ?? Number.NaN));
  const [powerFactor, setPowerFactor] = useState<number>(Number(device?.power_factor ?? Number.NaN));
  const [frequency, setFrequency] = useState<number>(Number(device?.frequency ?? Number.NaN));
  const [energyKwh, setEnergyKwh] = useState<number>(Number(device?.energy_kwh ?? Number.NaN));
  const [energyWh, setEnergyWh] = useState<number>(Number(device?.energy_wh ?? Number.NaN));
  const [relayOn, setRelayOn] = useState<boolean>(Boolean(device?.relay ?? device?.switches?.['1'] ?? initialSwitches?.['1'] ?? false));
  const [rssi, setRssi] = useState<number>(Number(device?.rssi ?? Number.NaN));
  const [tripReason, setTripReason] = useState<string>(String(device?.trip_reason ?? ''));
  const [alerts, setAlerts] = useState<{
    message?: string;
    over_current?: boolean;
    under_voltage?: boolean;
    over_voltage?: boolean;
    low_pf?: boolean;
    freq_error?: boolean;
    reverse_power?: boolean;
  }>(device?.alerts ?? {});

  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isControllingRelay, setIsControllingRelay] = useState(false);

  // Sync state when device prop updates
  useEffect(() => {
    if (!device) return;
    if (device.voltage !== undefined) setVoltage(Number(device.voltage ?? Number.NaN));
    if (device.current !== undefined) setCurrent(Number(device.current ?? Number.NaN));
    if (device.power !== undefined) setPower(Number(device.power ?? Number.NaN));
    if (device.apparent_power !== undefined) setApparentPower(Number(device.apparent_power ?? Number.NaN));
    if (device.reactive_power !== undefined) setReactivePower(Number(device.reactive_power ?? Number.NaN));
    if (device.power_factor !== undefined) setPowerFactor(Number(device.power_factor ?? Number.NaN));
    if (device.frequency !== undefined) setFrequency(Number(device.frequency ?? Number.NaN));
    if (device.energy_kwh !== undefined) setEnergyKwh(Number(device.energy_kwh ?? Number.NaN));
    if (device.energy_wh !== undefined) setEnergyWh(Number(device.energy_wh ?? Number.NaN));
    if (device.relay !== undefined) setRelayOn(Boolean(device.relay));
    else if (device.switches?.['1'] !== undefined) setRelayOn(Boolean(device.switches['1']));
    if (device.rssi !== undefined) setRssi(Number(device.rssi ?? Number.NaN));
    if (device.trip_reason !== undefined) setTripReason(String(device.trip_reason));
    if (device.alerts) setAlerts(device.alerts);
  }, [device]);

  const reading = (value: number, digits: number) => Number.isFinite(value) ? value.toFixed(digits) : '?';

  // Relay toggle handler (Capacitive single-switch provisional control)
  const handleToggleRelay = async () => {
    if (!isOnline || !deviceId || isControllingRelay) return;
    const next = !relayOn;
    setIsControllingRelay(true);
    setRelayOn(next); // optimistic update

    try {
      await deviceApi.controlSwitch(deviceId, 1, next ? 'on' : 'off');
    } catch (err) {
      console.error('Failed to toggle relay switch:', err);
      setRelayOn(!next); // revert
      setToastMessage('Failed to switch relay state. Please check connection.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsControllingRelay(false);
    }
  };

  // Dedicated Hardware Reset Command via MQTT topic devices/${deviceId}/reset_energy
  const handleConfirmReset = async () => {
    if (!isOnline || !deviceId || isResetting) return;
    setIsResetting(true);
    try {
      await deviceApi.resetEnergy(deviceId);
      setShowResetModal(false);
      setToastMessage('Reset requested. Waiting for the next meter reading.');
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error('Failed to reset energy:', err);
      setToastMessage('Failed to send reset command to hardware.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsResetting(false);
    }
  };

  const hasRelayReading = device?.relay != null || initialSwitches?.['1'] != null;
  const hasAnyAlert = Boolean(
    tripReason ||
    alerts.over_current ||
    alerts.over_voltage ||
    alerts.under_voltage ||
    alerts.low_pf ||
    alerts.freq_error ||
    alerts.reverse_power ||
    alerts.message
  );

  return (
    <div className="relative bg-white text-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm select-none space-y-4">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute top-3 left-4 right-4 z-40 bg-sky-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm border border-sky-400/40 flex items-center justify-between backdrop-blur-md animate-fade-in">
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="ml-2 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="flex flex-wrap items-start justify-between gap-2 pb-3.5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-700 flex items-center justify-center border border-amber-500/30 shadow-inner">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 font-mono">
                {modelCode}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 font-mono text-slate-600">
                {isThreePhase ? '3-Phase Smart Meter' : '1-Phase Single Switch Meter'}
              </span>
            </div>
            <div className="text-base font-extrabold text-slate-900 mt-0.5">
              {deviceName || (isThreePhase ? 'Three Phase Energy Meter' : 'Single Phase Energy Meter')}
            </div>
          </div>
        </div>

        {/* Status Indicators: Online & RSSI */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-mono">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className={isOnline ? 'text-emerald-700' : 'text-rose-700'}>{isOnline ? 'LIVE' : 'OFFLINE'}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600">
            <Wifi className="w-3 h-3 text-sky-700" />
            <span>{reading(rssi, 0)} dBm</span>
          </div>
        </div>
      </div>

      {/* Trip Reason / Alert Warning Banner */}
      {hasAnyAlert && (
        <div className="bg-amber-50 border border-amber-500/40 rounded-2xl p-3 flex items-start gap-2.5 text-amber-700">
          <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <div className="font-bold text-amber-700">
              {tripReason ? `Trip Warning: ${tripReason}` : 'Safety Alert Triggered'}
            </div>
            <div className="text-amber-700 text-[11px]">
              {alerts.message || 'Hardware safety threshold detected. Review electrical parameters below.'}
            </div>
          </div>
        </div>
      )}

      {/* Hero Card: Total Accumulated Energy (kWh / Wh) + Dedicated Reset Action */}
      <div className="bg-sky-50 rounded-2xl p-4 sm:p-5 border border-sky-500/30 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-sky-700">
              <Sparkles className="w-3.5 h-3.5 text-sky-700" />
              <span>Total Accumulated Consumption</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900">
                {reading(energyKwh, 4)}
              </span>
              <span className="text-sm sm:text-base font-bold text-sky-700 font-mono">kWh (Units)</span>
            </div>
            <div className="text-xs text-slate-600 font-mono mt-0.5">
              Reported: <strong className="text-slate-600">{reading(energyWh, 2)} Wh</strong>
            </div>
          </div>

          {/* Dedicated Reset Option Command Button */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              disabled={!isOnline || isResetting}
              className="inline-flex items-center gap-2 min-h-11 px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 border border-sky-500/30 hover:border-sky-500/50 shadow-sm transition-all cursor-pointer group disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-sky-700 group-hover:rotate-[-45deg] transition-transform ${isResetting ? 'animate-spin' : ''}`} />
              <span>Reset energy</span>
            </button>

          </div>
        </div>
      </div>

      {/* Relay Switch Provisional Control Card (When hasSwitch is true, e.g. EMS1) */}
      {hasSwitch && (
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                relayOn
                  ? 'bg-emerald-500/20 text-emerald-700 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}>
                <Power className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-900">Relay Switch Output (Switch 1)</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                    relayOn
                      ? 'bg-emerald-500/20 text-emerald-700 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-700 border border-rose-500/40'
                  }`}>
                    {!hasRelayReading ? 'Unknown' : relayOn ? 'ACTIVE LOAD' : 'CUT OFF'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Provisional capacitive load control with hardware protection
                </div>
              </div>
            </div>

            {/* Capacitive Switch Toggle Button */}
            <button
              type="button"
              onClick={handleToggleRelay}
              disabled={!isOnline || !hasRelayReading || isControllingRelay}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50 ${
                relayOn
                  ? 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                  : 'bg-slate-50 hover:bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{relayOn ? 'Turn Off' : 'Turn On'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 6 Core Required Electrical Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* 1. Active Power (W) */}
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-slate-600 flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-700" /> Active Power
          </span>
          <div className="mt-1">
            <div className="text-xl font-black font-mono text-emerald-700 tracking-tight">
              {reading(power, 2)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-emerald-700 font-bold">
              <span>Watts (W)</span>
              <span className="text-[10px] font-mono text-slate-600">{reading(power / 1000, 3)} kW</span>
            </div>
          </div>
        </div>

        {/* 2. RMS Voltage (V) */}
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-slate-600 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-sky-700" /> Voltage
          </span>
          <div className="mt-1">
            <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
              {reading(voltage, 2)}
            </div>
            <span className="text-[11px] text-sky-700 font-bold">Volts (AC)</span>
          </div>
        </div>

        {/* 3. RMS Current (A) */}
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-slate-600 flex items-center gap-1">
            <Activity className="w-3 h-3 text-amber-700" /> Current
          </span>
          <div className="mt-1">
            <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
              {reading(current, 4)}
            </div>
            <span className="text-[11px] text-amber-700 font-bold">Amperes (A)</span>
          </div>
        </div>

        {/* 4. Power Factor (PF) */}
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-slate-600 flex items-center gap-1">
            <Sliders className="w-3 h-3 text-purple-700" /> Power Factor
          </span>
          <div className="mt-1">
            <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
              {reading(powerFactor, 3)}
            </div>
            <span className="text-[11px] text-purple-700 font-bold">
              {!Number.isFinite(powerFactor) ? 'No reading yet' : powerFactor >= 0.9 ? 'High Efficiency' : 'Low PF'}
            </span>
          </div>
        </div>

        {/* 5. Apparent Power (VA) */}
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-slate-600 flex items-center gap-1">
            <Activity className="w-3 h-3 text-indigo-700" /> Apparent Power
          </span>
          <div className="mt-1">
            <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
              {reading(apparentPower, 2)}
            </div>
            <span className="text-[11px] text-indigo-700 font-bold">Volt-Amps (VA)</span>
          </div>
        </div>

        {/* 6. Reactive Power (VAR) */}
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-slate-600 flex items-center gap-1">
            <Waves className="w-3 h-3 text-rose-700" /> Reactive Power
          </span>
          <div className="mt-1">
            <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
              {reading(reactivePower, 2)}
            </div>
            <span className="text-[11px] text-rose-700 font-bold">VAr</span>
          </div>
        </div>
      </div>

      {isThreePhase && (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          Individual phase readings are unavailable.
        </p>
      )}

      {/* Protection & Hardware Safety Matrix */}
      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            Hardware Protection & Safety Matrix
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Real-time Tripping Guard</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px] font-mono">
          <div className={`p-2 rounded-xl border flex items-center justify-between ${
            alerts.over_current ? 'bg-rose-50 border-rose-500/50 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <span>Over Current</span>
            <span className={`font-bold ${alerts.over_current ? 'text-rose-700 animate-pulse' : 'text-emerald-700'}`}>
              {alerts.over_current === undefined ? '?' : alerts.over_current ? 'TRIP' : 'OK'}
            </span>
          </div>

          <div className={`p-2 rounded-xl border flex items-center justify-between ${
            alerts.over_voltage ? 'bg-amber-50 border-amber-500/50 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <span>Over Voltage</span>
            <span className={`font-bold ${alerts.over_voltage ? 'text-amber-700 animate-pulse' : 'text-emerald-700'}`}>
              {alerts.over_voltage === undefined ? '?' : alerts.over_voltage ? 'HIGH' : 'OK'}
            </span>
          </div>

          <div className={`p-2 rounded-xl border flex items-center justify-between ${
            alerts.under_voltage ? 'bg-amber-50 border-amber-500/50 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <span>Under Voltage</span>
            <span className={`font-bold ${alerts.under_voltage ? 'text-amber-700 animate-pulse' : 'text-emerald-700'}`}>
              {alerts.under_voltage === undefined ? '?' : alerts.under_voltage ? 'LOW' : 'OK'}
            </span>
          </div>

          <div className={`p-2 rounded-xl border flex items-center justify-between ${
            alerts.low_pf ? 'bg-purple-50 border-purple-500/50 text-purple-700' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <span>Low PF</span>
            <span className={`font-bold ${alerts.low_pf ? 'text-purple-700' : 'text-emerald-700'}`}>
              {alerts.low_pf === undefined ? '?' : alerts.low_pf ? 'WARN' : 'OK'}
            </span>
          </div>

          <div className={`p-2 rounded-xl border flex items-center justify-between ${
            alerts.freq_error ? 'bg-rose-50 border-rose-500/50 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <span>Freq Error</span>
            <span className={`font-bold ${alerts.freq_error ? 'text-rose-700' : 'text-emerald-700'}`}>
              {alerts.freq_error === undefined ? '?' : alerts.freq_error ? 'ERROR' : 'OK'}
            </span>
          </div>

          <div className={`p-2 rounded-xl border flex items-center justify-between ${
            alerts.reverse_power ? 'bg-rose-50 border-rose-500/50 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <span>Reverse Pwr</span>
            <span className={`font-bold ${alerts.reverse_power ? 'text-rose-700' : 'text-emerald-700'}`}>
              {alerts.reverse_power === undefined ? '?' : alerts.reverse_power ? 'REV' : 'OK'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid Frequency & Health Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 pt-1 font-mono gap-1 border-t border-slate-200">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Grid Frequency: <strong className="text-slate-900">{reading(frequency, 2)} Hz</strong> (Nominal 50.00 Hz)
        </span>
        <span className="text-[11px] text-slate-500">
          IEC 62053-21 Class 1.0 Metering Accuracy
        </span>
      </div>

      {/* Confirmation Dialog Modal for Hardware Energy Reset */}
      {showResetModal && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-300/55 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-700 flex items-center justify-center border border-sky-500/30 mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-extrabold text-slate-900">Reset Energy to 0?</h3>
              <p className="text-xs text-slate-600">
                This will dispatch a reset command to the hardware meter via MQTT topic:
              </p>
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-sky-700 mt-2 break-all">
                devices/{deviceId || 'EMS1'}/reset_energy
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Both the hardware non-volatile registers and database counters will restart from <strong>0.0000 kWh</strong>.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                data-device-dismiss onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="flex-1 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <span>Confirm Reset</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// -------------------------------------------------------------
// 3. SMART WATER TANK DYNAMIC UI (Graphic + Percentage Level)
// -------------------------------------------------------------
interface GateControllerProps {
  modelCode: string;
  deviceName?: string;
  deviceId?: string;
  initialSwitches?: Record<string, boolean>;
  isOnline?: boolean;
}

export const GateControllerLayout = ({
  modelCode,
  deviceName = 'Gate Controller',
  deviceId,
  initialSwitches,
  isOnline = true
}: GateControllerProps) => {
  const [isOn, setIsOn] = useState<boolean>(() => Boolean(initialSwitches?.['1']));
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [triggerMode, setTriggerMode] = useState<'pulse' | 'toggle'>('pulse');
  const [triggerCount, setTriggerCount] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(`neuro_gate_triggers_${deviceId || modelCode}`);
      return stored ? parseInt(stored, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [lastActionTime, setLastActionTime] = useState<string | null>(null);
  const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state if initialSwitches from server changes
  useEffect(() => {
    if (initialSwitches && initialSwitches['1'] !== undefined) {
      setIsOn(Boolean(initialSwitches['1']));
    }
  }, [initialSwitches]);

  // Clean up pulse timer on unmount
  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
      }
    };
  }, []);

  // Real-time synchronization when physical hardware publishes telemetry over MQTT/WebSocket
  useEffect(() => {
    if (!deviceId) return;
    const unsubscribe = realtimeSocket.subscribe((incomingDeviceId, incomingState) => {
      if (incomingDeviceId === deviceId && incomingState) {
        const switchMap = incomingState.switches || incomingState.payload || (typeof incomingState.state === 'object' ? incomingState.state : null);
        if (switchMap && switchMap['1'] !== undefined) {
          setIsOn(Boolean(switchMap['1']));
        } else if (incomingState.channel === 1 && incomingState.state !== undefined) {
          setIsOn(Boolean(incomingState.state));
        }
      }
    });
    return unsubscribe;
  }, [deviceId]);

  const recordTrigger = () => {
    const nextCount = triggerCount + 1;
    setTriggerCount(nextCount);
    const nowStr = formatIstTime(new Date(), true);
    setLastActionTime(nowStr);
    try {
      localStorage.setItem(`neuro_gate_triggers_${deviceId || modelCode}`, String(nextCount));
    } catch {}
  };

  const handleTrigger = async () => {
    if (!isOnline) {
      console.warn('Gate trigger ignored: device is offline.');
      return;
    }
    if (isTriggering) return; // Prevent double trigger while pulse active

    recordTrigger();

    if (triggerMode === 'pulse') {
      // 1. Send ON command to start motor
      setIsTriggering(true);
      setIsOn(true);

      if (deviceId) {
        try {
          await deviceApi.controlSwitch(deviceId, 1, 'on');
        } catch (err) {
          console.error('Failed to trigger gate ON:', err);
          setIsTriggering(false);
          setIsOn(false);
          return;
        }
      }

      // 2. Pulse: Automatically send OFF after 1.5 seconds to complete the trigger cycle
      pulseTimeoutRef.current = setTimeout(async () => {
        if (deviceId) {
          try {
            await deviceApi.controlSwitch(deviceId, 1, 'off');
          } catch (err) {
            console.error('Failed to reset gate trigger to OFF:', err);
          }
        }
        setIsOn(false);
        setIsTriggering(false);
      }, 1500);
    } else {
      // Manual Toggle Mode (Hold ON or Hold OFF)
      const targetState = !isOn;
      setIsOn(targetState);
      if (deviceId) {
        try {
          await deviceApi.controlSwitch(deviceId, 1, targetState ? 'on' : 'off');
        } catch (err) {
          console.error('Failed to toggle gate switch:', err);
          setIsOn(!targetState); // Revert on failure
        }
      }
    }
  };

  const isActive = isTriggering || isOn;

  return (
    <div className="w-full flex flex-col items-center gap-3.5 select-none font-sans">
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="w-full bg-rose-50/95 border border-rose-200 rounded-2xl p-3 flex items-center gap-2.5 text-rose-700 text-xs font-semibold shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
          <span>Gate Controller is Offline. Motor trigger commands are disabled until the device reconnects.</span>
        </div>
      )}

      {/* 1. Gate Visualizer & Live Status Display Card */}
      <div className="w-full rounded-2xl sm:rounded-3xl bg-white text-slate-900 p-4 sm:p-5 border border-slate-200 shadow-sm overflow-hidden relative">
        {/* Glow ambient background */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-500"
          style={{
            background: isActive
              ? 'radial-gradient(circle at 50% 30%, rgba(16, 185, 129, 0.22) 0%, transparent 70%)'
              : 'radial-gradient(circle at 50% 30%, rgba(56, 189, 248, 0.08) 0%, transparent 70%)'
          }}
        />

        {/* Top Status Row inside Visualizer */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 relative z-10">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${
              isActive
                ? 'bg-emerald-500/20 text-emerald-700 border-emerald-500/40'
                : 'bg-sky-500/10 text-sky-700 border-sky-500/20'
            }`}>
              <RotateCw className={`w-4 h-4 ${isActive ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-600 tracking-wide uppercase font-mono truncate max-w-[150px] sm:max-w-xs block">
                {deviceName || 'Motorized Barrier'}
              </span>
              <p className="text-[10px] text-slate-600 font-mono">
                Relay 1 • GPIO 13
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 backdrop-blur-md transition-all ${
            isActive
              ? 'bg-emerald-500/25 text-emerald-700 border-emerald-400/50 shadow-xs animate-pulse'
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-400'}`} />
            {isTriggering ? 'MOTOR TRIGGERED' : (isOn ? 'ENERGIZED' : 'STANDBY')}
          </span>
        </div>

        {/* Gate Graphic Visualizer */}
        <div className="relative py-3.5 flex flex-col items-center justify-center z-10">
          <div className="w-full max-w-sm h-22 relative flex items-center justify-between px-2">
            {/* Left Gate Pillar */}
            <div className="w-5 sm:w-6 h-full rounded-md bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 border border-slate-200 shadow-sm flex flex-col justify-between p-1 z-20">
              <span className="w-full h-1 bg-sky-400/60 rounded-full" />
              <div className={`w-1.5 h-1.5 rounded-full mx-auto ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="w-full h-1 bg-sky-400/60 rounded-full" />
            </div>

            {/* Sliding Gate Barrier Structure */}
            <div className="flex-1 h-16 mx-2 relative overflow-hidden flex items-center">
              {/* Rail Guide Top and Bottom */}
              <div className="absolute top-0 inset-x-0 h-1 bg-slate-50 rounded-full" />
              <div className="absolute bottom-0 inset-x-0 h-1.5 bg-slate-50 rounded-full" />

              {/* Sliding Gate Panel */}
              <div
                className={`w-full h-full rounded-md border flex items-center justify-around px-2 transition-all duration-700 ${
                  isActive
                    ? 'translate-x-10 opacity-75 border-emerald-400/70 bg-emerald-50 shadow-sm'
                    : 'translate-x-0 opacity-95 border-sky-500/30 bg-slate-50'
                }`}
              >
                {/* Vertical Metal Bars of Gate */}
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 h-full rounded-full transition-colors ${
                      isActive ? 'bg-gradient-to-b from-emerald-400 to-teal-500' : 'bg-gradient-to-b from-slate-400 to-slate-600'
                    }`}
                  />
                ))}
              </div>

              {/* Motor Cogwheels Animation */}
              <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1.5 transition-opacity ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                <RotateCw className={`w-3.5 h-3.5 text-emerald-700 ${isActive ? 'animate-spin' : ''}`} />
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-700">
                  {!isOnline ? 'POSITION UNKNOWN' : isActive ? 'SIGNAL PULSE ACTIVE' : 'MOTOR READY'}
                </span>
              </div>
            </div>

            {/* Right Gate Pillar */}
            <div className="w-5 sm:w-6 h-full rounded-md bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 border border-slate-200 shadow-sm flex flex-col justify-between p-1 z-20">
              <span className="w-full h-1 bg-sky-400/60 rounded-full" />
              <div className={`w-1.5 h-1.5 rounded-full mx-auto ${isActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
              <span className="w-full h-1 bg-sky-400/60 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Tactile Trigger Button Section */}
      <div className={`w-full flex flex-col items-center justify-center gap-2.5 py-1 ${!isOnline ? 'pointer-events-none opacity-40 grayscale-[40%]' : ''}`}>
        <div className="relative flex items-center justify-center">
          {/* Pulsing neon rings when active */}
          {isActive && (
            <>
              <div className="absolute inset-0 rounded-full bg-emerald-400/25 animate-ping duration-1000 pointer-events-none" />
              <div className="absolute -inset-3 rounded-full bg-emerald-500/20 blur-lg pointer-events-none animate-pulse" />
            </>
          )}

          {/* Capacitive Switch Button */}
          <button
            type="button"
            onClick={handleTrigger}
            disabled={!isOnline || isTriggering}
            className={`w-36 h-36 sm:w-40 sm:h-40 rounded-full flex flex-col items-center justify-center transition-all duration-200 cursor-pointer select-none active:scale-95 shadow-xl relative border-4 ${
              isActive
                ? 'bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 text-white border-emerald-300 shadow-emerald-500/30 scale-105 ring-6 ring-emerald-400/20'
                : 'bg-gradient-to-br from-white via-slate-50 to-sky-50 text-slate-800 border-white hover:border-sky-300 hover:shadow-sky-500/20 shadow-sm ring-6 ring-sky-100/60'
            }`}
            aria-label="Gate Trigger Switch"
          >
            {/* Center Icon */}
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-1.5 transition-transform ${
              isActive ? 'bg-white/20 text-white scale-110' : 'bg-sky-50 text-[#0284c7] group-hover:scale-105'
            }`}>
              <Power className={`w-6 h-6 sm:w-7 sm:h-7 ${isActive ? 'stroke-[2.8]' : 'stroke-[2.2]'}`} />
            </div>

            {/* Action Text */}
            <span className={`text-xs sm:text-sm font-black tracking-wider uppercase font-mono ${
              isActive ? 'text-white drop-shadow-sm' : 'text-slate-800'
            }`}>
              {isTriggering ? 'TRIGGERING...' : (isOn && triggerMode === 'toggle' ? 'TURN OFF' : 'TRIGGER GATE')}
            </span>

            {/* Subtitle */}
            <span className={`text-[10px] font-semibold mt-0.5 ${
              isActive ? 'text-emerald-100' : 'text-slate-500'
            }`}>
              {isTriggering
                ? 'Pulse signal (1.5s)'
                : (triggerMode === 'pulse' ? 'Tap to Open / Close' : (isOn ? 'Relay is ON' : 'Tap to toggle'))}
            </span>
          </button>
        </div>

        {/* Trigger Mode Selector Pill */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-slate-100/90 border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => setTriggerMode('pulse')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              triggerMode === 'pulse'
                ? 'bg-white text-[#0284c7] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ⚡ Auto-Pulse (1.5s)
          </button>
          <button
            type="button"
            onClick={() => setTriggerMode('toggle')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              triggerMode === 'toggle'
                ? 'bg-white text-[#0284c7] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🔄 Manual Toggle
          </button>
        </div>
      </div>

      {/* 3. Gate Telemetry & Statistics Cards */}
      <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-2.5 px-3 border border-sky-100 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono">Channel</span>
          <span className="text-xs sm:text-sm font-extrabold text-slate-800 mt-0.5">1 (GPIO 13)</span>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-2.5 px-3 border border-sky-100 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono">Motor State</span>
          <span className={`text-xs sm:text-sm font-extrabold mt-0.5 ${
            isActive ? 'text-emerald-600' : 'text-slate-800'
          }`}>
            {isTriggering ? 'Triggering' : (isOn ? 'Energized' : 'Standby')}
          </span>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-2.5 px-3 border border-sky-100 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono">Last Action</span>
          <span className="text-xs sm:text-sm font-extrabold text-slate-800 mt-0.5 truncate">
            {lastActionTime || 'Ready'}
          </span>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-2.5 px-3 border border-sky-100 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono">Total Triggers</span>
          <span className="text-xs sm:text-sm font-extrabold text-[#0284c7] mt-0.5 font-mono">{triggerCount} Cycles</span>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// MASTER DYNAMIC UI WRAPPER COMPONENT
// -------------------------------------------------------------
interface DynamicDeviceLayoutProps {
  modelCode: string;
  deviceName?: string;
  deviceId?: string;
  initialSwitches?: Record<string, boolean>;
  switchConfigs?: Array<{ index: number; name: string; iconPath?: string }>;
  isOnline?: boolean;
  device?: any;
}

export const DynamicDeviceLayout = ({
  modelCode,
  deviceName,
  deviceId,
  initialSwitches,
  switchConfigs,
  isOnline = true,
  device
}: DynamicDeviceLayoutProps) => {
  const registered = MODEL_REGISTRY[modelCode] || MODEL_REGISTRY['TP8'];

  switch (registered?.layoutType) {
    case 'gate_controller':
      return (
        <GateControllerLayout
          modelCode={modelCode}
          deviceName={deviceName}
          deviceId={deviceId}
          initialSwitches={initialSwitches}
          isOnline={isOnline}
        />
      );
    case 'touch_panel':
      return (
        <TouchPanelLayout
          key={deviceId}
          lastSeenAt={device?.last_seen_at}
          switchCount={registered.switchCount || 8}
          modelCode={modelCode}
          deviceName={deviceName}
          deviceId={deviceId}
          initialSwitches={initialSwitches}
          switchConfigs={switchConfigs}
          isOnline={isOnline}
        />
      );
    case 'energy_meter':
      return (
        <EnergyMeterLayout
          isThreePhase={registered.isThreePhase}
          hasSwitch={registered.hasSwitch}
          modelCode={modelCode}
          deviceName={deviceName}
          deviceId={deviceId}
          isOnline={isOnline}
          device={device}
          initialSwitches={initialSwitches}
        />
      );
    default:
      return device ? <DeviceEndpointControls key={deviceId} device={device} online={isOnline} /> : null;
  }
};
