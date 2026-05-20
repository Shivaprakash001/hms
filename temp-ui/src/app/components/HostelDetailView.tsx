import { useState } from 'react';
import { ChevronLeft, MapPin, Users, DollarSign, TrendingUp, BedDouble, IndianRupee, Receipt } from 'lucide-react';

interface Hostel {
  id: string;
  name: string;
  location: string;
  occupancy: number;
  totalRooms: number;
  occupiedRooms: number;
  revenue: string;
  pendingPayments: number;
  alerts: number;
}

interface HostelDetailViewProps {
  hostel: Hostel;
  onBack: () => void;
}

type Tab = 'overview' | 'rooms' | 'tenants' | 'financials' | 'expenses' | 'moveouts';

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'financials', label: 'Financials' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'moveouts', label: 'Move-Outs' },
];

export function HostelDetailView({ hostel, onBack }: HostelDetailViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-card border-b border-border z-10">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={onBack}
              className="p-2 -ml-2 active:scale-95 transition-transform"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-foreground">{hostel.name}</h1>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <MapPin className="w-3 h-3" />
                <span>{hostel.location}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 -mb-px scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-medium whitespace-nowrap rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {activeTab === 'overview' && <OverviewTab hostel={hostel} />}
        {activeTab === 'rooms' && <RoomsTab />}
        {activeTab === 'tenants' && <TenantsTab />}
        {activeTab === 'financials' && <FinancialsTab />}
        {activeTab === 'expenses' && <ExpensesTab />}
        {activeTab === 'moveouts' && <MoveOutsTab />}
      </div>
    </div>
  );
}

function OverviewTab({ hostel }: { hostel: Hostel }) {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Occupancy</span>
            <BedDouble className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-semibold text-foreground">{hostel.occupancy}%</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {hostel.occupiedRooms}/{hostel.totalRooms} rooms
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Revenue</span>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-semibold text-foreground">{hostel.revenue}</div>
          <div className="flex items-center gap-1 text-[10px] text-[#10B981] mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>+12.5% vs last month</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Active Tenants</span>
            <Users className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-semibold text-foreground">{hostel.occupiedRooms * 2}</div>
          <div className="text-[10px] text-muted-foreground mt-1">2 per room avg</div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Pending</span>
            <Receipt className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-xl font-semibold text-foreground">{hostel.pendingPayments}</div>
          <div className="text-[10px] text-[#F59E0B] mt-1">Requires attention</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Recent Activity</h3>
        <div className="space-y-2">
          <ActivityItem
            title="Payment received"
            description="Rajesh Kumar - Room 204"
            amount="₹12,000"
            time="2 hours ago"
            type="success"
          />
          <ActivityItem
            title="New tenant moved in"
            description="Priya Sharma - Room 312"
            time="5 hours ago"
            type="info"
          />
          <ActivityItem
            title="Maintenance request"
            description="Room 108 - AC not working"
            time="1 day ago"
            type="warning"
          />
        </div>
      </div>
    </div>
  );
}

