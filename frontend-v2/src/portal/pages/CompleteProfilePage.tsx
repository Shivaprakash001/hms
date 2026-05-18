import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { tenantService } from '@features/tenants/api';

export function CompleteProfilePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await tenantService.completeMyProfile({ name, phone });
      toast.success('Profile completed');
      navigate('/tenant/dashboard', { replace: true });
    } catch {
      toast.error('Failed to complete profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold">Complete your profile</h1>
        <input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-border"
          required
        />
        <input
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-border"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-accent text-accent-foreground font-semibold"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
