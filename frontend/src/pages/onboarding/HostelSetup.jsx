import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building, MapPin, Layers, LayoutGrid, Users, 
  Wifi, Coffee, Shirt, Car, Battery, BookOpen, Video,
  Image as ImageIcon, Phone, ArrowRight, ArrowLeft, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { useNavigate } from 'react-router-dom';

const steps = [
  { id: 1, title: 'Basic Details' },
  { id: 2, title: 'Structure' },
  { id: 3, title: 'Amenities' },
  { id: 4, title: 'Branding' }
];

const HostelSetup = () => {
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
    if (currentStep < 4) setCurrentStep(currentStep + 1);
    else navigate('/onboarding/room-setup');
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const toggleAmenity = (amenity) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity) 
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const updateCount = (field, delta) => {
    setFormData(prev => ({
      ...prev,
      [field]: Math.max(1, prev[field] + delta)
    }));
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Hostel Name</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Grand Residency" 
                    className="pl-10 h-12 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {['Boys Hostel', 'Girls Hostel', 'Mixed PG', 'Working PG'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFormData({...formData, type})}
                    className={`p-4 rounded-2xl border-2 transition-all text-sm font-bold ${formData.type === type ? 'border-purple-500 bg-ops-accent/10 text-purple-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-4 w-4 h-4 text-slate-400" />
                  <textarea 
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="123, Luxury Street, Near Metro Station"
                    className="w-full pl-10 pt-3 pb-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none text-sm min-h-[100px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input 
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  placeholder="City" 
                  className="h-12 rounded-xl" 
                />
                <Input 
                  value={formData.pincode}
                  onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                  placeholder="Pincode" 
                  className="h-12 rounded-xl" 
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
            {[
              { label: 'Number of Floors', field: 'floors', icon: <Layers className="w-5 h-5" /> },
              { label: 'Number of Rooms', field: 'rooms', icon: <LayoutGrid className="w-5 h-5" /> },
              { label: 'Total Bed Capacity', field: 'capacity', icon: <Users className="w-5 h-5" /> }
            ].map((item) => (
              <div key={item.field} className="flex items-center justify-between p-6 rounded-3xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-ops-accent shadow-sm">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{item.label}</h3>
                    <p className="text-xs text-slate-500">Manage {item.label.toLowerCase()} easily</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => updateCount(item.field, -1)}
                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    -
                  </button>
                  <span className="text-xl font-bold text-slate-900 w-8 text-center">{formData[item.field]}</span>
                  <button 
                    onClick={() => updateCount(item.field, 1)}
                    className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white hover:bg-purple-700 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        );
      case 3:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-4"
          >
            {[
              { id: 'wifi', name: 'WiFi', icon: <Wifi /> },
              { id: 'food', name: 'Food', icon: <Coffee /> },
              { id: 'laundry', name: 'Laundry', icon: <Shirt /> },
              { id: 'parking', name: 'Parking', icon: <Car /> },
              { id: 'backup', name: 'Power Backup', icon: <Battery /> },
              { id: 'study', name: 'Study Area', icon: <BookOpen /> },
              { id: 'cctv', name: 'CCTV', icon: <Video /> }
            ].map((amenity) => (
              <button
                key={amenity.id}
                onClick={() => toggleAmenity(amenity.id)}
                className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${formData.amenities.includes(amenity.id) ? 'border-purple-500 bg-ops-accent/10 text-purple-700' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${formData.amenities.includes(amenity.id) ? 'bg-white shadow-sm' : 'bg-slate-50'}`}>
                  {React.cloneElement(amenity.icon, { className: "w-6 h-6" })}
                </div>
                <span className="text-xs font-bold uppercase tracking-tight">{amenity.name}</span>
              </button>
            ))}
          </motion.div>
        );
      case 4:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex flex-col items-center">
              <div className="relative group cursor-pointer">
                <div className="w-32 h-32 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 group-hover:border-purple-400 group-hover:bg-ops-accent/10 transition-all">
                  <ImageIcon className="w-8 h-8 mb-2" />
                  <span className="text-[10px] font-bold uppercase">Upload Logo</span>
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center justify-center text-ops-accent">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-500">Click to upload your hostel logo</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Primary Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+91 9876543210" 
                    className="pl-10 h-12 rounded-xl"
                  />
                </div>
              </div>
              <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100 flex gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-600 shadow-sm flex-shrink-0">
                  <Star className="w-5 h-5" />
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Pro Tip:</strong> Branded hostels with logos and clear photos get <span className="font-bold underline">40% more</span> bookings on our platform.
                </p>
              </div>
            </div>
          </motion.div>
        );
      default: return null;
    }
  };

  return (
    <OnboardingLayout>
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 md:p-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Hostel Setup</h1>
            <p className="text-slate-500 text-sm">Step {currentStep} of 4: {steps[currentStep-1].title}</p>
          </div>
          <div className="flex gap-1.5">
            {steps.map((step) => (
              <div 
                key={step.id} 
                className={`h-2 rounded-full transition-all duration-500 ${step.id === currentStep ? 'w-8 bg-purple-600' : 'w-2 bg-slate-100'}`} 
              />
            ))}
          </div>
        </div>

        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-4 mt-12 pt-8 border-t border-slate-50">
          {currentStep > 1 && (
            <Button 
              variant="outline" 
              onClick={prevStep}
              className="h-14 px-8 border-slate-200 text-slate-600 rounded-2xl font-bold flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </Button>
          )}
          <Button 
            onClick={nextStep}
            className={`h-14 flex-1 bg-brand-gradient text-white rounded-2xl font-black text-lg shadow-xl shadow-purple-100 flex items-center justify-center gap-3 group`}
          >
            {currentStep === 4 ? 'Complete Setup' : 'Continue'}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  );
};

export default HostelSetup;
