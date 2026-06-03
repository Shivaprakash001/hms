import { useEffect, useRef, useState } from 'react';
import { UtensilsCrossed, Home, MapPin } from 'lucide-react';
import { ScrollReveal, StaggerReveal } from './ScrollReveal';

const features = [
  {
    icon: UtensilsCrossed,
    title: 'Homely Food',
    description: 'Fresh, daily meals included — just like mom\'s cooking',
    gradient: 'from-[#F07B1D]/20 to-[#FBB040]/20',
  },
  {
    icon: Home,
    title: 'Homely Atmosphere',
    description: 'Warm, safe & comfortable — designed for students',
    gradient: 'from-green-500/20 to-emerald-400/20',
  },
  {
    icon: MapPin,
    title: 'Prime Location',
    description: '400m from SNIST gate — walk in 5 minutes',
    gradient: 'from-[#1B2D5B]/20 to-blue-400/20',
  },
];

export function WhyChooseUs() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const dragDeltaX = useRef(0);

  useEffect(() => {
    if (isHovered || isDragging) return;

    const interval = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % features.length);
    }, 3500);

    return () => window.clearInterval(interval);
  }, [isHovered, isDragging]);

  const goToFeature = (index: number) => {
    setCurrentIndex((index + features.length) % features.length);
  };

  const handleSwipeEnd = () => {
    const delta = dragDeltaX.current;
    dragStartX.current = null;
    dragDeltaX.current = 0;
    setIsDragging(false);

    if (Math.abs(delta) < 48) return;
    goToFeature(currentIndex + (delta < 0 ? 1 : -1));
  };

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <ScrollReveal>
          <h2
            className="text-3xl md:text-4xl text-center text-[#1B2D5B] mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Why Choose Us
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <p className="text-center text-[#2C2C2A] mb-12 max-w-2xl mx-auto">
            We provide more than just accommodation — we create a home away from home for students
          </p>
        </ScrollReveal>

        <StaggerReveal>
          <div
            className="relative max-w-3xl mx-auto"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div
              className="overflow-hidden rounded-xl shadow-lg cursor-grab active:cursor-grabbing select-none"
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
                {features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div key={feature.title} className="w-full flex-shrink-0">
                      <div className="relative bg-[#FFFDF5] rounded-xl border border-[#F07B1D]/10 overflow-hidden group h-[280px] md:h-[320px]">
                        <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} flex flex-col items-center justify-center`}>
                          <Icon className="w-20 h-20 text-[#1B2D5B]/20 mb-4 transition-transform duration-500 group-hover:scale-110" />
                          <span className="text-[#1B2D5B]/50 font-medium text-sm">
                            {feature.title} visual
                          </span>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium text-[#1B2D5B] border border-[#F07B1D]/20">
                          Photo placeholder
                        </div>

                        <div className="relative h-full flex flex-col justify-end p-6 md:p-8">
                          <div className="w-12 h-12 md:w-14 md:h-14 bg-[#F07B1D] rounded-full flex items-center justify-center mb-4">
                            <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                          </div>
                          <h3 className="text-xl md:text-2xl font-semibold text-white mb-2">
                            {feature.title}
                          </h3>
                          <p className="text-white/90 text-sm md:text-base">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center gap-2 mt-4">
              {features.map((feature, index) => (
                <button
                  key={feature.title}
                  type="button"
                  onClick={() => goToFeature(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? 'bg-[#F07B1D] w-6'
                      : 'bg-[#F07B1D]/30 hover:bg-[#F07B1D]/50'
                  }`}
                  aria-label={`Show ${feature.title}`}
                />
              ))}
            </div>
          </div>
        </StaggerReveal>
      </div>
    </section>
  );
}
