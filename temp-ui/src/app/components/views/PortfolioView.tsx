import { useState } from 'react';
import { TrendingUp, DollarSign, Users, Building2, AlertCircle, TrendingDown } from 'lucide-react';
import { StatCard } from '../StatCard';
import { AddTenantModal } from '../modals/AddTenantModal';
import { RecordPaymentModal } from '../modals/RecordPaymentModal';

const portfolioStats = [
  { label: 'Total Revenue', value: '₹12.4L', change: '+12.5%', trend: 'up' as const, icon: DollarSign },
  { label: 'Occupancy Rate', value: '87%', change: '+5.2%', trend: 'up' as const, icon: Building2 },
  { label: 'Active Tenants', value: '324', change: '-2', trend: 'down' as const, icon: Users },
  { label: 'Pending Payments', value: '₹2.8L', change: '+8', trend: 'neutral' as const, icon: AlertCircle },
  { label: 'Total Hostels', value: '4', change: 'Active', trend: 'neutral' as const, icon: Building2 },
  { label: 'Total Vacancies', value: '18', change: '12% vacant', trend: 'neutral' as const, icon: Building2 },
];

const insights = [
  {
    title: 'Highest Occupancy',
    value: 'Sri Adithya HSR Layout',
    metric: '95% occupied',
    color: 'text-[#10B981]',
  },
  {
    title: 'Overdue Payments',
    value: '₹45,000',
    metric: '8 tenants',
    color: 'text-[#EF4444]',
  },
  {
    title: 'Move-Outs This Month',
    value: '6 tenants',
    metric: 'Expected vacancy',
    color: 'text-[#F59E0B]',
  },
];

export function PortfolioView() {
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Portfolio Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Business control center</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {portfolioStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Revenue Trend */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-medium text-foreground mb-4">Combined Revenue Trend</h3>
        <div className="space-y-3">
          {[
            { month: 'Jan', amount: 950000, change: 5 },
            { month: 'Feb', amount: 1020000, change: 7 },
            { month: 'Mar', amount: 1100000, change: 8 },
            { month: 'Apr', amount: 1150000, change: 5 },
            { month: 'May', amount: 1240000, change: 8 },
          ].map((item) => {
            const maxAmount = 1240000;
            const percentage = (item.amount / maxAmount) * 100;

            return (
              <div key={item.month}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">{item.month}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      ₹{(item.amount / 100000).toFixed(1)}L
                    </span>
                    <span className="text-[10px] text-[#10B981] flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" />
                      {item.change}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-accent h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Business Insights */}
      <div>
        <h2 className="text-base font-medium text-foreground mb-3">Business Insights</h2>
        <div className="space-y-3">
          {insights.map((insight) => (
            <div key={insight.title} className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">{insight.title}</div>
              <div className={`text-lg font-semibold ${insight.color}`}>{insight.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{insight.metric}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-medium text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowAddTenant(true)}
            className="bg-accent text-accent-foreground p-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">Add Tenant</span>
          </button>
          <button
            onClick={() => setShowRecordPayment(true)}
            className="bg-card border border-border text-foreground p-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <DollarSign className="w-4 h-4" />
            <span className="text-sm font-medium">Record Payment</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      {showAddTenant && (
        <AddTenantModal
          onClose={() => setShowAddTenant(false)}
          onSubmit={(data) => {
            console.log('Add tenant:', data);
            setShowAddTenant(false);
          }}
        />
      )}
      {showRecordPayment && (
        <RecordPaymentModal
          onClose={() => setShowRecordPayment(false)}
          onSubmit={(data) => {
            console.log('Record payment:', data);
            setShowRecordPayment(false);
          }}
        />
      )}
    </div>
  );
}
