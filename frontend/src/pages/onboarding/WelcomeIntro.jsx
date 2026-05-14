import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Users, Zap, CreditCard, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { useNavigate } from 'react-router-dom';

const features = [
  {
    title: "Rent Automation",
    description: "Automated collection and reminders",
    icon: <Zap className="w-6 h-6 text-purple-600" />,
    color: "bg-purple-50"
  },
  {
    title: "Tenant Management",
    description: "Digital KYC and documents",
    icon: <Users className="w-6 h-6 text-blue-600" />,
    color: "bg-blue-50"
  },
  {
    title: "Real-time Tracking",
    description: "Instant dues and payment status",
    icon: <Sparkles className="w-6 h-6 text-amber-600" />,
    color: "bg-amber-50"
  },
  {
    title: "Online Payments",
    description: "UPI, Cards, and Netbanking",
    icon: <CreditCard className="w-6 h-6 text-emerald-600" />,
    color: "bg-emerald-50"
  }
];

const WelcomeIntro = () => {
  const navigate = useNavigate();

  return (
    <OnboardingLayout>
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 md:p-12 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -mr-8 -mt-8 opacity-50" />
        
        <div className="relative z-10 text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-6"
          >
            <Sparkles className="w-3 h-3" />
            Quick Setup
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
            Welcome to HosteFlow <span className="animate-pulse">👋</span>
          </h1>
          <p className="text-slate-600 text-lg">
            Setup your hostel and start managing in under 5 minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 + 0.3 }}
              whileHover={{ scale: 1.02, y: -2 }}
              className="p-5 rounded-2xl border border-slate-100 hover:border-purple-200 hover:shadow-lg hover:shadow-purple-50 transition-all duration-300 group cursor-default"
            >
              <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-4 group-hover:rotate-6 transition-transform`}>
                {feature.icon}
              </div>
              <h3 className="font-bold text-slate-900 mb-1">{feature.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        <div className="space-y-6">
          <Button 
            onClick={() => navigate('/onboarding/pricing')}
            className="w-full h-14 bg-brand-gradient hover:opacity-90 text-white rounded-2xl font-bold text-lg transition-all duration-300 shadow-xl shadow-purple-200 flex items-center justify-center gap-3 group"
          >
            Start Setup
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>

          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((step) => (
              <div 
                key={step} 
                className={`h-1.5 rounded-full transition-all duration-500 ${step === 1 ? 'w-8 bg-purple-600' : 'w-1.5 bg-slate-200'}`} 
              />
            ))}
          </div>
        </div>
      </div>
    </OnboardingLayout>
  );
};

export default WelcomeIntro;
