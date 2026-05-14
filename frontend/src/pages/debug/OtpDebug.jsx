import React, { useState } from 'react';
import PhoneOtpVerification from '@/components/auth/PhoneOtpVerification';
import { isFirebasePhoneAuthConfigured, firebaseAuth } from '@/lib/firebase';
import { AlertCircle, CheckCircle2, ShieldCheck, Terminal } from 'lucide-react';

export default function OtpDebug() {
  const [phone, setPhone] = useState('');
  const [verificationData, setVerificationData] = useState(null);

  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? 'Present ✅' : 'Missing ❌',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? 'Present ✅' : 'Missing ❌',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'Present ✅' : 'Missing ❌',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ? 'Present ✅' : 'Missing ❌',
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-mono">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
          <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
            <Terminal className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Firebase OTP Debugger</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Environment & Flow Verification</p>
          </div>
        </div>

        {/* Configuration Status */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">1. Environment Config</h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(config).map(([key, status]) => (
              <div key={key} className="bg-slate-900 p-3 rounded-lg flex justify-between items-center text-[11px]">
                <span className="text-slate-500 font-bold">{key}:</span>
                <span className={status.includes('✅') ? 'text-emerald-400' : 'text-rose-400'}>{status}</span>
              </div>
            ))}
          </div>
          {!isFirebasePhoneAuthConfigured && (
            <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-start gap-3">
              <AlertCircle className="shrink-0 w-4 h-4 mt-0.5" />
              <p>Firebase is NOT configured. Check your frontend .env file and ensure keys are prefixed with VITE_.</p>
            </div>
          )}
          {isFirebasePhoneAuthConfigured && !firebaseAuth && (
            <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs flex items-start gap-3">
              <AlertCircle className="shrink-0 w-4 h-4 mt-0.5" />
              <p>Keys are present but Firebase Auth failed to initialize. Check the browser console for errors.</p>
            </div>
          )}
        </div>

        {/* Live Test */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl text-slate-900">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">2. Live OTP Test</h2>
          
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Phone Number (digits only)</label>
              <input 
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Enter 10-digit mobile number"
                className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-100 text-lg font-bold outline-none focus:ring-2 focus:ring-purple-100 transition-all"
              />
              <p className="text-[9px] text-slate-400 mt-2 px-1">Will be automatically prefixed with +91</p>
            </div>

            <PhoneOtpVerification 
              phone={phone}
              onVerified={(data) => {
                console.log('✅ OTP Verified Successfully in Debug Page:', data);
                setVerificationData(data);
              }}
            />

            {verificationData && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CheckCircle2 className="text-emerald-600 w-8 h-8" />
                <div>
                  <p className="text-emerald-900 font-bold text-sm">Verification Successful!</p>
                  <p className="text-emerald-600 text-[10px] break-all">ID Token: {verificationData.idToken.substring(0, 50)}...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Debugging Guide</h2>
          <ul className="text-[11px] space-y-3 text-slate-400 list-disc pl-4">
            <li>Open <span className="text-slate-200">Browser Console (F12)</span> to see detailed [OTP Debug] logs.</li>
            <li>Ensure <span className="text-slate-200">Phone Authentication</span> is enabled in Firebase Console.</li>
            <li>Add <span className="text-slate-200">{window.location.hostname}</span> to Authorized Domains in Firebase Console.</li>
            <li>Test numbers in India should start with 6, 7, 8, or 9.</li>
            <li>Wait at least 60 seconds between resend attempts to avoid quota blocks.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
