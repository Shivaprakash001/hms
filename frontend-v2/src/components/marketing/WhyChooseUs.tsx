import { UtensilsCrossed, Home, MapPin } from 'lucide-react';

export function WhyChooseUs() {
  const features = [
    {
      icon: UtensilsCrossed,
      title: 'Homely Food',
      description: "Fresh, daily meals included — just like mom's cooking",
      image: 'https://images.unsplash.com/photo-1542367592-8849eb950fd8?w=800&q=80',
    },
    {
      icon: Home,
      title: 'Homely Atmosphere',
      description: 'Warm, safe & comfortable — designed for students',
      image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&q=80',
    },
    {
      icon: MapPin,
      title: 'Prime Location',
      description: '400m from SNIST gate — walk in 5 minutes',
      image: 'https://images.unsplash.com/photo-1779062553813-e2047a686036?w=800&q=80',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-[#f5f0e8]">
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
                className="group relative rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 cursor-default"
                style={{ minHeight: '380px' }}
              >
                {/* Background image */}
                <img
                  src={feature.image}
                  alt={feature.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />

                {/* Gradient overlay — stronger at bottom for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />

                {/* Saffron accent strip at top */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#F07B1D]" />

                {/* Content */}
                <div className="relative h-full flex flex-col justify-end p-8" style={{ minHeight: '380px' }}>
                  {/* Icon badge */}
                  <div className="w-14 h-14 bg-[#F07B1D] rounded-full flex items-center justify-center mb-5 shadow-lg">
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  <h3
                    className="text-2xl font-bold text-white mb-3 drop-shadow-md"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-white/85 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
