import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
// (Icons and UI components skipped for brevity)

export default function TenantOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    personal: { full_name: '', gender: '', date_of_birth: '' },
    contact: { primary_phone: '', guardian_phone: '', emergency_phone: '', guardian_name: '', guardian_relation: '' },
    academic: { college_name: '', course: '', year: '', roll_number: '' },
    address: { permanent_address: '', temporary_address: '' },
    policyAcceptance: { typed_signature_name: '' }
  });

  const nextStep = () => setStep(s => Math.min(s + 1, 5));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await api.post('/tenants/onboarding/complete', formData);
      setStep(5); // Success step
    } catch(err) {
      console.error(err);
      alert('Failed to complete onboarding');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col gap-6">
      {/* Visual Step Indicator can go here */}
      
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">Welcome! Let's get you set up</h2>
          <p>Please complete your profile to continue.</p>
          <input className="border p-2" placeholder="Full Name" value={formData.personal.full_name} onChange={e => setFormData({...formData, personal: {...formData.personal, full_name: e.target.value}})} />
          <input className="border p-2" placeholder="Date of Birth" type="date" value={formData.personal.date_of_birth} onChange={e => setFormData({...formData, personal: {...formData.personal, date_of_birth: e.target.value}})} />
          <button className="bg-blue-600 text-white p-2" onClick={nextStep}>Next</button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">Contact Details</h2>
          <input className="border p-2" placeholder="My Phone" value={formData.contact.primary_phone} onChange={e => setFormData({...formData, contact: {...formData.contact, primary_phone: e.target.value}})} />
          <input className="border p-2" placeholder="Parent/Guardian Phone" value={formData.contact.guardian_phone} onChange={e => setFormData({...formData, contact: {...formData.contact, guardian_phone: e.target.value}})} />
          <input className="border p-2" placeholder="Parent/Guardian Name" value={formData.contact.guardian_name} onChange={e => setFormData({...formData, contact: {...formData.contact, guardian_name: e.target.value}})} />
          <div className="flex justify-between">
            <button onClick={prevStep}>Back</button>
            <button className="bg-blue-600 text-white p-2" onClick={nextStep}>Next</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">Hostel Rules & Policies</h2>
          <div className="space-y-4">
             <div className="p-4 border rounded"><strong>Payment Rules:</strong> Rent is due by 5th. Late fees apply.</div>
             <div className="p-4 border rounded"><strong>Discipline:</strong> No smoking, gate closes at 9:30 PM.</div>
          </div>
          <div className="flex justify-between">
            <button onClick={prevStep}>Back</button>
            <button className="bg-blue-600 text-white p-2" onClick={nextStep}>I Understand</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">Digital Signature</h2>
          <input className="border p-2" placeholder="Type your full name exactly as above to sign" value={formData.policyAcceptance.typed_signature_name} onChange={e => setFormData({...formData, policyAcceptance: {typed_signature_name: e.target.value}})} />
          <div className="flex justify-between">
            <button onClick={prevStep}>Back</button>
            <button className="bg-green-600 text-white p-2" disabled={isSubmitting} onClick={handleSubmit}>Complete Activation</button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="text-center flex flex-col gap-4">
          <h2 className="text-3xl font-bold text-green-600">Activation Complete!</h2>
          <p>Welcome to the hostel! Your dashboard is now ready.</p>
          <button className="bg-blue-600 text-white p-2" onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
        </div>
      )}
    </div>
  );
}
