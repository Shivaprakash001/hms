import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { legalSections } from '../../content/legal';

export function LegalPage() {
  const { hash } = useLocation();

  useEffect(() => {
    document.title = "Legal & Policies | Trishul Solutions";
    if (hash) {
      const element = document.getElementById(hash.replace('#', ''));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [hash]);

  const navLinks = legalSections.map((section: any) => ({
    id: section.id,
    title: section.title,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground antialiased pb-20">
      <header className="bg-card text-card-foreground border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <p className="text-accent text-xs font-bold uppercase tracking-[0.2em] mb-4">
            Trishul Solutions
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Legal & Policies
          </h1>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Our commitment to transparency, privacy, and fair usage of the HMS platform.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {navLinks.map(({ id, title }) => (
              <a
                key={id}
                href={`#${id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium transition-colors border border-border"
              >
                {title}
              </a>
            ))}
          </div>
        </div>
      </header>

      <main id="legal-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-20">
        {legalSections.map((section: any) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-heading`}
            className="scroll-mt-[72px]"
          >
            <div className="pb-6 mb-8 border-b-2 border-accent">
              <h2 id={`${section.id}-heading`} className="text-2xl sm:text-3xl font-bold">
                {section.title}
              </h2>
              {section.subtitle && (
                <p className="mt-2 text-muted-foreground text-base">{section.subtitle}</p>
              )}
              {section.lastUpdated && (
                <p className="mt-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Last updated: {section.lastUpdated}
                </p>
              )}
            </div>

            <div className="space-y-4">
              {section.content.map((block: any, idx: number) => {
                switch (block.type) {
                  case 'subheading':
                    return (
                      <h3 key={idx} className="text-base font-semibold pt-4 pb-1">
                        {block.text}
                      </h3>
                    );
                  case 'notice':
                    return (
                      <div key={idx} role="note" className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-5 py-4">
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 leading-relaxed">
                          {block.text}
                        </p>
                      </div>
                    );
                  case 'contact_list':
                    return (
                      <div key={idx} className="mt-2 rounded-xl border border-border overflow-hidden">
                        {block.items.map((item: any, i: number) => (
                          <div
                            key={i}
                            className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-5 py-3.5 ${
                              i % 2 === 0 ? 'bg-muted/50' : 'bg-transparent'
                            }`}
                          >
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28 shrink-0">
                              {item.label}
                            </span>
                            <span className="font-medium">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  default:
                    return (
                      <p key={idx} className="text-muted-foreground leading-7 text-[0.9375rem]">
                        {block.text}
                      </p>
                    );
                }
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
