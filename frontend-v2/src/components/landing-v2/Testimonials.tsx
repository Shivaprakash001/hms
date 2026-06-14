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

export function Testimonials({ testimonials = [] }: { testimonials?: TestimonialContent[] }) {
  const safeTestimonials = testimonials.filter((testimonial) => testimonial?.name && testimonial?.review);
  if (!safeTestimonials.length) return null;

  const avatarThemes = [
    { bg: 'bg-amber-100 border border-amber-200', text: 'text-amber-800' },
    { bg: 'bg-blue-100 border border-blue-200', text: 'text-blue-800' },
    { bg: 'bg-emerald-100 border border-emerald-200', text: 'text-emerald-800' },
    { bg: 'bg-purple-100 border border-purple-200', text: 'text-purple-800' },
    { bg: 'bg-indigo-100 border border-indigo-200', text: 'text-indigo-800' },
  ];

  const students = safeTestimonials.filter(t => !t.role?.toLowerCase().includes('parent'));
  const parents = safeTestimonials.filter(t => t.role?.toLowerCase().includes('parent'));

  // Select up to 2 students and up to 1 parent to match the 3-card grid strategy
  let displayedTestimonials: { item: TestimonialContent; type: 'student' | 'parent'; index: number }[] = [];
  
  if (parents.length > 0) {
    const selectedStudents = students.slice(0, 2);
    const selectedParent = parents.slice(0, 1);
    displayedTestimonials = [
      ...selectedStudents.map((t, i) => ({ item: t, type: 'student' as const, index: i })),
      ...selectedParent.map((t, i) => ({ item: t, type: 'parent' as const, index: i + selectedStudents.length }))
    ];
  } else {
    displayedTestimonials = safeTestimonials.slice(0, 3).map((t, i) => ({
      item: t,
      type: t.role?.toLowerCase().includes('parent') ? 'parent' as const : 'student' as const,
      index: i
    }));
  }

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto items-stretch">
            {displayedTestimonials.map(({ item: testimonial, type, index }) => {
              const isParent = type === 'parent';
              const theme = avatarThemes[index % avatarThemes.length];

              return (
                <article
                  key={`${testimonial.name}-${index}`}
                  className={cn(
                    "relative flex flex-col rounded-2xl border p-6 shadow-md hover:shadow-lg transition-all duration-500 ease-in-out",
                    isParent
                      ? "col-span-1 md:col-span-2 bg-[#FAF6EE] border-[#FBB040]/25"
                      : "col-span-1 bg-[#FFFDF5]/40 border-[#FBB040]/10"
                  )}
                >
                  {isParent && (
                    <Quote className="absolute right-6 top-6 h-12 w-12 text-[#FBB040]/10 rotate-180 pointer-events-none" />
                  )}

                  <div className="mb-4 flex items-center gap-3">
                    {testimonial.image?.url ? (
                      <img
                        src={testimonial.image.url}
                        alt={testimonial.image.alt || testimonial.name}
                        className="h-12 w-12 rounded-full object-cover border-2 border-[#FBB040]/20"
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
        </ScrollReveal>
      </div>
    </section>
  );
}
