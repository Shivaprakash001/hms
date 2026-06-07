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
                <article className="overflow-hidden rounded-2xl border border-[#F07B1D]/10 bg-[#FFFDF5] shadow-md">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={image.url}
                      alt={image.alt}
                      loading={index < 2 ? 'eager' : 'lazy'}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                  {(image.caption || image.title || image.category) && (
                    <div className="p-4">
                      <p className="font-semibold text-[#1B2D5B]">{image.caption || image.title}</p>
                      {image.category && <p className="mt-1 text-xs uppercase tracking-wide text-[#F07B1D]">{image.category}</p>}
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
