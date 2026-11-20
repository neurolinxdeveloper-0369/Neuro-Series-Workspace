import { useState } from 'react';
import { ArrowRight, House } from 'lucide-react';
import type { Room } from '../services/home';
import type { Device } from '../services/device';
import { getAssetUrl } from '../utils/assets';

export function RoomOverviewCard({ room, devices, onOpen }: {
  room: Room;
  devices: Device[];
  onOpen: () => void;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const roomDevices = devices.filter(device => device.room_id === room.id);
  const online = roomDevices.filter(device => device.is_online === true).length;
  const image = room.image_path;

  return (
    <section aria-label={`${room.name} room overview`}
      className="relative isolate min-h-44 overflow-hidden rounded-[28px] border border-white bg-sky-100 shadow-sm sm:min-h-52">
      {image && failedImage !== image && <img
        src={getAssetUrl(image.split('/').map(encodeURIComponent).join('/'))}
        alt="" loading="lazy" onError={() => setFailedImage(image)}
        className="pointer-events-none absolute inset-y-0 right-0 -z-20 h-full w-[78%] object-cover object-right" />}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'linear-gradient(90deg, #e9f8ff 0%, #e9f8fff2 25%, #e9f8ffbd 43%, #e9f8ff26 68%, transparent 100%)' }} />
      <div className="flex min-h-44 w-[68%] flex-col items-start justify-center gap-2 p-5 sm:min-h-52 sm:p-6">
        <div className="flex max-w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 sm:text-xs">
          <House aria-hidden="true" className="size-4 shrink-0" />
          <span className="break-words">{room.name}</span>
        </div>
        <h2 className="max-w-full break-words text-xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-2xl">{room.name}</h2>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-600 sm:text-sm" aria-live="polite" aria-atomic="true">
          <span>{roomDevices.length} {roomDevices.length === 1 ? 'device' : 'devices'}</span>
          <span aria-hidden="true">·</span>
          <span className="rounded-full bg-lime-100/90 px-2 py-0.5 text-lime-800">{online} online</span>
        </p>
        <button type="button" onClick={onOpen} aria-label={`View devices in ${room.name}`}
          className="mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-white/95 text-sky-600 shadow-sm transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700">
          <ArrowRight aria-hidden="true" className="size-5" />
        </button>
      </div>
    </section>
  );
}
