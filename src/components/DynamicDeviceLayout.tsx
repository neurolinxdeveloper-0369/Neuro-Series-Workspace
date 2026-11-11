import { useState, useRef, useEffect } from 'react';
import { 
  Zap, 
  Gauge, 
  Waves, 
  Sliders, 
  ToggleRight, 
  Power, 
  Tv, 
  Activity, 
  Droplets, 
  Blinds, 
  Lightbulb, 
  Router, 
  Sun, 
  Wind, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  RotateCw, 
  Edit2, 
  X, 
  Search, 
  CheckCircle2, 
  Info,
  AlertTriangle
} from 'lucide-react';
import { getAssetUrl } from '../utils/assets';
import { HARDWARE_ICONS } from '../utils/icons';
import { deviceApi } from '../services/device';
import { realtimeSocket } from '../services/socket';

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

  // Handle possible QR JSON payload: {"ssid": "NEURO-TP8-BC88"}
  if (clean.startsWith('{') && clean.endsWith('}')) {
    try {
      const parsed = JSON.parse(clean);
      if (parsed.ssid) clean = parsed.ssid;
      else if (parsed.modelCode) clean = `NEURO-${parsed.modelCode}-${parsed.mac4 || 'BC88'}`;
    } catch {
      // ignore
    }
  }

  // Handle URL format: https://neurolinx.in/device?ssid=NEURO-TP8-BC88
  if (clean.includes('ssid=')) {
    const match = clean.match(/ssid=([^&]+)/);
    if (match) clean = decodeURIComponent(match[1]);
  }

  // Pattern 1: NEURO-[MODEL]-[MAC4] or NEURO-BLE-[MODEL]-[MAC4]
  let modelCode = 'TP8';
  let mac4 = 'BC88';

  const neuroMatch = clean.match(/NEURO-(?:BLE-)?([A-Za-z0-9]+)-([A-Fa-f0-9]{4})/i);
  if (neuroMatch) {
    modelCode = neuroMatch[1].toUpperCase();
    mac4 = neuroMatch[2].toUpperCase();
  } else {
    // Pattern 2: [MODEL]-[MAC4]
    const shortMatch = clean.match(/^([A-Za-z0-9]+)-([A-Fa-f0-9]{4})$/i);
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

  const registered = MODEL_REGISTRY[modelCode] || MODEL_REGISTRY['TP8'];

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
  isOnline?: boolean;
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
  deviceName, 
  deviceId, 
  initialSwitches,
  isOnline = true
}: TouchPanelProps) => {
  // Initialize default switch names strictly as "Switch 1", "Switch 2", "Switch 3"...
  const [switches, setSwitches] = useState<SwitchItemConfig[]>(() => {
    try {
      const stored = localStorage.getItem(`neuro_touch_panel_${modelCode}_${switchCount}`);
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

  // Track pending rollback timers by channel number
  const rollbackTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // Cleanup pending rollback timers on unmount
  useEffect(() => {
    return () => {
      rollbackTimersRef.current.forEach(timer => clearTimeout(timer));
      rollbackTimersRef.current.clear();
    };
  }, []);

  // Sync state when initialSwitches from server changes
  useEffect(() => {
    if (initialSwitches) {
      setSwitches(prev => prev.map((sw, i) => {
        const chKey = String(i + 1);
        if (initialSwitches[chKey] !== undefined) {
          return { ...sw, state: Boolean(initialSwitches[chKey]) };
        }
        return sw;
      }));
    }
  }, [initialSwitches]);

  // Real-time synchronization when physical hardware publishes telemetry over MQTT/WebSocket
  useEffect(() => {
    if (!deviceId) return;
    const unsubscribe = realtimeSocket.subscribe((incomingDeviceId, incomingState) => {
      if (incomingDeviceId === deviceId && incomingState) {
        const switchMap = incomingState.switches || incomingState.payload || (typeof incomingState.state === 'object' ? incomingState.state : null);
        if (switchMap && typeof switchMap === 'object') {
          // Acknowledged by hardware: clear rollback timer for each updated channel
          Object.keys(switchMap).forEach(chKey => {
            const chNum = parseInt(chKey, 10);
            if (rollbackTimersRef.current.has(chNum)) {
              clearTimeout(rollbackTimersRef.current.get(chNum)!);
              rollbackTimersRef.current.delete(chNum);
            }
          });

          setSwitches(prev => prev.map((sw, i) => {
            const chKey = String(i + 1);
            if (switchMap[chKey] !== undefined) {
              return { ...sw, state: Boolean(switchMap[chKey]) };
            }
            return sw;
          }));
        } else if (incomingState.channel !== undefined && incomingState.state !== undefined) {
          const chNum = parseInt(String(incomingState.channel), 10);
          if (rollbackTimersRef.current.has(chNum)) {
            clearTimeout(rollbackTimersRef.current.get(chNum)!);
            rollbackTimersRef.current.delete(chNum);
          }
          if (!isNaN(chNum)) {
            setSwitches(prev => prev.map((sw, i) => {
              if (i + 1 === chNum) {
                return { ...sw, state: Boolean(incomingState.state) };
              }
              return sw;
            }));
          }
        }
      }
    });
    return unsubscribe;
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
      localStorage.setItem(`neuro_touch_panel_${modelCode}_${switchCount}`, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const toggleSwitch = async (index: number) => {
    if (!isOnline) {
      console.warn('Switch toggle ignored: device is offline.');
      return;
    }

    const currentState = switches[index]?.state || false;
    const targetState = !currentState;
    const channel = index + 1;

    // Clear any existing rollback timer for this channel
    if (rollbackTimersRef.current.has(channel)) {
      clearTimeout(rollbackTimersRef.current.get(channel)!);
      rollbackTimersRef.current.delete(channel);
    }

    // 1. Optimistic UI update
    const updated = switches.map((sw, i) => 
      i === index ? { ...sw, state: targetState } : sw
    );
    persistSwitches(updated);

    // 2. Set 3.5s watchdog timeout: if hardware confirmation state does not arrive in time, flip back!
    const timer = setTimeout(() => {
      console.warn(`⏱️ Switch state confirmation timeout for channel ${channel}. Flipping back to ${currentState}`);
      setSwitches(prev => {
        const reverted = prev.map((sw, i) => i === index ? { ...sw, state: currentState } : sw);
        try {
          localStorage.setItem(`neuro_touch_panel_${modelCode}_${switchCount}`, JSON.stringify(reverted));
        } catch {}
        return reverted;
      });
      rollbackTimersRef.current.delete(channel);
    }, 3500);

    rollbackTimersRef.current.set(channel, timer);

    // 3. Call backend switch control API (publishes to devices/{deviceId}/set via MQTT)
    if (deviceId) {
      try {
        const res = await deviceApi.controlSwitch(deviceId, channel, targetState ? 'on' : 'off');
        if (res && res.switches) {
          const chKey = String(channel);
          if (res.switches[chKey] === targetState) {
            // Confirmation arrived! Cancel rollback timer
            if (rollbackTimersRef.current.has(channel)) {
              clearTimeout(rollbackTimersRef.current.get(channel)!);
              rollbackTimersRef.current.delete(channel);
            }
          } else if (res.switches[chKey] !== undefined) {
            // Hardware returned mismatched state -> flip back to what hardware reported
            if (rollbackTimersRef.current.has(channel)) {
              clearTimeout(rollbackTimersRef.current.get(channel)!);
              rollbackTimersRef.current.delete(channel);
            }
            setSwitches(prev => prev.map((sw, i) => i === index ? { ...sw, state: Boolean(res.switches[chKey]) } : sw));
          }
        }
      } catch (err) {
        console.warn(`Failed to control switch channel ${channel}, flipping back:`, err);
        // API call failed -> IMMEDIATELY flip back to previous state!
        if (rollbackTimersRef.current.has(channel)) {
          clearTimeout(rollbackTimersRef.current.get(channel)!);
          rollbackTimersRef.current.delete(channel);
        }
        setSwitches(prev => {
          const reverted = prev.map((sw, i) => i === index ? { ...sw, state: currentState } : sw);
          try {
            localStorage.setItem(`neuro_touch_panel_${modelCode}_${switchCount}`, JSON.stringify(reverted));
          } catch {}
          return reverted;
        });
      }
    }
  };

  const allOn = async () => {
    if (!isOnline) return;
    persistSwitches(switches.map(sw => ({ ...sw, state: true })));
    if (deviceId) {
      for (let i = 0; i < switches.length; i++) {
        try {
          await deviceApi.controlSwitch(deviceId, i + 1, 'on');
        } catch {}
      }
    }
  };

  const allOff = async () => {
    if (!isOnline) return;
    persistSwitches(switches.map(sw => ({ ...sw, state: false })));
    if (deviceId) {
      for (let i = 0; i < switches.length; i++) {
        try {
          await deviceApi.controlSwitch(deviceId, i + 1, 'off');
        } catch {}
      }
    }
  };

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

  const handleSaveCustomization = () => {
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
        <img 
          src={getAssetUrl(`ICONS/${sw.iconPath}`)} 
          alt=""
          className={`w-8 h-8 sm:w-10 sm:h-10 object-contain transition-all duration-300 pointer-events-none ${
            isOn 
              ? 'filter drop-shadow-[0_0_10px_rgba(56,189,248,1)] brightness-150' 
              : 'opacity-40 grayscale contrast-125'
          }`}
        />
      );
    }

    const lower = sw.name.toLowerCase();
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
        className={`w-7 h-7 sm:w-8 sm:h-8 transition-all duration-300 pointer-events-none ${
          isOn 
            ? 'text-white drop-shadow-[0_0_12px_rgba(56,189,248,1)]' 
            : 'text-slate-400 group-hover:text-slate-300'
        }`}
        strokeWidth={2.3}
      />
    );
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[36px] p-5 sm:p-7 border border-white/90 shadow-[0_20px_50px_rgba(2,132,199,0.08),0_4px_16px_rgba(0,0,0,0.04)] select-none">
      {/* Top Header Card: Model Display & Quick Batch Actions */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-sky-100/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-[#0284c7] flex items-center justify-center border border-sky-100 shadow-xs">
            <ToggleRight className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#0284c7] font-mono bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/60 shadow-2xs">
                {modelCode}
              </span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                Capacitive Touch Panel
              </span>
            </div>
            <div className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight mt-0.5">
              {deviceName || `${switchCount} Gang Switches`}
            </div>
          </div>
        </div>

        {/* Quick Batch Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!isOnline}
            onClick={allOn}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xs transition-all ${
              isOnline
                ? 'bg-[#0284c7] hover:bg-[#0369a1] text-white active:scale-95 cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
            }`}
          >
            All ON
          </button>
          <button
            type="button"
            disabled={!isOnline}
            onClick={allOff}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border shadow-xs transition-all ${
              isOnline
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80 active:scale-95 cursor-pointer'
                : 'bg-slate-100 text-slate-400 border-slate-200/50 cursor-not-allowed opacity-60'
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
      <div className="flex flex-col items-center gap-5 sm:gap-8 py-3 my-2">
        {switchRows.map((rowIndices, rowIdx) => (
          <div key={rowIdx} className="flex items-center justify-center gap-4 sm:gap-7 w-full">
            {rowIndices.map((idx) => {
              const sw = switches[idx];
              if (!sw) return null;
              const isOn = sw.state;

              return (
                <div
                  key={idx}
                  onTouchStart={() => handleTouchStart(idx)}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  onClick={() => handleClick(idx)}
                  className={`group relative rounded-full aspect-square w-[76px] h-[76px] sm:w-24 sm:h-24 flex items-center justify-center select-none transition-all duration-300 ease-out ${
                    !isOnline
                      ? 'opacity-35 cursor-not-allowed pointer-events-none filter grayscale-[50%] bg-[#181a1f] border-2 border-slate-700'
                      : isOn
                        ? 'cursor-pointer active:scale-90 bg-[#0b1424] border-2 border-white ring-4 ring-[#38bdf8] shadow-[0_0_26px_rgba(56,189,248,0.9),0_0_50px_rgba(14,165,233,0.45),inset_0_0_16px_rgba(56,189,248,0.4)]'
                        : 'cursor-pointer active:scale-90 bg-[#181a1f] hover:bg-[#20232a] border-2 border-[#2f333c] shadow-[0_8px_20px_rgba(0,0,0,0.35),inset_0_2px_4px_rgba(255,255,255,0.06)]'
                  }`}
                  title={!isOnline ? 'Device is offline - switch disabled' : `${sw.name} • Tap to toggle, Long-press to edit`}
                >
                  {/* Luminous Inner Glow Aura when ON */}
                  {isOn && isOnline && (
                    <div className="absolute inset-1 rounded-full bg-radial from-sky-400/25 via-transparent to-transparent pointer-events-none animate-pulse" />
                  )}

                  {/* Centered Appliance Icon - NO TEXT */}
                  <div className="relative z-10 flex items-center justify-center">
                    {renderApplianceIcon(sw, idx, isOn && isOnline)}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Status Hint */}
      <div className="mt-6 pt-3.5 border-t border-sky-100/80 flex items-center justify-between text-xs text-slate-500 font-sans">
        <span className="flex items-center gap-1.5 text-slate-600">
          <Info className="w-3.5 h-3.5 text-[#0284c7]" />
          <span>Tap circle to toggle &bull; Long-press to customize</span>
        </span>
        <span className="font-mono font-bold text-[#0284c7]">
          {switches.filter(s => s.state).length} / {switchCount} ON
        </span>
      </div>

      {/* =========================================================
          CUSTOMIZE SWITCH MODAL (Name & Icon Picker Screen)
          Triggered via Long Press on any switch
          ========================================================= */}
      {editingIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in select-none">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-[32px] sm:rounded-3xl p-5 sm:p-6 shadow-2xl text-white max-h-[92vh] flex flex-col justify-between overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Customize Switch {editingIndex + 1}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Model: {modelCode} • SW {editingIndex + 1}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingIndex(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              
              {/* Switch Name Input */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Switch Label / Appliance Name
                </label>
                <div className="flex items-center gap-2 bg-slate-800/80 rounded-2xl border border-slate-700 px-3 py-2 focus-within:border-sky-400 transition-colors">
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => {
                      setDraftName(e.target.value);
                      setConflictNotice(null);
                    }}
                    placeholder={`e.g. Light ${editingIndex + 1} or Fan`}
                    className="w-full bg-transparent text-sm text-white font-sans outline-none"
                    autoFocus
                  />
                  {draftName && (
                    <button
                      type="button"
                      onClick={() => setDraftName('')}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Conflict / Auto-numbering notification */}
              {conflictNotice && (
                <div className="bg-sky-950/60 border border-sky-500/40 rounded-2xl p-2.5 flex items-start gap-2 text-xs text-sky-200 animate-in fade-in">
                  <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                  <span>{conflictNotice}</span>
                </div>
              )}

              {/* Quick Preset Labels with Smart Conflict Auto-Numbering */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400">
                    Quick Preset Names:
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-slate-500">Style:</span>
                    <button
                      type="button"
                      onClick={() => setNamingStyle('numbered')}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${namingStyle === 'numbered' ? 'bg-sky-500/30 text-sky-300 font-bold' : 'text-slate-400'}`}
                    >
                      Light 1, 2
                    </button>
                    <button
                      type="button"
                      onClick={() => setNamingStyle('prefixed')}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${namingStyle === 'prefixed' ? 'bg-sky-500/30 text-sky-300 font-bold' : 'text-slate-400'}`}
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
                      className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/80 transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Switch Preview Card */}
              <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-800 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">Switch Preview:</span>
                <div className="flex items-center gap-2.5 bg-slate-900 border border-sky-400/50 rounded-xl px-3 py-1.5">
                  <div className="w-6 h-6 rounded-md bg-sky-400/20 flex items-center justify-center">
                    {draftIconPath ? (
                      <img 
                        src={getAssetUrl(`ICONS/${draftIconPath}`)} 
                        alt="Preview" 
                        className="w-5 h-5 object-contain"
                      />
                    ) : (
                      <Power className="w-3.5 h-3.5 text-sky-400" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-white font-mono">
                    {draftName || `Switch ${editingIndex + 1}`}
                  </div>
                  <span className="text-[10px] text-sky-300 font-bold bg-sky-500/20 px-1.5 py-0.5 rounded">
                    ON
                  </span>
                </div>
              </div>

              {/* Icon Picker Header & Search */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300">
                    Select Icon ({HARDWARE_ICONS.length} Appliance Icons)
                  </label>
                  {draftIconPath && (
                    <button
                      type="button"
                      onClick={() => setDraftIconPath('')}
                      className="text-[11px] font-semibold text-rose-400 hover:underline cursor-pointer"
                    >
                      Use Default Icon
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-slate-800/80 rounded-2xl border border-slate-700 px-3 py-1.5 mb-3">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    placeholder="Search icons..."
                    className="w-full bg-transparent text-xs text-white outline-none"
                  />
                  {iconSearch && (
                    <button type="button" onClick={() => setIconSearch('')}>
                      <X className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                </div>

                {/* Grid of 174 transparent PNG icons */}
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                  
                  {/* Default / Lucide Power Option */}
                  <button
                    type="button"
                    onClick={() => setDraftIconPath('')}
                    className={`aspect-square rounded-xl p-1.5 flex flex-col items-center justify-center transition-all cursor-pointer border ${
                      !draftIconPath
                        ? 'bg-sky-500/20 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                        : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800'
                    }`}
                    title="Default Power Icon"
                  >
                    <Power className="w-5 h-5 text-sky-400" />
                  </button>

                  {/* 174 Icons from public/ICONS */}
                  {filteredIcons.map((iconName) => {
                    const isSelected = draftIconPath === iconName;
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setDraftIconPath(iconName)}
                        className={`aspect-square rounded-xl p-1.5 flex items-center justify-center transition-all cursor-pointer relative group border ${
                          isSelected
                            ? 'bg-sky-500/30 border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.5)] scale-105'
                            : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 hover:border-slate-500'
                        }`}
                        title={iconName}
                      >
                        <img 
                          src={getAssetUrl(`ICONS/${iconName}`)} 
                          alt="Icon" 
                          className="w-full h-full object-contain filter drop-shadow-sm transition-transform group-hover:scale-110"
                          loading="lazy"
                        />
                        {isSelected && (
                          <div className="absolute top-0.5 right-0.5 w-3 h-3 bg-sky-400 rounded-full flex items-center justify-center">
                            <Check className="w-2 h-2 text-slate-950" strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-800 mt-4 flex-shrink-0">
              <button
                type="button"
                onClick={() => setEditingIndex(null)}
                className="flex-1 py-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomization}
                className="flex-1 py-3 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs shadow-md shadow-sky-500/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Switch</span>
              </button>
            </div>

          </div>
        </div>
      )}

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
}

export const EnergyMeterLayout = ({ isThreePhase = false, hasSwitch = false, modelCode }: EnergyMeterProps) => {
  const [relayOn, setRelayOn] = useState(true);

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl select-none space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
              {modelCode} • {isThreePhase ? '3-Phase Smart Meter' : '1-Phase Smart Meter'}
            </div>
            <div className="text-sm font-extrabold text-white">
              Real-time Power Telemetry
            </div>
          </div>
        </div>

        {hasSwitch && (
          <button
            type="button"
            onClick={() => setRelayOn(!relayOn)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
              relayOn 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30' 
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{relayOn ? 'Load Connected' : 'Disconnected'}</span>
          </button>
        )}
      </div>

      {/* 5 Core Required Metrics: Voltage, Current, Power, Power Factor, Energy */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        
        {/* 1. Voltage (V) */}
        <div className="bg-slate-800/70 rounded-2xl p-3 border border-slate-700/60 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-sky-400" /> Voltage
          </span>
          <div className="mt-1">
            <div className="text-lg sm:text-xl font-extrabold font-mono text-white tracking-tight">
              {isThreePhase ? '415.2' : '230.4'}
            </div>
            <span className="text-[11px] text-sky-400 font-bold">Volts (AC)</span>
          </div>
        </div>

        {/* 2. Current (A) */}
        <div className="bg-slate-800/70 rounded-2xl p-3 border border-slate-700/60 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
            <Activity className="w-3 h-3 text-amber-400" /> Current
          </span>
          <div className="mt-1">
            <div className="text-lg sm:text-xl font-extrabold font-mono text-white tracking-tight">
              {isThreePhase ? '15.30' : '4.82'}
            </div>
            <span className="text-[11px] text-amber-400 font-bold">Amperes (A)</span>
          </div>
        </div>

        {/* 3. Active Power (W / kW) */}
        <div className="bg-slate-800/70 rounded-2xl p-3 border border-slate-700/60 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-400" /> Power
          </span>
          <div className="mt-1">
            <div className="text-lg sm:text-xl font-extrabold font-mono text-emerald-400 tracking-tight">
              {isThreePhase ? '3.45' : '1.11'}
            </div>
            <span className="text-[11px] text-emerald-400/80 font-bold">Kilowatts (kW)</span>
          </div>
        </div>

        {/* 4. Power Factor (PF) */}
        <div className="bg-slate-800/70 rounded-2xl p-3 border border-slate-700/60 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
            <Sliders className="w-3 h-3 text-purple-400" /> Power Factor
          </span>
          <div className="mt-1">
            <div className="text-lg sm:text-xl font-extrabold font-mono text-white tracking-tight">
              0.98
            </div>
            <span className="text-[11px] text-purple-400 font-bold">PF (Lead/Lag)</span>
          </div>
        </div>

        {/* 5. Total Accumulated Energy (kWh) */}
        <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-sky-950/60 to-slate-800/80 rounded-2xl p-3 border border-sky-500/40 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-sky-300 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-sky-400" /> Total Energy
          </span>
          <div className="mt-1">
            <div className="text-lg sm:text-xl font-extrabold font-mono text-sky-300 tracking-tight">
              {isThreePhase ? '849.3' : '142.6'}
            </div>
            <span className="text-[11px] text-sky-300 font-bold">kWh (Units)</span>
          </div>
        </div>
      </div>

      {/* If Three Phase, show individual phases R, Y, B breakdown */}
      {isThreePhase && (
        <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800 space-y-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
            Three Phase Live Load Distribution
          </div>
          <div className="grid grid-cols-3 gap-2 text-center font-mono">
            <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-2">
              <span className="text-[10px] font-extrabold text-rose-400">PHASE R (L1)</span>
              <div className="text-sm font-bold text-white mt-0.5">231.2 V</div>
              <div className="text-xs text-rose-300 font-medium">5.1 A • 1.15 kW</div>
            </div>
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-2">
              <span className="text-[10px] font-extrabold text-amber-400">PHASE Y (L2)</span>
              <div className="text-sm font-bold text-white mt-0.5">229.8 V</div>
              <div className="text-xs text-amber-300 font-medium">4.8 A • 1.08 kW</div>
            </div>
            <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-2">
              <span className="text-[10px] font-extrabold text-sky-400">PHASE B (L3)</span>
              <div className="text-sm font-bold text-white mt-0.5">230.5 V</div>
              <div className="text-xs text-sky-300 font-medium">5.4 A • 1.22 kW</div>
            </div>
          </div>
        </div>
      )}

      {/* Frequency & Meter Health */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-1 font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Grid Frequency: <strong className="text-white">50.02 Hz</strong>
        </span>
        <span>Accuracy Class 1.0 • Calibrated</span>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 3. SMART WATER TANK DYNAMIC UI (Graphic + Percentage Level)
// -------------------------------------------------------------
interface WaterTankProps {
  modelCode: string;
}

export const WaterTankLayout = ({ modelCode }: WaterTankProps) => {
  const [tankLevel, setTankLevel] = useState(78); // percentage 78%
  const [motorOn, setMotorOn] = useState(true);
  const [autoMode, setAutoMode] = useState(true);

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl select-none space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
            <Waves className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
              {modelCode} • Hydro Telemetry
            </div>
            <div className="text-sm font-extrabold text-white">
              Smart Water Tank & Pump Automation
            </div>
          </div>
        </div>

        {/* Auto / Manual Mode Pill */}
        <button
          type="button"
          onClick={() => setAutoMode(!autoMode)}
          className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
            autoMode 
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' 
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          {autoMode ? 'Auto-Control' : 'Manual'}
        </button>
      </div>

      {/* Main Graphic Section: Water Tank Reservoir Graphic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        
        {/* Left Column: Visual Water Tank Container with Animated Wave Liquid */}
        <div className="flex flex-col items-center justify-center bg-slate-950/80 rounded-2xl p-4 border border-slate-800/90 relative overflow-hidden">
          
          {/* Tank Outer Shell Graphic */}
          <div className="relative w-36 h-48 rounded-[24px] border-4 border-slate-700/80 bg-slate-900 overflow-hidden shadow-inner flex flex-col justify-end">
            
            {/* Level Markings (0%, 25%, 50%, 75%, 100%) */}
            <div className="absolute inset-y-0 right-1.5 flex flex-col justify-between py-2 text-[9px] font-mono text-slate-500 pointer-events-none z-20">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>

            {/* Liquid Fill Level based on tankLevel % */}
            <div 
              className="w-full bg-gradient-to-t from-cyan-600 via-sky-500 to-cyan-400 relative transition-all duration-700 ease-out shadow-[0_0_25px_rgba(6,182,212,0.4)]"
              style={{ height: `${tankLevel}%` }}
            >
              {/* Dynamic Wave Crest */}
              <div className="absolute -top-3 inset-x-0 h-4 bg-cyan-300/40 rounded-full blur-[1px] animate-pulse" />
            </div>

            {/* Inflow indicator pipe at top */}
            <div className="absolute top-1 left-4 flex items-center gap-1 z-20">
              <span className={`w-2 h-2 rounded-full ${motorOn ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`} />
              <span className="text-[9px] font-mono text-slate-400">
                {motorOn ? 'Inflow ON' : 'Standby'}
              </span>
            </div>
          </div>

          {/* Quick interactive test slider for level preview */}
          <div className="w-full mt-3 px-2 flex items-center justify-between text-xs text-slate-400">
            <span>Level:</span>
            <input 
              type="range" 
              min="5" 
              max="100" 
              value={tankLevel} 
              onChange={(e) => setTankLevel(Number(e.target.value))}
              className="w-24 accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Right Column: Tank Stats & Pump Control Switch */}
        <div className="space-y-3">
          
          {/* Big Percentage Card */}
          <div className="bg-slate-800/70 rounded-2xl p-3.5 border border-slate-700/70">
            <span className="text-xs font-mono uppercase text-slate-400 block mb-0.5">
              Current Tank Level
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono text-cyan-400 tracking-tight">
                {tankLevel}%
              </span>
              <span className="text-xs font-bold text-slate-300">
                ({Math.round((tankLevel / 100) * 1000)} L / 1,000 L)
              </span>
            </div>
            
            {/* Health pill */}
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 font-medium">Optimal water reservoir level</span>
            </div>
          </div>

          {/* Motor / Pump Switch */}
          <div className="bg-slate-800/70 rounded-2xl p-3.5 border border-slate-700/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                motorOn ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30' : 'bg-slate-700 text-slate-400'
              }`}>
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Submersible Motor Pump</div>
                <div className="text-[11px] font-mono text-slate-400">
                  {motorOn ? 'Pumping: 18.5 L/min' : 'Motor Stopped'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMotorOn(!motorOn)}
              className={`w-12 h-6 rounded-full transition-colors duration-300 p-0.5 relative cursor-pointer ${
                motorOn ? 'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.6)]' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                  motorOn ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Dry Run & Overflow Protection alerts */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Dry-Run Cutoff
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" /> Overflow Guard
            </span>
          </div>

        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 4. IR BLASTER DYNAMIC UI (Smart Remote Controls)
// -------------------------------------------------------------
export const IrBlasterLayout = ({ modelCode }: { modelCode: string }) => {
  const [power, setPower] = useState(true);
  const [temperature, setTemperature] = useState(24);
  const [mode, setMode] = useState<'cool' | 'heat' | 'dry' | 'fan'>('cool');
  const [fanSpeed, setFanSpeed] = useState<'low' | 'med' | 'high' | 'auto'>('auto');

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl select-none space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Tv className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">
              {modelCode} • 360° Omnidirectional IR
            </div>
            <div className="text-sm font-extrabold text-white">
              Climate & AC Remote Control
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPower(!power)}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            power 
              ? 'bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.6)]' 
              : 'bg-slate-800 text-slate-500 border border-slate-700'
          }`}
        >
          <Power className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>

      {/* Main Temperature & Dial */}
      <div className="flex flex-col items-center justify-center py-2">
        <div className="text-xs font-mono uppercase text-slate-400 mb-1">Target Temperature</div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setTemperature(prev => Math.max(16, prev - 1))}
            className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-xl font-bold flex items-center justify-center border border-slate-700 cursor-pointer"
          >
            -
          </button>
          
          <div className="text-5xl font-extrabold font-mono text-sky-400 tracking-tight">
            {temperature}°<span className="text-2xl text-slate-400 font-normal">C</span>
          </div>

          <button
            type="button"
            onClick={() => setTemperature(prev => Math.min(30, prev + 1))}
            className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-xl font-bold flex items-center justify-center border border-slate-700 cursor-pointer"
          >
            +
          </button>
        </div>
      </div>

      {/* Mode Selectors */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
        {(['cool', 'heat', 'dry', 'fan'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`py-2 rounded-xl capitalize transition-colors border cursor-pointer ${
              mode === m 
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50' 
                : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Fan Speed */}
      <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-800/60 p-2.5 rounded-2xl border border-slate-700/60">
        <span className="flex items-center gap-1.5 font-mono text-slate-400">
          <Wind className="w-3.5 h-3.5 text-sky-400" /> Fan Speed:
        </span>
        <div className="flex items-center gap-1">
          {(['auto', 'low', 'med', 'high'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFanSpeed(s)}
              className={`px-2 py-0.5 rounded-lg uppercase text-[10px] font-bold cursor-pointer ${
                fanSpeed === s ? 'bg-sky-400 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 5. SENSORS DYNAMIC UI (Temperature, Humidity, Motion)
// -------------------------------------------------------------
export const SensorLayout = ({ modelCode }: { modelCode: string }) => {
  const isMotion = modelCode === 'MSEN';

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl select-none space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
              {modelCode} • Environmental Sensor
            </div>
            <div className="text-sm font-extrabold text-white">
              {isMotion ? 'Passive PIR Motion Telemetry' : 'Atmospheric Conditions'}
            </div>
          </div>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-500/30">
          Active
        </span>
      </div>

      {isMotion ? (
        <div className="flex flex-col items-center justify-center py-4 space-y-3">
          <div className="relative flex items-center justify-center w-24 h-24">
            <span className="absolute w-24 h-24 rounded-full bg-emerald-500/20 animate-ping" />
            <div className="w-16 h-16 rounded-full bg-emerald-500/30 border border-emerald-400 flex items-center justify-center text-emerald-300">
              <Activity className="w-8 h-8 animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <span className="text-lg font-extrabold text-emerald-400">Motion Detected</span>
            <p className="text-xs text-slate-400 mt-0.5">Radar Ping • Just now</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/70 rounded-2xl p-3.5 border border-slate-700/60">
            <span className="text-xs font-mono text-slate-400 uppercase flex items-center gap-1">
              <Sun className="w-3.5 h-3.5 text-amber-400" /> Temperature
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white mt-1">
              26.4°C
            </div>
            <span className="text-[11px] text-emerald-400 font-semibold">Comfortable zone</span>
          </div>

          <div className="bg-slate-800/70 rounded-2xl p-3.5 border border-slate-700/60">
            <span className="text-xs font-mono text-slate-400 uppercase flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" /> Humidity
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-cyan-400 mt-1">
              58% RH
            </div>
            <span className="text-[11px] text-cyan-400/80 font-semibold">Optimal moisture</span>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// 6. CURTAIN DRIVER DYNAMIC UI
// -------------------------------------------------------------
export const CurtainLayout = ({ modelCode }: { modelCode: string }) => {
  const [position, setPosition] = useState(60);

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl select-none space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
            <Blinds className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-purple-400 font-mono">
              {modelCode} • Motorized Drapery
            </div>
            <div className="text-sm font-extrabold text-white">Curtain Position ({position}%)</div>
          </div>
        </div>
      </div>

      {/* Graphic Illustration of Curtains */}
      <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 flex items-center justify-between relative overflow-hidden h-28">
        {/* Left Curtain Drape */}
        <div 
          className="h-full bg-gradient-to-r from-purple-800 via-purple-600 to-purple-500 rounded-l-xl transition-all duration-300 border-r border-purple-300/40"
          style={{ width: `${(100 - position) / 2}%` }}
        />
        {/* Window View */}
        <div className="flex-1 flex flex-col items-center justify-center text-xs font-mono text-slate-400">
          <span>Curtain Track</span>
          <span className="text-purple-300 font-bold">{position}% Open</span>
        </div>
        {/* Right Curtain Drape */}
        <div 
          className="h-full bg-gradient-to-l from-purple-800 via-purple-600 to-purple-500 rounded-r-xl transition-all duration-300 border-l border-purple-300/40"
          style={{ width: `${(100 - position) / 2}%` }}
        />
      </div>

      {/* Position Slider */}
      <input 
        type="range"
        min="0"
        max="100"
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        className="w-full accent-purple-400 cursor-pointer"
      />

      <div className="flex items-center justify-between gap-2 pt-1">
        <button type="button" onClick={() => setPosition(100)} className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer">
          Open
        </button>
        <button type="button" onClick={() => setPosition(50)} className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer">
          Half
        </button>
        <button type="button" onClick={() => setPosition(0)} className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer">
          Close
        </button>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 7. HEAVY DUTY PLUG DYNAMIC UI (16A / 30A High Load)
// -------------------------------------------------------------
export const HeavyPlugLayout = ({ modelCode }: { modelCode: string }) => {
  const [on, setOn] = useState(true);

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl select-none space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
            <Power className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-rose-400 font-mono">
              {modelCode} • High Amp Socket Node
            </div>
            <div className="text-sm font-extrabold text-white">Appliance Overload Guard</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOn(!on)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            on ? 'bg-rose-500 text-white shadow-[0_0_14px_#f43f5e]' : 'bg-slate-800 text-slate-500'
          }`}
        >
          <Power className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-800/70 p-3 rounded-2xl border border-slate-700/60">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Power</span>
          <div className="text-base sm:text-lg font-bold font-mono text-rose-400 mt-0.5">
            {on ? '2,640 W' : '0 W'}
          </div>
        </div>
        <div className="bg-slate-800/70 p-3 rounded-2xl border border-slate-700/60">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Current</span>
          <div className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
            {on ? '11.4 A' : '0.0 A'}
          </div>
        </div>
        <div className="bg-slate-800/70 p-3 rounded-2xl border border-slate-700/60">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Voltage</span>
          <div className="text-base sm:text-lg font-bold font-mono text-sky-400 mt-0.5">
            231.5 V
          </div>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 8. LIGHTING DYNAMIC UI (RGB & CCT Color Wheel / Sliders)
// -------------------------------------------------------------
export const LightingLayout = ({ modelCode }: { modelCode: string }) => {
  const [brightness, setBrightness] = useState(85);
  const [selectedHex, setSelectedHex] = useState('#06b6d4');

  const swatches = ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#f8fafc'];

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl select-none space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div 
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{ backgroundColor: `${selectedHex}25`, color: selectedHex }}
          >
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-sky-400 font-mono">
              {modelCode} • Spectral Luminaire
            </div>
            <div className="text-sm font-extrabold text-white">Brightness & Color Palette</div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Brightness</span>
          <span className="text-white font-mono">{brightness}%</span>
        </div>
        <input 
          type="range"
          min="5"
          max="100"
          value={brightness}
          onChange={(e) => setBrightness(Number(e.target.value))}
          className="w-full accent-sky-400 cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        {swatches.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => setSelectedHex(hex)}
            className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
              selectedHex === hex ? 'scale-125 border-white shadow-lg' : 'border-transparent hover:scale-110'
            }`}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 9. INDUSTRY & AGRICULTURE (Motors, Aqua Smart)
// -------------------------------------------------------------
export const IndustryAgriLayout = ({ modelCode }: { modelCode: string }) => {
  const [running, setRunning] = useState(true);

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl select-none space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <RotateCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
              {modelCode} • Heavy Motor Starter
            </div>
            <div className="text-sm font-extrabold text-white">Industrial Automation</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRunning(!running)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold font-mono transition-colors cursor-pointer ${
            running ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
          }`}
        >
          {running ? 'RUNNING' : 'STOPPED'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
        <div className="bg-slate-800/70 p-3 rounded-2xl border border-slate-700/60">
          <span className="text-slate-400 block">3-Phase Voltage:</span>
          <span className="text-base font-bold text-white mt-1 block">415 V Balanced</span>
        </div>
        <div className="bg-slate-800/70 p-3 rounded-2xl border border-slate-700/60">
          <span className="text-slate-400 block">Overload Status:</span>
          <span className="text-base font-bold text-emerald-400 mt-1 block">Normal (Trip: OK)</span>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 10. HUBS, GATEWAYS & CONSOLES
// -------------------------------------------------------------
export const HubLayout = ({ modelCode }: { modelCode: string }) => {
  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl select-none space-y-3">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
            <Router className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-sky-400 font-mono">
              {modelCode} • Central Gateway
            </div>
            <div className="text-sm font-extrabold text-white">Mesh Network Master</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="bg-slate-800/70 p-3 rounded-2xl">
          <span className="text-slate-400">Mesh Nodes:</span>
          <div className="text-lg font-bold text-sky-400">18 Connected</div>
        </div>
        <div className="bg-slate-800/70 p-3 rounded-2xl">
          <span className="text-slate-400">Signal Latency:</span>
          <div className="text-lg font-bold text-emerald-400">12 ms (BLE/Zigbee)</div>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 10. GATE CONTROLLER DYNAMIC UI (NEURO-GATE-XXXX)
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
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
      <div className="w-full rounded-2xl sm:rounded-3xl bg-slate-900 text-white p-4 sm:p-5 border border-slate-800 shadow-md overflow-hidden relative">
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
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 relative z-10">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${
              isActive 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
            }`}>
              <RotateCw className={`w-4 h-4 ${isActive ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-300 tracking-wide uppercase font-mono truncate max-w-[150px] sm:max-w-xs block">
                {deviceName || 'Motorized Barrier'}
              </span>
              <p className="text-[10px] text-slate-400 font-mono">
                Relay 1 • GPIO 13
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 backdrop-blur-md transition-all ${
            isActive
              ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50 shadow-xs animate-pulse'
              : 'bg-slate-800/90 text-slate-300 border-slate-700/80'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-400'}`} />
            {isTriggering ? 'MOTOR TRIGGERED' : (isOn ? 'ENERGIZED' : 'STANDBY')}
          </span>
        </div>

        {/* Gate Graphic Visualizer */}
        <div className="relative py-3.5 flex flex-col items-center justify-center z-10">
          <div className="w-full max-w-sm h-22 relative flex items-center justify-between px-2">
            {/* Left Gate Pillar */}
            <div className="w-5 sm:w-6 h-full rounded-md bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border border-slate-600 shadow-sm flex flex-col justify-between p-1 z-20">
              <span className="w-full h-1 bg-sky-400/60 rounded-full" />
              <div className={`w-1.5 h-1.5 rounded-full mx-auto ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="w-full h-1 bg-sky-400/60 rounded-full" />
            </div>

            {/* Sliding Gate Barrier Structure */}
            <div className="flex-1 h-16 mx-2 relative overflow-hidden flex items-center">
              {/* Rail Guide Top and Bottom */}
              <div className="absolute top-0 inset-x-0 h-1 bg-slate-700/80 rounded-full" />
              <div className="absolute bottom-0 inset-x-0 h-1.5 bg-slate-700/80 rounded-full" />

              {/* Sliding Gate Panel */}
              <div 
                className={`w-full h-full rounded-md border flex items-center justify-around px-2 transition-all duration-700 ${
                  isActive 
                    ? 'translate-x-10 opacity-75 border-emerald-400/70 bg-emerald-950/40 shadow-sm' 
                    : 'translate-x-0 opacity-95 border-sky-500/30 bg-slate-800/60'
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
                <RotateCw className={`w-3.5 h-3.5 text-emerald-400 ${isActive ? 'animate-spin' : ''}`} />
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                  {isActive ? 'SIGNAL PULSE ACTIVE' : 'MOTOR READY'}
                </span>
              </div>
            </div>

            {/* Right Gate Pillar */}
            <div className="w-5 sm:w-6 h-full rounded-md bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border border-slate-600 shadow-sm flex flex-col justify-between p-1 z-20">
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
                : 'bg-gradient-to-br from-white via-slate-50 to-sky-50 text-slate-800 border-white hover:border-sky-300 hover:shadow-sky-500/20 shadow-lg ring-6 ring-sky-100/60'
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
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Channel</span>
          <span className="text-xs sm:text-sm font-extrabold text-slate-800 mt-0.5">1 (GPIO 13)</span>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-2.5 px-3 border border-sky-100 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Motor State</span>
          <span className={`text-xs sm:text-sm font-extrabold mt-0.5 ${
            isActive ? 'text-emerald-600' : 'text-slate-800'
          }`}>
            {isTriggering ? 'Triggering' : (isOn ? 'Energized' : 'Standby')}
          </span>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-2.5 px-3 border border-sky-100 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Last Action</span>
          <span className="text-xs sm:text-sm font-extrabold text-slate-800 mt-0.5 truncate">
            {lastActionTime || 'Ready'}
          </span>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-2.5 px-3 border border-sky-100 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Total Triggers</span>
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
  isOnline?: boolean;
}

export const DynamicDeviceLayout = ({ 
  modelCode, 
  deviceName, 
  deviceId, 
  initialSwitches,
  isOnline = true
}: DynamicDeviceLayoutProps) => {
  const registered = MODEL_REGISTRY[modelCode] || MODEL_REGISTRY['TP8'];

  switch (registered.layoutType) {
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
          switchCount={registered.switchCount || 8} 
          modelCode={modelCode}
          deviceName={deviceName}
          deviceId={deviceId}
          initialSwitches={initialSwitches}
          isOnline={isOnline}
        />
      );
    case 'energy_meter':
      return (
        <EnergyMeterLayout 
          isThreePhase={registered.isThreePhase} 
          hasSwitch={registered.hasSwitch}
          modelCode={modelCode}
        />
      );
    case 'water_tank':
      return <WaterTankLayout modelCode={modelCode} />;
    case 'ir_blaster':
      return <IrBlasterLayout modelCode={modelCode} />;
    case 'sensor':
      return <SensorLayout modelCode={modelCode} />;
    case 'curtain':
      return <CurtainLayout modelCode={modelCode} />;
    case 'heavy_plug':
      return <HeavyPlugLayout modelCode={modelCode} />;
    case 'lighting':
      return <LightingLayout modelCode={modelCode} />;
    case 'motor_agri':
      return <IndustryAgriLayout modelCode={modelCode} />;
    case 'hub':
    case 'console':
    default:
      return <HubLayout modelCode={modelCode} />;
  }
};
