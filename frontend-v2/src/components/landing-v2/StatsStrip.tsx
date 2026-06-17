import { ScrollReveal } from './ScrollReveal';
import type { LandingAvailability } from './landingTypes';

interface StatItem {
  value: string;
  label: string;
}

function rupee(value: number | null | undefined) {
  const price = value || 8000;
  return `₹${Number(price).toLocaleString('en-IN')}/mo`;
}

export function StatsStrip({
  stats,
  availability,
}: {
  stats?: StatItem[];
  availability?: LandingAvailability;
}) {
  const defaultStats: StatItem[] = [
    { value: '5 Min Walk', label: 'To SNIST campus gate' },
    { value: 'Homely Meals', label: 'Breakfast, lunch & dinner' },
    { value: rupee(availability?.startingPrice), label: 'Starting price, no hidden fees' },
    { value: '2 Blocks', label: 'Safe student buildings' },
    { value: '24/7 Wardens', label: 'Security & student support' },
  ];

  // Resolve dynamic values in stats array if needed
  const displayStats = (stats && stats.length > 0 ? stats : defaultStats).map((stat) => {
    let resolvedValue = stat.value;
    if (resolvedValue.includes('{{price}}') || resolvedValue.includes('8000')) {
      resolvedValue = resolvedValue.replace('{{price}}', rupee(availability?.startingPrice)).replace('8000', Number(availability?.startingPrice || 8000).toLocaleString('en-IN'));
    }
    return {
      ...stat,
      value: resolvedValue,
    };
  });

  return (
    <section className="bg-[#F07B1D] py-6 border-y border-[#1B2D5B]/10 relative">
      <div className="max-w-7xl mx-auto px-4">
        {/* Horizontal scroll on mobile, regular grid on desktop */}
        <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none gap-4 pb-3 -mx-4 px-4 md:grid md:grid-cols-3 lg:grid-cols-5 md:gap-6 md:pb-0 md:mx-0 md:px-0">
          {displayStats.map((stat, index) => (
            <div key={index} className="min-w-[190px] flex-shrink-0 snap-center md:min-w-0 md:flex-1">
              <ScrollReveal delay={index * 0.05} className="h-full">
                <div className="text-center text-[#1B2D5B] p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-[#1B2D5B]/10 hover:border-[#1B2D5B]/25 hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-0.5 shadow-sm flex flex-col justify-center h-full">
                  <div
                    className="text-xl md:text-2xl font-extrabold mb-1 tracking-tight"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {stat.value}
                  </div>
                  <div className="text-[11px] md:text-xs text-[#1B2D5B]/85 font-semibold leading-snug">{stat.label}</div>
                </div>
              </ScrollReveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
