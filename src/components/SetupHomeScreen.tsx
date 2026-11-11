import { useState } from 'react';
import { 
  Building2, 
  Home as HomeIcon, 
  Building, 
  MapPin, 
  Wifi, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  X, 
  Plus, 
  Minus, 
  Navigation, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { homeApi, type Home, type PropertyType } from '../services/home';
import { NeuroLoader } from './NeuroLoader';

interface SetupHomeScreenProps {
  isOpen: boolean;
  allowClose?: boolean;
  onClose?: () => void;
  onSuccess: (home: Home) => void;
}

const PROPERTY_TYPES: { id: PropertyType; label: string; icon: typeof HomeIcon }[] = [
  { id: 'House', label: 'House', icon: HomeIcon },
  { id: 'Apartment', label: 'Apartment', icon: Building2 },
  { id: 'Villa', label: 'Villa', icon: HomeIcon },
  { id: 'Flat', label: 'Flat', icon: Building },
  { id: 'Office', label: 'Office', icon: Building2 },
  { id: 'Building', label: 'Building', icon: Building },
];

export const SetupHomeScreen = ({
  isOpen,
  allowClose = false,
  onClose,
  onSuccess,
}: SetupHomeScreenProps) => {
  const [name, setName] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('House');
  const [floorCount, setFloorCount] = useState(1);
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata');
  
  // Wi-Fi Config
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [showWifiPassword, setShowWifiPassword] = useState(false);

  // Status
  const [isLocating, setIsLocating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locationSuccess, setLocationSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle Detect Current Location
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setLatitude(lat);
        setLongitude(lng);
        setLocationSuccess(`Location detected: ${lat}, ${lng}`);
        setIsLocating(false);

        // Try reverse geocoding via free OpenStreetMap Nominatim
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then((res) => res.json())
          .then((data) => {
            if (data?.address) {
              const detectedCity = data.address.city || data.address.town || data.address.suburb || data.address.county || '';
              const detectedRoad = data.address.road || data.address.neighbourhood || '';
              if (detectedCity && !city) setCity(detectedCity);
              if (detectedRoad && !addressLine) setAddressLine(detectedRoad);
            }
          })
          .catch(() => {
            // Silently ignore reverse geocode error
          });
      },
      (err) => {
        setIsLocating(false);
        setErrorMessage(`Could not retrieve location: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Please enter a name for your smart home.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const createdHome = await homeApi.createHome({
        name: name.trim(),
        property_type: propertyType,
        floor_count: floorCount,
        address_line: addressLine.trim() || undefined,
        city: city.trim() || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        timezone,
        default_wifi_ssid: wifiSsid.trim() || undefined,
        wifi_password: wifiPassword || undefined,
      });

      onSuccess(createdHome);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to set up home';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto flex flex-col justify-between select-none pointer-events-auto font-sans animate-in fade-in duration-200"
      style={{
        backgroundColor: '#d4edf4',
        backgroundImage: `
          radial-gradient(circle at 10% 10%, rgba(255, 255, 255, 0.95) 0%, transparent 50%),
          radial-gradient(circle at 90% 90%, rgba(255, 255, 255, 0.90) 0%, transparent 50%)
        `,
      }}
    >
      {/* Real-time Loader */}
      {isLoading && <NeuroLoader message="Configuring Smart Home..." />}

      {/* Top Header */}
      <header className="screen-top-header w-full flex items-center justify-between px-5 sm:px-10 py-5 sm:py-6">
        <div className="flex items-center gap-3">
          {allowClose && (
            <button
              onClick={onClose}
              className="p-2 -ml-2 rounded-full text-slate-700 hover:text-slate-900 hover:bg-white/60 transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.2} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-xl font-bold text-slate-900 tracking-tight font-sans">
              Setup Your Home
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#0284c7]/10 text-[#0284c7]">
              Step 1 of 1
            </span>
          </div>
        </div>

        {allowClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.2} />
          </button>
        )}
      </header>

      {/* Main Form Content */}
      <main className="w-full max-w-lg mx-auto px-5 sm:px-8 py-2 pb-16 flex flex-col items-center flex-1">
        
        {/* Intro Banner Card */}
        <div 
          className="w-full rounded-3xl p-5 mb-5 shadow-sm text-left flex items-start gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(240, 249, 255, 0.85) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.90)',
          }}
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0284c7] to-sky-400 flex items-center justify-center text-white flex-shrink-0 shadow-md shadow-sky-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 font-sans tracking-tight">
              Welcome to Neuro Series!
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
              Every smart home begins with a single connection. Let’s configure your primary location to organize your devices, rooms, and automations.
            </p>
          </div>
        </div>

        {/* Error notification banner */}
        {errorMessage && (
          <div className="w-full mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          
          {/* Card 1: Location & Property Identity */}
          <div 
            className="w-full rounded-3xl p-5 shadow-md bg-white space-y-4"
            style={{
              border: '1px solid rgba(255, 255, 255, 0.95)',
              boxShadow: '0 16px 36px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(0, 0, 0, 0.02)',
            }}
          >
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0284c7] font-sans">
              Property Details
            </h3>

            {/* Location Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Location Name / Nickname <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Banjara Hills Villa, Home, Penthouse"
                required
                className="w-full px-4 py-3 rounded-2xl bg-slate-50/70 border border-slate-200 text-slate-900 placeholder:text-slate-400 font-sans text-sm outline-none focus:border-[#0284c7] focus:bg-white focus:ring-4 focus:ring-sky-100 transition-all"
              />
            </div>

            {/* Property Type Grid */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Property Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PROPERTY_TYPES.map((pt) => {
                  const Icon = pt.icon;
                  const isSelected = propertyType === pt.id;
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => setPropertyType(pt.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-[#0284c7] bg-sky-50/80 text-[#0284c7] font-bold shadow-xs' 
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-1 ${isSelected ? 'text-[#0284c7]' : 'text-slate-500'}`} />
                      <span className="text-xs">{pt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Floors Count Stepper */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Number of Floors
                </label>
                <span className="text-[11px] text-slate-500">
                  Used for multi-floor device grouping
                </span>
              </div>
              <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setFloorCount((c) => Math.max(1, c - 1))}
                  className="w-8 h-8 rounded-xl bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors shadow-xs"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-6 text-center text-sm font-bold text-slate-800">
                  {floorCount}
                </span>
                <button
                  type="button"
                  onClick={() => setFloorCount((c) => Math.min(20, c + 1))}
                  className="w-8 h-8 rounded-xl bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Address & Geolocation */}
          <div 
            className="w-full rounded-3xl p-5 shadow-md bg-white space-y-4"
            style={{
              border: '1px solid rgba(255, 255, 255, 0.95)',
              boxShadow: '0 16px 36px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(0, 0, 0, 0.02)',
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0284c7] font-sans">
                Location & Coordinates
              </h3>
              
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isLocating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#0284c7] text-xs font-semibold cursor-pointer transition-all disabled:opacity-60"
              >
                <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'Locating...' : 'Detect GPS'}</span>
              </button>
            </div>

            {locationSuccess && (
              <p className="text-[11px] text-emerald-600 font-medium">
                ✓ {locationSuccess}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address Line / Area
                </label>
                <input
                  type="text"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="Road No. 12, Jubilee Hills"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50/70 border border-slate-200 text-slate-900 placeholder:text-slate-400 font-sans text-xs sm:text-sm outline-none focus:border-[#0284c7] focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Hyderabad"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50/70 border border-slate-200 text-slate-900 placeholder:text-slate-400 font-sans text-xs sm:text-sm outline-none focus:border-[#0284c7] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#0284c7]" />
                <span>Timezone: <strong>{timezone}</strong></span>
              </div>
              {latitude && longitude ? (
                <span className="text-[11px] font-mono text-slate-500">
                  {latitude.toFixed(4)}, {longitude.toFixed(4)}
                </span>
              ) : null}
            </div>
          </div>

          {/* Card 3: Encrypted Wi-Fi Helper (Optional) */}
          <div 
            className="w-full rounded-3xl p-5 shadow-md bg-white space-y-3"
            style={{
              border: '1px solid rgba(255, 255, 255, 0.95)',
              boxShadow: '0 16px 36px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(0, 0, 0, 0.02)',
            }}
          >
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-[#0284c7]" />
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0284c7] font-sans">
                Home Wi-Fi Setup (Optional)
              </h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Provides one-tap smart device provisioning. Passwords are encrypted at rest with AES-256-GCM.
            </p>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Wi-Fi Network Name (SSID)
                </label>
                <input
                  type="text"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  placeholder="e.g. Neuro_Home_5G"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50/70 border border-slate-200 text-slate-900 placeholder:text-slate-400 font-sans text-xs sm:text-sm outline-none focus:border-[#0284c7] focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Wi-Fi Password
                </label>
                <div className="relative">
                  <input
                    type={showWifiPassword ? 'text' : 'password'}
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    placeholder="Encrypted password"
                    className="w-full px-4 py-2.5 pr-10 rounded-2xl bg-slate-50/70 border border-slate-200 text-slate-900 placeholder:text-slate-400 font-sans text-xs sm:text-sm outline-none focus:border-[#0284c7] focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWifiPassword(!showWifiPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showWifiPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 rounded-2xl bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-sm sm:text-base tracking-wide transition-all duration-200 shadow-md shadow-sky-600/25 active:scale-[0.99] flex items-center justify-center cursor-pointer disabled:opacity-70"
            >
              Save & Enter Dashboard
            </button>
          </div>

        </form>
      </main>
    </div>
  );
};
