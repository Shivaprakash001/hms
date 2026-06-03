import { useState, useEffect, useRef } from 'react';
import { Building2, UtensilsCrossed, Bed } from 'lucide-react';

export function ImageCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const dragDeltaX = useRef(0);

  const slides = [
    {
      label: 'Room Interior',
      icon: Bed,
      gradient: 'from-[#F07B1D]/20 to-[#FBB040]/20'
    },
    {
      label: 'Daily Meals',
      icon: UtensilsCrossed,
      gradient: 'from-green-500/20 to-emerald-400/20'
    },
    {
      label: 'Hostel Building',
      icon: Building2,
      gradient: 'from-[#1B2D5B]/20 to-blue-400/20'
    }
  ];

  useEffect(() => {
    if (isHovered || isDragging) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isHovered, isDragging, slides.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex((index + slides.length) % slides.length);
  };

  const handleSwipeEnd = () => {
    const delta = dragDeltaX.current;
    dragStartX.current = null;
    dragDeltaX.current = 0;
    setIsDragging(false);

    if (Math.abs(delta) < 48) return;
    goToSlide(currentIndex + (delta < 0 ? 1 : -1));
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="overflow-hidden rounded-2xl shadow-lg cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(event) => {
          dragStartX.current = event.clientX;
          dragDeltaX.current = 0;
          setIsDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragStartX.current == null) return;
          dragDeltaX.current = event.clientX - dragStartX.current;
        }}
        onPointerUp={(event) => {
          if (dragStartX.current == null) return;
          event.currentTarget.releasePointerCapture(event.pointerId);
          handleSwipeEnd();
        }}
        onPointerCancel={handleSwipeEnd}
      >
        <div
          className={`flex transition-transform ease-in-out ${isDragging ? 'duration-200' : 'duration-500'}`}
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {slides.map((slide, index) => {
            const Icon = slide.icon;
            return (
              <div
                key={index}
                className="w-full flex-shrink-0"
              >
                <div className={`aspect-[4/3] bg-gradient-to-br ${slide.gradient} flex flex-col items-center justify-center relative`}>
                  <Icon className="w-16 h-16 text-[#1B2D5B]/30 mb-4" />
                  <span className="text-[#1B2D5B]/60 font-medium text-sm">
                    {slide.label}
                  </span>
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium text-[#1B2D5B] border border-[#F07B1D]/20">
                    Photo placeholder
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center gap-2 mt-4">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'bg-[#F07B1D] w-6'
                : 'bg-[#F07B1D]/30 hover:bg-[#F07B1D]/50'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
