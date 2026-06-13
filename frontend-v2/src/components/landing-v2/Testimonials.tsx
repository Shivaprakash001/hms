import { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import type { TestimonialContent } from '@lib/sanity/landingContent';
import { cn } from '@/app/components/ui/utils';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SA';
}

export function Testimonials({ testimonials = [] }: { testimonials?: TestimonialContent[] }) {
  const safeTestimonials = testimonials.filter((testimonial) => testimonial?.name && testimonial?.review);
  if (!safeTestimonials.length) return null;

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (safeTestimonials.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % safeTestimonials.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [safeTestimonials.length]);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + safeTestimonials.length) % safeTestimonials.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % safeTestimonials.length);
  };

  const avatarThemes = [
    { bg: 'bg-amber-100 border border-amber-200', text: 'text-amber-800' },
    { bg: 'bg-blue-100 border border-blue-200', text: 'text-blue-800' },
    { bg: 'bg-emerald-100 border border-emerald-200', text: 'text-emerald-800' },
    { bg: 'bg-purple-100 border border-purple-200', text: 'text-purple-800' },
    { bg: 'bg-indigo-100 border border-indigo-200', text: 'text-indigo-800' },
  ];

  return (
    <section className="bg-white py-10 md:py-24">
      <div className="mx-auto max-w-7xl px-4">
        <ScrollReveal>
          <h2
            className="mb-4 text-center text-3xl text-[#1B2D5B] md:text-4xl font-bold"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            What Students & Parents Say
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <p className="mx-auto mb-12 max-w-2xl text-center text-[#2C2C2A]">
            Real words from people who know the hostel experience.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.3}>
          <div className="relative max-w-2xl mx-auto">
            {/* Carousel Container */}
            <div className="relative h-[320px] sm:h-[260px] md:h-[220px] w-full overflow-hidden sm:overflow-visible">
              {safeTestimonials.map((testimonial, index) => {
                const theme = avatarThemes[index % avatarThemes.length];
                const isParent = testimonial.role?.toLowerCase().includes('parent');

                return (
                  <article
                    key={`${testimonial.name}-${index}`}
                    className={cn(
                      "absolute inset-0 flex h-full flex-col rounded-2xl border border-[#F07B1D]/10 bg-[#FFFDF5]/40 p-6 shadow-md hover:shadow-lg transition-all duration-500 ease-in-out",
                      index === activeIndex
                        ? "opacity-100 translate-x-0 z-10"
                        : "opacity-0 translate-x-[50px] md:translate-x-[100px] pointer-events-none z-0"
                    )}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      {testimonial.image?.url ? (
                        <img
                          src={testimonial.image.url}
                          alt={testimonial.image.alt || testimonial.name}
                          className="h-12 w-12 rounded-full object-cover border-2 border-[#F07B1D]/20"
                          loading="lazy"
                        />
                      ) : (
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${theme.bg}`}>
                          <span className={`text-sm font-extrabold ${theme.text}`}>{initials(testimonial.name)}</span>
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-[#1B2D5B]">{testimonial.name}</div>
                        {testimonial.role && (
                          <div className="mt-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                              isParent
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-[#1B2D5B]/10 text-[#1B2D5B] border border-[#1B2D5B]/20'
                            }`}>
                              {testimonial.role}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mb-3 flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < Math.round(testimonial.rating || 5) ? 'fill-[#FBB040] text-[#FBB040]' : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>

                    <p className="flex-1 text-[15px] leading-relaxed text-[#1B2D5B]">
                      &quot;{testimonial.review}&quot;
                    </p>
                  </article>
                );
              })}
            </div>

            {/* Controls */}
            {safeTestimonials.length > 1 && (
              <div className="mt-6 flex items-center justify-center gap-4">
                <button
                  onClick={handlePrev}
                  className="rounded-full h-10 w-10 border border-[#1B2D5B]/15 flex items-center justify-center text-[#1B2D5B] hover:bg-[#1B2D5B] hover:text-white transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
                  aria-label="Previous testimonial"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="flex gap-2.5 items-center justify-center">
                  {safeTestimonials.map((_, index) => (
                    <button
                      key={index}
                      className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                        index === activeIndex ? 'bg-[#F07B1D] scale-110' : 'bg-[#1B2D5B]/20 hover:bg-[#1B2D5B]/40'
                      }`}
                      onClick={() => setActiveIndex(index)}
                      aria-label={`Go to testimonial ${index + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={handleNext}
                  className="rounded-full h-10 w-10 border border-[#1B2D5B]/15 flex items-center justify-center text-[#1B2D5B] hover:bg-[#1B2D5B] hover:text-white transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
                  aria-label="Next testimonial"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

