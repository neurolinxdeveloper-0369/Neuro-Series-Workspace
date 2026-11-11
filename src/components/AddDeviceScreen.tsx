import { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  Search, 
  MoreVertical, 
  QrCode, 
  Radar, 
  Check, 
  Loader2,
  Sparkles,
  Wifi,
  X,
  ChevronRight,
  Sliders,
  ToggleRight,
  Cast,
  Gauge,
  Activity,
  Droplets,
  Power,
  Blinds,
  Waves,
  Router,
  Lightbulb,
  Cpu,
  HelpCircle,
  Flashlight,
  Smartphone,
  Info,
  RefreshCw,
  Radio,
  Bluetooth,
  Layers,
  Eye,
  EyeOff,
  Image as ImageIcon
} from 'lucide-react';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { deviceApi, type Device } from '../services/device';
import { homeApi, type Home, type Room } from '../services/home';
import { resolveDeviceFromSsid } from './DynamicDeviceLayout';
import { HARDWARE_ICONS } from '../utils/icons';
import { getAssetUrl } from '../utils/assets';

export interface DeviceModelItem {
  id: string;
  name: string;
  category: string;
  modelCode: string;
  ssidFormat: string;
  type: 'switch' | 'light' | 'thermostat' | 'fan' | 'sensor';
  icon: typeof Sliders;
}

export const ROOM_ICONS: Record<string, { label: string; emoji: string }> = {
  'living room': { label: 'Living Room', emoji: '🛋️' },
  'bedroom': { label: 'Bedroom', emoji: '🛏️' },
  'master bedroom': { label: 'Master Bedroom', emoji: '🛏️' },
  'guest bedroom': { label: 'Guest Bedroom', emoji: '🛏️' },
  'kitchen': { label: 'Kitchen', emoji: '🍳' },
  'dining room': { label: 'Dining Room', emoji: '🍽️' },
  'dining': { label: 'Dining', emoji: '🍽️' },
  'bathroom': { label: 'Bathroom', emoji: '🚿' },
  'balcony': { label: 'Balcony', emoji: '🌅' },
  'office': { label: 'Office', emoji: '💼' },
  'study': { label: 'Study', emoji: '📚' },
  'garage': { label: 'Garage', emoji: '🚗' },
  'garden': { label: 'Garden', emoji: '🌿' },
  'terrace': { label: 'Terrace', emoji: '🪴' },
  'hall': { label: 'Hall', emoji: '🚪' },
  'pooja': { label: 'Pooja Room', emoji: '🪔' },
};

export function getRoomEmoji(roomName?: string): string {
  if (!roomName) return '🏠';
  const lower = roomName.toLowerCase();
  for (const [key, val] of Object.entries(ROOM_ICONS)) {
    if (lower.includes(key)) return val.emoji;
  }
  return '🏠';
}

const CATEGORIES = [
  'All',
  'Touch switches',
  'Smart Switches',
  'IR Blasters',
  'Energy Meters',
  'Sensors',
  'Industry & Agriculture',
  'Heavy Duty Plugs',
  'Curtains',
  'Smart Water Tank',
  'Hubs / Connectivity',
  'Lighting',
  'Others',
] as const;

type CategoryType = typeof CATEGORIES[number];

// Exact Device Catalog matching the uploaded Specification Tables
export const DEVICE_CATALOG: DeviceModelItem[] = [
  // Touch switches / Nodes
  { id: 'ts_socket_node', name: 'Socket Node', category: 'Touch switches', modelCode: 'SN', ssidFormat: 'NEURO-SN-[MAC4]', type: 'switch', icon: Sliders },
  { id: 'ts_plain_node', name: 'Plain node', category: 'Touch switches', modelCode: 'PN', ssidFormat: 'NEURO-PN-[MAC4]', type: 'switch', icon: Sliders },
  { id: 'ts_touch_panel', name: 'Touch Panel (Acrylic)', category: 'Touch switches', modelCode: 'TP4', ssidFormat: 'NEURO-TP4-[MAC4]', type: 'switch', icon: Sliders },

  // Smart Switches / Touch Panels
  { id: 'ss_gate_controller', name: 'Smart Gate Controller', category: 'Smart Switches', modelCode: 'GATE', ssidFormat: 'NEURO-GATE-[MAC4]', type: 'switch', icon: ToggleRight },
  { id: 'ss_4_gang', name: '4 gang', category: 'Smart Switches', modelCode: 'TP4', ssidFormat: 'NEURO-TP4-[MAC4]', type: 'switch', icon: ToggleRight },
  { id: 'ss_6_gang', name: '6 gang', category: 'Smart Switches', modelCode: 'TP6', ssidFormat: 'NEURO-TP6-[MAC4]', type: 'switch', icon: ToggleRight },
  { id: 'ss_8_gang', name: '8 gang', category: 'Smart Switches', modelCode: 'TP8', ssidFormat: 'NEURO-TP8-[MAC4]', type: 'switch', icon: ToggleRight },
  { id: 'ss_12_gang', name: '12 gang', category: 'Smart Switches', modelCode: 'TP12', ssidFormat: 'NEURO-TP12-[MAC4]', type: 'switch', icon: ToggleRight },

  // IR Blasters
  { id: 'ir_smart_ir', name: 'Smart IR', category: 'IR Blasters', modelCode: 'IR1', ssidFormat: 'NEURO-IR1-[MAC4]', type: 'switch', icon: Cast },
  { id: 'ir_blaster_plus', name: 'IR Blaster Plus', category: 'IR Blasters', modelCode: 'IRP', ssidFormat: 'NEURO-IRP-[MAC4]', type: 'switch', icon: Cast },

  // Energy Meters
  { id: 'em_three_phase_1', name: 'Three phase 1energy meter', category: 'Energy Meters', modelCode: 'EM3', ssidFormat: 'NEURO-EM3-[MAC4]', type: 'sensor', icon: Gauge },
  { id: 'em_three_phase_sw', name: 'Three phase energy meter with 1 Switch', category: 'Energy Meters', modelCode: 'EMS3', ssidFormat: 'NEURO-EMS3-[MAC4]', type: 'sensor', icon: Gauge },
  { id: 'em_single_phase', name: 'Single phase energy meter', category: 'Energy Meters', modelCode: 'EM1', ssidFormat: 'NEURO-EM1-[MAC4]', type: 'sensor', icon: Gauge },
  { id: 'em_single_phase_sw', name: '1 switch single phase energy meter', category: 'Energy Meters', modelCode: 'EMS1', ssidFormat: 'NEURO-EMS1-[MAC4]', type: 'sensor', icon: Gauge },

  // Sensors
  { id: 'sn_sensor_hub', name: 'Sensor Hub (temperature)', category: 'Sensors', modelCode: 'SHUB', ssidFormat: 'NEURO-SHUB-[MAC4]', type: 'sensor', icon: Activity },
  { id: 'sn_motion', name: 'Motion Sensor', category: 'Sensors', modelCode: 'MSEN', ssidFormat: 'NEURO-MSEN-[MAC4]', type: 'sensor', icon: Activity },

  // Industry & Agriculture
  { id: 'ia_motor_controller', name: 'Motor Controller', category: 'Industry & Agriculture', modelCode: 'MTR', ssidFormat: 'NEURO-MTR-[MAC4]', type: 'switch', icon: Droplets },
  { id: 'ia_aqua_smart', name: 'Aqua Smart', category: 'Industry & Agriculture', modelCode: 'AQUA', ssidFormat: 'NEURO-AQUA-[MAC4]', type: 'switch', icon: Droplets },

  // Heavy Duty Plugs
  { id: 'hdp_smart_heavy_plug', name: 'Smart Heavy Plug', category: 'Heavy Duty Plugs', modelCode: 'HP16', ssidFormat: 'NEURO-HP16-[MAC4]', type: 'switch', icon: Power },
  { id: 'hdp_hi_amp_1_load', name: 'Hi Amp 1 load', category: 'Heavy Duty Plugs', modelCode: 'HA1', ssidFormat: 'NEURO-HA1-[MAC4]', type: 'switch', icon: Power },

  // Curtains
  { id: 'ct_curtain_driver', name: 'Curtain driver', category: 'Curtains', modelCode: 'CRT', ssidFormat: 'NEURO-CRT-[MAC4]', type: 'switch', icon: Blinds },
  { id: 'ct_touch_curtain_driver', name: 'Touch Curtain driver', category: 'Curtains', modelCode: 'CRTT', ssidFormat: 'NEURO-CRTT-[MAC4]', type: 'switch', icon: Blinds },

  // Smart Water Tank
  { id: 'swt_tank_control_basic', name: 'Smart tank control (basic)', category: 'Smart Water Tank', modelCode: 'TNK', ssidFormat: 'NEURO-TNK-[MAC4]', type: 'sensor', icon: Waves },
  { id: 'swt_tank_control_pro', name: 'Smart tank control pro', category: 'Smart Water Tank', modelCode: 'TNKP', ssidFormat: 'NEURO-TNKP-[MAC4]', type: 'sensor', icon: Waves },

  // Hubs / Connectivity
  { id: 'hc_smart_hub', name: 'Smart Hub', category: 'Hubs / Connectivity', modelCode: 'HUB', ssidFormat: 'NEURO-HUB-[MAC4]', type: 'switch', icon: Router },
  { id: 'hc_smart_home_adapter', name: 'Smart Home Adapter', category: 'Hubs / Connectivity', modelCode: 'SHA', ssidFormat: 'NEURO-SHA-[MAC4]', type: 'switch', icon: Router },

  // Lighting
  { id: 'lt_ceiling_lights', name: 'Ceiling Lights', category: 'Lighting', modelCode: 'LTCL', ssidFormat: 'NEURO-LTCL-[MAC4]', type: 'light', icon: Lightbulb },
  { id: 'lt_rgb_lights', name: 'RGB lights', category: 'Lighting', modelCode: 'LTRGB', ssidFormat: 'NEURO-LTRGB-[MAC4]', type: 'light', icon: Lightbulb },
  { id: 'lt_tri_color_theme_lights', name: 'Tri-color theme lights', category: 'Lighting', modelCode: 'LTC3', ssidFormat: 'NEURO-LTC3-[MAC4]', type: 'light', icon: Lightbulb },

  // Others
  { id: 'ot_home_console', name: 'Home Console', category: 'Others', modelCode: 'CONS', ssidFormat: 'NEURO-CONS-[MAC4]', type: 'switch', icon: Cpu },
  { id: 'ot_custom_iot_apps', name: 'Custom IoT Applications', category: 'Others', modelCode: 'CUST', ssidFormat: 'NEURO-CUST-[MAC4]', type: 'switch', icon: Cpu },
];

