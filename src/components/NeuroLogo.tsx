import { useEffect, useRef } from 'react';
import { getAssetUrl } from '../utils/assets';

export function NeuroLogo({ 
  className = "w-8 h-8",
  variant = "white"
}: { 
  className?: string;
  variant?: "white" | "black";
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = getAssetUrl('logo.png');
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Color mapping:
      // Blue stays blue
      // If variant === "black": map white pixels to deep slate/black (#0f172a: r:15, g:23, b:42)
      // If variant === "white": keep white pixels pure white
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a > 20) {
          if (r > 200 && g > 200 && b > 200) {
            if (variant === 'black') {
              data[i] = 15;
              data[i + 1] = 23;
              data[i + 2] = 42;
            } else {
              data[i] = 255;
              data[i + 1] = 255;
              data[i + 2] = 255;
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
    };
  }, [variant]);

  return (
    <canvas 
      ref={canvasRef} 
      className={`${className} object-contain`} 
    />
  );
}
