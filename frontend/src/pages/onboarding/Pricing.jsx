import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Zap, Star, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { useNavigate } from 'react-router-dom';

const plans = [
  {
    name: "Free Plan",
    price: "0",
    icon: <Zap className="w-5 h-5" />,
    features: ["Up to 10 tenants", "Basic rent tracking", "Manual reminders", "Standard support"],
    cta: "Start Free",
    recommended: false,
    color: "slate"
  },
  {
    name: "Standard Plan",
    price: "999",
    icon: <Star className="w-5 h-5" />,
    features: ["Up to 100 tenants", "WhatsApp reminders", "Analytics dashboard", "Online payments"],
    cta: "Select Standard",
    recommended: true,
    color: "purple"
  },
  {
    name: "Growth Plan",
    price: "2499",
    icon: <Rocket className="w-5 h-5" />,
    features: ["Unlimited tenants", "Advanced reports", "Team access", "Automated workflows"],
    cta: "Select Growth",
    recommended: false,
    color: "indigo"
  }
];

const Pricing = () => {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const navigate = useNavigate();

  return (
    <OnboardingLayout>
      <div className="w-full max-w-5xl mx-auto py-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Choose Your Plan</h1>
          <p className="text-slate-600 mb-8">Transparent pricing for hostels of all sizes.</p>
          
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-500'}`}>Monthly</span>
            <button 
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="w-14 h-7 bg-slate-200 rounded-full p-1 relative transition-colors duration-300 focus:outline-none"
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-0'}`} />
            </button>
            <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-slate-900' : 'text-slate-500'}`}>
              Yearly <span className="text-emerald-600 text-[10px] bg-emerald-50 px-2 py-0.5 rounded-full ml-1 font-bold">SAVE 20%</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          {plans.map((plan, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`relative bg-white rounded-3xl p-8 border-2 transition-all duration-300 ${plan.recommended ? 'border-purple-500 shadow-2xl shadow-purple-100 scale-105 z-10' : 'border-slate-100 shadow-xl hover:border-slate-200'}`}
            >
              {plan.recommended && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full">
                  Recommended
                </div>
              )}
              
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${plan.recommended ? 'bg-purple-100 text-ops-accent' : 'bg-slate-100 text-slate-600'}`}>
                {plan.icon}
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold text-slate-900">₹{billingCycle === 'yearly' ? Math.floor(plan.price * 12 * 0.8) : plan.price}</span>
                <span className="text-slate-500 text-sm">/{billingCycle === 'yearly' ? 'year' : 'mo'}</span>
              </div>

              <div className="space-y-4 mb-8">
                {plan.features.map((feature, fIdx) => (
                  <div key={fIdx} className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${plan.recommended ? 'bg-purple-100 text-ops-accent' : 'bg-slate-100 text-slate-500'}`}>
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                    <span className="text-slate-600 text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <Button 
                onClick={() => navigate('/onboarding/setup')}
                className={`w-full h-12 rounded-xl font-bold transition-all duration-300 ${plan.recommended ? 'bg-brand-gradient text-white shadow-lg shadow-purple-100' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}
              >
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <button 
            onClick={() => navigate('/onboarding/setup')}
            className="text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            Continue to Setup
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </OnboardingLayout>
  );
};

export default Pricing;
