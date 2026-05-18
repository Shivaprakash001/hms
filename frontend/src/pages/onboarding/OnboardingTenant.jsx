import React from 'react';
import { UserPlus, User, Phone, Home, IndianRupee, ArrowRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useNavigate } from 'react-router-dom';

export default function OnboardingTenant() {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-8 md:p-12">
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-50/50">
          <UserPlus className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Add First Tenant</h1>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Let's start your digital ledger</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tenant Full Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Alex Johnson" className="pl-11 h-14 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white text-base font-medium transition-all" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="+91 90000 00000" className="pl-11 h-14 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white text-base font-medium transition-all" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Assign Room</label>
            <div className="relative">
              <Home className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select className="w-full h-14 pl-11 pr-4 bg-slate-50/50 border border-slate-100 rounded-2xl text-base font-medium outline-none focus:bg-white focus:ring-2 focus:ring-purple-100 appearance-none transition-all cursor-pointer">
                <option>Select a generated room</option>
                <option>Room 101</option>
                <option>Room 102</option>
                <option>Room 103</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Monthly Rent</label>
            <div className="relative">
              <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="8000" className="pl-11 h-14 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white text-base font-medium transition-all" />
            </div>
          </div>
        </div>

        <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 flex flex-col sm:flex-row items-center gap-6 mt-8">
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-md flex-shrink-0">
            <SkipForward className="w-7 h-7" />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-xs text-slate-600 font-bold uppercase tracking-tight mb-1">Don't have tenant details yet?</p>
            <p className="text-slate-400 text-xs leading-relaxed mb-3">You can skip this step and add tenants from the dashboard later.</p>
            <button 
              onClick={() => navigate('/onboarding/done')}
              className="text-xs font-black text-ops-accent hover:text-purple-700 transition-colors uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1"
            >
              Skip this for now
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <Button 
          onClick={() => navigate('/onboarding/done')}
          className="w-full h-16 bg-brand-gradient text-white rounded-2xl font-black text-xl shadow-2xl shadow-purple-200 flex items-center justify-center gap-4 group hover:scale-[1.02] active:scale-95 transition-all"
        >
          Finish Onboarding
          <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
