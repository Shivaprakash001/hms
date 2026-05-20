import { X, Check } from 'lucide-react';
import { useState } from 'react';

interface FilterModalProps {
  onClose: () => void;
  onApply: (filters: FilterOptions) => void;
  currentFilters: FilterOptions;
}

export interface FilterOptions {
  occupancy: string[];
  revenue: string[];
  alerts: string[];
}

export function FilterModal({ onClose, onApply, currentFilters }: FilterModalProps) {
  const [filters, setFilters] = useState<FilterOptions>(currentFilters);

  const occupancyOptions = [
    { value: 'high', label: 'High (>90%)' },
    { value: 'medium', label: 'Medium (75-90%)' },
    { value: 'low', label: 'Low (<75%)' },
  ];

  const revenueOptions = [
    { value: 'above-4l', label: 'Above ₹4L' },
    { value: '2l-4l', label: '₹2L - ₹4L' },
    { value: 'below-2l', label: 'Below ₹2L' },
  ];

  const alertOptions = [
    { value: 'critical', label: 'Critical Alerts' },
    { value: 'warnings', label: 'Warnings' },
    { value: 'no-alerts', label: 'No Alerts' },
  ];

  const toggleFilter = (category: keyof FilterOptions, value: string) => {
    setFilters(prev => {
      const current = prev[category];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [category]: updated };
    });
  };

  const clearAll = () => {
    setFilters({ occupancy: [], revenue: [], alerts: [] });
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl sm:max-w-lg">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Filter Hostels</h2>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 space-y-6">
          {/* Occupancy */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Occupancy Rate</h3>
            <div className="space-y-2">
              {occupancyOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => toggleFilter('occupancy', option.value)}
                  className={`w-full px-4 py-3 rounded-lg flex items-center justify-between transition-colors ${
                    filters.occupancy.includes(option.value)
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-card border border-border text-foreground'
                  }`}
                >
                  <span>{option.label}</span>
                  {filters.occupancy.includes(option.value) && <Check className="w-5 h-5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Revenue */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Monthly Revenue</h3>
            <div className="space-y-2">
              {revenueOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => toggleFilter('revenue', option.value)}
                  className={`w-full px-4 py-3 rounded-lg flex items-center justify-between transition-colors ${
                    filters.revenue.includes(option.value)
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-card border border-border text-foreground'
                  }`}
                >
                  <span>{option.label}</span>
                  {filters.revenue.includes(option.value) && <Check className="w-5 h-5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Alert Status</h3>
            <div className="space-y-2">
              {alertOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => toggleFilter('alerts', option.value)}
                  className={`w-full px-4 py-3 rounded-lg flex items-center justify-between transition-colors ${
                    filters.alerts.includes(option.value)
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-card border border-border text-foreground'
                  }`}
                >
                  <span>{option.label}</span>
                  {filters.alerts.includes(option.value) && <Check className="w-5 h-5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <button
              onClick={clearAll}
              className="py-3 px-4 border border-border text-foreground rounded-lg font-medium active:scale-95 transition-transform"
            >
              Clear All
            </button>
            <button
              onClick={handleApply}
              className="py-3 px-4 bg-accent text-accent-foreground rounded-lg font-medium active:scale-95 transition-transform"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
