import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Phone, Chrome, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { Link } from 'react-router-dom';

const Signup = () => {
  const [password, setPassword] = useState('');
  
  const getPasswordStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length > 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = getPasswordStrength(password);
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-slate-200', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400'];

  return (
    <OnboardingLayout>
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 md:p-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand-gradient rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-purple-200">
            <span className="text-white text-2xl font-bold">H</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Create Account</h1>
          <p className="text-slate-500 text-sm text-center">
            Join HosteFlow to transform your property management
          </p>
        </div>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="John Doe" 
                  className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider ml-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="+91 9876543210" 
                  className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                type="email" 
                placeholder="name@company.com" 
                className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            {/* Password Strength Indicator */}
            <div className="mt-2 space-y-1.5">
              <div className="flex gap-1 h-1">
                {[1, 2, 3, 4].map((i) => (
                  <div 
                    key={i} 
                    className={`h-full flex-1 rounded-full transition-colors duration-300 ${i <= strength ? strengthColors[strength] : 'bg-slate-100'}`}
                  />
                ))}
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">Strength: {strengthLabels[strength - 1] || 'None'}</span>
                <span className="text-[10px] text-slate-400 font-medium">Min. 8 characters</span>
              </div>
            </div>
          </div>

          <Button className="w-full h-12 bg-brand-gradient hover:opacity-90 text-white rounded-xl font-semibold transition-all duration-300 shadow-md shadow-purple-100 flex items-center justify-center gap-2 group mt-6">
            Get Started
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-4 text-slate-400">Or signup with</span>
            </div>
          </div>

          <Button variant="outline" className="w-full h-12 border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
            <Chrome className="w-4 h-4" />
            Sign up with Google
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-ops-accent font-semibold hover:underline">
            Login
          </Link>
        </p>
      </div>
    </OnboardingLayout>
  );
};

export default Signup;
