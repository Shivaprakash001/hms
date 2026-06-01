import { UtensilsCrossed, Home, MapPin } from 'lucide-react';
import { ScrollReveal, StaggerReveal, StaggerItem } from './ScrollReveal';

export function WhyChooseUs() {
  const features = [
    {
      icon: UtensilsCrossed,
      title: 'Homely Food',
      description: 'Fresh, daily meals included — just like mom\'s cooking',
      bgImage: 'https://images.unsplash.com/photo-1542367592-8849eb950fd8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'
    },
    {
      icon: Home,
      title: 'Homely Atmosphere',
      description: 'Warm, safe & comfortable — designed for students',
      bgImage: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'
    },
    {
      icon: MapPin,
      title: 'Prime Location',
      description: '400m from SNIST gate — walk in 5 minutes',
      bgImage: 'https://images.unsplash.com/photo-1779062553813-e2047a686036?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080'
    }
  ];

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <ScrollReveal>
          <h2
            className="text-3xl md:text-4xl text-center text-[#1B2D5B] mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Why Choose Us
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <p className="text-center text-[#2C2C2A] mb-12 max-w-2xl mx-auto">
            We provide more than just accommodation — we create a home away from home for students
          </p>
        </ScrollReveal>

        <StaggerReveal>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <StaggerItem key={index}>
                  <div className="relative bg-[#FFFDF5] rounded-xl shadow-lg hover:shadow-xl transition-shadow border border-[#F07B1D]/10 overflow-hidden group h-[280px] md:h-[320px]">
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                      style={{ backgroundImage: `url(${feature.bgImage})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                    <div className="relative h-full flex flex-col justify-end p-6 md:p-8">
                      <div className="w-12 h-12 md:w-14 md:h-14 bg-[#F07B1D] rounded-full flex items-center justify-center mb-4">
                        <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                      </div>
                      <h3 className="text-xl md:text-2xl font-semibold text-white mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-white/90 text-sm md:text-base">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </div>
        </StaggerReveal>
      </div>
    </section>
  );
}
