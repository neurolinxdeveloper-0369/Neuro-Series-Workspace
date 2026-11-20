import { ArrowRight, Cpu } from 'lucide-react';
import { useState } from 'react';
import type { Device } from '../services/device';
import { getAssetUrl } from '../utils/assets';
import { getRoomEmoji } from './AddDeviceScreen';

export function HomeDeviceCard({ device, roomName, list, onOpen }: {
  device: Device; roomName: string; list: boolean; onOpen: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return <button type="button" onClick={onOpen} aria-label={`Open ${device.custom_name}, ${device.is_online ? 'online' : 'offline'}`}
    className={`group relative flex w-full flex-col overflow-hidden rounded-3xl border border-white bg-gradient-to-br from-white/95 to-sky-100/65 p-3 text-left shadow-sm transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${list ? 'min-h-28' : 'min-h-40'}`}>
    <div className="flex w-full items-start justify-between gap-1">
      <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[9px] font-semibold text-slate-700 sm:text-[10px]">
        <span aria-hidden="true">{getRoomEmoji(roomName)}</span><span className="truncate">{roomName}</span>
      </span>
      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-1 text-[9px] font-bold sm:text-[10px] ${device.is_online ? 'bg-lime-100 text-lime-800' : 'bg-slate-100 text-slate-500'}`}>
        <span aria-hidden="true" className={`size-1.5 rounded-full ${device.is_online ? 'bg-lime-600' : 'bg-slate-400'}`} />{device.is_online ? 'Online' : 'Offline'}
      </span>
    </div>
    <div className={`flex items-center justify-center ${list ? 'absolute inset-y-8 right-14 w-20' : 'h-16 w-full'}`}>
      {/^TP[0-9]+$/.test(device.model_code) && !imageFailed
        ? <img src={getAssetUrl('8S.png')} alt="" onError={() => setImageFailed(true)} className="h-16 w-28 object-contain drop-shadow-sm" />
        : <Cpu aria-hidden="true" className="size-10 text-sky-600" />}
    </div>
    <div className={`mt-auto flex w-full items-end justify-between gap-2 ${list ? 'pr-24' : ''}`}>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-extrabold text-slate-900">{device.custom_name}</h3>
        <p className="mt-1 truncate text-[10px] font-medium text-slate-400">{device.device_id}</p>
      </div>
      <span className={`flex shrink-0 flex-col items-center gap-1 ${list ? 'absolute bottom-3 right-3' : ''}`}>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-bold text-sky-600">{device.model_code}</span>
        <span className="grid size-7 place-items-center rounded-full bg-white text-slate-500 shadow-sm"><ArrowRight className="size-4" /></span>
      </span>
    </div>
  </button>;
}
