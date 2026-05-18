import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Sparkles, LayoutDashboard, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { useNavigate } from 'react-router-dom';

const checklistItems = [
  "Hostel details configured",
  "Room inventory generated",
  "Pricing plans activated",
  "Payment tracking enabled",
  "Owner dashboard ready"
];

const SetupComplete = () => {
  const navigate = useNavigate();
  const [showChecklist, setShowChecklist] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowChecklist(true), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <OnboardingLayout>
      <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-8 md:p-12 text-center relative overflow-hidden">
        {/* Decorative background sparks */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-ops-accent/10 rounded-full opacity-50 blur-3xl"
        />
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-50 rounded-full opacity-50 blur-3xl"
        />

        <div className="relative z-10">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 12, stiffness: 100, delay: 0.2 }}
            className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-emerald-50"
          >
            <CheckCircle2 className="w-12 h-12" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight">You're All Set!</h1>
            <p className="text-slate-500 mb-10 max-w-xs mx-auto">
              Your hostel management dashboard is ready. Welcome to the future of property management.
            </p>
          </motion.div>

          <div className="max-w-xs mx-auto space-y-3 mb-12">
            {checklistItems.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={showChecklist ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 1 + (idx * 0.15) }}
                className="flex items-center gap-3 text-left"
              >
                <div className="w-5 h-5 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <span className="text-sm font-semibold text-slate-700">{item}</span>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2 }}
          >
            <Button 
              onClick={() => navigate('/dashboard')}
              className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black text-xl shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 group"
            >
              <LayoutDashboard className="w-6 h-6" />
              Open Dashboard
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            
            <p className="mt-6 text-slate-400 text-xs font-medium flex items-center justify-center gap-2">
              <Sparkles className="w-3 h-3" />
              Powered by HosteFlow Premium
            </p>
          </motion.div>
        </div>
      </div>
    </OnboardingLayout>
  );
};

export default SetupComplete;
