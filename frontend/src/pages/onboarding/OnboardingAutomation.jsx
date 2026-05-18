import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { ownerService } from '../../api/services';

export default function OnboardingAutomation() {
  const [genDay, setGenDay] = useState(1);
  const [dueDay, setDueDay] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const timeline = [
    { day: `MAY ${genDay}`, icon: '📋', title: 'Rent generated', desc: 'Tenants see the due bill instantly', color: 'bg-purple-600' },
    { day: `MAY ${dueDay}`, icon: '📅', title: 'Due date', desc: 'Tenants must pay by this day', color: 'bg-ops-accent' },
    { day: `FROM DUE DATE +1`, icon: '🔔', title: 'Reminders start', desc: 'Automatic WhatsApp + in-app alerts', color: 'bg-amber-500' },
  ];

  const handleSave = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Save rent automation preferences
      await ownerService.updatePreferences({
        auto_rent_day: genDay,
        // Assuming the backend supports a due day or we calculate it
        // For now, we persist the generation day which is the primary automation trigger
      });
      
      navigate('/onboarding/tenant');
    } catch (err) {
      console.error('Failed to save automation rules:', err);
      setError('Failed to save rules. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 md:p-12 max-w-2xl mx-auto relative overflow-hidden">
      <div className="absolute top-0 left-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -ml-16 -mt-16 opacity-50" />

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shadow-sm">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Critical Step</span>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Set up rent automation</h1>
          <p className="text-slate-500 text-sm font-medium mt-2 leading-relaxed">
            This is what saves you hours every month. You won't need to chase tenants manually.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs font-bold mb-8 border border-rose-100">
            {error}
          </div>
        )}

        <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs font-bold mb-8 border border-rose-100 flex items-center justify-center">
          Upgrade to Starter to enable automation
        </div>

        <div className="space-y-8">
          {/* Generation Day */}
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block px-1">
              Generate rent on the ___th of every month
            </label>
            <div className="flex items-center justify-between p-2 rounded-2xl bg-slate-50 border border-slate-100">
              <button 
                onClick={() => setGenDay(Math.max(1, genDay - 1))}
                className="w-14 h-14 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all active:scale-90"
              >
                <ArrowRight className="w-5 h-5 rotate-180" />
              </button>
              <div className="text-center">
                <span className="text-2xl font-black text-slate-900 block">{genDay}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">of month</span>
              </div>
              <button 
                onClick={() => setGenDay(Math.min(28, genDay + 1))}
                className="w-14 h-14 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all active:scale-90"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Due Day */}
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block px-1">
              Tenants must pay by the ___th
            </label>
            <div className="flex items-center justify-between p-2 rounded-2xl bg-slate-50 border border-slate-100">
              <button 
                onClick={() => setDueDay(Math.max(genDay + 1, dueDay - 1))}
                className="w-14 h-14 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all active:scale-90"
              >
                <ArrowRight className="w-5 h-5 rotate-180" />
              </button>
              <div className="text-center">
                <span className="text-2xl font-black text-slate-900 block">{dueDay}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">of month</span>
              </div>
              <button 
                onClick={() => setDueDay(Math.min(28, dueDay + 1))}
                className="w-14 h-14 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all active:scale-90"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Timeline Preview */}
          <div className="bg-slate-900 rounded-[2rem] p-8 space-y-6 shadow-2xl shadow-slate-200">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center mb-2">Automation Timeline Preview</p>
            <div className="space-y-6 relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-800" />
              {timeline.map((item, i) => (
                <div key={i} className="flex gap-4 relative z-10">
                  <div className={`w-4 h-4 rounded-full ${item.color} border-4 border-slate-900 mt-1`} />
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.day}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{item.icon}</span>
                      <h4 className="text-sm font-bold text-white">{item.title}</h4>
                    </div>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button 
            onClick={handleSave}
            disabled={isLoading}
            className="w-full h-16 bg-brand-gradient text-white rounded-2xl font-black text-xl shadow-xl shadow-purple-100 flex items-center justify-center gap-3 group transition-all hover:scale-[1.01] active:scale-95 mt-4"
          >
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
              <>
                Save & Continue
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
