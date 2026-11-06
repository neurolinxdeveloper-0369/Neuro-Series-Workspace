import { useState, useEffect, useRef, type TouchEvent } from 'react';

interface ExploreCardItem {
  id: number;
  heading: string;
  text: string;
}

const exploreCards: ExploreCardItem[] = [
  {
    id: 1,
    heading: 'Explore devices',
    text: 'Effortlessly orchestrate Neuro Series touch panels, tailored mood lighting, and all IR-controlled appliances with a single tap or automated routine.',
  },
  {
    id: 2,
    heading: 'Explore devices',
    text: 'Keep your home comfortable and resources balanced. Regulate room temperatures, monitor tank levels, and automate water distribution.',
  },
  {
    id: 3,
    heading: 'Explore devices',
    text: 'Stay ahead of your monthly power bills. Access detailed device-level logs, peak usage graphs, and real-time energy telemetry right at your fingertips.',
  },
];

export const ExploreCardSlider = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // Auto-slide every 3 seconds as requested
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % exploreCards.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % exploreCards.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + exploreCards.length) % exploreCards.length);
  };

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 45) {
      handleNext();
    } else if (distance < -45) {
      handlePrev();
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  return (
    <div className="explore-slider-container w-full flex flex-col items-center justify-center px-4 sm:px-6 pointer-events-auto select-none">
      
      {/* Transparent Glass Card styled exactly matching reference image */}
      <div 
        className="relative w-full max-w-sm sm:max-w-md md:max-w-lg rounded-3xl overflow-hidden shadow-lg transition-all"
        style={{
          background: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.95)',
          boxShadow: '0 16px 36px -10px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(0, 0, 0, 0.02), inset 0 1.5px 2px rgba(255, 255, 255, 1)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Subtle Specular curved glare */}
        <div 
          className="absolute inset-0 pointer-events-none rounded-3xl"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.50) 0%, transparent 60%)'
          }}
        />

        {/* Carousel Slider Track */}
        <div 
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {exploreCards.map((card) => (
            <div 
              key={card.id} 
              className="w-full flex-shrink-0 p-5 sm:p-6 flex flex-col justify-between"
            >
              {/* Heading: "Explore devices" */}
              <div className="relative z-10">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight font-sans">
                  {card.heading}
                </h2>
              </div>

              {/* Exact Card Content Text */}
              <div className="relative z-10 mt-2.5">
                <p className="font-semibold text-slate-700 text-sm sm:text-base leading-snug font-sans">
                  {card.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Small Sharp Pointer Dots in Blue Colour Below the Card */}
      <div className="flex items-center justify-center gap-1.5 mt-2.5 select-none">
        {exploreCards.map((card, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={card.id}
              onClick={() => setActiveIndex(idx)}
              aria-label={`Go to card ${idx + 1}`}
              className="p-1 flex items-center justify-center focus:outline-none cursor-pointer"
            >
              <span
                className={`
                  rotate-45 rounded-[1px] transition-all duration-300 block
                  ${isActive 
                    ? 'w-1.5 h-1.5 bg-[#0284c7] scale-125 shadow-[0_0_5px_rgba(2,132,199,0.55)]' 
                    : 'w-1.5 h-1.5 bg-sky-300/60 hover:bg-sky-400'
                  }
                `}
              />
            </button>
          );
        })}
      </div>

    </div>
  );
};
