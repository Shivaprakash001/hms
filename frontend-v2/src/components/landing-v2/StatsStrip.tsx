import { ScrollReveal } from './ScrollReveal';
import type { LandingAvailability } from './landingTypes';

function rupee(value: number | null | undefined) {
  const price = value || 8000;
  return `₹${Number(price).toLocaleString('en-IN')}+`;
}

export function StatsStrip({ availability }: { availability?: LandingAvailability }) {
  const stats = [
    { number: '2', label: 'Hostel Buildings' },
    { number: '4', label: 'Sharing Rooms' },
    { number: rupee(availability?.startingPrice), label: 'Starting Price' },
    { number: '9+', label: 'Amenities' },
  ];

  return (
    <section className="bg-[#F07B1D] py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((stat, index) => (
            <ScrollReveal key={index} delay={index * 0.1}>
              <div className="text-center text-white">
                <div
                  className="text-3xl md:text-4xl font-bold mb-1"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {stat.number}
                </div>
                <div className="text-sm md:text-base opacity-90">{stat.label}</div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
