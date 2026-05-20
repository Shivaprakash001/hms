import { AlertCircle, AlertTriangle, Info, Clock, Phone, Bell } from 'lucide-react';

const alerts = [
  {
    id: '1',
    type: 'critical' as const,
    title: 'Overdue Payment',
    description: 'Sneha Reddy - Room 205 - ₹11,000',
    hostel: 'Sri Adithya Koramangala',
    time: '2 days overdue',
  },
  {
    id: '2',
    type: 'warning' as const,
    title: 'Maintenance Request',
    description: 'AC not working - Room 108',
    hostel: 'Sri Adithya Koramangala',
    time: '1 day ago',
  },
  {
    id: '3',
    type: 'warning' as const,
    title: 'Low Occupancy',
    hostel: 'Sri Adithya Indiranagar',
    description: 'Current occupancy: 78% (below target 85%)',
    time: '3 hours ago',
  },
  {
    id: '4',
    type: 'info' as const,
    title: 'Upcoming Move-Out',
    description: 'Ankit Verma - Room 205',
    hostel: 'Sri Adithya Koramangala',
    time: 'May 25, 2026',
  },
  {
    id: '5',
    type: 'critical' as const,
    title: 'Multiple Pending Payments',
    description: '5 tenants with pending payments',
    hostel: 'Sri Adithya Indiranagar',
    time: 'Today',
  },
  {
    id: '6',
    type: 'info' as const,
    title: 'Contract Renewal Due',
    description: 'Rajesh Kumar - Room 204',
    hostel: 'Sri Adithya HSR Layout',
    time: 'In 15 days',
  },
];

export function AlertsView() {
  const criticalCount = alerts.filter(a => a.type === 'critical').length;
  const warningCount = alerts.filter(a => a.type === 'warning').length;

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">Stay on top of important updates</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-[#EF4444]/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-[#EF4444]" />
            <span className="text-xs text-muted-foreground">Critical</span>
          </div>
          <div className="text-xl font-semibold text-foreground">{criticalCount}</div>
        </div>
        <div className="bg-card border border-[#F59E0B]/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-xs text-muted-foreground">Warnings</span>
          </div>
          <div className="text-xl font-semibold text-foreground">{warningCount}</div>
        </div>
      </div>

      {/* Alerts List */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">All Alerts</h3>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertCard({
  alert,
}: {
  alert: {
    type: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    hostel: string;
    time: string;
  };
}) {
  const config = {
    critical: {
      icon: AlertCircle,
      color: 'text-[#EF4444]',
      bg: 'bg-[#EF4444]/10',
      border: 'border-[#EF4444]/20',
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-[#F59E0B]',
      bg: 'bg-[#F59E0B]/10',
      border: 'border-[#F59E0B]/20',
    },
    info: {
      icon: Info,
      color: 'text-[#3B82F6]',
      bg: 'bg-[#3B82F6]/10',
      border: 'border-[#3B82F6]/20',
    },
  };

  const { icon: Icon, color, bg, border } = config[alert.type];

  return (
    <div className={`bg-card border ${border} rounded-xl p-4 space-y-3`}>
      <div className="flex items-start gap-3">
        <div className={`${bg} ${color} p-2 rounded-lg`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground">{alert.title}</h4>
          <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-muted-foreground">{alert.hostel}</span>
            <span className="text-xs text-muted-foreground">•</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{alert.time}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="bg-accent text-accent-foreground py-2.5 rounded-lg text-sm font-medium active:scale-95 transition-transform flex items-center justify-center gap-2">
          <Phone className="w-4 h-4" />
          Call
        </button>
        <button className="bg-card border border-border text-foreground py-2.5 rounded-lg text-sm font-medium active:scale-95 transition-transform flex items-center justify-center gap-2">
          <Bell className="w-4 h-4" />
          Notify
        </button>
      </div>
    </div>
  );
}
