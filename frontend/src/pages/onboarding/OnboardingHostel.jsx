import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building, MapPin, 
  Image as ImageIcon, Phone, ArrowRight, ArrowLeft, CheckCircle2, Star
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useNavigate } from 'react-router-dom';

const steps = [
  { id: 1, title: 'Basic Details' },
  { id: 2, title: 'Branding' }
];

export default function OnboardingHostel() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    type: 'Boys Hostel',
    address: '',
    city: '',
    state: '',
    pincode: '',
    floors: 1,
    rooms: 1,
    capacity: 1,
    amenities: [],
    phone: '',
    logo: null
  });

  const navigate = useNavigate();

  const nextStep = () => {
    if (currentStep < 2) setCurrentStep(currentStep + 1);
    else navigate('/onboarding/rooms');
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const renderStep = () => {
    switch(currentStep) {
      case 1:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
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
          </motion.div>
        );
      case 2:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex flex-col items-center">
              <div className="relative group cursor-pointer">
                <div className="w-40 h-40 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 group-hover:border-purple-400 group-hover:bg-purple-50 transition-all">
                  <ImageIcon className="w-10 h-10 mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Upload Logo</span>
                </div>
                <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-2xl shadow-xl border border-slate-100 flex items-center justify-center text-purple-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
              <p className="mt-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Hostel Branding</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contact Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+91 9876543210" 
                    className="pl-11 h-14 rounded-2xl border-slate-100 bg-slate-50/50"
                  />
                </div>
              </div>
              <div className="p-6 rounded-[2rem] bg-indigo-50 border border-indigo-100 flex gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-md flex-shrink-0">
                  <Star className="w-6 h-6" />
                </div>
                <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                  A professional profile builds trust with tenants. Add high-quality photos later to increase your booking rate by up to <strong>40%</strong>.
                </p>
              </div>
            </div>
          </motion.div>
        );
      default: return null;
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 md:p-12">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Hostel Setup</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
            Step {currentStep} of 2: <span className="text-purple-600">{steps[currentStep-1].title}</span>
          </p>
        </div>
      </div>

      <div className="min-h-[440px]">
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-4 mt-12 pt-8 border-t border-slate-50">
        {currentStep > 1 && (
          <Button 
            variant="outline" 
            onClick={prevStep}
            className="h-14 px-8 border-slate-100 text-slate-400 rounded-2xl font-bold hover:text-slate-900 hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </Button>
        )}
        <Button 
          onClick={nextStep}
          className={`h-14 flex-1 bg-brand-gradient text-white rounded-2xl font-black text-lg shadow-xl shadow-purple-100 flex items-center justify-center gap-3 group transition-all hover:scale-[1.02] active:scale-95`}
        >
          {currentStep === 2 ? 'Complete Setup' : 'Continue'}
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
