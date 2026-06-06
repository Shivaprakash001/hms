import { Star, Shield, UtensilsCrossed, Phone } from 'lucide-react';
import { ScrollReveal, StaggerReveal, StaggerItem } from './ScrollReveal';
import type { TestimonialContent } from '@lib/sanity/landingContent';
import { fallbackLandingContent } from '@lib/sanity/client';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SA';
}

export function Testimonials({ testimonials = fallbackLandingContent.testimonials }: { testimonials?: TestimonialContent[] }) {
  const studentTestimonials = testimonials.filter((testimonial) => testimonial.verificationType !== 'PARENT');
  const parentTestimonial =
    testimonials.find((testimonial) => testimonial.verificationType === 'PARENT') ||
    fallbackLandingContent.testimonials.find((testimonial) => testimonial.verificationType === 'PARENT')!;
  const ratings = [
    { label: 'Food Quality', value: 4.9, percentage: 98 },
    { label: 'Cleanliness', value: 4.7, percentage: 94 },
    { label: 'Safety', value: 4.8, percentage: 96 },
    { label: 'Value for Money', value: 4.6, percentage: 92 }
  ];

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <ScrollReveal>
          <h2
            className="text-3xl md:text-4xl text-center text-[#1B2D5B] mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            What Students & Parents Say
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <p className="text-center text-[#2C2C2A] mb-12 max-w-2xl mx-auto">
            Real words from real people — not written by us.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.3}>
          <div className="flex flex-col items-center gap-3 mb-12">
            <div className="flex items-center gap-2">
              <span className="text-4xl font-bold text-[#1B2D5B]" style={{ fontFamily: 'var(--font-display)' }}>
                4.8
              </span>
              <Star className="w-8 h-8 text-[#FBB040] fill-[#FBB040]" />
            </div>
            <p className="text-sm text-[#2C2C2A]/60">out of 5</p>

            <div className="w-full max-w-2xl mt-6 space-y-3">
              {ratings.map((rating, index) => (
                <div key={index} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-[#2C2C2A] w-32 text-right">
                    {rating.label}
                  </span>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#F07B1D] rounded-full transition-all duration-1000"
                      style={{ width: `${rating.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-[#1B2D5B] w-8">
                    {rating.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.4}>
          <h3 className="text-xl font-semibold text-[#1B2D5B] mb-6 text-center md:text-left">
            Student Experiences
          </h3>
        </ScrollReveal>

        <StaggerReveal staggerDelay={0.15}>
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {studentTestimonials.map((testimonial, index) => (
              <StaggerItem key={index}>
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-[#F07B1D]/10 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-[#F07B1D] flex items-center justify-center">
                      <span className="text-[#1B2D5B] font-bold text-sm">
                        {initials(testimonial.name)}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-[#1B2D5B]">
                        {testimonial.name}
                      </div>
                      <div className="text-xs text-[#2C2C2A]/60">
                        {testimonial.details}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < Math.round(testimonial.rating || 5) ? 'text-[#FBB040] fill-[#FBB040]' : 'text-gray-300'}`} />
                    ))}
                  </div>

                  <p className="text-[#1B2D5B] italic leading-relaxed mb-4 flex-1" style={{ fontSize: '15px' }}>
                    &quot;{testimonial.quote}&quot;
                  </p>

                  <div className="inline-flex items-center gap-2 bg-[#F07B1D]/10 border border-[#F07B1D] px-3 py-1.5 rounded-full text-xs font-medium text-[#F07B1D] self-start">
                    {testimonial.duration}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </div>
          <p className="text-center text-[#2C2C2A]/60 text-sm mb-12">
            Names and details shared with permission. Identities partially anonymized.
          </p>
        </StaggerReveal>

        <ScrollReveal delay={0.6}>
          <h3 className="text-xl font-semibold text-[#1B2D5B] mb-6 text-center md:text-left">
            Parent Perspective
          </h3>
        </ScrollReveal>

        <ScrollReveal delay={0.7}>
          <div className="bg-[#FFFDF5] rounded-2xl p-8 shadow-xl border-2 border-[#F07B1D]/20">
            <div className="grid md:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <div className="text-6xl text-[#F07B1D] mb-4 leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                  "
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-full bg-[#1B2D5B] flex items-center justify-center">
                    <span className="text-white font-bold">{initials(parentTestimonial.name)}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-[#1B2D5B]">
                      {parentTestimonial.name}
                    </div>
                    <div className="text-sm text-[#2C2C2A]/60">
                      {parentTestimonial.details || 'Verified parent'}
                    </div>
                  </div>
                </div>

                <p
                  className="text-[#1B2D5B] italic leading-relaxed text-lg mb-4"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {parentTestimonial.quote}
                </p>

                <div className="inline-flex items-center gap-2 bg-[#1B2D5B]/10 border border-[#1B2D5B] px-4 py-2 rounded-full text-sm font-medium text-[#1B2D5B]">
                  {parentTestimonial.duration || 'Parent perspective'} · Verified
                </div>
              </div>

              <div className="hidden md:flex flex-col gap-4">
                <div className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-md">
                  <div className="w-10 h-10 bg-[#1B2D5B]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-[#1B2D5B]" />
                  </div>
                  <span className="font-medium text-[#1B2D5B] text-sm">Safe</span>
                </div>

                <div className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-md">
                  <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <UtensilsCrossed className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="font-medium text-[#1B2D5B] text-sm">Fed Well</span>
                </div>

                <div className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-md">
                  <div className="w-10 h-10 bg-[#F07B1D]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-[#F07B1D]" />
                  </div>
                  <span className="font-medium text-[#1B2D5B] text-sm">Responsive</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
