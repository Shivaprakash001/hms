import { Phone, Building2, Bed, FileCheck, Key } from 'lucide-react';
import { ScrollReveal, StaggerReveal, StaggerItem } from './ScrollReveal';

export function AdmissionProcess() {
  const steps = [
    {
      number: 1,
      icon: Phone,
      title: 'Reach Out',
      description: 'Call or WhatsApp Srinivasa Rao — get answers in minutes.'
    },
    {
      number: 2,
      icon: Building2,
      title: 'Visit the Hostel',
      description: 'Come see the room, food, and facilities in person.'
    },
    {
      number: 3,
      icon: Bed,
      title: 'Pick Your Room',
      description: 'Select your preferred block and bed. We show you who your roommates are.'
    },
    {
      number: 4,
      icon: FileCheck,
      title: 'Pay & Confirm',
      description: 'Simple deposit to reserve your bed. No hidden charges.'
    },
    {
      number: 5,
      icon: Key,
      title: 'Move In',
      description: 'Bring your things. Your home near SNIST is ready.',
      isLast: true
    }
  ];

  return (
    <section className="py-16 md:py-24 bg-[#FFFDF5]">
      <div className="max-w-7xl mx-auto px-4">
        <ScrollReveal>
          <h2
            className="text-3xl md:text-4xl text-center text-[#1B2D5B] mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            How Admission Works
          </h2>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <p className="text-center text-[#2C2C2A] mb-12 max-w-2xl mx-auto">
            Simple. Transparent. No surprises.
          </p>
        </ScrollReveal>

        <StaggerReveal>
          <div className="hidden md:flex justify-between items-start relative max-w-5xl mx-auto">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <StaggerItem key={index}>
                  <div className="flex flex-col items-center relative" style={{ width: '180px' }}>
                    {index < steps.length - 1 && (
                      <div className="absolute left-full top-6 w-full h-px border-t-2 border-dashed border-[#F07B1D]/30" style={{ marginLeft: '24px', width: 'calc(100% - 48px)' }} />
                    )}

                    <div className={`w-12 h-12 rounded-full ${step.isLast ? 'bg-[#1B2D5B]' : 'bg-[#F07B1D]'} text-white flex items-center justify-center font-bold text-xl mb-4 relative z-10`}>
                      {step.number}
                    </div>

                    <div className={`w-14 h-14 rounded-full ${step.isLast ? 'bg-[#1B2D5B]/10' : 'bg-[#F07B1D]/10'} flex items-center justify-center mb-3`}>
                      <Icon className={`w-7 h-7 ${step.isLast ? 'text-[#1B2D5B]' : 'text-[#F07B1D]'}`} />
                    </div>

                    <h3 className="font-semibold text-[#1B2D5B] mb-2 text-center text-sm">
                      {step.title}
                    </h3>

                    <p className="text-[#2C2C2A]/70 text-center text-xs leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </StaggerItem>
              );
            })}
          </div>

          <div className="md:hidden space-y-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <StaggerItem key={index}>
                  <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-[#F07B1D]">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-full ${step.isLast ? 'bg-[#1B2D5B]' : 'bg-[#F07B1D]'} text-white flex items-center justify-center font-bold text-xl flex-shrink-0`}>
                        {step.number}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-full ${step.isLast ? 'bg-[#1B2D5B]/10' : 'bg-[#F07B1D]/10'} flex items-center justify-center`}>
                            <Icon className={`w-5 h-5 ${step.isLast ? 'text-[#1B2D5B]' : 'text-[#F07B1D]'}`} />
                          </div>
                          <h3 className="font-semibold text-[#1B2D5B]">
                            {step.title}
                          </h3>
                        </div>
                        <p className="text-[#2C2C2A]/70 text-sm">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </div>
        </StaggerReveal>

        <ScrollReveal delay={0.8}>
          <div className="mt-12 max-w-2xl mx-auto">
            <div className="bg-[#F07B1D]/10 border-l-4 border-[#F07B1D] rounded-lg p-4 text-center">
              <p className="text-[#1B2D5B] font-medium">
                Most students complete admission in under 48 hours.
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
