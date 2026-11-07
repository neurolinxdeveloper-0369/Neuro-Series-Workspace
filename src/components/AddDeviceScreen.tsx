import { useState } from 'react';
import { 
  ChevronLeft, 
  Search, 
  QrCode, 
  Lightbulb, 
  ToggleRight, 
  Power, 
  Thermometer, 
  Fan, 
  Radio, 
  Check, 
  Loader2, 
  Radar, 
  Sparkles,
  Wifi
} from 'lucide-react';
import { deviceApi } from '../services/device';
import { homeApi } from '../services/home';
import type { Room } from '../services/home';

interface AddDeviceScreenProps {
  isOpen: boolean;
  onClose: () => void;
  homeId: string | null;
  rooms: Room[];
  onDeviceAdded: (roomName: string) => void;
  onRoomAdded: (newRoom: Room) => void;
}

export const AddDeviceScreen = ({
  isOpen,
  onClose,
  homeId,
  rooms,
  onDeviceAdded,
  onRoomAdded,
}: AddDeviceScreenProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [foundDevices, setFoundDevices] = useState<Array<{ name: string; type: 'light' | 'switch' | 'fan' | 'thermostat' | 'sensor'; signal: string }>>([]);
  
  // Custom manual modal state
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState<'light' | 'switch' | 'fan' | 'thermostat' | 'sensor'>('light');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreatingNewRoom, setIsCreatingNewRoom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  const categories = [
    { id: 'light', label: 'Lighting', icon: Lightbulb, color: 'text-amber-500 bg-amber-50' },
    { id: 'switch', label: 'Switches', icon: ToggleRight, color: 'text-sky-500 bg-sky-50' },
    { id: 'plug', label: 'Plugs & Outlets', icon: Power, color: 'text-emerald-500 bg-emerald-50' },
    { id: 'thermostat', label: 'AC & Climate', icon: Thermometer, color: 'text-rose-500 bg-rose-50' },
    { id: 'fan', label: 'Fans', icon: Fan, color: 'text-indigo-500 bg-indigo-50' },
    { id: 'sensor', label: 'Sensors', icon: Radio, color: 'text-purple-500 bg-purple-50' },
  ] as const;

  const handleStartScan = () => {
    setIsScanning(true);
    setFoundDevices([]);
    setTimeout(() => {
      setIsScanning(false);
      setFoundDevices([
        { name: 'Neuro Smart Bulb Pro', type: 'light', signal: '-45 dBm' },
        { name: 'Matter Climate Sensor', type: 'sensor', signal: '-52 dBm' },
        { name: 'Neuro Dual Relay Switch', type: 'switch', signal: '-60 dBm' },
      ]);
    }, 2400);
  };

  const handleSaveDevice = async (name: string, type: 'light' | 'switch' | 'fan' | 'thermostat' | 'sensor', room: string) => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      let finalRoomName = room.trim();
      
      // If user typed a new room name
      if (isCreatingNewRoom && newRoomName.trim()) {
        finalRoomName = newRoomName.trim();
        if (homeId) {
          try {
            const createdRoom = await homeApi.createRoom(homeId, finalRoomName);
            onRoomAdded(createdRoom);
          } catch {
            // Fallback room object
            onRoomAdded({ id: `rm_${Date.now()}`, home_id: homeId, name: finalRoomName });
          }
        }
      } else if (!finalRoomName && rooms.length > 0) {
        finalRoomName = rooms[0].name;
      } else if (!finalRoomName) {
        finalRoomName = 'Living room';
        if (homeId) {
          try {
            const createdRoom = await homeApi.createRoom(homeId, finalRoomName);
            onRoomAdded(createdRoom);
          } catch {
            onRoomAdded({ id: `rm_${Date.now()}`, home_id: homeId, name: finalRoomName });
          }
        }
      }

      await deviceApi.addDevice({
        name: name.trim(),
        type,
        room: finalRoomName,
        homeId: homeId || undefined,
      });

      setSuccessToast(`Added "${name.trim()}" to ${finalRoomName}!`);
      onDeviceAdded(finalRoomName);

      setTimeout(() => {
        setIsCustomModalOpen(false);
        setSuccessToast('');
        onClose();
      }, 1200);
    } catch {
      setSuccessToast('Failed to connect device. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#f3f4f8] rounded-[36px] overflow-hidden shadow-2xl border border-white/60 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 relative"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 pb-3 flex items-center justify-between border-b border-slate-100 bg-white">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
          </button>
          
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 font-sans tracking-tight">
            Add device
          </h1>

          <button 
            onClick={() => {}}
            className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Search"
          >
            <Search className="w-5 h-5 text-slate-700" strokeWidth={2.2} />
          </button>
        </div>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* Toast Notification */}
          {successToast && (
            <div className="bg-emerald-500 text-white font-semibold text-sm px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <Check className="w-5 h-5 flex-shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {/* Quick Scan Cards */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Scan Nearby Devices Card */}
            <div 
              onClick={handleStartScan}
              className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-2xl bg-sky-50 flex items-center justify-center text-[#0284c7] group-hover:scale-105 transition-transform">
                  <Radar className={`w-6 h-6 ${isScanning ? 'animate-spin text-sky-600' : ''}`} strokeWidth={2.2} />
                </div>
                {isScanning && (
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                  Scan nearby
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  {isScanning ? 'Searching Bluetooth & Wi-Fi...' : 'Matter, Wi-Fi & BLE'}
                </p>
              </div>
            </div>

            {/* Scan QR Code Card */}
            <div 
              onClick={() => {
                setIsCustomModalOpen(true);
                setDeviceName('Matter Smart Plug');
                setDeviceType('switch');
              }}
              className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
                  <QrCode className="w-6 h-6" strokeWidth={2.2} />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                  Scan QR code
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  Scan code on device
                </p>
              </div>
            </div>
          </div>

          {/* Discovered Devices Banner if scanned */}
          {foundDevices.length > 0 && (
            <div className="bg-white rounded-3xl p-5 border border-sky-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 tracking-wide uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Found ({foundDevices.length}) Devices Nearby
                </span>
                <button 
                  onClick={handleStartScan}
                  className="text-xs text-[#0284c7] font-semibold hover:underline"
                >
                  Rescan
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {foundDevices.map((dev, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between first:pt-1 last:pb-1">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-700">
                        <Wifi className="w-4 h-4 text-[#0284c7]" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{dev.name}</div>
                        <div className="text-xs text-slate-400">Signal: {dev.signal}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setDeviceName(dev.name);
                        setDeviceType(dev.type);
                        setIsCustomModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-full bg-[#0284c7] text-white text-xs font-bold hover:bg-[#0369a1] transition-colors cursor-pointer"
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Device Type / Category */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-sans">
                By Device Category
              </h2>
              <button 
                onClick={() => {
                  setDeviceName('');
                  setIsCustomModalOpen(true);
                }}
                className="text-xs font-bold text-[#0284c7] hover:underline cursor-pointer"
              >
                + Custom Device
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setDeviceName(`Smart ${cat.label}`);
                      setDeviceType(cat.id === 'plug' ? 'switch' : cat.id as any);
                      setIsCustomModalOpen(true);
                    }}
                    className="bg-white rounded-3xl p-4 flex flex-col items-center justify-center text-center border border-slate-100 shadow-sm hover:shadow-md hover:border-sky-200 transition-all cursor-pointer group"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform ${cat.color}`}>
                      <Icon className="w-6 h-6" strokeWidth={2.2} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 line-clamp-1">
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Partner Brands Strip */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Compatible Standards
            </h3>
            <div className="flex items-center justify-around gap-2 text-slate-700 text-xs font-bold">
              <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100">Matter</span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100">Zigbee 3.0</span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100">MQTT</span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100">Wi-Fi 6</span>
            </div>
          </div>

        </div>

        {/* Custom Manual Device Modal Overlay */}
        {isCustomModalOpen && (
          <div 
            onClick={() => setIsCustomModalOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-30 flex items-end sm:items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  Configure Device
                </h3>
                <button 
                  onClick={() => setIsCustomModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Device Name
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. Living Room Ceiling Light"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-[#0284c7]"
                />
              </div>

              {/* Type */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Device Type
                </label>
                <select
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-[#0284c7] bg-white cursor-pointer"
                >
                  <option value="light">Light / Bulb</option>
                  <option value="switch">Switch / Outlet</option>
                  <option value="fan">Fan</option>
                  <option value="thermostat">Thermostat / AC</option>
                  <option value="sensor">Sensor</option>
                </select>
              </div>

              {/* Room Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-600">
                    Assign to Room
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewRoom(!isCreatingNewRoom)}
                    className="text-xs font-semibold text-[#0284c7] hover:underline"
                  >
                    {isCreatingNewRoom ? 'Select existing' : '+ Add new room'}
                  </button>
                </div>

                {isCreatingNewRoom ? (
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="e.g. Master Bedroom, Kitchen..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-[#0284c7]"
                    autoFocus
                  />
                ) : (
                  <select
                    value={selectedRoom}
                    onChange={(e) => setSelectedRoom(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-[#0284c7] bg-white cursor-pointer"
                  >
                    {rooms.length === 0 && (
                      <option value="Living room">Living room (Default)</option>
                    )}
                    {rooms.map((rm) => (
                      <option key={rm.id} value={rm.name}>{rm.name}</option>
                    ))}
                    <option value="Living room">Living room</option>
                    <option value="Bedroom">Bedroom</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Balcony">Balcony</option>
                  </select>
                )}
              </div>

              {/* Submit Button */}
              <button
                onClick={() => handleSaveDevice(deviceName, deviceType, isCreatingNewRoom ? newRoomName : selectedRoom)}
                disabled={isSubmitting || !deviceName.trim()}
                className="w-full py-3 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-sm shadow-md transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <span>Connect & Save Device</span>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
