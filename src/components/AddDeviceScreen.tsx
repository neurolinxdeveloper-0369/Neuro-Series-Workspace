import { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  Search, 
  MoreVertical, 
  QrCode, 
  Radar, 
  Check, 
  Loader2,
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
  Info,
  RefreshCw,
  Layers,
  Eye,
  EyeOff,
  Image as ImageIcon
} from 'lucide-react';
import { Camera } from '@capacitor/camera';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import jsQR from 'jsqr';
import { deviceApi, type Device, type PairingConfig, type ProvisionResult } from '../services/device';
import { homeApi, type Home, type Room } from '../services/home';
import { resolveDeviceFromSsid, MODEL_REGISTRY } from './DynamicDeviceLayout';
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
  catalogOnly?: boolean;
  refreshRevision: number;
  onClose: () => void;
  homeId: string | null;
  activeHome?: Home | null;
  defaultWifiSsid?: string;
  rooms: Room[];
  onDeviceAdded: (roomName: string, device?: Device) => void;
  onRoomAdded: (newRoom: Room) => void;
}

const isSetupSsid = (ssid: unknown): ssid is string => typeof ssid === 'string' && /^(?:NEURO[-_]|(?:TP|GATE|EM|TNK)\d*[-_])[^\s]+$/i.test(ssid);

type ScreenView = 'main' | 'catalog' | 'qr_scanner' | 'scan_nearby' | 'connect_device' | 'assign_room' | 'provision_form' | 'provision_success';

