import { ArrowRight, Cpu, House, Sparkles, Zap } from 'lucide-react';
import type { Device } from '../services/device';
import type { Room } from '../services/home';
import { getAssetUrl } from '../utils/assets';

export function SmartHomeOverview({ rooms, devices, homeName, onExplore, onAssistant }: {
  rooms: Room[]; devices: Device[]; homeName: string;
  onExplore: () => void; onAssistant?: () => void;
}) {
  const online = devices.filter(device => device.is_online === true).length;
  return <div className="w-full max-w-sm shrink-0 space-y-4 sm:max-w-md md:max-w-2xl lg:max-w-5xl">
    <section aria-label="Smart Home overview" className="relative isolate overflow-hidden rounded-[28px] border border-white bg-sky-100 shadow-sm">
      <img src={getAssetUrl('Rooms%20Images/Smart%20Home.png')} alt="" className="pointer-events-none absolute inset-y-0 right-0 -z-20 h-full w-[85%] object-cover object-right" />
      <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(90deg, #e9f8ff 0%, #e9f8fff2 25%, #e9f8ffb3 50%, transparent 85%)' }} />
      <div className="flex min-h-48 w-[70%] flex-col items-start justify-center gap-2 p-5 sm:min-h-56 sm:p-6">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600"><House className="size-4" />{homeName}</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Smart Home</h1>
        <dl className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-600 sm:text-sm" aria-live="polite" aria-atomic="true">
          <div><dt className="sr-only">Total rooms</dt><dd>{rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}</dd></div>
          <div><dt className="sr-only">Total devices</dt><dd>{devices.length} {devices.length === 1 ? 'device' : 'devices'}</dd></div>
          <div className="rounded-full bg-lime-100 px-2 py-0.5 text-lime-800"><dt className="sr-only">Online devices</dt><dd>{online} online</dd></div>
        </dl>
      </div>
    </section>
    <section aria-label="Explore devices">
      <header className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className="text-base font-bold text-slate-900">Explore devices</h2>
        <button type="button" onClick={onExplore} className="flex min-h-11 items-center gap-1 text-xs font-semibold text-sky-700">See all<ArrowRight className="size-4" /></button>
      </header>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2" aria-label="Swipe to explore device categories">
        {[
          { title: 'Touch panels', description: 'Control your lights and switches.', Icon: Cpu },
          { title: 'Energy meters', description: 'Track readings from your home.', Icon: Zap },
          { title: 'Smart controllers', description: 'Explore connected home controls.', Icon: House },
        ].map(({ title, description, Icon }) => <button key={title} type="button" onClick={onExplore}
          className="w-48 shrink-0 snap-start rounded-3xl border border-white bg-white/80 p-4 text-left shadow-sm">
          <Icon className="mb-3 size-7 text-sky-600" /><h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
        </button>)}
      </div>
    </section>
    <section className="rounded-3xl border border-white bg-white/80 p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Sparkles className="size-5 text-sky-600" />AI assistant</h2>
      <p className="mt-2 text-sm text-slate-500">Ask about your home, device status, and controls.</p>
      <button type="button" onClick={onAssistant} disabled={!onAssistant} className="mt-3 flex min-h-11 items-center gap-2 rounded-full bg-sky-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Open assistant<ArrowRight className="size-4" /></button>
      {!onAssistant && <p className="mt-2 text-xs text-slate-500">Available to the home owner.</p>}
    </section>
  </div>;
}
