import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Chrome, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { Link } from 'react-router-dom';

const Login = () => {
  return (
    <OnboardingLayout>
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 md:p-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand-gradient rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-purple-200">
            <span className="text-white text-2xl font-bold">H</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome Back</h1>
          <p className="text-slate-500 text-sm text-center">
            Login to manage your hostel with ease
          </p>
        </div>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
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
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Password</label>
              <button className="text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors">
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                type="password" 
                placeholder="••••••••" 
                className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          <Button className="w-full h-12 bg-brand-gradient hover:opacity-90 text-white rounded-xl font-semibold transition-all duration-300 shadow-md shadow-purple-100 flex items-center justify-center gap-2 group">
            Login
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-4 text-slate-400">Or continue with</span>
            </div>
          </div>

          <Button variant="outline" className="w-full h-12 border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
            <Chrome className="w-4 h-4" />
            Google
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500">
          Don't have an account?{' '}
          <Link to="/signup" className="text-purple-600 font-semibold hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </OnboardingLayout>
  );
};

export default Login;
