import { Star } from 'lucide-react';
import { ScrollReveal, StaggerReveal, StaggerItem } from './ScrollReveal';
import type { TestimonialContent } from '@lib/sanity/landingContent';

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

  return (
    <section className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4">
        <ScrollReveal>
          <h2
            className="mb-4 text-center text-3xl text-[#1B2D5B] md:text-4xl"
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

        <StaggerReveal staggerDelay={0.12}>
          <div className="grid gap-6 md:grid-cols-3">
            {safeTestimonials.map((testimonial, index) => (
              <StaggerItem key={`${testimonial.name}-${index}`}>
                <article className="flex h-full flex-col rounded-2xl border border-[#F07B1D]/10 bg-white p-6 shadow-lg">
                  <div className="mb-4 flex items-center gap-3">
                    {testimonial.image?.url ? (
                      <img
                        src={testimonial.image.url}
                        alt={testimonial.image.alt || testimonial.name}
                        className="h-12 w-12 rounded-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F07B1D]/15">
                        <span className="text-sm font-bold text-[#1B2D5B]">{initials(testimonial.name)}</span>
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-[#1B2D5B]">{testimonial.name}</div>
                      {testimonial.role && <div className="text-xs text-[#2C2C2A]/60">{testimonial.role}</div>}
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
              </StaggerItem>
            ))}
          </div>
        </StaggerReveal>
      </div>
    </section>
  );
}
