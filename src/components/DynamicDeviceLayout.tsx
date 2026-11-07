import { useState } from 'react';
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
  RotateCw
} from 'lucide-react';

export interface ResolvedDeviceMeta {
  modelCode: string;
  mac4: string;
  name: string;
  category: string;
  layoutType: 'touch_panel' | 'energy_meter' | 'water_tank' | 'ir_blaster' | 'sensor' | 'motor_agri' | 'heavy_plug' | 'curtain' | 'lighting' | 'hub' | 'console';
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
}

const DEFAULT_SWITCH_NAMES = [
  'Ceiling Light',
  'Chandelier',
  'Wall Lamp',
  'Fan Speed',
  'Ambient Glow',
  'Balcony Light',
  'Spotlight',
  'Master Bed Lamp',
  'Reading Light',
  'Night Light',
  'Passage Light',
  'Accent Light',
];

export const TouchPanelLayout = ({ switchCount, modelCode, deviceName }: TouchPanelProps) => {
  const [switchStates, setSwitchStates] = useState<boolean[]>(() => 
    Array.from({ length: switchCount }, (_, i) => i === 0 || i === 2)
  );

  const toggleSwitch = (index: number) => {
    setSwitchStates(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const allOn = () => setSwitchStates(Array(switchCount).fill(true));
  const allOff = () => setSwitchStates(Array(switchCount).fill(false));

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
            <ToggleRight className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-sky-400 font-mono">
              {modelCode} • Capacitive Touch Panel
            </div>
            <div className="text-sm font-extrabold text-white">
              {deviceName || `${switchCount} Gang Switches Layout`}
            </div>
          </div>
        </div>

        {/* Quick Batch Actions */}
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          <button
            type="button"
            onClick={allOn}
            className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/40 transition-colors cursor-pointer"
          >
            All ON
          </button>
          <button
            type="button"
            onClick={allOff}
            className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
          >
            All OFF
          </button>
        </div>
      </div>

      {/* Dynamic Grid of Switches based on switchCount (e.g. 8 switches for TP8) */}
      <div className={`grid gap-2.5 ${
        switchCount <= 2 ? 'grid-cols-2' :
        switchCount <= 4 ? 'grid-cols-2' :
        switchCount <= 8 ? 'grid-cols-2 sm:grid-cols-4' :
        'grid-cols-3 sm:grid-cols-4'
      }`}>
        {Array.from({ length: switchCount }).map((_, idx) => {
          const isOn = switchStates[idx] ?? false;
          const switchLabel = DEFAULT_SWITCH_NAMES[idx] || `Switch ${idx + 1}`;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => toggleSwitch(idx)}
              className={`group relative flex flex-col justify-between p-3 rounded-2xl border transition-all duration-300 text-left cursor-pointer overflow-hidden ${
                isOn
                  ? 'bg-gradient-to-br from-sky-500/20 via-sky-950/40 to-slate-900 border-sky-400/60 shadow-[0_0_18px_rgba(14,165,233,0.35)]'
                  : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-400 opacity-90'
              }`}
            >
              {/* Top Row: Switch Number + Neon LED Indicator */}
              <div className="flex items-center justify-between w-full mb-3">
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  SW {idx + 1}
                </span>
                
                {/* Capacitive Touch Glowing LED */}
                <div className={`w-3 h-3 rounded-full transition-all duration-300 flex items-center justify-center ${
                  isOn 
                    ? 'bg-sky-400 shadow-[0_0_10px_#38bdf8]' 
                    : 'bg-slate-700 border border-slate-600'
                }`}>
                  {isOn && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                </div>
              </div>

              {/* Icon & Label */}
              <div className="space-y-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  isOn ? 'bg-sky-400 text-slate-950 shadow-sm' : 'bg-slate-700/60 text-slate-400'
                }`}>
                  <Power className="w-3.5 h-3.5" strokeWidth={2.5} />
                </div>
                <div className={`text-xs font-bold tracking-tight truncate ${isOn ? 'text-white' : 'text-slate-300'}`}>
                  {switchLabel}
                </div>
                <div className="text-[10px] font-mono">
                  {isOn ? (
                    <span className="text-sky-300 font-bold">ON</span>
                  ) : (
                    <span className="text-slate-500">OFF</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer Status Bar */}
      <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-emerald-400 font-semibold">Capacitive Grid Active</span>
        </span>
        <span className="font-mono">
          {switchStates.filter(Boolean).length} of {switchCount} Powered ON
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
// MASTER DYNAMIC UI WRAPPER COMPONENT
// -------------------------------------------------------------
interface DynamicDeviceLayoutProps {
  modelCode: string;
  deviceName?: string;
}

export const DynamicDeviceLayout = ({ modelCode, deviceName }: DynamicDeviceLayoutProps) => {
  const registered = MODEL_REGISTRY[modelCode] || MODEL_REGISTRY['TP8'];

  switch (registered.layoutType) {
    case 'touch_panel':
      return (
        <TouchPanelLayout 
          switchCount={registered.switchCount || 8} 
          modelCode={modelCode}
          deviceName={deviceName}
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
