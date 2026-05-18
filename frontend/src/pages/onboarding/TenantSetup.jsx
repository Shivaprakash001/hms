import React from 'react';
import { motion } from 'react-router-dom';
import { UserPlus, User, Phone, Home, IndianRupee, ArrowRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { useNavigate } from 'react-router-dom';

const TenantSetup = () => {
  const navigate = useNavigate();

  return (
    <OnboardingLayout>
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 md:p-12">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <UserPlus className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Add Your First Tenant</h1>
          <p className="text-slate-500 text-sm">Let's start by adding one tenant to see how it works.</p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Tenant Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Alex Johnson" className="pl-10 h-12 rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="+91 90000 00000" className="pl-10 h-12 rounded-xl" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Assign Room</label>
              <div className="relative">
                <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select className="w-full h-12 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-100 appearance-none">
                  <option>Select Room</option>
                  <option>Room 101</option>
                  <option>Room 102</option>
                  <option>Room 103</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Monthly Rent</label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="8000" className="pl-10 h-12 rounded-xl" />
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 flex items-center gap-4">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm flex-shrink-0">
              <SkipForward className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-600 font-medium">You can upload documents and ID proofs later.</p>
              <button 
                onClick={() => navigate('/onboarding/complete')}
                className="text-xs font-bold text-ops-accent hover:underline"
              >
                Skip this for now
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12 flex gap-4">
          <Button 
            onClick={() => navigate('/onboarding/complete')}
            className="h-14 flex-1 bg-brand-gradient text-white rounded-2xl font-black text-lg shadow-xl shadow-purple-200 flex items-center justify-center gap-3 group"
          >
            Finish Setup
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  );
};

export default TenantSetup;
