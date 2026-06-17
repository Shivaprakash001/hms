import { Star, Quote } from 'lucide-react';
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

const avatarThemes = [
  { bg: 'bg-amber-100 border border-amber-200', text: 'text-amber-800' },
  { bg: 'bg-blue-100 border border-blue-200', text: 'text-blue-800' },
  { bg: 'bg-emerald-100 border border-emerald-200', text: 'text-emerald-800' },
  { bg: 'bg-purple-100 border border-purple-200', text: 'text-purple-800' },
  { bg: 'bg-indigo-100 border border-indigo-200', text: 'text-indigo-800' },
];

function TestimonialCard({
  testimonial,
  theme,
  isParent,
}: {
  testimonial: TestimonialContent;
  theme: { bg: string; text: string };
  isParent: boolean;
}) {
  return (
    <article
      className={cn(
        "relative flex flex-col rounded-2xl border p-6 shadow-sm hover:shadow-md transition-all duration-300 bg-white hover:-translate-y-0.5",
        isParent
          ? "border-purple-100 bg-purple-50/10 hover:border-purple-200"
          : "border-[#F07B1D]/10 bg-[#FFFDF5]/20 hover:border-[#F07B1D]/20"
      )}
    >
      <Quote
        className={cn(
          "absolute right-6 top-6 h-12 w-12 pointer-events-none opacity-5",
          isParent ? "text-purple-600" : "text-[#F07B1D]"
        )}
      />

      <div className="mb-4 flex items-center gap-3">
        {testimonial.image?.url ? (
          <img
            src={testimonial.image.url}
            alt={testimonial.image.alt || testimonial.name}
            className="h-12 w-12 rounded-full object-cover border border-[#FBB040]/20"
            loading="lazy"
          />
        ) : (
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-full font-extrabold text-sm", theme.bg, theme.text)}>
            {initials(testimonial.name)}
          </div>
        )}
        <div>
          <div className="font-bold text-[#1B2D5B]">{testimonial.name}</div>
          {testimonial.role && (
            <div className="mt-1">
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase border",
                  isParent
                    ? 'bg-purple-155 text-purple-800 border-purple-200 bg-purple-100'
                    : 'bg-[#1B2D5B]/10 text-[#1B2D5B] border-[#1B2D5B]/20'
                )}
              >
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
            className={cn(
              "h-4 w-4",
              i < Math.round(testimonial.rating || 5)
                ? 'fill-[#FBB040] text-[#FBB040]'
                : 'text-gray-300'
            )}
          />
        ))}
      </div>

      <p className="flex-1 text-[15px] leading-relaxed text-[#2C2C2A]">
        &quot;{testimonial.review}&quot;
      </p>
    </article>
  );
}

export function Testimonials({ testimonials = [] }: { testimonials?: TestimonialContent[] }) {
  const safeTestimonials = testimonials.filter((testimonial) => testimonial?.name && testimonial?.review);
  if (!safeTestimonials.length) return null;

  const students = safeTestimonials.filter(t => !t.role?.toLowerCase().includes('parent'));
  const parents = safeTestimonials.filter(t => t.role?.toLowerCase().includes('parent'));

  return (
    <section className="bg-white py-10 md:py-24 border-t border-gray-100">
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
            Real reviews from SNIST students and parents who trust us.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.3}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-6xl mx-auto items-start">
            {/* Students Column */}
            {students.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-[#F07B1D]/20 pb-3 mb-4">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FBB040]" />
                  <h3 className="text-xl font-bold text-[#1B2D5B] tracking-tight">Student Experiences</h3>
                  <span className="text-xs bg-[#1B2D5B]/10 text-[#1B2D5B] px-2 py-0.5 rounded-full font-semibold">
                    {students.length} Reviews
                  </span>
                </div>
                <div className="space-y-6">
                  {students.map((testimonial, index) => {
                    const theme = avatarThemes[index % avatarThemes.length];
                    return (
                      <TestimonialCard
                        key={`${testimonial.name}-${index}`}
                        testimonial={testimonial}
                        theme={theme}
                        isParent={false}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Parents Column */}
            {parents.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-purple-200 pb-3 mb-4">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                  <h3 className="text-xl font-bold text-[#1B2D5B] tracking-tight">Parent Perspective</h3>
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-semibold">
                    {parents.length} Reviews
                  </span>
                </div>
                <div className="space-y-6">
                  {parents.map((testimonial, index) => {
                    const theme = avatarThemes[index % avatarThemes.length];
                    return (
                      <TestimonialCard
                        key={`${testimonial.name}-${index}`}
                        testimonial={testimonial}
                        theme={theme}
                        isParent={true}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
