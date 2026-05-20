import { useState } from 'react';
import { X, DollarSign, Calendar, AlertTriangle } from 'lucide-react';

interface PricingRatesModalProps {
  onClose: () => void;
  onSave: (data: any) => void;
}

export function PricingRatesModal({ onClose, onSave }: PricingRatesModalProps) {
  const [formData, setFormData] = useState({
    singleRoomRate: '8000',
    doubleRoomRate: '12000',
    tripleRoomRate: '15000',
    securityDeposit: '10000',
    gracePeriodDays: '5',
    lateFeePercentage: '5',
    overdueNoticeDays: '3',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl sm:max-w-lg">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Pricing & Rates</h2>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Room Rates */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-accent" />
              Monthly Room Rates
            </h3>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Single Room Rate (₹/month)</label>
              <input
                type="number"
                required
                value={formData.singleRoomRate}
                onChange={(e) => handleChange('singleRoomRate', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="8000"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Double Room Rate (₹/month)</label>
              <input
                type="number"
                required
                value={formData.doubleRoomRate}
                onChange={(e) => handleChange('doubleRoomRate', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="12000"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Triple Room Rate (₹/month)</label>
              <input
                type="number"
                required
                value={formData.tripleRoomRate}
                onChange={(e) => handleChange('tripleRoomRate', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="15000"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Security Deposit (₹)</label>
              <input
                type="number"
                required
                value={formData.securityDeposit}
                onChange={(e) => handleChange('securityDeposit', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="10000"
              />
            </div>
          </div>

          {/* Overdue Policies */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
              Overdue Payment Policies
            </h3>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Grace Period (days)</label>
              <input
                type="number"
                required
                min="0"
                max="30"
                value={formData.gracePeriodDays}
                onChange={(e) => handleChange('gracePeriodDays', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Days after due date before payment is marked as overdue
              </p>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Late Fee (%)</label>
              <input
                type="number"
                required
                min="0"
                max="100"
                value={formData.lateFeePercentage}
                onChange={(e) => handleChange('lateFeePercentage', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Percentage of rent charged as late fee
              </p>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Overdue Notice Period (days)</label>
              <input
                type="number"
                required
                min="1"
                max="30"
                value={formData.overdueNoticeDays}
                onChange={(e) => handleChange('overdueNoticeDays', e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="3"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Send automated reminder after this many days of overdue
              </p>
            </div>
          </div>

          {/* Example Calculation */}
          <div className="bg-secondary/50 border border-border rounded-xl p-4">
            <h4 className="text-xs font-medium text-foreground mb-2">Example Calculation</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Rent due: 1st of every month</p>
              <p>Grace period: {formData.gracePeriodDays} days (marked overdue on {parseInt(formData.gracePeriodDays) + 1}th)</p>
              <p>Late fee: {formData.lateFeePercentage}% of rent (₹{(parseInt(formData.doubleRoomRate) * parseInt(formData.lateFeePercentage)) / 100} for double room)</p>
              <p>Reminder sent: After {formData.overdueNoticeDays} days of overdue</p>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-accent text-accent-foreground py-4 rounded-xl font-medium active:scale-95 transition-transform"
          >
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