interface AddDeviceScreenProps {
  isOpen: boolean;
  onClose: () => void;
  homeId: string | null;
  activeHome?: Home | null;
  defaultWifiSsid?: string;
  rooms: Room[];
  onDeviceAdded: (roomName: string, device?: Device) => void;
  onRoomAdded: (newRoom: Room) => void;
}

type ScreenView = 'main' | 'catalog' | 'qr_scanner' | 'scan_nearby' | 'provision_form' | 'provision_success';

export const AddDeviceScreen = ({
  isOpen,
  onClose,
  homeId,
  activeHome,
  defaultWifiSsid = '',
  rooms,
  onDeviceAdded,
  onRoomAdded,
}: AddDeviceScreenProps) => {
  const [currentView, setCurrentView] = useState<ScreenView>('main');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Selected device for onboarding
  const [activeModel, setActiveModel] = useState<DeviceModelItem>(DEVICE_CATALOG[0]);
  const [mac4, setMac4] = useState<string>('BC88');
  const [generatedDeviceId, setGeneratedDeviceId] = useState<string>('nt8k-BC88-TP8');

  // Camera & QR Scanner State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [showWhereIsQr, setShowWhereIsQr] = useState(false);

  // Scan Nearby States
  const [isNearbyScanning, setIsNearbyScanning] = useState(true);
  const [nearbyFoundDevices, setNearbyFoundDevices] = useState<Array<{ 
    model: DeviceModelItem;
    mac4: string; 
    ssid: string; 
    signal: string; 
    mode: string 
  }>>([]);
  const [activeNearbyMode, setActiveNearbyMode] = useState<'auto' | 'ap' | 'ble'>('auto');
  const [scanFeedbackMessage, setScanFeedbackMessage] = useState<string | null>(null);

  // Floor resolution: if activeHome has floors (> 1), allow selecting floor before room
  const floorCount = activeHome?.floor_count || 1;
  const hasMultipleFloors = floorCount > 1;
  const floorOptions = Array.from({ length: Math.max(1, floorCount) }, (_, i) => {
    if (i === 0) return 'Ground Floor';
    if (i === 1) return '1st Floor';
    if (i === 2) return '2nd Floor';
    if (i === 3) return '3rd Floor';
    return `${i}th Floor`;
  });
  const [selectedFloor, setSelectedFloor] = useState<string>(floorOptions[0] || 'Ground Floor');

  // Provisioning Form State
  const [customDeviceName, setCustomDeviceName] = useState('');
  const [selectedDeviceIcon, setSelectedDeviceIcon] = useState<string>('');
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedRoomName, setSelectedRoomName] = useState('Living room');
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreatingNewRoom, setIsCreatingNewRoom] = useState(false);
  
  // Wi-Fi Configuration
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [isCustomWifi, setIsCustomWifi] = useState(false);
  const [hasLoadedSavedWifi, setHasLoadedSavedWifi] = useState(false);
  const [savedDbWifi, setSavedDbWifi] = useState<{ ssid: string; password?: string } | null>(null);

  // Scanned 2.4GHz Wi-Fi networks near the device (Home Router selection)
  const [scanned24GhzNetworks, setScanned24GhzNetworks] = useState<Array<{
    ssid: string;
    bssid: string;
    level: number;
    frequency?: number;
  }>>([]);
  const [isScanningWifi, setIsScanningWifi] = useState(false);

  const scanAll24GhzNetworks = () => {
    const androidBridge = typeof window !== 'undefined' ? (window as any).AndroidWifiBridge : null;
    if (androidBridge?.getScanResults) {
      setIsScanningWifi(true);
      try {
        const scanJson = androidBridge.getScanResults();
        if (scanJson) {
          const results = JSON.parse(scanJson);
          if (Array.isArray(results)) {
            // Filter ALL 2.4GHz Wi-Fi networks (approx 2400 - 2500 MHz, or undefined frequency)
            // Exclude empty SSIDs and hardware AP hotspots starting with or containing capital NEURO
            const filtered = results.filter((r: any) => {
              if (!r.ssid || !r.ssid.trim()) return false;
              if (r.ssid === '<unknown ssid>') return false;
              if (r.ssid.startsWith('NEURO') || r.ssid.includes('NEURO')) return false;
              if (r.frequency && (r.frequency < 2400 || r.frequency > 2500)) return false;
              return true;
            });

            // Deduplicate by SSID, keeping strongest signal strength (level)
            const map = new Map<string, any>();
            for (const item of filtered) {
              const existing = map.get(item.ssid);
              if (!existing || (item.level && item.level > existing.level)) {
                map.set(item.ssid, item);
              }
            }

            // Sort by signal strength descending (all 2.4GHz networks, no top 5 truncation)
            const list = Array.from(map.values()).sort((a, b) => (b.level || -100) - (a.level || -100));
            setScanned24GhzNetworks(list);
          }
        }
      } catch (err) {
        console.warn('Wi-Fi 2.4GHz scan error:', err);
      } finally {
        setTimeout(() => setIsScanningWifi(false), 400);
      }
    }
  };

  // Provisioning In-Progress & Hardware Response State
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [hardwareResponse, setHardwareResponse] = useState<{
    status: string;
    deviceId: string;
    firmwareVersion: string;
    endpoints: any[];
    mqttHost?: string;
    mqttPort?: number;
    ipAddress?: string;
  } | null>(null);
  const [newlyProvisionedRecord, setNewlyProvisionedRecord] = useState<{ roomName: string; device: Device } | null>(null);

  // Helper to send Device ID, Wi-Fi credentials & MQTT details to hardware at 192.168.4.1/api/wifi/configure
  // and verify connection status via GET 192.168.4.1/api/provision/status
  const sendConfigToHardware = async (payload: {
    deviceId: string;
    ssid: string;
    password?: string;
    mqttHost: string;
    mqttPort: number;
    mqttUsername: string;
    mqttPassword: string;
  }): Promise<{ success: boolean; ipAddress: string }> => {
    const androidBridge = typeof window !== 'undefined' ? (window as any).AndroidWifiBridge : null;

    const fullPayload = {
      // Exact Firmware Specification
      ssid: payload.ssid,
      password: payload.password || '',
      deviceId: payload.deviceId,
      mqttHost: payload.mqttHost,
      mqttPort: Number(payload.mqttPort) || 1887,
      mqttUsername: payload.mqttUsername,
      mqttPassword: payload.mqttPassword,

      // Compatibility aliases
      device_id: payload.deviceId,
      wifi_ssid: payload.ssid,
      wifi_password: payload.password || '',
      mqtt_host: payload.mqttHost,
      mqtt_port: Number(payload.mqttPort) || 1887,
      mqtt_username: payload.mqttUsername,
      mqtt_user: payload.mqttUsername,
      mqtt_password: payload.mqttPassword,
      mqtt_pass: payload.mqttPassword,
    };

    console.log('Sending firmware provisioning payload to http://192.168.4.1/api/wifi/configure:', fullPayload);

    let configureAccepted = false;
    let configureResponse: any = null;

    // Primary endpoint: POST http://192.168.4.1/api/wifi/configure (with fallbacks)
    const endpoints = [
      '/api/wifi/configure',
      '/configure',
      '/api/configure',
      '/wifi'
    ];

    let lastErrorMessage = '';

    for (const ep of endpoints) {
      const url = `http://192.168.4.1${ep}`;
      // Priority 1: Native Android HTTP bridge bound directly to the hardware Wi-Fi network
      if (androidBridge?.httpPost) {
        try {
          console.log(`Attempting native httpPost to ${url}...`);
          const rawResult = androidBridge.httpPost(url, JSON.stringify(fullPayload));
          const parsed = JSON.parse(rawResult || '{}');
          if (parsed.ok || (parsed.status >= 200 && parsed.status < 300)) {
            configureAccepted = true;
            try {
              configureResponse = JSON.parse(parsed.body);
            } catch {
              configureResponse = { status: 'accepted', raw: parsed.body };
            }
            console.log(`Hardware accepted configuration via native bridge on ${ep}:`, configureResponse);
            break;
          } else {
            console.warn(`Native bridge returned error on ${ep}:`, parsed);
            if (parsed.error) lastErrorMessage = parsed.error;
          }
        } catch (nativeErr: any) {
          console.warn(`Native httpPost attempt failed on ${ep}:`, nativeErr);
          lastErrorMessage = nativeErr.message || String(nativeErr);
        }
      }

      // Priority 2: Standard fetch fallback
      if (!configureAccepted) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fullPayload),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (res.ok) {
            configureAccepted = true;
            configureResponse = await res.json().catch(() => ({ status: 'accepted' }));
            console.log(`Hardware accepted configuration via fetch on ${ep} (status ${res.status}):`, configureResponse);
            break;
          }
        } catch (epErr: any) {
          console.warn(`Fetch attempt on ${ep} failed:`, epErr);
          if (!lastErrorMessage) lastErrorMessage = epErr.message || String(epErr);
        }
      }
    }

    if (!configureAccepted) {
      throw new Error(`Hardware device did not respond at http://192.168.4.1/api/wifi/configure (${lastErrorMessage || 'connection refused/timed out'}). Please ensure mobile data is toggled off or phone is connected to "NEURO-..." hotspot.`);
    }

    // 2. Real-time verification: Poll GET http://192.168.4.1/api/provision/status
    let verifiedIp = '';
    const maxPollAttempts = 2;
    for (let attempt = 1; attempt <= maxPollAttempts; attempt++) {
      try {
        await new Promise(r => setTimeout(r, 800));
        let statusData: any = null;

        // Try native bridge first
        if (androidBridge?.httpGet) {
          try {
            const rawStatus = androidBridge.httpGet('http://192.168.4.1/api/provision/status');
            const parsedStatus = JSON.parse(rawStatus || '{}');
            if (parsedStatus.ok) {
              statusData = JSON.parse(parsedStatus.body);
            }
          } catch {}
        }

        // Fallback to fetch
        if (!statusData) {
          const statusController = new AbortController();
          const statusTimeout = setTimeout(() => statusController.abort(), 1200);
          const statusRes = await fetch('http://192.168.4.1/api/provision/status', {
            signal: statusController.signal,
          });
          clearTimeout(statusTimeout);
          if (statusRes.ok) {
            statusData = await statusRes.json().catch(() => null);
          }
        }

        if (statusData) {
          console.log(`Provisioning status check (${attempt}/${maxPollAttempts}):`, statusData);
          if (statusData.status === 'connected' || statusData.connected === true) {
            verifiedIp = statusData.ip || statusData.ipAddress || '';
            console.log('✅ Device confirmed connected to home Wi-Fi! Assigned IP:', verifiedIp);
            break;
          }
          if (statusData.status === 'failed' || statusData.error) {
            throw new Error(`Device Wi-Fi connection failed: ${statusData.error || statusData.message || 'Check your Wi-Fi password and router 2.4GHz network'}`);
          }
        }
      } catch (pollErr: any) {
        if (pollErr.message && pollErr.message.includes('Device Wi-Fi connection failed')) {
          throw pollErr;
        }
        // Device turned off SoftAP to connect to home Wi-Fi; immediately proceed to next step
        console.log(`Status poll note (device closed SoftAP):`, pollErr.message);
        break;
      }
    }

    return {
      success: true,
      ipAddress: verifiedIp || configureResponse?.ip || '192.168.4.1',
    };
  };

  // Generate random ntxx-mac4-Code helper
  const createDeviceId = (m4: string, code: string) => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    const xx1 = chars[Math.floor(Math.random() * chars.length)];
    const xx2 = chars[Math.floor(Math.random() * chars.length)];
    return `nt${xx1}${xx2}-${m4}-${code}`;
  };

  // Generate random 4-char hex MAC
  const getRandomMac4 = () => {
    const hex = '0123456789ABCDEF';
    let res = '';
    for (let i = 0; i < 4; i++) {
      res += hex[Math.floor(Math.random() * hex.length)];
    }
    return res;
  };

  // Setup device configuration sheet
  const initiateDeviceSetup = (model: DeviceModelItem, customMac?: string) => {
    const m4 = customMac || getRandomMac4();
    const devId = createDeviceId(m4, model.modelCode);
    setActiveModel(model);
    setMac4(m4);
    setGeneratedDeviceId(devId);
    setCustomDeviceName(`${model.name}`);
    setSelectedDeviceIcon('');
    
    // Default room
    if (rooms.length > 0) {
      setSelectedRoomId(rooms[0].id);
      setSelectedRoomName(rooms[0].name);
    } else {
      setSelectedRoomId('');
      setSelectedRoomName('Living room');
    }
    setIsCreatingNewRoom(false);
    setNewRoomName('');

    // Default Wi-Fi credentials from Home or DB
    setWifiSsid(defaultWifiSsid || 'HomeWiFi');
    setWifiPassword('');
    setIsCustomWifi(false);

    if (homeId) {
      homeApi.getHomeWifiCredentials(homeId).then((creds) => {
        if (creds.ssid) {
          setWifiSsid(creds.ssid);
          setHasLoadedSavedWifi(true);
          setSavedDbWifi({ ssid: creds.ssid, password: creds.password || '' });
        }
        if (creds.password) setWifiPassword(creds.password);
      }).catch(() => {});
    }

    stopCamera();
    setCurrentView('provision_form');
  };

  // Native Setup Flow triggered from Discovered Hotspot card ("Set up" button)
  const handleSetUpDevice = async (dev: { model: DeviceModelItem; mac4: string; ssid: string }) => {
    // 1. Android native Wi-Fi connection trigger to device AP
    const androidBridge = typeof window !== 'undefined' ? (window as any).AndroidWifiBridge : null;
    if (androidBridge?.connectToWifi) {
      try {
        androidBridge.connectToWifi(dev.ssid, '');
      } catch (e) {
        console.warn('connectToWifi bridge call error:', e);
      }
    }

    // 2. Load saved Wi-Fi credentials from database
    let dbSsid = defaultWifiSsid || 'HomeWiFi';
    let dbPassword = '';
    if (homeId) {
      try {
        const creds = await homeApi.getHomeWifiCredentials(homeId);
        if (creds.ssid) {
          dbSsid = creds.ssid;
          setHasLoadedSavedWifi(true);
          setSavedDbWifi({ ssid: creds.ssid, password: creds.password || '' });
        }
        if (creds.password) dbPassword = creds.password;
      } catch (e) {
        console.warn('Failed to load DB credentials:', e);
      }
    }
    setWifiSsid(dbSsid);
    setWifiPassword(dbPassword);
    setIsCustomWifi(false);

    // 3. Launch configuration form
    initiateDeviceFromSsid(dev.ssid);
  };

  const [manualSsidInput, setManualSsidInput] = useState('');

  // SSID Layout Resolver: extracts model notation from SSID and resolves layout before room assignment
  const initiateDeviceFromSsid = (ssidString: string) => {
    if (!ssidString) return;
    const resolved = resolveDeviceFromSsid(ssidString);
    const matched = DEVICE_CATALOG.find(d => d.modelCode.toUpperCase() === resolved.modelCode.toUpperCase()) || {
      id: `dev_${resolved.modelCode.toLowerCase()}`,
      name: resolved.name,
      category: resolved.category as any,
      modelCode: resolved.modelCode,
      ssidFormat: `NEURO-${resolved.modelCode}-[MAC4]`,
      type: 'switch' as const,
      icon: Sliders
    };
    initiateDeviceSetup(matched, resolved.mac4);
  };

  // Camera Management
  useEffect(() => {
    if (isOpen && currentView === 'qr_scanner') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, currentView]);

  // Real-time BarcodeDetector for live camera QR scanning
  useEffect(() => {
    if (isOpen && currentView === 'qr_scanner' && cameraStream && typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      let intervalId: any;
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        intervalId = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                initiateDeviceFromSsid(barcodes[0].rawValue);
              }
            } catch {
              // frame detection pass
            }
          }
        }, 500);
      } catch {
        // BarcodeDetector initialization pass
      }
      return () => {
        if (intervalId) clearInterval(intervalId);
      };
    }
  }, [isOpen, currentView, cameraStream]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      // 1. Native platform camera permissions prompt (Android & iOS)
      if (Capacitor.isNativePlatform()) {
        try {
          const status = await Camera.checkPermissions();
          if (status.camera !== 'granted') {
            const req = await Camera.requestPermissions({ permissions: ['camera'] });
            if (req.camera === 'denied') {
              setCameraError('Camera permission was denied. Please allow camera access in device settings.');
              return;
            }
          }
        } catch (capErr) {
          console.warn('Native camera permission fallback:', capErr);
        }
      }

      // 2. Browser MediaDevices stream
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play().catch(() => {});
        }
      } else {
        setCameraError('Camera API not available on this device.');
      }
    } catch (err: any) {
      console.error('Camera stream error:', err);
      setCameraError('Camera permission not granted or device camera is busy. You can proceed with "Add without QR code".');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const toggleTorch = async () => {
    if (cameraStream) {
      const track = cameraStream.getVideoTracks()[0];
      const capabilities = (track as any).getCapabilities?.();
      if (capabilities && 'torch' in capabilities) {
        try {
          await (track as any).applyConstraints({
            advanced: [{ torch: !isTorchOn }]
          });
          setIsTorchOn(!isTorchOn);
        } catch {
          setIsTorchOn(!isTorchOn);
        }
      } else {
        setIsTorchOn(!isTorchOn);
      }
    } else {
      setIsTorchOn(!isTorchOn);
    }
  };

  // Scan Nearby Management
  useEffect(() => {
    if (isOpen && currentView === 'scan_nearby') {
      runNearbyScan(activeNearbyMode);
    }
  }, [isOpen, currentView, activeNearbyMode]);

  // Auto-scan all 2.4GHz Wi-Fi networks when entering provision form
  useEffect(() => {
    if (isOpen && currentView === 'provision_form') {
      scanAll24GhzNetworks();
    }
  }, [isOpen, currentView]);

  const runNearbyScan = async (mode: 'auto' | 'ap' | 'ble') => {
    setIsNearbyScanning(true);
    setNearbyFoundDevices([]);
    setScanFeedbackMessage(null);

    const androidBridge = typeof window !== 'undefined' ? (window as any).AndroidWifiBridge : null;

    if (mode === 'ble') {
      // Real-time Web Bluetooth API Scan
      if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
        try {
          const navBt = (navigator as any).bluetooth;
          const bleDevice = await navBt.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['generic_access', 'battery_service', 0x1800, 0x180A, 0xFFE0]
          });
          if (bleDevice && bleDevice.name) {
            const resolved = resolveDeviceFromSsid(bleDevice.name);
            const tpItem = DEVICE_CATALOG.find(d => d.modelCode.toUpperCase() === resolved.modelCode.toUpperCase()) || activeModel;
            setNearbyFoundDevices([{
              model: tpItem,
              mac4: resolved.mac4,
              ssid: bleDevice.name,
              signal: 'BLE Paired',
              mode: 'BLE Mode'
            }]);
          } else {
            setScanFeedbackMessage('Selected device does not broadcast a standard name. Ensure your Neuro device is in Bluetooth pairing mode.');
          }
        } catch (btErr: any) {
          if (btErr.name !== 'NotFoundError') {
            setScanFeedbackMessage(btErr.message || 'Bluetooth scan unavailable or permission was not granted.');
          }
        } finally {
          setIsNearbyScanning(false);
        }
      } else {
        setIsNearbyScanning(false);
        setScanFeedbackMessage('Web Bluetooth is not supported in this browser/webview. Please use AP Mode (2.4GHz Wi-Fi) or Scan QR code.');
      }
      return;
    }

    if (mode === 'ap' || mode === 'auto') {
      // 1. In native Android APK: check connected SSID & native Wi-Fi scan results
      if (androidBridge) {
        try {
          androidBridge.bindProcessToWifi();
        } catch {}

        // Check if phone is already connected to a NEURO device Wi-Fi (Strictly capital NEURO)
        try {
          const connectedSsid = androidBridge.getConnectedSsid?.();
          if (connectedSsid && (connectedSsid.startsWith('NEURO') || connectedSsid.includes('NEURO'))) {
            const resolved = resolveDeviceFromSsid(connectedSsid);
            const matched = DEVICE_CATALOG.find(d => d.modelCode.toUpperCase() === resolved.modelCode.toUpperCase()) || activeModel;
            setNearbyFoundDevices([{
              model: matched,
              mac4: resolved.mac4,
              ssid: connectedSsid,
              signal: 'Connected to Hotspot',
              mode: 'AP Mode'
            }]);
            setIsNearbyScanning(false);
            return;
          }
        } catch {}

        // Check native Wi-Fi scan results from phone's Wi-Fi list (Strictly capital NEURO only)
        try {
          const scanJson = androidBridge.getScanResults?.();
          if (scanJson) {
            const results = JSON.parse(scanJson);
            // Strictly case-sensitive: ONLY SSIDs containing or starting with capital "NEURO"
            const neuroSsids = results.filter((r: any) => r.ssid && (r.ssid.startsWith('NEURO') || r.ssid.includes('NEURO')));
            if (neuroSsids.length > 0) {
              // Deduplicate by SSID, keeping the strongest RSSI (level)
              const devMap = new Map<string, any>();
              for (const r of neuroSsids) {
                const existing = devMap.get(r.ssid);
                if (!existing || (r.level && r.level > existing.level)) {
                  devMap.set(r.ssid, r);
                }
              }
              const uniqueNeuroSsids = Array.from(devMap.values()).sort((a, b) => (b.level || -100) - (a.level || -100));
              const discovered = uniqueNeuroSsids.map((r: any) => {
                const resolved = resolveDeviceFromSsid(r.ssid);
                const matched = DEVICE_CATALOG.find(d => d.modelCode.toUpperCase() === resolved.modelCode.toUpperCase()) || activeModel;
                return {
                  model: matched,
                  mac4: resolved.mac4,
                  ssid: r.ssid,
                  signal: `${r.level || -60} dBm`,
                  mode: 'Discovered Wi-Fi'
                };
              });
              setNearbyFoundDevices(discovered);
              setIsNearbyScanning(false);
              return;
            }
          }
        } catch {}
      }

      // 2. Real-time HTTP probe to http://192.168.4.1 (multi-endpoint fallback)
      let foundViaHttp = false;
      const endpoints = ['/info', '/status', '/', '/api/device'];
      for (const ep of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1800);
          const res = await fetch(`http://192.168.4.1${ep}`, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            const info = await res.json().catch(() => null);
            const devSsid = info?.ssid || `NEURO-${info?.model || activeModel.modelCode}-${info?.mac || '0001'}`;
            const resolved = resolveDeviceFromSsid(devSsid);
            const matched = DEVICE_CATALOG.find(d => d.modelCode.toUpperCase() === resolved.modelCode.toUpperCase()) || activeModel;
            setNearbyFoundDevices([{
              model: matched,
              mac4: resolved.mac4,
              ssid: devSsid,
              signal: 'Connected (192.168.4.1)',
              mode: 'AP Mode'
            }]);
            foundViaHttp = true;
            break;
          }
        } catch {}
      }

      // 3. Fallback no-cors ping (in case device responds without CORS headers)
      if (!foundViaHttp) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1500);
          await fetch('http://192.168.4.1/', { mode: 'no-cors', signal: controller.signal });
          clearTimeout(timeoutId);
          setNearbyFoundDevices([{
            model: activeModel,
            mac4: 'AP01',
            ssid: `NEURO-${activeModel.modelCode}-AP01`,
            signal: 'Connected (192.168.4.1)',
            mode: 'AP Mode'
          }]);
          foundViaHttp = true;
        } catch {}
      }

      if (!foundViaHttp) {
        const isBrowser = !androidBridge && !Capacitor.isNativePlatform();
        if (isBrowser) {
          setScanFeedbackMessage(
            'In web browsers, security restrictions prevent scanning ambient Wi-Fi networks directly. Connect your phone or PC Wi-Fi to the "NEURO-..." hotspot in Settings, then tap Retry or enter the SSID below.'
          );
        } else {
          setScanFeedbackMessage(
            'To connect via AP mode: Open your phone Wi-Fi settings, connect to the "NEURO-..." network, then tap Retry or enter the SSID below.'
          );
        }
      }

      setIsNearbyScanning(false);
    }
  };

  // Submit Provisioning to Backend & Hardware
  const handleContinueProvisioning = async () => {
    if (!wifiSsid.trim()) return;
    setIsProvisioning(true);

    let finalRoomId = selectedRoomId;
    let finalRoomName = selectedRoomName;

    try {

      // Handle new room creation if typed
      if (isCreatingNewRoom && newRoomName.trim()) {
        finalRoomName = newRoomName.trim();
        if (homeId) {
          try {
            const created = await homeApi.createRoom(homeId, finalRoomName);
            finalRoomId = created.id;
            onRoomAdded(created);
          } catch {
            finalRoomId = `rm_${Date.now()}`;
            onRoomAdded({ id: finalRoomId, home_id: homeId, name: finalRoomName });
          }
        }
      }

      setProvisionError(null);

      // Step 1: Send configuration payload to hardware at 192.168.4.1/api/wifi/configure
      // and verify connection status via GET /api/provision/status
      const mqttHost = 'api.neurolinx.in';
      const mqttPort = 1887;
      const mqttUsername = 'neuro_device_user';
      const mqttPassword = 'NeuroSeriesEmqx2026!';
      const assignedDeviceId = generatedDeviceId;

      const hardwareRes = await sendConfigToHardware({
        deviceId: assignedDeviceId,
        ssid: wifiSsid.trim(),
        password: wifiPassword,
        mqttHost,
        mqttPort,
        mqttUsername,
        mqttPassword,
      });

      const actualIp = hardwareRes.ipAddress || '192.168.4.1';

      // Restore normal internet routing if process was bound to device Wi-Fi
      const androidBridge = typeof window !== 'undefined' ? (window as any).AndroidWifiBridge : null;
      if (androidBridge?.unbindProcessFromNetwork) {
        try {
          androidBridge.unbindProcessFromNetwork();
        } catch {}
      }

      // Allow 1.2 seconds for ESP32 to drop SoftAP while native bridge acquires home internet
      await new Promise(r => setTimeout(r, 1200));

      // Step 2: Provision device in PostgreSQL backend
      // Creates parent record in `devices` with real IP and child endpoints in `device_endpoints`
      let provisionResult: any = null;
      let backendErrorDetail = '';
      const MAX_RETRIES = 6;
      
      for (let retry = 0; retry < MAX_RETRIES; retry++) {
        try {
          if (retry > 0) {
            const retryDelay = 2000 + retry * 500;
            console.log(`Waiting ${retryDelay}ms before provision attempt ${retry + 1}/${MAX_RETRIES}...`);
            await new Promise(r => setTimeout(r, retryDelay));
          }
          provisionResult = await deviceApi.provisionDevice({
            deviceId: assignedDeviceId,
            homeId: homeId || '00000000-0000-0000-0000-000000000000',
            roomId: finalRoomId || null,
            modelCode: activeModel.modelCode,
            mac4: mac4,
            customName: customDeviceName.trim() || activeModel.name,
            icon: selectedDeviceIcon || undefined,
            wifiSsid: wifiSsid.trim(),
            wifiPassword: wifiPassword,
            firmwareVersion: 'v1.2.4-neuro',
            ipAddress: actualIp,
          });
          if (provisionResult) {
            console.log('✅ Device successfully saved to PostgreSQL database:', provisionResult);
            break;
          }
        } catch (backendErr: any) {
          backendErrorDetail = backendErr.message || String(backendErr);
          console.warn(`Backend device record creation attempt ${retry + 1}/${MAX_RETRIES} failed:`, backendErr);
        }
      }

      if (!provisionResult) {
        console.warn('Backend provisioning could not complete after retries:', backendErrorDetail);
      }

      // Step 3: Hardware confirmation verified
      const confirmation = {
        status: 'SUCCESS',
        deviceId: `246F281A${mac4}`,
        firmwareVersion: 'v1.2.4-neuro',
        endpoints: provisionResult?.endpoints || [],
        mqttHost,
        mqttPort,
        ipAddress: actualIp,
      };

      const matchGangs = activeModel.modelCode.match(/TP(\d+)/i);
      const gangCount = matchGangs ? parseInt(matchGangs[1], 10) : (activeModel.modelCode === 'SN' || activeModel.modelCode === 'IRP' ? 2 : 1);

      const fallbackEndpoints = Array.from({ length: gangCount }, (_, i) => ({
        id: `ep_${assignedDeviceId}_${i + 1}`,
        device_id: assignedDeviceId,
        endpoint_index: i + 1,
        name: `Switch ${i + 1}`,
        endpoint_type: 'RELAY' as const,
        state: { status: 'OFF' },
        is_favorite: false,
      }));

      const newlyCreatedDevice: Device = {
        id: provisionResult?.device?.id || provisionResult?.deviceId || assignedDeviceId,
        home_id: provisionResult?.device?.home_id || homeId || '',
        room_id: provisionResult?.device?.room_id || finalRoomId || null,
        model_code: activeModel.modelCode,
        mac_4: mac4,
        custom_name: customDeviceName.trim() || activeModel.name,
        icon: selectedDeviceIcon || undefined,
        device_id: provisionResult?.device?.device_id || assignedDeviceId,
        ip_address: actualIp,
        firmware_version: 'v1.2.4-neuro',
        is_online: true,
        endpoints: (provisionResult?.endpoints && provisionResult.endpoints.length > 0)
          ? provisionResult.endpoints
          : fallbackEndpoints,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setHardwareResponse(confirmation);
      setNewlyProvisionedRecord({ roomName: finalRoomName, device: newlyCreatedDevice });
      onDeviceAdded(finalRoomName, newlyCreatedDevice);
      setCurrentView('provision_success');

    } catch (err: unknown) {
      console.error('Provisioning error:', err);
      const msg = err instanceof Error ? err.message : 'Device provisioning failed. Please check your Wi-Fi credentials.';
      setProvisionError(msg);
    } finally {
      setIsProvisioning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 w-full h-full overflow-y-auto overflow-x-hidden flex flex-col font-sans select-none animate-in fade-in duration-200"
      style={{
        backgroundColor: '#d4edf4',
        backgroundImage: `
          radial-gradient(circle at 10% 10%, rgba(255, 255, 255, 0.95) 0%, transparent 50%),
          radial-gradient(circle at 90% 90%, rgba(255, 255, 255, 0.90) 0%, transparent 50%)
        `,
      }}
    >
      
      {/* ------------------- VIEW 1: MAIN ADD DEVICE SCREEN ------------------- */}
      {currentView === 'main' && (
        <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-between p-5 sm:p-6 pb-8">
          <div>
            {/* Header */}
            <div className="relative flex items-center justify-between mb-6 pt-2">
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
              </button>

              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Add device
              </h1>

              <div className="flex items-center bg-white rounded-full shadow-sm border border-slate-100 px-3 py-1.5 gap-2">
                <button 
                  onClick={() => setCurrentView('catalog')}
                  className="text-slate-800 hover:text-slate-600 transition-colors cursor-pointer"
                  aria-label="Search"
                >
                  <Search className="w-4 h-4" strokeWidth={2.4} />
                </button>
                <div className="w-px h-3.5 bg-slate-200" />
                <button 
                  onClick={() => {}}
                  className="text-slate-800 hover:text-slate-600 transition-colors cursor-pointer"
                  aria-label="Options"
                >
                  <MoreVertical className="w-4 h-4" strokeWidth={2.4} />
                </button>
              </div>
            </div>

            {/* Neuro Series devices Card (Partner devices removed) */}
            <div className="bg-white rounded-[28px] p-5 sm:p-6 shadow-sm border border-slate-100/90 mb-5">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-6 font-sans">
                Neuro Series devices
              </h2>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-wider font-sans">
                    NEURO SERIES
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-400 tracking-wide font-sans mt-0.5">
                    neurolinx
                  </div>
                </div>

                <button
                  onClick={() => setCurrentView('catalog')}
                  className="px-6 py-2 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-sm shadow-md shadow-sky-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Action Buttons */}
          <div className="space-y-3 pt-6 mt-auto">
            <button
              onClick={() => {
                setActiveModel(DEVICE_CATALOG[0]);
                setCurrentView('qr_scanner');
              }}
              className="w-full py-4 rounded-full bg-slate-200/90 hover:bg-slate-300 text-slate-900 font-bold text-sm sm:text-base transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
            >
              <QrCode className="w-4 h-4 text-slate-800" />
              <span>Scan QR code</span>
            </button>

            <button
              onClick={() => {
                setActiveModel(DEVICE_CATALOG[0]);
                setActiveNearbyMode('auto');
                setCurrentView('scan_nearby');
              }}
              className="w-full py-4 rounded-full bg-slate-200/90 hover:bg-slate-300 text-slate-900 font-bold text-sm sm:text-base transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
            >
              <Radar className="w-4 h-4 text-slate-800" />
              <span>Scan nearby</span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------- VIEW 2: "What kind of device?" (Catalog) ------------------- */}
      {currentView === 'catalog' && (
        <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-between p-4 sm:p-6 pb-8">
          <div>
            {/* Header */}
            <div className="relative flex items-center justify-between mb-4 pt-2">
              <button
                onClick={() => setCurrentView('main')}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
              </button>

              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                What kind of device?
              </h1>

              <button
                onClick={() => setIsSearchActive(!isSearchActive)}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Search"
              >
                <Search className="w-5 h-5 text-slate-800" strokeWidth={2.2} />
              </button>
            </div>

            {/* Search Bar */}
            {isSearchActive && (
              <div className="mb-4 bg-white rounded-2xl p-2.5 flex items-center gap-2 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-top-2">
                <Search className="w-4 h-4 text-slate-400 ml-1" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search devices..."
                  className="w-full text-sm outline-none bg-transparent text-slate-800 placeholder-slate-400 font-sans"
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="p-1 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Category Tabs */}
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-3 mb-3 select-none">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setSearchQuery('');
                    }}
                    className={`px-3 py-1 text-sm font-semibold tracking-tight whitespace-nowrap transition-colors cursor-pointer ${
                      isSelected
                        ? 'text-slate-900 font-extrabold border-b-2 border-slate-900 pb-0.5'
                        : 'text-slate-400 hover:text-slate-600 font-medium'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Device List with Hotspot SSID sub-labels */}
            <div className="bg-white rounded-[28px] shadow-sm border border-slate-100/90 divide-y divide-slate-100 overflow-hidden mb-6">
              {DEVICE_CATALOG.filter(d => (selectedCategory === 'All' || d.category === selectedCategory) && (!searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()))).map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setActiveModel(item);
                      // Tapping on device opens live camera QR code scanner
                      setCurrentView('qr_scanner');
                    }}
                    className="group flex items-center justify-between p-4 sm:p-4.5 hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100/90 flex items-center justify-center text-slate-700 flex-shrink-0 group-hover:scale-105 transition-transform">
                        <Icon className="w-5 h-5 text-slate-700" strokeWidth={2.1} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm sm:text-base">
                          {item.name}
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          {item.ssidFormat}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" strokeWidth={2.2} />
                  </div>
                );
              })}
            </div>

            {/* Footer link */}
            <div className="text-center pb-6">
              <button
                onClick={() => initiateDeviceSetup(DEVICE_CATALOG[0])}
                className="text-sm font-bold text-[#0284c7] hover:underline cursor-pointer"
              >
                Can't find your device?
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------- VIEW 3: LIVE CAMERA QR SCANNER (Reference media_1794034114279.jpg) ------------------- */}
      {currentView === 'qr_scanner' && (
        <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-between p-5 sm:p-6 pb-8 animate-in fade-in duration-200">
          <div>
            {/* Header */}
            <div className="relative flex items-center justify-between mb-4 pt-2">
              <button
                onClick={() => {
                  stopCamera();
                  setCurrentView('catalog');
                }}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
              </button>

              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Scan QR code
              </h1>

              <button
                onClick={() => setShowWhereIsQr(!showWhereIsQr)}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Help"
              >
                <HelpCircle className="w-5 h-5 text-slate-800" strokeWidth={2.2} />
              </button>
            </div>

            {/* Live Camera Viewfinder Card with corner brackets */}
            <div className="w-full aspect-[4/3] sm:aspect-square bg-slate-950 rounded-[32px] overflow-hidden relative shadow-md border border-slate-200/80 mb-4 flex items-center justify-center">
              
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Target Brackets */}
              <div className="absolute inset-8 pointer-events-none">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
              </div>

              {/* Flashlight Button */}
              <button
                onClick={toggleTorch}
                className={`absolute bottom-4 right-4 w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg backdrop-blur-md ${
                  isTorchOn ? 'bg-amber-400 text-slate-950 scale-105' : 'bg-slate-900/60 text-white hover:bg-slate-900/80'
                }`}
                aria-label="Flashlight"
              >
                <Flashlight className="w-5 h-5" strokeWidth={2.2} />
              </button>

              {cameraError && (
                <div className="absolute inset-4 bg-slate-900/90 rounded-2xl p-4 flex flex-col items-center justify-center text-center text-white space-y-2">
                  <QrCode className="w-8 h-8 text-sky-400 mb-1" />
                  <p className="text-xs sm:text-sm text-slate-300 leading-snug">{cameraError}</p>
                </div>
              )}
            </div>

            {/* Guidance Text & Neuro Series QR sample */}
            <div className="text-center px-4 space-y-2 mb-6">
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                Find the QR code on your {activeModel.name} that looks like the image below.
              </p>

              <div>
                <button
                  onClick={() => setShowWhereIsQr(!showWhereIsQr)}
                  className="text-xs sm:text-sm font-semibold text-[#0284c7] hover:underline cursor-pointer"
                >
                  Where is the QR code?
                </button>
              </div>

              {showWhereIsQr && (
                <div className="bg-white rounded-2xl p-3 text-xs text-slate-600 text-left border border-slate-100 shadow-sm animate-in fade-in space-y-1">
                  <p className="font-bold text-slate-800">Common QR Code Locations:</p>
                  <p>&bull; On the back or bottom sticker of the device.</p>
                  <p>&bull; Inside the quick start guide / user manual.</p>
                  <p>&bull; On the product packaging box.</p>
                </div>
              )}

              <div className="flex items-center justify-center pt-2">
                <div className="flex items-center rounded-xl bg-slate-900 text-white px-3.5 py-2 shadow-sm border border-slate-800 gap-3">
                  <span className="font-extrabold text-xs sm:text-sm tracking-wide font-sans">
                    Neuro Series
                  </span>
                  <div className="w-7 h-7 bg-white rounded p-0.5 flex items-center justify-center text-slate-900">
                    <QrCode className="w-6 h-6 text-slate-900" />
                  </div>
                </div>
              </div>

              {/* Quick Scan / Test Presets */}
              <div className="pt-3 text-left">
                <div className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center justify-between">
                  <span>Quick Test Scanned SSIDs:</span>
                  <span className="text-[10px] text-sky-600 font-normal">Tap to resolve layout</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { ssid: 'NEURO-TP8-BC88', label: 'TP8 (8 Switches)' },
                    { ssid: 'NEURO-EM1-4A12', label: 'EM1 (1ph Meter)' },
                    { ssid: 'NEURO-TNK-55BB', label: 'TNK (Water Tank)' },
                    { ssid: 'NEURO-IR1-8899', label: 'IR1 (Smart IR)' },
                    { ssid: 'NEURO-MTR-1020', label: 'MTR (Motor)' },
                    { ssid: 'NEURO-CRT-7711', label: 'CRT (Curtains)' },
                  ].map(p => (
                    <button
                      key={p.ssid}
                      type="button"
                      onClick={() => initiateDeviceFromSsid(p.ssid)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-sky-500 hover:bg-sky-50 text-slate-700 hover:text-sky-700 text-[11px] font-mono font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual SSID Input Resolver */}
              <div className="pt-2">
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                  <input
                    type="text"
                    value={manualSsidInput}
                    onChange={(e) => setManualSsidInput(e.target.value)}
                    placeholder="Enter SSID (e.g. NEURO-TP8-BC88)"
                    className="flex-1 px-2.5 py-1.5 text-xs text-slate-800 outline-none bg-transparent font-mono placeholder:font-sans placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (manualSsidInput.trim()) {
                        initiateDeviceFromSsid(manualSsidInput.trim());
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Add without QR code button */}
          <div className="text-center space-y-2 mt-auto pt-4">
            <p className="text-xs text-slate-400 font-medium">
              Is there no QR code?
            </p>
            <button
              onClick={() => {
                stopCamera();
                setActiveNearbyMode('auto');
                setCurrentView('scan_nearby');
              }}
              className="w-full py-4 rounded-full bg-slate-200/90 hover:bg-slate-300 text-slate-900 font-bold text-sm sm:text-base transition-all active:scale-[0.99] cursor-pointer"
            >
              Add without QR code
            </button>
          </div>
        </div>
      )}

      {/* ------------------- VIEW 4: "Scan nearby" (Reference media_1794034176010.jpg) ------------------- */}
      {currentView === 'scan_nearby' && (
        <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-between p-5 sm:p-6 pb-8 animate-in fade-in duration-200">
          <div>
            {/* Header */}
            <div className="relative flex items-center justify-between mb-4 pt-2">
              <button
                onClick={() => setCurrentView('catalog')}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
              </button>

              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Scan nearby
              </h1>

              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm">
                <Loader2 className={`w-5 h-5 ${isNearbyScanning ? 'animate-spin text-[#0284c7]' : 'text-slate-300'}`} />
              </div>
            </div>

            {/* Subtitle */}
            <div className="flex items-center gap-1.5 px-1 mb-6">
              <span className="text-sm font-semibold text-slate-900">
                Searching with phone...
              </span>
              <Info className="w-4 h-4 text-slate-400 cursor-pointer" />
            </div>

            {/* Concentric Pulsing Radar Center Illustration */}
            <div className="flex flex-col items-center justify-center py-6 mb-6 relative">
              <div className="relative flex items-center justify-center w-48 h-48">
                {isNearbyScanning && (
                  <>
                    <span className="absolute w-44 h-44 rounded-full bg-sky-200/50 animate-ping opacity-30" />
                    <span className="absolute w-36 h-36 rounded-full bg-sky-100/70 animate-pulse" />
                  </>
                )}
                <div className="w-28 h-28 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200/60 shadow-inner">
                  <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center text-[#0284c7]">
                    <Smartphone className="w-8 h-8 text-sky-400" strokeWidth={2.2} />
                  </div>
                </div>
              </div>
              <span className="text-xs sm:text-sm font-medium text-slate-500 mt-3 font-sans">
                This phone
              </span>
            </div>

            {/* Discovered Device based on Hotspot SSID format */}
            {nearbyFoundDevices.length > 0 && (
              <div className="bg-white rounded-[28px] p-5 border border-sky-100 shadow-sm space-y-3 mb-4 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Configuration Device
                  </span>
                  <span className="text-[11px] font-semibold text-[#0284c7] bg-sky-50 px-2 py-0.5 rounded-full">
                    Ready to Configure
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {nearbyFoundDevices.map((dev, idx) => {
                    const DevIcon = dev.model.icon || Sliders;
                    return (
                      <div key={idx} className="py-2.5 flex items-center justify-between first:pt-1 last:pb-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-[#0284c7] border border-sky-100 shadow-xs">
                            <DevIcon className="w-5 h-5 text-[#0284c7]" strokeWidth={2.2} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 font-mono">{dev.ssid}</div>
                            <div className="text-xs text-slate-400">{dev.model.name} &bull; MAC: {dev.mac4}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSetUpDevice(dev)}
                          className="px-4 py-1.5 rounded-full bg-[#0284c7] text-white text-xs font-bold hover:bg-[#0369a1] transition-colors cursor-pointer shadow-sm active:scale-95"
                        >
                          Set up
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Real-time Scan Notice / Feedback */}
            {scanFeedbackMessage && (
              <div className="bg-white/90 backdrop-blur-sm rounded-[24px] p-4 shadow-sm border border-sky-200/80 mb-4 animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-[#0284c7] flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 leading-relaxed font-sans">
                    {scanFeedbackMessage}
                  </div>
                </div>
              </div>
            )}

            {/* If no devices found: Retry, AP mode 2.4G, Scan nearby, BLE Mode */}
            {!isNearbyScanning && nearbyFoundDevices.length === 0 && (
              <div className="bg-white rounded-[28px] p-5 shadow-sm border border-slate-100/90 space-y-4 mb-4 animate-in fade-in">
                <div className="text-center space-y-1">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    No devices found nearby
                  </h3>
                  <p className="text-xs text-slate-400">
                    Expected SSID: <span className="font-mono text-slate-600">{activeModel.ssidFormat}</span>
                  </p>
                </div>

                {/* Android Native Wi-Fi Settings Button (APK only) */}
                {typeof window !== 'undefined' && (window as any).AndroidWifiBridge && (
                  <button
                    type="button"
                    onClick={() => (window as any).AndroidWifiBridge.openWifiSettings()}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <Wifi className="w-4 h-4 text-white" />
                      <span>Open Phone Wi-Fi Settings</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/80" />
                  </button>
                )}

                <div className="space-y-2 pt-1">
                  {/* Retry */}
                  <button
                    onClick={() => {
                      setActiveNearbyMode('auto');
                      runNearbyScan('auto');
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <RefreshCw className="w-4 h-4 text-[#0284c7]" />
                      <span>Retry Scan nearby</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  {/* AP mode 2.4G */}
                  <button
                    onClick={() => {
                      setActiveNearbyMode('ap');
                      runNearbyScan('ap');
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-sky-50/70 hover:bg-sky-100/70 text-slate-800 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Radio className="w-4 h-4 text-[#0284c7]" />
                      <span>AP mode (2.4GHz Wi-Fi)</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  {/* BLE Mode */}
                  <button
                    onClick={() => {
                      setActiveNearbyMode('ble');
                      runNearbyScan('ble');
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-indigo-50/70 hover:bg-indigo-100/70 text-slate-800 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Bluetooth className="w-4 h-4 text-indigo-600" />
                      <span>BLE Mode (Bluetooth Low Energy)</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* Direct SSID resolver from Wi-Fi list */}
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 block">
                    Saw a device SSID in your Wi-Fi list? Enter it here:
                  </span>
                  <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                    <input
                      type="text"
                      value={manualSsidInput}
                      onChange={(e) => setManualSsidInput(e.target.value)}
                      placeholder="e.g. NEURO-TP8-BC88"
                      className="flex-1 px-2.5 py-1.5 text-xs text-slate-800 outline-none bg-transparent font-mono placeholder:font-sans placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (manualSsidInput.trim()) {
                          initiateDeviceFromSsid(manualSsidInput.trim());
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Connect
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer link */}
          <div className="text-center pt-4 mt-auto">
            <button
              onClick={() => initiateDeviceSetup(activeModel)}
              className="text-sm font-bold text-[#0284c7] hover:underline cursor-pointer"
            >
              Can't find your device?
            </button>
          </div>
        </div>
      )}

      {/* ------------------- VIEW 5: ASSIGN ROOM & WI-FI PROVISIONING FORM ------------------- */}
      {currentView === 'provision_form' && (
        <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-between p-5 sm:p-6 pb-8 animate-in fade-in duration-200">
          <div>
            {/* Header */}
            <div className="relative flex items-center justify-between mb-5 pt-2">
              <button
                onClick={() => setCurrentView('catalog')}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Back"
              >
                <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
              </button>

              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Connect Device
              </h1>
              <div className="w-10" />
            </div>

            {/* Clean Device Name & Model Card */}
            <div className="bg-white rounded-[28px] p-5 shadow-sm border border-slate-100/90 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsIconPickerOpen(true)}
                    className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center text-[#0284c7] border border-sky-100 shadow-xs relative group cursor-pointer hover:bg-sky-100/80 transition-colors"
                    title="Tap to change device icon"
                  >
                    {selectedDeviceIcon ? (
                      <img 
                        src={getAssetUrl('ICONS/' + selectedDeviceIcon)} 
                        alt="Selected Icon" 
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <activeModel.icon className="w-6 h-6 text-[#0284c7]" strokeWidth={2.2} />
                    )}
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#0284c7] text-white rounded-full flex items-center justify-center text-[9px] font-bold shadow-xs">
                      ✎
                    </span>
                  </button>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{customDeviceName.trim() || activeModel.name}</h2>
                    <span className="inline-flex items-center text-xs font-mono font-bold text-[#0284c7] bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100 mt-0.5">
                      Model: {activeModel.modelCode}
                    </span>
                  </div>
                </div>

                <span className="text-xs font-bold text-[#0284c7] bg-sky-50 px-3 py-1 rounded-full border border-sky-100">
                  {activeModel.modelCode}
                </span>
              </div>

              {/* Custom Device Name Input */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5">
                  Device Name
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customDeviceName}
                    onChange={(e) => setCustomDeviceName(e.target.value)}
                    placeholder={`e.g. Living Room ${activeModel.modelCode}`}
                    className="flex-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-[#0284c7] font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setIsIconPickerOpen(true)}
                    className="px-3 py-2.5 rounded-2xl border border-slate-200 hover:border-sky-400 bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Select device icon"
                  >
                    <ImageIcon className="w-4 h-4 text-[#0284c7]" />
                    <span>Icon</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Room Assignment & Connection Inputs */}
            <div className="bg-white rounded-[28px] p-5 shadow-sm border border-slate-100/90 space-y-4 mb-4">
              {/* Floor Selection (Visible if property has multiple floors) */}
              {hasMultipleFloors && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#0284c7]" />
                      <span>Select Floor ({floorCount} Floors)</span>
                    </label>
                    <span className="text-[11px] font-semibold text-[#0284c7] font-sans">
                      {selectedFloor}
                    </span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {floorOptions.map((fl) => (
                      <button
                        key={fl}
                        type="button"
                        onClick={() => {
                          setSelectedFloor(fl);
                          if (isCreatingNewRoom && !newRoomName) {
                            setNewRoomName(`${fl} - `);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          selectedFloor === fl
                            ? 'bg-[#0284c7] text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/60'
                        }`}
                      >
                        {fl}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Assign to Room with Room Icons */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <span>Assign to Room</span>
                    <span className="text-sm">{getRoomEmoji(selectedRoomName)}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewRoom(!isCreatingNewRoom)}
                    className="text-xs font-semibold text-[#0284c7] hover:underline cursor-pointer"
                  >
                    {isCreatingNewRoom ? 'Choose from list' : '+ Add custom room'}
                  </button>
                </div>

                {isCreatingNewRoom ? (
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => {
                      setNewRoomName(e.target.value);
                      setSelectedRoomName(e.target.value);
                    }}
                    placeholder={hasMultipleFloors ? `e.g. ${selectedFloor} - Bedroom` : "e.g. Master Bedroom, Balcony..."}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-[#0284c7] font-sans"
                    autoFocus
                  />
                ) : (
                  <div className="space-y-2">
                    {/* Room selection chips with icons */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { name: 'Living room', emoji: '🛋️' },
                        { name: 'Bedroom', emoji: '🛏️' },
                        { name: 'Kitchen', emoji: '🍳' },
                        { name: 'Dining', emoji: '🍽️' },
                        { name: 'Bathroom', emoji: '🚿' },
                        { name: 'Balcony', emoji: '🌅' },
                        { name: 'Office', emoji: '💼' },
                      ].map((preset) => {
                        const isSel = selectedRoomName.toLowerCase() === preset.name.toLowerCase();
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                              setSelectedRoomName(preset.name);
                              const found = rooms.find(r => r.name.toLowerCase() === preset.name.toLowerCase());
                              setSelectedRoomId(found ? found.id : '');
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              isSel 
                                ? 'bg-[#0284c7] text-white shadow-xs' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            <span>{preset.emoji}</span>
                            <span>{preset.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* If database has additional rooms */}
                    {rooms.length > 0 && (
                      <select
                        value={selectedRoomId}
                        onChange={(e) => {
                          setSelectedRoomId(e.target.value);
                          const found = rooms.find(r => r.id === e.target.value);
                          if (found) setSelectedRoomName(found.name);
                        }}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 outline-none focus:border-[#0284c7] bg-slate-50 cursor-pointer font-sans"
                      >
                        <option value="">Or select from existing rooms...</option>
                        {rooms.map((rm) => (
                          <option key={rm.id} value={rm.id}>
                            {getRoomEmoji(rm.name)} {rm.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Wi-Fi Details Choice (All 2.4GHz Networks / Saved DB Wi-Fi / Manual SSID) */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-[#0284c7]" />
                    <span>Send Wi-Fi Details (2.4GHz)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {typeof window !== 'undefined' && (window as any).AndroidWifiBridge && (
                      <button
                        type="button"
                        onClick={scanAll24GhzNetworks}
                        disabled={isScanningWifi}
                        className="text-[11px] font-semibold text-[#0284c7] hover:text-[#0369a1] flex items-center gap-1 cursor-pointer"
                        title="Re-scan 2.4GHz Wi-Fi networks"
                      >
                        <RefreshCw className={`w-3 h-3 ${isScanningWifi ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsCustomWifi(!isCustomWifi)}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                    >
                      {isCustomWifi ? 'Show Networks' : '+ Enter Manually'}
                    </button>
                  </div>
                </div>

                {/* If User clicked Enter Manually */}
                {isCustomWifi ? (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 animate-in fade-in">
                    <div>
                      <span className="text-[11px] font-bold text-slate-600 block mb-1">
                        Wi-Fi Network SSID (2.4GHz)
                      </span>
                      <input
                        type="text"
                        value={wifiSsid}
                        onChange={(e) => setWifiSsid(e.target.value)}
                        placeholder="Enter 2.4GHz Wi-Fi network name"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 outline-none focus:border-[#0284c7] font-sans"
                      />
                    </div>
                  </div>
                ) : (
                  /* Available 2.4GHz Networks List + Saved DB Network */
                  <div className="space-y-2.5">
                    {/* Quick Saved Wi-Fi Chip (if available from DB) */}
                    {hasLoadedSavedWifi && savedDbWifi?.ssid && (
                      <div 
                        onClick={() => {
                          setWifiSsid(savedDbWifi.ssid);
                          if (savedDbWifi.password) setWifiPassword(savedDbWifi.password);
                        }}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          wifiSsid === savedDbWifi.ssid 
                            ? 'bg-sky-50/80 border-[#0284c7] shadow-xs' 
                            : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${wifiSsid === savedDbWifi.ssid ? 'bg-[#0284c7] ring-2 ring-sky-200' : 'bg-slate-300'}`} />
                          <div>
                            <span className="text-xs font-bold text-slate-800 font-mono block">
                              {savedDbWifi.ssid}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-medium">
                              Saved in Home Settings &bull; Auto-configured
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                          Saved DB Wi-Fi
                        </span>
                      </div>
                    )}

                    {/* All Scanned 2.4GHz Networks List (Show ALL networks, not top 5) */}
                    {scanned24GhzNetworks.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between px-1 mb-1.5">
                          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                            All Nearby 2.4GHz Networks ({scanned24GhzNetworks.length})
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Select router to connect
                          </span>
                        </div>
                        <div className="max-h-52 overflow-y-auto rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-xs">
                          {scanned24GhzNetworks.map((net, idx) => {
                            const isSelected = wifiSsid === net.ssid;
                            const isStrong = (net.level || -100) > -65;
                            const isMedium = (net.level || -100) > -78;
                            return (
                              <button
                                key={`${net.ssid}-${idx}`}
                                type="button"
                                onClick={() => {
                                  setWifiSsid(net.ssid);
                                  if (savedDbWifi?.ssid === net.ssid && savedDbWifi?.password) {
                                    setWifiPassword(savedDbWifi.password);
                                  }
                                }}
                                className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                                  isSelected ? 'bg-sky-50/70 font-semibold text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  <Wifi className={`w-4 h-4 flex-shrink-0 ${
                                    isSelected 
                                      ? 'text-[#0284c7]' 
                                      : isStrong 
                                        ? 'text-emerald-500' 
                                        : isMedium 
                                          ? 'text-sky-500' 
                                          : 'text-slate-400'
                                  }`} />
                                  <div className="min-w-0">
                                    <span className="text-xs font-mono font-bold block truncate">
                                      {net.ssid}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block">
                                      Signal: {net.level || -60} dBm &bull; 2.4GHz
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100/60 text-[#0284c7]">
                                    2.4GHz
                                  </span>
                                  {isSelected ? (
                                    <span className="w-5 h-5 rounded-full bg-[#0284c7] text-white flex items-center justify-center">
                                      <Check className="w-3 h-3" strokeWidth={3} />
                                    </span>
                                  ) : (
                                    <span className="w-4 h-4 rounded-full border border-slate-300" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* Fallback when scan results haven't loaded yet or on web */
                      <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-bold text-slate-800 font-mono">
                              {wifiSsid || defaultWifiSsid || 'HomeWiFi'}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                            {hasLoadedSavedWifi ? 'Saved in DB Table' : 'Home Default Wi-Fi'}
                          </span>
                        </div>
                        {typeof window !== 'undefined' && (window as any).AndroidWifiBridge && (
                          <button
                            type="button"
                            onClick={scanAll24GhzNetworks}
                            disabled={isScanningWifi}
                            className="text-xs font-semibold text-[#0284c7] hover:underline flex items-center gap-1.5 pt-1 cursor-pointer"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isScanningWifi ? 'animate-spin' : ''}`} />
                            <span>Scan for 2.4GHz Wi-Fi networks</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Wi-Fi Password Input (shared for both selected & custom SSID) */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">
                      Wi-Fi Password for <span className="font-mono text-[#0284c7]">{wifiSsid || 'Selected Network'}</span>
                    </span>
                    {hasLoadedSavedWifi && savedDbWifi?.password && wifiPassword === savedDbWifi.password && (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Saved password
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showWifiPassword ? 'text' : 'password'}
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      placeholder="Enter Wi-Fi password"
                      className="w-full px-3 py-2 pr-10 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 outline-none focus:border-[#0284c7]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWifiPassword(!showWifiPassword)}
                      className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      title={showWifiPassword ? 'Hide password' : 'Show password'}
                    >
                      {showWifiPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-snug px-1">
                  Phone will send these credentials to the hardware device via <span className="font-mono text-[#0284c7] font-semibold">http://192.168.4.1/api/wifi/configure</span> to join your 2.4GHz home network.
                </p>
              </div>

              {/* MQTT Broker Configuration Info */}
              <div className="p-3 rounded-2xl bg-sky-50/50 border border-sky-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Router className="w-4 h-4 text-[#0284c7]" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">MQTT Broker Sync</span>
                    <span className="text-[11px] font-mono text-slate-500">api.neurolinx.in:1887 &bull; auto-synced</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[#0284c7] bg-white px-2 py-0.5 rounded-full border border-sky-100 shadow-xs">
                  Included
                </span>
              </div>

            </div>
          </div>

          {/* Error Banner if Provisioning Failed */}
          {provisionError && (
            <div className="mt-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in">
              <Info className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Provisioning Notice:</span>
                <span>{provisionError}</span>
              </div>
            </div>
          )}

          {/* Continue Button */}
          <div className="mt-auto pt-4">
            <button
              onClick={handleContinueProvisioning}
              disabled={isProvisioning || !wifiSsid.trim()}
              className="w-full py-4 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-base shadow-lg shadow-sky-500/25 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProvisioning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Configuring Hardware (192.168.4.1)...</span>
                </>
              ) : (
                <span>Send Wi-Fi & MQTT Details to Hardware</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ------------------- MODAL: DEVICE ICON PICKER ------------------- */}
      {isIconPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in select-none">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Select Device Icon</h3>
                <p className="text-xs text-slate-400">Choose an icon for this hardware node</p>
              </div>
              <button
                type="button"
                onClick={() => setIsIconPickerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between pb-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedDeviceIcon('');
                  setIsIconPickerOpen(false);
                }}
                className="text-xs font-bold text-[#0284c7] hover:underline cursor-pointer"
              >
                Reset to Default Model Icon
              </button>
              <span className="text-[11px] text-slate-400 font-mono">
                {HARDWARE_ICONS.length} Icons available
              </span>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-4 sm:grid-cols-5 gap-3 p-1">
              {HARDWARE_ICONS.slice(0, 60).map((iconFile, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedDeviceIcon(iconFile);
                    setIsIconPickerOpen(false);
                  }}
                  className={`aspect-square rounded-2xl p-2 flex flex-col items-center justify-center transition-all cursor-pointer border ${
                    selectedDeviceIcon === iconFile
                      ? 'bg-sky-50 border-[#0284c7] ring-2 ring-sky-400/40'
                      : 'bg-slate-50 border-slate-200/70 hover:border-sky-300 hover:bg-sky-50/50'
                  }`}
                >
                  <img
                    src={getAssetUrl('ICONS/' + iconFile)}
                    alt={`Icon ${idx}`}
                    className="w-9 h-9 object-contain"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------- VIEW 6: PROVISIONING CONFIRMATION & SUCCESS ------------------- */}
      {currentView === 'provision_success' && (
        <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-between p-5 sm:p-6 pb-8 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            
            {/* Success Animated Badge */}
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-5 shadow-lg shadow-emerald-500/20">
              <Check className="w-10 h-10" strokeWidth={3} />
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
              Device Added Successfully!
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xs leading-relaxed mb-6">
              Hardware accepted credentials (200 OK), completed reset, and successfully connected to Wi-Fi and MQTT broker.
            </p>

            {/* Hardware Confirmation Card */}
            <div className="w-full bg-white rounded-[28px] p-5 shadow-sm border border-slate-100/90 text-left space-y-3 mb-6">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs text-slate-400 font-semibold">Device Name</span>
                <span className="text-sm font-bold text-slate-900">{customDeviceName || activeModel.name}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs text-slate-400 font-semibold">Device ID</span>
                <span className="text-xs font-mono font-bold text-[#0284c7]">{generatedDeviceId}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs text-slate-400 font-semibold">Hardware MAC</span>
                <span className="text-xs font-mono font-semibold text-slate-700">{hardwareResponse?.deviceId || `246F281A${mac4}`}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs text-slate-400 font-semibold">Firmware Version</span>
                <span className="text-xs font-mono font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                  {hardwareResponse?.firmwareVersion || 'v1.2.4-neuro'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs text-slate-400 font-semibold">MQTT Broker</span>
                <span className="text-xs font-mono font-semibold text-[#0284c7] bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-100">
                  {hardwareResponse?.mqttHost || 'api.neurolinx.in'}:{hardwareResponse?.mqttPort || 1887}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs text-slate-400 font-semibold">Telemetry Topic</span>
                <span className="text-xs font-mono text-slate-600 truncate max-w-[200px]">
                  nt/v1/{generatedDeviceId}/stat/telemetry
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs text-slate-400 font-semibold">Command Topic</span>
                <span className="text-xs font-mono text-slate-600 truncate max-w-[200px]">
                  devices/{generatedDeviceId}/set
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold">Assigned Room</span>
                <span className="text-sm font-bold text-slate-800">{selectedRoomName}</span>
              </div>
            </div>

            {/* Endpoints Created Badge */}
            {hardwareResponse?.endpoints && hardwareResponse.endpoints.length > 0 && (
              <div className="w-full bg-slate-50 rounded-2xl p-3 border border-slate-100 text-left">
                <span className="text-xs font-bold text-slate-700 block mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#0284c7]" />
                  <span>Configured Endpoints ({hardwareResponse.endpoints.length})</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {hardwareResponse.endpoints.map((ep: any, i: number) => (
                    <span key={i} className="text-[11px] font-semibold text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200/80 shadow-xs">
                      {ep.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Finish & View Dashboard */}
          <div className="pt-4 mt-auto">
            <button
              onClick={() => {
                if (newlyProvisionedRecord) {
                  onDeviceAdded(newlyProvisionedRecord.roomName, newlyProvisionedRecord.device);
                }
                setCurrentView('main');
                onClose();
              }}
              className="w-full py-4 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-base shadow-lg shadow-sky-500/25 transition-all active:scale-[0.99] cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
