import { UtensilsCrossed, Home, MapPin } from 'lucide-react';

export function WhyChooseUs() {
  const features = [
    {
      icon: UtensilsCrossed,
      title: 'Homely Food',
      description: 'Fresh, daily meals included — just like mom\'s cooking'
    },
    {
      icon: Home,
      title: 'Homely Atmosphere',
      description: 'Warm, safe & comfortable — designed for students'
    },
    {
      icon: MapPin,
      title: 'Prime Location',
      description: '400m from SNIST gate — walk in 5 minutes'
    }
  ];

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <h2
          className="text-3xl md:text-4xl text-center text-[#1B2D5B] mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Why Choose Us
        </h2>
        <p className="text-center text-[#2C2C2A] mb-12 max-w-2xl mx-auto">
          We provide more than just accommodation — we create a home away from home for students
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-[#FFFDF5] p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow border border-[#F07B1D]/10"
              >
                <div className="w-16 h-16 bg-[#F07B1D] rounded-full flex items-center justify-center mb-6">
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-[#1B2D5B] mb-3">
                  {feature.title}
                </h3>
                <p className="text-[#2C2C2A]">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
