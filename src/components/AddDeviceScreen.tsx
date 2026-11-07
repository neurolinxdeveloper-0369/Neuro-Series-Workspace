import { useState } from 'react';
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
  X
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
  const [scanType, setScanType] = useState<'nearby' | 'qr' | null>(null);
  const [foundDevices, setFoundDevices] = useState<Array<{ name: string; type: 'light' | 'switch' | 'fan' | 'thermostat' | 'sensor'; signal: string }>>([]);
  
  // Custom Device / Setup Dialog state
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [deviceBrandTitle, setDeviceBrandTitle] = useState('Neuro Series Device');
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState<'light' | 'switch' | 'fan' | 'thermostat' | 'sensor'>('light');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreatingNewRoom, setIsCreatingNewRoom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  if (!isOpen) return null;

  const handleStartScanNearby = () => {
    setScanType('nearby');
    setIsScanning(true);
    setFoundDevices([]);
    setTimeout(() => {
      setIsScanning(false);
      setFoundDevices([
        { name: 'Neuro Series Smart Bulb Pro', type: 'light', signal: '-42 dBm' },
        { name: 'Neuro Dual Relay Switch', type: 'switch', signal: '-58 dBm' },
        { name: 'Matter Climate Sensor', type: 'sensor', signal: '-50 dBm' },
      ]);
    }, 2200);
  };

  const handleStartScanQr = () => {
    setScanType('qr');
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setDeviceBrandTitle('Matter QR Paired Device');
      setDeviceName('Matter Smart Socket');
      setDeviceType('switch');
      setIsSetupDialogOpen(true);
    }, 1800);
  };

  const openAddSetup = (title: string, defaultName: string, defaultType: 'light' | 'switch' | 'fan' | 'thermostat' | 'sensor') => {
    setDeviceBrandTitle(title);
    setDeviceName(defaultName);
    setDeviceType(defaultType);
    setSelectedRoom(rooms.length > 0 ? rooms[0].name : 'Living room');
    setIsCreatingNewRoom(false);
    setNewRoomName('');
    setIsSetupDialogOpen(true);
  };

  const handleSaveDevice = async () => {
    if (!deviceName.trim()) return;
    setIsSubmitting(true);
    try {
      let finalRoomName = selectedRoom.trim();
      
      if (isCreatingNewRoom && newRoomName.trim()) {
        finalRoomName = newRoomName.trim();
        if (homeId) {
          try {
            const createdRoom = await homeApi.createRoom(homeId, finalRoomName);
            onRoomAdded(createdRoom);
          } catch {
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
        name: deviceName.trim(),
        type: deviceType,
        room: finalRoomName,
        homeId: homeId || undefined,
      });

      setSuccessToast(`"${deviceName.trim()}" added to ${finalRoomName}!`);
      onDeviceAdded(finalRoomName);

      setTimeout(() => {
        setIsSetupDialogOpen(false);
        setSuccessToast('');
        onClose();
      }, 1200);
    } catch {
      setSuccessToast('Failed to add device. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 w-full h-full bg-[#f3f4f8] overflow-y-auto overflow-x-hidden flex flex-col font-sans select-none animate-in fade-in duration-200">
      
      {/* Centered Max-Width Mobile/Tablet Container */}
      <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-between p-5 sm:p-6 pb-8">
        
        {/* Top Section */}
        <div>
          {/* Header matching Reference (media_1794028553859.jpg) */}
          <div className="relative flex items-center justify-between mb-6 pt-2">
            
            {/* Left: Circular Back Button */}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shadow-sm hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
            </button>

            {/* Center: Title */}
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Add device
            </h1>

            {/* Right: Search & More Capsule Button */}
            <div className="flex items-center bg-white rounded-full shadow-sm border border-slate-100 px-3 py-1.5 gap-2">
              <button 
                onClick={() => {}}
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

          {/* Toast Notification */}
          {successToast && (
            <div className="bg-emerald-500 text-white font-semibold text-sm px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 mb-4 animate-in fade-in slide-in-from-top-2">
              <Check className="w-5 h-5 flex-shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {/* 1. Neuro Series devices Card (Reference Image Card 1) */}
          <div className="bg-white rounded-[28px] p-5 sm:p-6 shadow-sm border border-slate-100/90 mb-4">
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
                onClick={() => openAddSetup('Neuro Series Device', 'Neuro Series Ceiling Light', 'light')}
                className="px-6 py-2 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-sm shadow-md shadow-sky-500/20 active:scale-95 transition-all cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          {/* 2. Partner devices Card (Reference Image Card 2) */}
          <div className="bg-white rounded-[28px] p-5 sm:p-6 shadow-sm border border-slate-100/90 mb-6">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-5 font-sans">
              Partner devices
            </h2>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-base font-extrabold text-slate-800 tracking-tight font-sans">
                  harman
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  Works with <span className="font-bold text-slate-700">Neuro Series</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold pt-1">
                  <span className="text-sm text-slate-900">❉</span>
                  <span>matter</span>
                </div>
              </div>

              <button
                onClick={() => openAddSetup('Partner Device', 'Matter Smart Plug', 'switch')}
                className="px-6 py-2 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-sm shadow-md shadow-sky-500/20 active:scale-95 transition-all cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          {/* Scanning Status / Found Devices Section */}
          {isScanning && (
            <div className="bg-white rounded-3xl p-5 border border-sky-100 shadow-sm flex items-center justify-center gap-3 mb-4 animate-in fade-in">
              <Radar className="w-5 h-5 text-[#0284c7] animate-spin" />
              <span className="text-sm font-bold text-slate-800">
                {scanType === 'qr' ? 'Scanning QR code with camera...' : 'Searching nearby Wi-Fi, BLE & Matter...'}
              </span>
            </div>
          )}

          {foundDevices.length > 0 && (
            <div className="bg-white rounded-3xl p-5 border border-sky-100 shadow-sm space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 tracking-wide uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Found ({foundDevices.length}) Devices Nearby
                </span>
                <button 
                  onClick={handleStartScanNearby}
                  className="text-xs text-[#0284c7] font-semibold hover:underline"
                >
                  Rescan
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {foundDevices.map((dev, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between first:pt-1 last:pb-1">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center text-[#0284c7]">
                        <Wifi className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900">{dev.name}</div>
                        <div className="text-[11px] text-slate-400">Signal: {dev.signal}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => openAddSetup(dev.name, dev.name, dev.type)}
                      className="px-3.5 py-1.5 rounded-full bg-[#0284c7] text-white text-xs font-bold hover:bg-[#0369a1] transition-colors cursor-pointer"
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Buttons matching Reference (media_1794028553859.jpg) */}
        <div className="space-y-3 pt-6 mt-auto">
          {/* Scan QR code */}
          <button
            onClick={handleStartScanQr}
            className="w-full py-4 rounded-full bg-slate-200/90 hover:bg-slate-300 text-slate-900 font-bold text-sm sm:text-base transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4 text-slate-800" />
            <span>Scan QR code</span>
          </button>

          {/* Scan nearby */}
          <button
            onClick={handleStartScanNearby}
            className="w-full py-4 rounded-full bg-slate-200/90 hover:bg-slate-300 text-slate-900 font-bold text-sm sm:text-base transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
          >
            <Radar className="w-4 h-4 text-slate-800" />
            <span>Scan nearby</span>
          </button>
        </div>

      </div>

      {/* Setup & Connect Dialog Sheet */}
      {isSetupDialogOpen && (
        <div 
          onClick={() => setIsSetupDialogOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {deviceBrandTitle}
              </h3>
              <button 
                onClick={() => setIsSetupDialogOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
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
                placeholder="e.g. Living Room Chandelier"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-[#0284c7] font-sans"
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
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-[#0284c7] bg-white cursor-pointer font-sans"
              >
                <option value="light">Lighting / Bulb</option>
                <option value="switch">Switch / Outlet / Socket</option>
                <option value="fan">Ceiling / Exhaust Fan</option>
                <option value="thermostat">Air Conditioner / Thermostat</option>
                <option value="sensor">Smart Sensor</option>
              </select>
            </div>

            {/* Room Assignment */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-600">
                  Assign to Room
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewRoom(!isCreatingNewRoom)}
                  className="text-xs font-semibold text-[#0284c7] hover:underline cursor-pointer"
                >
                  {isCreatingNewRoom ? 'Choose existing' : '+ Add new room'}
                </button>
              </div>

              {isCreatingNewRoom ? (
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Master Bedroom, Kitchen..."
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-[#0284c7] font-sans"
                  autoFocus
                />
              ) : (
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-[#0284c7] bg-white cursor-pointer font-sans"
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

            {/* Connect & Save Button */}
            <button
              onClick={handleSaveDevice}
              disabled={isSubmitting || !deviceName.trim()}
              className="w-full py-3.5 rounded-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-sm shadow-md transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting Device...</span>
                </>
              ) : (
                <span>Connect & Save Device</span>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
