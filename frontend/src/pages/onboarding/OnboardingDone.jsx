import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Sparkles, LayoutDashboard, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';

const checklistItems = [
  "Hostel details configured",
  "Room inventory generated",
  "Pricing plans activated",
  "Payment tracking enabled",
  "Owner dashboard ready"
];

export default function OnboardingDone() {
  const navigate = useNavigate();
  const [showChecklist, setShowChecklist] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowChecklist(true), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 p-8 md:p-16 text-center relative overflow-hidden w-full max-w-2xl mx-auto">
      {/* Decorative background sparks */}
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute top-0 right-0 -mr-24 -mt-24 w-80 h-80 bg-purple-50 rounded-full opacity-60 blur-[100px]"
      />
      <motion.div 
        animate={{ rotate: -360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-0 left-0 -ml-24 -mb-24 w-80 h-80 bg-indigo-50 rounded-full opacity-60 blur-[100px]"
      />

      <div className="relative z-10">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 12, stiffness: 100, delay: 0.2 }}
          className="w-32 h-32 bg-emerald-50 text-emerald-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-emerald-100/50"
        >
          <CheckCircle2 className="w-16 h-16" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tighter">You're All Set!</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-12">Property Management Reimagined</p>
        </motion.div>

        <div className="max-w-xs mx-auto space-y-4 mb-14">
          {checklistItems.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={showChecklist ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 1 + (idx * 0.15) }}
              className="flex items-center gap-4 text-left p-2 rounded-2xl hover:bg-slate-50 transition-colors group"
            >
              <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-200">
                <Check className="w-3.5 h-3.5 stroke-[4]" />
              </div>
              <span className="text-sm font-bold text-slate-700 tracking-tight group-hover:text-slate-900 transition-colors">{item}</span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2 }}
          className="space-y-6"
        >
          <Button 
            onClick={() => navigate('/dashboard')}
            className="w-full h-18 bg-slate-900 text-white rounded-[1.5rem] font-black text-2xl shadow-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-4 group active:scale-95"
          >
            <LayoutDashboard className="w-7 h-7" />
            Go to Dashboard
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </Button>
          
          <div className="flex items-center justify-center gap-3">
            <div className="h-px flex-1 bg-slate-100" />
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-purple-400" />
              Powered by HosteFlow Premium
            </p>
            <div className="h-px flex-1 bg-slate-100" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
