import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, MapPin, Phone, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useNavigate } from 'react-router-dom';
import { ownerService } from '../../api/services';

export default function OnboardingHostel() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  });

  const handleNext = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.address) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      // Save property details to the backend
      await ownerService.updateHostel({
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
      });
      
      // Move to the next step
      navigate('/onboarding/automation');
    } catch (err) {
      console.error('Failed to save hostel details:', err);
      setError(err.response?.data?.message || 'Failed to save details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 md:p-12 max-w-2xl mx-auto overflow-hidden relative">
      {/* Decorative background accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em]">Property Setup</span>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tell us about your property</h1>
          <p className="text-slate-500 text-sm font-medium mt-2 leading-relaxed">
            Let's get the basics down. This information will appear on your tenants' receipts and dashboard.
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs font-bold mb-8 border border-rose-100"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleNext} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Property Name</label>
            <div className="relative group">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-purple-600 transition-colors" />
              <Input 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Royal Heritage PG" 
                className="pl-11 h-14 rounded-2xl border-slate-100 bg-slate-50/50 text-lg font-medium transition-all focus:bg-white"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Support Phone (Optional)</label>
            <div className="relative group">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-purple-600 transition-colors" />
              <Input 
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. +91 98765 43210" 
                className="pl-11 h-14 rounded-2xl border-slate-100 bg-slate-50/50 text-lg font-medium transition-all focus:bg-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Address</label>
            <div className="relative group">
              <MapPin className="absolute left-4 top-4 w-4 h-4 text-slate-300 group-focus-within:text-purple-600 transition-colors" />
              <textarea 
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full min-h-[120px] pl-11 pr-4 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-lg font-medium transition-all focus:ring-2 focus:ring-purple-100 focus:border-purple-600 outline-none focus:bg-white"
                placeholder="No. 123, Main Street, Bengaluru, Karnataka 560001"
                required
              />
            </div>
          </div>

          <div className="pt-4">
            <Button 
              type="submit"
              disabled={isLoading}
              className="w-full h-16 bg-brand-gradient text-white rounded-[1.25rem] font-black text-xl shadow-xl shadow-purple-100 flex items-center justify-center gap-3 group transition-all hover:scale-[1.02] active:scale-95"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  Save & Continue
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
            
            <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6 flex items-center justify-center gap-2">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Auto-saving to secure cloud
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
