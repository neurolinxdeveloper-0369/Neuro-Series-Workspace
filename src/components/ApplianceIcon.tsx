import { ICON_ARTWORK } from '../../server/src/config/icon-artwork';
import { useEffect, useRef, useState } from 'react';
import { getAssetUrl } from '../utils/assets';

/** Display the original asset, framing its transparent margins without editing its pixels. */
export function ApplianceIcon({ filename, className, alt = '', white = true, lazy = false }: {
  filename: string; className?: string; alt?: string; white?: boolean; lazy?: boolean;
}) {
  const element = useRef<SVGSVGElement>(null);
  const [ready, setReady] = useState(!lazy);
  useEffect(() => {
    if (!lazy || typeof IntersectionObserver === 'undefined') { setReady(true); return; }
    if (ready || !element.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setReady(true); observer.disconnect(); }
    }, { rootMargin: '160px' });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [lazy, ready]);
  const artwork = ICON_ARTWORK[filename];
  const source = getAssetUrl('ICONS/' + encodeURIComponent(filename)) + '?v=' + (artwork?.version || 'black-20261120');
  const style = white ? { filter: 'brightness(0) invert(1)' } : undefined;
  if (!artwork) return <img src={source} alt={alt} className={className} style={style} loading={lazy ? 'lazy' : undefined} />;
  return <svg ref={element} viewBox={[artwork.x, artwork.y, artwork.width, artwork.height].join(' ')}
    preserveAspectRatio="xMidYMid meet" className={className} style={style}
    role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
    {ready && <image href={source} x="0" y="0" width={artwork.sourceWidth} height={artwork.sourceHeight} />}
  </svg>;
}
