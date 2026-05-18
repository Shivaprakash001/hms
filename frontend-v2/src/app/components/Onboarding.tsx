import { useState } from 'react';
import { Building2, Users, DollarSign, BarChart3, ArrowRight, Check } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const steps = [
  {
    icon: Building2,
    title: 'Manage Multiple Properties',
    description: 'Operate all your hostels and PGs from one centralized platform',
    color: 'bg-accent',
  },
  {
    icon: Users,
    title: 'Track Tenants & Rooms',
    description: 'Manage tenant information, room allocation, and occupancy in real-time',
    color: 'bg-[#3B82F6]',
  },
  {
    icon: DollarSign,
    title: 'Automated Financials',
    description: 'Track payments, expenses, and revenue with automated insights',
    color: 'bg-[#10B981]',
  },
  {
    icon: BarChart3,
    title: 'Business Analytics',
    description: 'Make data-driven decisions with occupancy trends and financial reports',
    color: 'bg-[#8B5CF6]',
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const step = steps[currentStep];
  const Icon = step.icon;

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Skip Button */}
      <div className="flex justify-end p-4">
        <button
          onClick={handleSkip}
          className="text-sm text-muted-foreground font-medium px-4 py-2"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        {/* Icon */}
        <div className={`${step.color} w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-lg`}>
          <Icon className="w-12 h-12 text-white" />
        </div>

        {/* Title & Description */}
        <h2 className="text-2xl font-semibold text-foreground text-center mb-3">
          {step.title}
        </h2>
        <p className="text-base text-muted-foreground text-center max-w-sm">
          {step.description}
        </p>
      </div>

      {/* Bottom Section */}
      <div className="px-6 pb-8 space-y-6">
        {/* Progress Indicators */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all ${
                index === currentStep
                  ? 'w-8 bg-accent'
                  : index < currentStep
                  ? 'w-1.5 bg-accent/60'
                  : 'w-1.5 bg-border'
              }`}
            />
          ))}
        </div>

        {/* Next/Get Started Button */}
        <button
          onClick={handleNext}
          className="w-full bg-accent text-accent-foreground py-4 rounded-xl font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm"
        >
          <span>{currentStep === steps.length - 1 ? 'Get Started' : 'Next'}</span>
          {currentStep === steps.length - 1 ? (
            <Check className="w-5 h-5" />
          ) : (
            <ArrowRight className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
