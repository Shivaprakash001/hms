import { DollarSign, TrendingUp, Calendar, Download } from 'lucide-react';

const revenueData = [
  { month: 'Jan', amount: 380000 },
  { month: 'Feb', amount: 395000 },
  { month: 'Mar', amount: 410000 },
  { month: 'Apr', amount: 425000 },
  { month: 'May', amount: 440000 },
];

const invoices = [
  { id: 'INV-001', hostel: 'Sri Adithya Koramangala', amount: '₹1,80,000', date: 'May 2026', status: 'paid' },
  { id: 'INV-002', hostel: 'Sri Adithya Indiranagar', amount: '₹1,20,000', date: 'May 2026', status: 'paid' },
  { id: 'INV-003', hostel: 'Sri Adithya HSR Layout', amount: '₹95,000', date: 'May 2026', status: 'pending' },
  { id: 'INV-004', hostel: 'Sri Adithya Whitefield', amount: '₹1,05,000', date: 'May 2026', status: 'pending' },
];

export function BillingView() {
  const totalRevenue = revenueData[revenueData.length - 1].amount;
  const previousRevenue = revenueData[revenueData.length - 2].amount;
  const growth = ((totalRevenue - previousRevenue) / previousRevenue * 100).toFixed(1);

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Billing & Revenue</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your financial performance</p>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">This Month</span>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-semibold text-foreground">₹12.4L</div>
          <div className="flex items-center gap-1 text-[10px] text-[#10B981] mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>+{growth}%</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">YTD Revenue</span>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-semibold text-foreground">₹65.5L</div>
          <div className="text-[10px] text-muted-foreground mt-1">Jan - May 2026</div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-medium text-foreground mb-4">Revenue Trend</h3>
        <div className="space-y-3">
          {revenueData.map((item, index) => {
            const maxAmount = Math.max(...revenueData.map(d => d.amount));
            const percentage = (item.amount / maxAmount) * 100;

            return (
              <div key={item.month}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">{item.month}</span>
                  <span className="text-xs font-medium text-foreground">
                    ₹{(item.amount / 100000).toFixed(1)}L
                  </span>
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

      {/* Invoices */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground">Recent Invoices</h3>
          <button className="text-xs text-accent font-medium">View All</button>
        </div>
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-medium text-foreground">{invoice.id}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{invoice.hostel}</div>
                </div>
                <span
                  className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                    invoice.status === 'paid'
                      ? 'bg-[#10B981]/10 text-[#10B981]'
                      : 'bg-[#F59E0B]/10 text-[#F59E0B]'
                  }`}
                >
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-sm text-muted-foreground">{invoice.date}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">{invoice.amount}</span>
                  <button className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
                    <Download className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
