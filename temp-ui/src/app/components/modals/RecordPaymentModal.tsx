import { useState } from 'react';
import { X, DollarSign, Calendar, Lock } from 'lucide-react';

interface RecordPaymentModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export function RecordPaymentModal({ onClose, onSubmit }: RecordPaymentModalProps) {
  const [formData, setFormData] = useState({
    tenantName: '',
    roomNumber: '',
    amount: '',
    paymentMode: 'cash',
    paymentDate: new Date().toISOString().split('T')[0],
    remarks: '',
    password: '',
  });

  const [showPasswordVerification, setShowPasswordVerification] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.paymentMode === 'cash' || formData.paymentMode === 'upi') {
      setShowPasswordVerification(true);
    } else {
      onSubmit(formData);
    }
  };

  const handlePasswordSubmit = () => {
    if (formData.password) {
      onSubmit(formData);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (showPasswordVerification) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-background w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Verify Your Identity</h2>
            <p className="text-sm text-muted-foreground">
              Enter your password to confirm this offline payment
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Enter your password"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowPasswordVerification(false)}
                className="py-3 px-4 border border-border text-foreground rounded-lg font-medium active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="py-3 px-4 bg-accent text-accent-foreground rounded-lg font-medium active:scale-95 transition-transform"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl sm:max-w-lg">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Record Payment</h2>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Tenant Selection */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Select Tenant *</label>
            <select
              required
              value={formData.tenantName}
              onChange={(e) => handleChange('tenantName', e.target.value)}
              className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Choose tenant</option>
              <option value="Rajesh Kumar - Room 204">Rajesh Kumar - Room 204</option>
              <option value="Priya Sharma - Room 312">Priya Sharma - Room 312</option>
              <option value="Amit Patel - Room 108">Amit Patel - Room 108</option>
              <option value="Sneha Reddy - Room 205">Sneha Reddy - Room 205</option>
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Payment Amount *</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="number"
                required
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="0"
              />
            </div>
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-xs text-muted-foreground mb-2">Payment Mode *</label>
            <div className="grid grid-cols-3 gap-2">
              {['cash', 'upi', 'online'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleChange('paymentMode', mode)}
                  className={`py-3 px-4 rounded-lg font-medium capitalize transition-colors ${
                    formData.paymentMode === mode
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-card border border-border text-foreground'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            {(formData.paymentMode === 'cash' || formData.paymentMode === 'upi') && (
              <p className="text-xs text-[#F59E0B] mt-2 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Password verification required for offline payments
              </p>
            )}
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Payment Date *</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="date"
                required
                value={formData.paymentDate}
                onChange={(e) => handleChange('paymentDate', e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Remarks (Optional)</label>
            <textarea
              value={formData.remarks}
              onChange={(e) => handleChange('remarks', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              placeholder="Add any notes about this payment..."
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-accent text-accent-foreground py-4 rounded-xl font-medium active:scale-95 transition-transform"
          >
            Record Payment
          </button>
        </form>
      </div>
    </div>
  );
}