export const AddDeviceScreen = ({
  isOpen,
  catalogOnly = false,
  refreshRevision,
  onClose,
  homeId,
  activeHome,
  defaultWifiSsid = '',
  rooms,
  onDeviceAdded,
  onRoomAdded,
}: AddDeviceScreenProps) => {
  const nativeProvisioning = Capacitor.isNativePlatform();
  const mobileBrowser = !nativeProvisioning && (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
  const [browserQrResult, setBrowserQrResult] = useState('');
  const [currentView, setCurrentView] = useState<ScreenView>(catalogOnly ? 'catalog' : 'main');
  const view = catalogOnly ? 'catalog' : currentView;
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
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraRequest = useRef(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [showWhereIsQr, setShowWhereIsQr] = useState(false);

  // Scan Nearby States
  const [isNearbyScanning, setIsNearbyScanning] = useState(true);
  const [nearbyFoundDevices, setNearbyFoundDevices] = useState<Array<{ 
    model?: DeviceModelItem;
    ssid: string;
    level: number;
  }>>([]);
  const scanIndicatorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [selectedHotspot, setSelectedHotspot] = useState('');
  const selectedHotspotRef = useRef('');
  const [isJoiningHotspot, setIsJoiningHotspot] = useState(false);
  const [hotspotReady, setHotspotReady] = useState(false);
  const [setupProgress, setSetupProgress] = useState('');
  const pairingConfig = useRef<PairingConfig | null>(null);
  const setupInFlight = useRef(false);

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
            // Filter Wi-Fi networks (exclude device configuration hotspots and unknown SSIDs)
            const filtered = results.filter((r: any) => {
              if (!r.ssid || !r.ssid.trim()) return false;
              if (r.ssid === '<unknown ssid>') return false;
              // Exclude NEURO device hotspots from router selection list (case-insensitive)
              if (r.ssid.toUpperCase().includes('NEURO')) return false;
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
  const confirmedPairing = useRef<{ key: string; ipAddress?: string; result?: ProvisionResult } | null>(null);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  // Helper to send Device ID, Wi-Fi credentials & MQTT details to hardware at 192.168.4.1/api/wifi/configure
  // The server confirms readiness from a fresh MQTT report after registration.
  const sendConfigToHardware = async (payload: {
    deviceId: string;
    ssid: string;
    password?: string;
    mqttHost: string;
    mqttPort: number;
    mqttUsername: string;
    mqttPassword: string;
  }): Promise<{ ipAddress?: string }> => {
    const bridge = (window as any).AndroidWifiBridge;
    const body = JSON.stringify({
      ...payload,
      password: payload.password || '',
      device_id: payload.deviceId,
      wifi_ssid: payload.ssid,
      wifi_password: payload.password || '',
      mqtt_host: payload.mqttHost,
      mqtt_port: payload.mqttPort,
      mqtt_username: payload.mqttUsername,
      mqtt_user: payload.mqttUsername,
      mqtt_password: payload.mqttPassword,
      mqtt_pass: payload.mqttPassword,
    });
    // Only try another path if the firmware explicitly says the path is unsupported.
    // A lost reply may mean the device accepted the settings and restarted.
    for (const path of ['/api/wifi/configure', '/configure', '/api/configure', '/wifi']) {
      const url = 'http://192.168.4.1' + path;
      let status: number;
      let responseBody: unknown;
      if (bridge?.httpPost) {
        const reply = JSON.parse(bridge.httpPost(url, body) || '{}');
        status = reply.status || 0;
        try { responseBody = JSON.parse(reply.body); } catch { responseBody = null; }
      } else if (Capacitor.getPlatform() === 'ios') {
        const reply = await CapacitorHttp.post({ url, data: JSON.parse(body), headers: { 'Content-Type': 'application/json' }, connectTimeout: 4000, readTimeout: 8000, disableRedirects: true });
        status = reply.status;
        responseBody = reply.data;
      } else {
        const reply = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          redirect: 'error',
          signal: AbortSignal.timeout(8000),
        });
        status = reply.status;
        responseBody = await reply.json().catch(() => null);
      }
      if ([404, 405, 501].includes(status)) continue;
      if (status < 200 || status >= 300) {
        throw new Error('The device did not confirm receiving setup. Reconnect to its setup Wi-Fi and try again.');
      }
      const data = responseBody as { status?: string; connected?: boolean; success?: boolean; error?: unknown; ip?: string; ipAddress?: string } | null;
      if (data?.status === 'failed' || data?.success === false || data?.error) {
        throw new Error('The device rejected setup. Check the Wi-Fi details and retry.');
      }
      const ip = data?.ip || data?.ipAddress;
      return { ipAddress: (data?.status === 'connected' || data?.connected === true) && ip !== '192.168.4.1' ? ip : undefined };
    }
    throw new Error('This device does not support Wi-Fi setup. Check the device firmware.');
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
  const initiateDeviceSetup = (model: DeviceModelItem, customMac?: string, loadSavedWifi = true) => {
    if (!nativeProvisioning) return;
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
    setWifiSsid(defaultWifiSsid);
    setWifiPassword('');
    setIsCustomWifi(false);

    if (homeId && loadSavedWifi) {
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

  const joinHotspot = async (ssid: string) => {
    const bridge = (window as any).AndroidWifiBridge;
    setHotspotReady(false);
    setIsJoiningHotspot(true);
    setProvisionError(null);
    try {
      if (bridge?.getConnectedSsid?.() === ssid) {
        setHotspotReady(true);
        return;
      }
      if (bridge?.connectToWifi && bridge.getSetupConnectionState) {
        bridge.connectToWifi(ssid, '');
        for (let attempt = 0; attempt < 35; attempt++) {
          if (selectedHotspotRef.current !== ssid) return;
          const status = bridge.getSetupConnectionState(ssid);
          if (status === 'connected') {
            setHotspotReady(true);
            return;
          }
          if (status === 'unavailable') break;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      setProvisionError('Join ' + ssid + ' in Wi-Fi Settings, then return and tap Check connection.');
    } finally {
      setIsJoiningHotspot(false);
    }
  };

  const checkHotspot = async () => {
    setProvisionError(null);
    try {
      const bridge = (window as any).AndroidWifiBridge;
      if (bridge?.getConnectedSsid?.() === selectedHotspot ||
          bridge?.getSetupConnectionState?.(selectedHotspot) === 'connected') {
        setHotspotReady(true);
        return true;
      }
      if (!bridge) {
        for (const path of ['/info', '/api/device', '/status']) {
          try {
            const url = 'http://192.168.4.1' + path;
            let info;
            if (Capacitor.getPlatform() === 'ios') {
              const res = await CapacitorHttp.get({ url, connectTimeout: 1500, readTimeout: 1500, disableRedirects: true });
              info = res.status === 200 ? res.data : null;
            } else {
              const res = await fetch(url, { signal: AbortSignal.timeout(1500), redirect: 'error' });
              info = res.ok ? await res.json() : null;
            }
            // The reported SSID must match the selected setup network.
            const reported = info?.ssid || (info?.model && info?.mac && `NEURO-${info.model}-${info.mac}`);
            if (reported === selectedHotspot) {
              setHotspotReady(true);
              return true;
            }
          } catch { /* try the next identification path */ }
        }
      }
    } catch { /* show the same actionable retry message */ }
    setHotspotReady(false);
    setProvisionError('Not connected to ' + selectedHotspot + '. Join it in Wi-Fi Settings and try again.');
    return false;
  };

  const handleSetUpDevice = async (ssid: string) => {
    if (!nativeProvisioning) return;
    if (setupInFlight.current) return;
    setProvisionError(null);
    if (!homeId) {
      setScanFeedbackMessage('Choose a location before adding a device.');
      return;
    }
    setupInFlight.current = true;
    setSelectedHotspot(ssid);
    selectedHotspotRef.current = ssid;
    setIsJoiningHotspot(true);
    setHotspotReady(false);
    confirmedPairing.current = null;
    pairingConfig.current = null;
    try {
      const [config, saved] = await Promise.all([
        deviceApi.getPairingConfig(homeId),
        homeApi.getHomeWifiCredentials(homeId).catch(() => null),
      ]);
      if (selectedHotspotRef.current !== ssid) return;
      pairingConfig.current = config;
      initiateDeviceFromSsid(ssid, false);
      setCurrentView('connect_device');
      setWifiSsid(saved?.ssid || defaultWifiSsid);
      setWifiPassword(saved?.password || '');
      await joinHotspot(ssid);
    } catch {
      if (selectedHotspotRef.current !== ssid) return;
      setScanFeedbackMessage('Couldn’t prepare setup. Reconnect your phone to the internet, then select the device network again.');
      setSelectedHotspot('');
      selectedHotspotRef.current = '';
      setCurrentView('scan_nearby');
    } finally {
      setupInFlight.current = false;
      setIsJoiningHotspot(false);
    }
  };

  const [manualSsidInput, setManualSsidInput] = useState('');

  // SSID Layout Resolver: extracts model notation from SSID and resolves layout before room assignment
  const initiateDeviceFromSsid = (ssidString: string, loadSavedWifi = true) => {
    if (!ssidString) return;
    if (!nativeProvisioning) {
      setBrowserQrResult(ssidString);
      stopCamera();
      setCurrentView('main');
      return;
    }
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
    initiateDeviceSetup(matched, resolved.mac4, loadSavedWifi);
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

  // Real-time camera QR scanner powered by jsQR and BarcodeDetector
  useEffect(() => {
    if (!isOpen || currentView !== 'qr_scanner' || !cameraStream) {
      return;
    }

    let isScanning = true;
    let animationFrameId: number;
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;

    let nativeDetector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        nativeDetector = null;
      }
    }

    let lastScanTime = 0;

    const scanFrame = async () => {
      if (!isScanning) return;

      const video = videoRef.current;
      const now = performance.now();

      if (video && video.readyState >= 2 && now - lastScanTime >= 140) {
        lastScanTime = now;
        try {
          let detectedText: string | null = null;

          // 1. Try native BarcodeDetector if supported by the browser/engine
          if (nativeDetector) {
            try {
              const barcodes = await nativeDetector.detect(video);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                detectedText = barcodes[0].rawValue;
              }
            } catch {}
          }

          // 2. jsQR software engine fallback (Works in 100% of Android WebViews & browsers)
          if (!detectedText && video.videoWidth > 0 && video.videoHeight > 0) {
            if (!canvas) {
              canvas = document.createElement('canvas');
              ctx = canvas.getContext('2d', { willReadFrequently: true });
            }
            if (ctx && canvas) {
              const maxDim = 640;
              let w = video.videoWidth;
              let h = video.videoHeight;
              if (w > maxDim || h > maxDim) {
                if (w > h) {
                  h = Math.round((h * maxDim) / w);
                  w = maxDim;
                } else {
                  w = Math.round((w * maxDim) / h);
                  h = maxDim;
                }
              }
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const imgData = ctx.getImageData(0, 0, w, h);
              const qr = jsQR(imgData.data, imgData.width, imgData.height, {
                inversionAttempts: 'dontInvert'
              });
              if (qr && qr.data && qr.data.trim()) {
                detectedText = qr.data.trim();
              }
            }
          }

          if (detectedText) {
            console.log('✅ QR Code successfully scanned:', detectedText);
            isScanning = false;
            try {
              if (navigator.vibrate) navigator.vibrate(80);
            } catch {}
            initiateDeviceFromSsid(detectedText);
            return;
          }
        } catch (frameErr) {
          console.warn('QR scan frame error:', frameErr);
        }
      }

      animationFrameId = requestAnimationFrame(scanFrame);
    };

    animationFrameId = requestAnimationFrame(scanFrame);

    return () => {
      isScanning = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen, currentView, cameraStream]);

  // Gallery Image QR Upload Decoder
  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: 'attemptBoth'
          });
          if (code && code.data && code.data.trim()) {
            console.log('✅ QR Decoded from uploaded photo:', code.data);
            try {
              if (navigator.vibrate) navigator.vibrate(80);
            } catch {}
            initiateDeviceFromSsid(code.data.trim());
          } else {
            alert('Could not find a valid QR code in this image. Please ensure the QR code is clear and in focus.');
          }
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    const request = ++cameraRequest.current;
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
      if (request !== cameraRequest.current) return;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }
        });
        if (request !== cameraRequest.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        cameraStreamRef.current?.getTracks().forEach(track => track.stop());
        cameraStreamRef.current = stream;
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
      if (request !== cameraRequest.current) return;
      console.error('Camera stream error:', err);
      setCameraError(nativeProvisioning
        ? 'Camera permission not granted or device camera is busy. You can proceed with "Add without QR code".'
        : 'Allow camera access in your browser settings, then try scanning again.');
    }
  };

  const stopCamera = () => {
    cameraRequest.current++;
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
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

  const readNearbyNetworks = (refresh: boolean) => {
    const bridge = (window as any).AndroidWifiBridge;
    if (!bridge?.getScanResults && !bridge?.getSetupScanResults) return;
    try {
      const raw = bridge.getSetupScanResults ? bridge.getSetupScanResults(refresh) : bridge.getScanResults();
      const results = JSON.parse(raw || '[]');
      if (!Array.isArray(results)) throw new Error('Invalid scan results');
      const networks = new Map<string, { ssid: string; level: number }>();
      for (const item of results) {
        if (typeof item?.ssid !== 'string' || !item.ssid.trim() || item.ssid === '<unknown ssid>') continue;
        const level = Number.isFinite(item.level) ? item.level : -100;
        const previous = networks.get(item.ssid);
        if (!previous || level > previous.level) networks.set(item.ssid, { ssid: item.ssid, level });
      }
      const connected = bridge.getConnectedSsid?.();
      if (typeof connected === 'string' && connected.trim() && connected !== '<unknown ssid>' && !networks.has(connected)) {
        networks.set(connected, { ssid: connected, level: -100 });
      }
      const sorted = [...networks.values()].sort((a, b) => b.level - a.level);
      setNearbyFoundDevices(sorted.map(({ ssid, level }) => {
        const resolved = isSetupSsid(ssid) ? resolveDeviceFromSsid(ssid) : null;
        const model = resolved ? DEVICE_CATALOG.find(device => device.modelCode.toUpperCase() === resolved.modelCode.toUpperCase()) : undefined;
        return { model, ssid, level };
      }));
      setScanFeedbackMessage(sorted.length ? null : 'No networks reported yet. Turn on Wi-Fi and Location and allow Wi-Fi scan permissions. This list updates automatically.');
    } catch {
      setScanFeedbackMessage('Couldn’t read nearby networks. Check Wi-Fi and Location permissions or open Wi-Fi Settings.');
    }
  };

  const runNearbyScan = () => {
    const bridge = (window as any).AndroidWifiBridge;
    if (!bridge?.getScanResults && !bridge?.getSetupScanResults) {
      setIsNearbyScanning(false);
      return;
    }
    clearTimeout(scanIndicatorTimer.current);
    setIsNearbyScanning(true);
    readNearbyNetworks(true);
    scanIndicatorTimer.current = setTimeout(() => setIsNearbyScanning(false), 6000);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (currentView !== 'scan_nearby') {
      if (currentView === 'provision_form' && !selectedHotspot) scanAll24GhzNetworks();
      return;
    }
    runNearbyScan();
    const updated = () => {
      if (document.visibilityState === 'hidden') return;
      readNearbyNetworks(false);
      clearTimeout(scanIndicatorTimer.current);
      setIsNearbyScanning(false);
    };
    const requestScan = () => {
      if (document.visibilityState !== 'hidden') runNearbyScan();
    };
    const latestResults = setInterval(() => {
      if (document.visibilityState !== 'hidden') readNearbyNetworks(false);
    }, 2000);
    const activeScan = setInterval(requestScan, 31000);
    window.addEventListener('neuro-wifi-scan-results', updated);
    document.addEventListener('visibilitychange', requestScan);
    return () => {
      clearTimeout(scanIndicatorTimer.current);
      clearInterval(latestResults);
      clearInterval(activeScan);
      window.removeEventListener('neuro-wifi-scan-results', updated);
      document.removeEventListener('visibilitychange', requestScan);
    };
  }, [isOpen, currentView, refreshRevision]);
  const leaveNearbySetup = () => {
    selectedHotspotRef.current = '';
    setSelectedHotspot('');
    setManualSsidInput('');
    pairingConfig.current = null;
    confirmedPairing.current = null;
    setWifiPassword('');
    setHotspotReady(false);
    setProvisionError(null);
    (window as any).AndroidWifiBridge?.unbindProcessFromNetwork?.();
  };

  const handleContinueProvisioning = async () => {
    if (!nativeProvisioning) return;
    if (isProvisioning || !wifiSsid.trim() || !homeId ||
        (selectedHotspot && !hotspotReady && !confirmedPairing.current)) return;
    setIsProvisioning(true);
    setProvisionError(null);
    const key = JSON.stringify([homeId, generatedDeviceId, wifiSsid.trim()]);
    let attempt = confirmedPairing.current;
    try {
      if (attempt?.key !== key) {
        setSetupProgress('Sending setup to your device…');
        const bridge = (window as any).AndroidWifiBridge;
        if (selectedHotspot && bridge &&
            bridge.getSetupConnectionState?.(selectedHotspot) !== 'connected' &&
            bridge.getConnectedSsid?.() !== selectedHotspot) {
          throw new Error('The setup Wi-Fi disconnected. Join it again before continuing.');
        }
        const config = pairingConfig.current || await deviceApi.getPairingConfig(homeId);
        const hardware = await sendConfigToHardware({ ...config, deviceId: generatedDeviceId, ssid: wifiSsid.trim(), password: wifiPassword });
        attempt = { key, ipAddress: hardware.ipAddress };
        confirmedPairing.current = attempt;
      }
      (window as any).AndroidWifiBridge?.unbindProcessFromNetwork?.();
      setSetupProgress('Waiting for the device to restart and come online…');

      let roomId = selectedRoomId;
      let roomName = selectedRoomName;
      if (!attempt.result) {
        // Switching off the setup network can take a moment on phones without cellular data.
        await new Promise(resolve => setTimeout(resolve, 700));
        if (isCreatingNewRoom && newRoomName.trim()) {
          const created = await homeApi.createRoom(homeId, newRoomName.trim());
          roomId = created.id;
          roomName = created.name;
          setSelectedRoomId(roomId);
          setSelectedRoomName(roomName);
          setIsCreatingNewRoom(false);
          onRoomAdded(created);
        }
        attempt.result = await deviceApi.provisionDevice({
          deviceId: generatedDeviceId,
          homeId,
          roomId: roomId || null,
          modelCode: activeModel.modelCode,
          mac4,
          customName: customDeviceName.trim() || activeModel.name,
          icon: selectedDeviceIcon || undefined,
          wifiSsid: wifiSsid.trim(),
          firmwareVersion: 'v1.2.4-neuro',
          ipAddress: attempt.ipAddress,
        });
      }
      const result = attempt.result;
      let lastSeenAt: string | null = null;
      if (!result.verificationFrom) throw new Error('Setup was sent, but the server cannot confirm it yet. Update the backend and try again.');
      const deadline = performance.now() + 40_000;
      while (!lastSeenAt && performance.now() < deadline) {
        try {
          const status = await deviceApi.getPairingStatus(result.deviceId, result.verificationFrom);
          if (status.online) lastSeenAt = status.lastSeenAt;
        } catch { /* the phone may still be reconnecting to the internet */ }
        if (!lastSeenAt && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 1500));
      }
      if (!lastSeenAt) throw new Error('Setup was sent, but the device hasn’t come online. Check its power and Wi-Fi, then tap Check again.');
      onDeviceAdded(roomName, { ...result.device, is_online: true, last_seen_at: lastSeenAt, endpoints: result.endpoints });
      leaveNearbySetup();
      setCurrentView('provision_success');
    } catch (err) {
      if (confirmedPairing.current && !confirmedPairing.current.result &&
          !(err instanceof Error && err.message.includes('server cannot confirm'))) {
        setProvisionError('Setup was sent. Reconnect your phone to the internet, then tap Check again.');
      } else {
        setProvisionError(err instanceof Error ? err.message : 'Setup didn’t finish. Check your Wi-Fi and try again.');
      }
      if (!confirmedPairing.current) setHotspotReady(false);
    } finally {
      if (confirmedPairing.current) pairingConfig.current = null;
      (window as any).AndroidWifiBridge?.unbindProcessFromNetwork?.();
      setIsProvisioning(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    return () => {
      selectedHotspotRef.current = '';
      pairingConfig.current = null;
      (window as any).AndroidWifiBridge?.unbindProcessFromNetwork?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  if (!nativeProvisioning) return (
    <div className="app-screen screen-top-container fixed inset-0 z-50 flex flex-col overflow-y-auto">
      <section className="mx-auto flex w-full max-w-md flex-1 flex-col p-5 sm:p-6">
        <header className="mb-6 flex items-center gap-4">
          <button type="button" aria-label="Back" data-screen-back onClick={() => {
            if (currentView === 'qr_scanner') { stopCamera(); setCurrentView('main'); }
            else onClose();
          }} className="grid size-11 shrink-0 place-items-center rounded-full bg-white">
            <ChevronLeft />
          </button>
          <h1 className="text-xl font-bold">{currentView === 'qr_scanner' && mobileBrowser ? 'Scan QR code' : 'Add device'}</h1>
        </header>
        <div className="my-auto space-y-5 pb-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 text-center">
            <h2 className="text-lg font-bold">Device setup is unsupported in this browser</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Use the installed Neuro Touch app to add devices and connect them to Wi-Fi.
              {mobileBrowser && ' You can scan a QR code here to read its details.'}
            </p>
          </div>
          {mobileBrowser && currentView === 'qr_scanner' && (
            <div className="space-y-3">
              <video ref={videoRef} autoPlay playsInline muted
                aria-label="QR camera preview" className="aspect-square w-full rounded-3xl bg-slate-100 object-cover" />
              {cameraError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{cameraError}</p>}
              <p className="text-center text-sm text-slate-600">Point the camera at the QR code on your device.</p>
            </div>
          )}
          {mobileBrowser && currentView !== 'qr_scanner' && (
            <button type="button" onClick={() => { setBrowserQrResult(''); setCurrentView('qr_scanner'); }}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-sky-700 px-4 font-semibold text-white">
              <QrCode className="size-5" />Scan QR code
            </button>
          )}
          {mobileBrowser && browserQrResult && currentView !== 'qr_scanner' && (
            <div role="status" className="rounded-2xl bg-white p-4">
              <h2 className="font-semibold">QR code scanned</h2>
              <p className="mt-2 break-all text-sm text-slate-700">{browserQrResult}</p>
              <p className="mt-3 text-sm text-slate-600">Open the installed Neuro Touch app to finish adding this device.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );

  return (
    <div 
      className="app-screen screen-top-container fixed inset-0 z-50 w-full h-full overflow-y-auto overflow-x-hidden flex flex-col font-sans select-none animate-in fade-in duration-200"
    >
      
      {/* ------------------- VIEW 1: MAIN ADD DEVICE SCREEN ------------------- */}
      {view === 'main' && (
        <div className="w-full max-w-md mx-auto flex flex-1 flex-col p-5 sm:p-6">
          <div>
            {/* Header */}
            <div className="relative flex items-center justify-between mb-6 pt-2">
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Back" data-screen-back
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

            {/* Neuro Touch devices Card (Partner devices removed) */}
            <div className="bg-white rounded-[28px] p-5 sm:p-6 shadow-sm border border-slate-100/90 mb-5">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-6 font-sans">
                Neuro Touch devices
              </h2>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-wider font-sans">
                    NEURO TOUCH
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-400 tracking-wide font-sans mt-0.5">
                    neurolinx
                  </div>
                </div>

                <button
                  onClick={() => setCurrentView('catalog')}
                  className="px-6 py-2 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-sm shadow-md shadow-sky-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  Browse models
                </button>
              </div>
            </div>
          </div>

          {/* Centered device setup actions */}
          <div className="my-auto space-y-3 py-6">
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
                setCurrentView('scan_nearby');
              }}
              className="w-full py-4 rounded-full bg-slate-200/90 hover:bg-slate-300 text-slate-900 font-bold text-sm sm:text-base transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
            >
              <Radar className="w-4 h-4 text-slate-800" />
              <span>Find nearby device</span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------- VIEW 2: "What kind of device?" (Catalog) ------------------- */}
      {view === 'catalog' && (
        <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-between p-4 sm:p-6 pb-8">
          <div>
            {/* Header */}
            <div className="relative flex items-center justify-between mb-4 pt-2">
              <button
                onClick={() => catalogOnly ? onClose() : setCurrentView('main')}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Back" data-screen-back
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
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-3 select-none" aria-label="Device categories">
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
                const Entry = catalogOnly ? 'div' : 'button';
                const controlAvailable = ['touch_panel', 'energy_meter', 'gate_controller'].includes(MODEL_REGISTRY[item.modelCode]?.layoutType ?? '');
                return (
                  <Entry
                    key={item.id}
                    onClick={catalogOnly ? undefined : () => {
                      setActiveModel(item);
                      // Tapping on device opens live camera QR code scanner
                      setCurrentView('qr_scanner');
                    }}
                    className="group flex w-full items-center justify-between gap-2 p-4 text-left sm:p-5 hover:bg-slate-50/80"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100/90 flex items-center justify-center text-slate-700 flex-shrink-0 group-hover:scale-105 transition-transform">
                        <Icon className="w-5 h-5 text-slate-700" strokeWidth={2.1} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm sm:text-base">
                          {item.name}
                        </div>
                        <div className="text-xs text-slate-600 font-mono mt-0.5">
                          {item.ssidFormat}
                        </div>
                      </div>
                    </div>
                    {catalogOnly
                      ? <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{controlAvailable ? 'Model controls' : 'Firmware-dependent'}</span>
                      : <ChevronRight className="w-4 h-4 shrink-0 text-slate-500" strokeWidth={2.2} />}
                  </Entry>
                );
              })}
            </div>

            {/* Footer link */}
            {!catalogOnly && <div className="text-center pb-6">
              <button
                onClick={() => initiateDeviceSetup(DEVICE_CATALOG[0])}
                className="text-sm font-bold text-[#0284c7] hover:underline cursor-pointer"
              >
                Enter a setup code manually
              </button>
            </div>}
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
                aria-label="Back" data-screen-back
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
            <div className="w-full aspect-[4/3] sm:aspect-square bg-slate-50 rounded-[32px] overflow-hidden relative shadow-md border border-slate-200/80 mb-4 flex items-center justify-center">
              
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

              {/* Animated Laser Scanning Line */}
              <div className="absolute inset-8 pointer-events-none overflow-hidden flex flex-col justify-center">
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_12px_#38bdf8] animate-pulse" />
              </div>

              {/* Viewfinder Bottom Controls: Choose Photo & Torch */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
                <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/95 hover:bg-white text-slate-900 text-xs font-semibold backdrop-blur-md cursor-pointer transition-all shadow-md active:scale-95">
                  <ImageIcon className="w-4 h-4 text-sky-400" />
                  <span>Choose Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleQrImageUpload}
                  />
                </label>

                {/* Flashlight Button */}
                <button
                  onClick={toggleTorch}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg backdrop-blur-md ${
                    isTorchOn ? 'bg-amber-400 text-slate-950 scale-105' : 'bg-white/95 text-slate-900 hover:bg-white'
                  }`}
                  aria-label="Flashlight"
                >
                  <Flashlight className="w-5 h-5" strokeWidth={2.2} />
                </button>
              </div>

              {cameraError && (
                <div className="absolute inset-4 bg-white/95 rounded-2xl p-4 flex flex-col items-center justify-center text-center text-slate-900 space-y-2">
                  <QrCode className="w-8 h-8 text-sky-400 mb-1" />
                  <p className="text-xs sm:text-sm text-slate-300 leading-snug">{cameraError}</p>
                </div>
              )}
            </div>

            {/* Guidance Text & Neuro Touch QR sample */}
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
                <div className="flex items-center rounded-xl bg-slate-50 text-slate-900 px-3.5 py-2 shadow-sm border border-slate-200 gap-3">
                  <span className="font-extrabold text-xs sm:text-sm tracking-wide font-sans">
                    Neuro Touch
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
                    { ssid: 'NEURO-EMS1-A1B2', label: 'EMS1 (1ph Meter + Switch)' },
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
                setCurrentView('scan_nearby');
              }}
              className="w-full py-4 rounded-full bg-slate-200/90 hover:bg-slate-300 text-slate-900 font-bold text-sm sm:text-base transition-all active:scale-[0.99] cursor-pointer"
            >
              Add without QR code
            </button>
          </div>
        </div>
      )}

      {currentView === 'scan_nearby' && (
        <section className="mx-auto w-full max-w-md p-5 pb-12">
          <button type="button" aria-label="Back" data-screen-back onClick={() => { leaveNearbySetup(); setCurrentView('main'); }}
            className="mb-5 rounded-full bg-white p-2"><ChevronLeft /></button>
          <div className="mb-6 text-center">
            <Radar aria-hidden="true" className="mx-auto mb-3 size-10 text-sky-600" />
            <h1 className="text-xl font-bold">
              {isNearbyScanning ? 'Finding your device' : 'Choose your device'}
              {isNearbyScanning && <span aria-hidden="true" className="ml-1 inline-flex gap-0.5">
                {[0, 1, 2].map(index => <span key={index} className="motion-safe:animate-pulse"
                  style={{ animationDelay: index * 250 + 'ms' }}>.</span>)}
              </span>}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Keep your phone close to the device. Turn on the device and put it in Wi-Fi setup mode.
            </p>
            {isNearbyScanning && <p role="status" className="sr-only">Scanning nearby Wi-Fi networks</p>}
          </div>
          <p className="mb-4 text-xs leading-relaxed text-slate-600">
            All network names reported by your phone are shown here, strongest signal first. This list updates as Android scans.
          </p>
          {!!nearbyFoundDevices.length && <h2 className="mb-3 text-sm font-semibold">Nearby Wi-Fi networks ({nearbyFoundDevices.length})</h2>}
          {nearbyFoundDevices.map(device => (
            <button key={device.ssid} type="button"
              aria-label={isSetupSsid(device.ssid) ? 'Select ' + device.ssid : device.ssid}
              disabled={!isSetupSsid(device.ssid) || isJoiningHotspot}
              onClick={() => void handleSetUpDevice(device.ssid)}
              className="mb-3 block w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm enabled:hover:border-sky-400">
              <div className="flex items-start gap-3">
                <Wifi aria-hidden="true" className="mt-1 size-5 shrink-0 text-sky-700" />
                <div className="min-w-0 flex-1">
                  <h3 className="break-all font-semibold">{device.ssid}</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {device.model?.name || (isSetupSsid(device.ssid) ? 'Device setup network' : 'Wi-Fi network')}
                  </p>
                </div>
                {isSetupSsid(device.ssid) && <ChevronRight aria-hidden="true" className="mt-1 size-5 shrink-0 text-sky-700" />}
              </div>
            </button>
          ))}
          {scanFeedbackMessage && <p role="status" className="py-3 text-sm">{scanFeedbackMessage}</p>}
          {typeof window !== 'undefined' && (window as any).AndroidWifiBridge ? (
            <button type="button" onClick={() => void runNearbyScan()} disabled={isNearbyScanning || isJoiningHotspot}
              className="my-3 min-h-11 font-semibold text-sky-700 disabled:opacity-50">Refresh networks</button>
          ) : <p className="py-3 text-sm text-slate-600">Nearby Wi-Fi scanning is available in the Android app. On this device, find the setup network in Wi-Fi Settings or on the device label and enter its name below while your phone is online.</p>}
          {(window as any).AndroidWifiBridge?.openWifiSettings && <button type="button"
            onClick={() => (window as any).AndroidWifiBridge.openWifiSettings()}
            className="ml-4 min-h-11 font-semibold text-sky-700">Wi-Fi Settings</button>}
          <details className="mt-4">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold text-sky-700">Enter device network manually</summary>
          <form className="mt-2 space-y-2" onSubmit={event => { event.preventDefault(); if (isSetupSsid(manualSsidInput.trim())) void handleSetUpDevice(manualSsidInput.trim()); }}>
            <label htmlFor="manual-setup-ssid" className="block text-sm font-medium">Enter device network instead</label>
            <input id="manual-setup-ssid" value={manualSsidInput} onChange={event => setManualSsidInput(event.target.value)}
              placeholder="NEURO-…" autoCapitalize="none" className="w-full rounded-xl border p-3" />
            <button type="submit" disabled={isJoiningHotspot || !isSetupSsid(manualSsidInput.trim())}
              className="min-h-11 font-semibold text-sky-700 disabled:opacity-50">Select network</button>
          </form>
          </details>
        </section>
      )}

      {currentView === 'connect_device' && selectedHotspot && (
        <section className="mx-auto w-full max-w-md p-5 pb-12">
          <button type="button" aria-label="Back" data-screen-back
            onClick={() => { leaveNearbySetup(); setCurrentView('scan_nearby'); }}
            className="mb-5 rounded-full bg-white p-2"><ChevronLeft /></button>
          <h1 className="text-center text-xl font-bold">Connect your device</h1>
          <p className="mt-3 break-all text-center text-sm font-semibold text-sky-800">{selectedHotspot}</p>
          <p role="status" className="my-4 rounded-2xl bg-white p-4 text-sm">
            {isJoiningHotspot ? 'Approve the Wi-Fi connection request on your phone…' : hotspotReady
              ? 'Device Wi-Fi connected. Tap Connect Device to continue.'
              : 'Join this device’s Wi-Fi network, then check the connection.'}
          </p>
          <p className="mb-5 text-sm leading-relaxed text-slate-600">
            This setup network may say “No internet.” Stay connected while setup runs. Keep mobile data on if available.
            After setup, reconnect to your home Wi-Fi so we can confirm the device is online.
          </p>
          {provisionError && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{provisionError}</p>}
          {!isJoiningHotspot && <div className="mb-4 flex flex-wrap gap-3">
            {(window as any).AndroidWifiBridge &&
              <button type="button" onClick={() => void joinHotspot(selectedHotspot)} className="min-h-11 rounded-xl bg-white px-3 font-semibold text-sky-700">Connect to network</button>}
            {(window as any).AndroidWifiBridge?.openWifiSettings &&
              <button type="button" onClick={() => (window as any).AndroidWifiBridge.openWifiSettings()}
                className="min-h-11 rounded-xl bg-white px-3 font-semibold text-sky-700">Wi-Fi Settings</button>}
            <button type="button" onClick={() => void checkHotspot()} className="min-h-11 rounded-xl bg-white px-3 font-semibold text-sky-700">Check connection</button>
          </div>}
          <button type="button" disabled={!hotspotReady || isJoiningHotspot} onClick={async () => {
            if (await checkHotspot()) setCurrentView('assign_room');
          }} className="min-h-12 w-full rounded-full bg-sky-700 px-4 font-bold text-white disabled:opacity-50">
            Connect Device
          </button>
        </section>
      )}

      {currentView === 'assign_room' && selectedHotspot && (
        <section className="mx-auto w-full max-w-md p-5 pb-12">
          <button type="button" aria-label="Back" data-screen-back onClick={() => setCurrentView('connect_device')}
            className="mb-5 rounded-full bg-white p-2"><ChevronLeft /></button>
          <h1 className="mb-5 text-xl font-bold">Assign to a room</h1>
          <label className="mb-4 block text-sm font-semibold">Device name
            <input value={customDeviceName} onChange={event => setCustomDeviceName(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3" />
          </label>
          <label className="block text-sm font-semibold">Room
            <select value={isCreatingNewRoom ? '__new__' : selectedRoomId} onChange={event => {
              const value = event.target.value;
              setIsCreatingNewRoom(value === '__new__');
              if (value !== '__new__') {
                setSelectedRoomId(value);
                setSelectedRoomName(rooms.find(room => room.id === value)?.name || '');
              }
            }} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3">
              <option value="">Choose a room</option>
              {rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
              <option value="__new__">Create a new room</option>
            </select>
          </label>
          {isCreatingNewRoom && <label className="mt-4 block text-sm font-semibold">New room name
            <input value={newRoomName} onChange={event => setNewRoomName(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3" />
          </label>}
          <button type="button" disabled={!customDeviceName.trim() || (isCreatingNewRoom ? !newRoomName.trim() : !selectedRoomId)}
            onClick={() => setCurrentView('provision_form')}
            className="mt-6 min-h-12 w-full rounded-full bg-sky-700 px-4 font-bold text-white disabled:opacity-50">
            Continue to home Wi-Fi
          </button>
        </section>
      )}

      {currentView === 'provision_form' && selectedHotspot && (
        <section className="mx-auto w-full max-w-md p-5 pb-12">
          <button type="button" aria-label="Back" data-screen-back disabled={isProvisioning} onClick={() => {
            if (confirmedPairing.current) { leaveNearbySetup(); setCurrentView('scan_nearby'); }
            else setCurrentView('assign_room');
          }}
            className="mb-5 rounded-full bg-white p-2"><ChevronLeft /></button>
          <h1 className="text-2xl font-bold">Set up {activeModel.name}</h1>
          <p role="status" className="mb-5 mt-2 text-sm">{isProvisioning ? setupProgress : isJoiningHotspot ? 'Approve the connection on your phone…' : confirmedPairing.current ? 'Setup sent. Checking whether your device is online.' : hotspotReady ? 'Device Wi-Fi connected.' : 'Join ' + selectedHotspot + ' to continue.'}</p>
          {!confirmedPairing.current && !hotspotReady && !isJoiningHotspot && (
            <div className="mb-5 flex flex-wrap gap-4">
              {typeof window !== 'undefined' && (window as any).AndroidWifiBridge &&
                <button type="button" className="font-semibold text-sky-700" onClick={() => void joinHotspot(selectedHotspot)}>Join device Wi-Fi</button>}
              <button type="button" className="font-semibold text-sky-700" onClick={() => void checkHotspot()}>Check connection</button>
            </div>
          )}
          {!confirmedPairing.current && (
            <fieldset disabled={isProvisioning} className="mb-5 space-y-3">
              <label className="block text-sm font-medium">Home Wi-Fi (2.4 GHz)
                <input value={wifiSsid} onChange={event => { setWifiSsid(event.target.value); setWifiPassword(''); }} autoCapitalize="none"
                  className="mt-1 w-full rounded-xl border p-3" />
              </label>
              <label className="block text-sm font-medium">Wi-Fi password
                <input type="password" value={wifiPassword} onChange={event => setWifiPassword(event.target.value)} autoComplete="off"
                  className="mt-1 w-full rounded-xl border p-3" />
              </label>
            </fieldset>
          )}
          {provisionError && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{provisionError}</p>}
          <button type="button" onClick={() => void handleContinueProvisioning()}
            disabled={isProvisioning || !wifiSsid.trim() || (!hotspotReady && !confirmedPairing.current)}
            className="w-full rounded-full bg-sky-700 p-3.5 font-bold text-white disabled:opacity-50">
            {isProvisioning ? 'Setting up…' : confirmedPairing.current ? 'Check again' : 'Save and connect device'}
          </button>
        </section>
      )}

      {/* ------------------- VIEW 5: ASSIGN ROOM & WI-FI PROVISIONING FORM ------------------- */}
      {currentView === 'provision_form' && !selectedHotspot && (
        <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-between p-5 sm:p-6 pb-8 animate-in fade-in duration-200">
          <div>
            {/* Header */}
            <div className="relative flex items-center justify-between mb-5 pt-2">
              <button
                onClick={() => setCurrentView('catalog')}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Back" data-screen-back
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
                  <span>{setupProgress}</span>
                </>
              ) : (
                <span>{confirmedPairing.current ? 'Check again' : 'Allow and continue'}</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ------------------- MODAL: DEVICE ICON PICKER ------------------- */}
      {isIconPickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-300/55 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in select-none">
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

            <h1 className="mb-2 text-2xl font-bold">Device setup is ready</h1>
            <p className="text-sm">{customDeviceName || activeModel.name} is online and ready to use.</p>
          </div>

          {/* Finish & View Dashboard */}
          <div className="pt-4 mt-auto">
            <button
              onClick={() => {
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
