import { ScrollReveal, StaggerReveal, StaggerItem } from './ScrollReveal';
import type { GalleryImageContent } from '@lib/sanity/landingContent';

export function GallerySection({ images = [] }: { images?: GalleryImageContent[] }) {
  if (!images.length) return null;

  return (
    <section className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4">
        <ScrollReveal>
          <h2
            className="mb-4 text-center text-3xl text-[#1B2D5B] md:text-4xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Hostel Gallery
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <p className="mx-auto mb-12 max-w-2xl text-center text-[#2C2C2A]">
            A closer look at rooms, food, facilities, and daily hostel life.
          </p>
        </ScrollReveal>

        <StaggerReveal staggerDelay={0.08}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image, index) => (
              <StaggerItem key={`${image.url}-${index}`}>
                <article className="relative overflow-hidden rounded-2xl border border-[#F07B1D]/10 bg-[#FFFDF5] shadow-md aspect-[4/3] group">
                  <img
                    src={image.url}
                    alt={image.alt}
                    loading={index < 2 ? 'eager' : 'lazy'}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  {(image.caption || image.title || image.category) && (
                    <div className="absolute bottom-3 left-3 right-3 flex flex-col items-start gap-1">
                      {image.category && (
                        <span className="bg-[#F07B1D] text-white text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">
                          {image.category}
                        </span>
                      )}
                      <div className="bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-white max-w-[95%] truncate border border-white/10">
                        {image.caption || image.title}
                      </div>
                    </div>
                  )}
                </article>
              </StaggerItem>
            ))}
          </div>
        </StaggerReveal>
      </div>
    </section>
  );
}
