import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building, MapPin, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useNavigate } from 'react-router-dom';

export default function OnboardingHostel() {
  const [formData, setFormData] = useState({
    name: '',
    type: 'Boys Hostel',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  const navigate = useNavigate();

  const handleContinue = () => {
    // In a real app, we'd save the hostel details here
    navigate('/onboarding/automation');
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 md:p-12">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Hostel Details</h1>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
          Tell us about your property to get started
        </p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Hostel Name</label>
            <div className="relative">
              <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Grand Residency" 
                className="pl-11 h-14 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white transition-all text-base font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {['Boys Hostel', 'Girls Hostel', 'Mixed PG', 'Working PG'].map((type) => (
              <button
                key={type}
                onClick={() => setFormData({...formData, type})}
                className={`p-4 rounded-2xl border-2 transition-all text-xs font-bold uppercase tracking-tight ${formData.type === type ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-lg shadow-purple-50' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Address</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
              <textarea 
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="123, Luxury Street, Near Metro Station"
                className="w-full pl-11 pt-4 pb-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-purple-100 outline-none text-base font-medium min-h-[120px] transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              value={formData.city}
              onChange={(e) => setFormData({...formData, city: e.target.value})}
              placeholder="City" 
              className="h-14 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white" 
            />
            <Input 
              value={formData.pincode}
              onChange={(e) => setFormData({...formData, pincode: e.target.value})}
              placeholder="Pincode" 
              className="h-14 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white" 
            />
          </div>
        </div>

        <div className="pt-10">
          <Button 
            onClick={handleContinue}
            className="w-full h-14 bg-brand-gradient text-white rounded-2xl font-black text-lg shadow-xl shadow-purple-100 flex items-center justify-center gap-3 group transition-all hover:scale-[1.01] active:scale-95"
          >
            Continue to Automation
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
