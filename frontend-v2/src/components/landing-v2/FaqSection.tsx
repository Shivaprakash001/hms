import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ScrollReveal, StaggerReveal, StaggerItem } from './ScrollReveal';
import type { FaqContent } from '@lib/sanity/landingContent';

export function FaqSection({ faqs = [] }: { faqs?: FaqContent[] }) {
  const safeFaqs = faqs.filter((faq) => faq?.question && faq?.answer);
  const [openQuestion, setOpenQuestion] = useState<string | null>(safeFaqs[0]?.question || null);

  if (!safeFaqs.length) return null;

  return (
    <section className="py-16 md:py-24 bg-[#FFFDF5]">
      <div className="max-w-4xl mx-auto px-4">
        <ScrollReveal>
          <h2
            className="text-3xl md:text-4xl text-center text-[#1B2D5B] mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Questions Parents Ask
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <p className="text-center text-[#2C2C2A] mb-10">
            Clear answers before you plan a visit.
          </p>
        </ScrollReveal>

        <StaggerReveal staggerDelay={0.08}>
          <div className="space-y-3">
            {safeFaqs.map((faq) => {
              const isOpen = openQuestion === faq.question;
              return (
                <StaggerItem key={faq.question}>
                  <article className="rounded-xl border border-[#F07B1D]/15 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => setOpenQuestion(isOpen ? null : faq.question)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <div>
                        <h3 className="font-semibold text-[#1B2D5B]">{faq.question}</h3>
                      </div>
                      <ChevronDown className={`h-5 w-5 flex-shrink-0 text-[#F07B1D] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <p className="border-t border-[#F07B1D]/10 px-5 py-4 text-sm leading-6 text-[#2C2C2A]/80">
                        {faq.answer}
                      </p>
                    )}
                  </article>
                </StaggerItem>
              );
            })}
          </div>
        </StaggerReveal>
      </div>
    </section>
  );
}