function ActivityItem({
  title,
  description,
  amount,
  time,
  type,
}: {
  title: string;
  description: string;
  amount?: string;
  time: string;
  type: 'success' | 'info' | 'warning';
}) {
  const colors = {
    success: 'bg-[#10B981]/10 text-[#10B981]',
    info: 'bg-[#3B82F6]/10 text-[#3B82F6]',
    warning: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  };

  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-start gap-3">
      <div className={`w-2 h-2 rounded-full mt-1.5 ${colors[type].split(' ')[0].replace('/10', '')}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        <div className="text-[10px] text-muted-foreground mt-1">{time}</div>
      </div>
      {amount && (
        <div className="text-sm font-semibold text-foreground">{amount}</div>
      )}
    </div>
  );
}

function RoomsTab() {
  const rooms = [
    { number: '101', type: 'Single', status: 'occupied', tenant: 'Amit Kumar', rent: '₹8,000' },
    { number: '102', type: 'Double', status: 'occupied', tenant: 'Raj & Vikram', rent: '₹12,000' },
    { number: '103', type: 'Single', status: 'vacant', tenant: null, rent: '₹8,000' },
    { number: '104', type: 'Triple', status: 'occupied', tenant: '3 tenants', rent: '₹15,000' },
    { number: '105', type: 'Double', status: 'maintenance', tenant: null, rent: '₹12,000' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Room List</h3>
        <span className="text-xs text-muted-foreground">{rooms.length} rooms</span>
      </div>
      {rooms.map((room) => (
        <div key={room.number} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-semibold text-foreground">Room {room.number}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{room.type}</div>
            </div>
            <span
              className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                room.status === 'occupied'
                  ? 'bg-[#10B981]/10 text-[#10B981]'
                  : room.status === 'vacant'
                  ? 'bg-[#6B7280]/10 text-[#6B7280]'
                  : 'bg-[#F59E0B]/10 text-[#F59E0B]'
              }`}
            >
              {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{room.tenant || 'Available'}</span>
            <span className="font-medium text-foreground">{room.rent}/mo</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TenantsTab() {
  const tenants = [
    { name: 'Rajesh Kumar', room: '204', phone: '+91 98765 43210', status: 'paid', rent: '₹12,000', score: 95, college: 'IIT Bangalore', year: '3rd Year' },
    { name: 'Priya Sharma', room: '312', phone: '+91 98765 43211', status: 'paid', rent: '₹10,000', score: 92, college: 'BITS Pilani', year: '2nd Year' },
    { name: 'Amit Patel', room: '108', phone: '+91 98765 43212', status: 'pending', rent: '₹15,000', score: 78, college: 'NIT Karnataka', year: '4th Year' },
    { name: 'Sneha Reddy', room: '205', phone: '+91 98765 43213', status: 'overdue', rent: '₹11,000', score: 45, college: 'VTU', year: '1st Year' },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-[#10B981]';
    if (score >= 65) return 'text-[#F59E0B]';
    return 'text-[#EF4444]';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return 'Excellent';
    if (score >= 65) return 'Good';
    return 'Poor';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Active Tenants</h3>
        <span className="text-xs text-muted-foreground">{tenants.length} tenants</span>
      </div>
      {tenants.map((tenant) => (
        <div key={tenant.phone} className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-semibold text-foreground">{tenant.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Room {tenant.room}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{tenant.college} • {tenant.year}</div>
            </div>
            <div className="text-right">
              <span
                className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                  tenant.status === 'paid'
                    ? 'bg-[#10B981]/10 text-[#10B981]'
                    : tenant.status === 'pending'
                    ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                    : 'bg-[#EF4444]/10 text-[#EF4444]'
                }`}
              >
                {tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)}
              </span>
            </div>
          </div>

          {/* Tenant Score */}
          <div className="bg-secondary/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Tenant Score</span>
              <span className={`text-sm font-semibold ${getScoreColor(tenant.score)}`}>
                {tenant.score}/100 • {getScoreLabel(tenant.score)}
              </span>
            </div>
            <div className="w-full bg-background rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${
                  tenant.score >= 85 ? 'bg-[#10B981]' : tenant.score >= 65 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                }`}
                style={{ width: `${tenant.score}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Based on payment history, timely payments, and compliance
            </p>
          </div>

          <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
            <span className="text-muted-foreground">{tenant.phone}</span>
            <span className="font-medium text-foreground">{tenant.rent}/mo</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FinancialsTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">This Month</div>
          <div className="text-xl font-semibold text-foreground">₹4.2L</div>
          <div className="flex items-center gap-1 text-[10px] text-[#10B981] mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>+8.5%</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Collected</div>
          <div className="text-xl font-semibold text-foreground">₹3.8L</div>
          <div className="text-[10px] text-muted-foreground mt-1">90% collected</div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Recent Payments</h3>
        <div className="space-y-2">
          <PaymentItem name="Rajesh Kumar" amount="₹12,000" date="May 15" status="received" />
          <PaymentItem name="Priya Sharma" amount="₹10,000" date="May 14" status="received" />
          <PaymentItem name="Amit Patel" amount="₹15,000" date="May 10" status="pending" />
        </div>
      </div>
    </div>
  );
}

function PaymentItem({
  name,
  amount,
  date,
  status,
}: {
  name: string;
  amount: string;
  date: string;
  status: 'received' | 'pending';
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-foreground">{name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{date}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-foreground">{amount}</div>
        <div
          className={`text-[10px] mt-0.5 ${
            status === 'received' ? 'text-[#10B981]' : 'text-[#F59E0B]'
          }`}
        >
          {status === 'received' ? 'Received' : 'Pending'}
        </div>
      </div>
    </div>
  );
}

function ExpensesTab() {
  const expenses = [
    { category: 'Maintenance', amount: '₹8,500', date: 'May 12', description: 'AC repair - Room 312' },
    { category: 'Utilities', amount: '₹15,200', date: 'May 10', description: 'Electricity bill' },
    { category: 'Cleaning', amount: '₹6,000', date: 'May 8', description: 'Monthly cleaning service' },
    { category: 'Internet', amount: '₹3,500', date: 'May 5', description: 'WiFi - May 2026' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="text-xs text-muted-foreground mb-1">Total Expenses (May)</div>
        <div className="text-2xl font-semibold text-foreground">₹33,200</div>
        <div className="text-[10px] text-muted-foreground mt-1">4 transactions</div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Expense History</h3>
        <div className="space-y-2">
          {expenses.map((expense, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="text-sm font-medium text-foreground">{expense.category}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{expense.description}</div>
                </div>
                <div className="text-sm font-semibold text-foreground">{expense.amount}</div>
              </div>
              <div className="text-[10px] text-muted-foreground">{expense.date}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MoveOutsTab() {
  const moveouts = [
    { name: 'Ankit Verma', room: '205', date: 'May 25, 2026', deposit: '₹10,000', status: 'pending' },
    { name: 'Neha Singh', room: '108', date: 'May 20, 2026', deposit: '₹12,000', status: 'completed' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Upcoming Move-Outs</h3>
        <span className="text-xs text-muted-foreground">{moveouts.length} scheduled</span>
      </div>
      {moveouts.map((moveout, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-semibold text-foreground">{moveout.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Room {moveout.room}</div>
            </div>
            <span
              className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                moveout.status === 'completed'
                  ? 'bg-[#10B981]/10 text-[#10B981]'
                  : 'bg-[#F59E0B]/10 text-[#F59E0B]'
              }`}
            >
              {moveout.status.charAt(0).toUpperCase() + moveout.status.slice(1)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
            <span className="text-muted-foreground">{moveout.date}</span>
            <span className="font-medium text-foreground">Deposit: {moveout.deposit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
