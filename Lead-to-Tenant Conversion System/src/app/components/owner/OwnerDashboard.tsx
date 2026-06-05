import { Users, UserCheck, UserPlus, TrendingUp, Eye, Heart, Phone, MessageCircle, QrCode, Bell } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

interface Activity {
  id: string;
  type: "view" | "interest" | "visit";
  studentName: string;
  action: string;
  timestamp: string;
}

interface OwnerDashboardProps {
  onViewLeads: () => void;
  onGenerateQR: () => void;
}

export function OwnerDashboard({ onViewLeads, onGenerateQR }: OwnerDashboardProps) {
  const kpis = [
    { label: "Today's Visitors", value: "12", color: "var(--brand-saffron)", icon: Eye },
    { label: "Interested Leads", value: "8", color: "var(--brand-saffron)", icon: Heart },
    { label: "Ready to Join", value: "5", color: "var(--success-green)", icon: UserCheck },
    { label: "Joined This Month", value: "23", color: "var(--brand-navy)", icon: TrendingUp },
  ];

  const funnelStages = [
    { stage: "Visitors", count: 145, color: "var(--brand-navy)" },
    { stage: "Interested", count: 58, color: "var(--brand-saffron)" },
    { stage: "Reserved", count: 23, color: "var(--alert-amber)" },
    { stage: "Invited", count: 15, color: "var(--success-green)" },
    { stage: "Joined", count: 12, color: "var(--success-green)" },
  ];

  const totalVisitors = funnelStages.reduce((sum, stage) => sum + stage.count, 0);

  const activities: Activity[] = [
    { id: "1", type: "interest", studentName: "Rahul Kumar", action: "marked Room 101 as interested", timestamp: "2 min ago" },
    { id: "2", type: "view", studentName: "Arjun Reddy", action: "viewed Room 203", timestamp: "5 min ago" },
    { id: "3", type: "view", studentName: "Karthik M", action: "viewed Hostel overview", timestamp: "12 min ago" },
    { id: "4", type: "interest", studentName: "Sai Teja", action: "marked Room 102 as interested", timestamp: "18 min ago" },
    { id: "5", type: "visit", studentName: "Pranav S", action: "scanned QR at Block 1", timestamp: "25 min ago" },
    { id: "6", type: "view", studentName: "Vijay Kumar", action: "viewed Room 201", timestamp: "32 min ago" },
  ];

  const getActivityIcon = (type: Activity["type"]) => {
    switch (type) {
      case "interest":
        return <Heart className="w-4 h-4 text-[var(--brand-saffron)]" />;
      case "view":
        return <Eye className="w-4 h-4 text-[var(--brand-navy)]" />;
      case "visit":
        return <UserPlus className="w-4 h-4 text-[var(--success-green)]" />;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Header */}
      <div className="bg-[var(--brand-navy)] text-white px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
              <p className="text-white/70 text-sm">Sri Adithya HMS — Owner Portal</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label} className="p-4 border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: kpi.color }}>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm text-[var(--neutral-gray)]">{kpi.label}</span>
                  <Icon className="w-5 h-5" style={{ color: kpi.color }} />
                </div>
                <div className="text-3xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: kpi.color }}>
                  {kpi.value}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Admission Funnel */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--brand-navy)] mb-4">Admission Funnel</h2>
          <div className="space-y-3">
            {funnelStages.map((stage) => {
              const widthPercentage = (stage.count / totalVisitors) * 100;
              return (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="font-medium text-[var(--deep-charcoal)]">{stage.stage}</span>
                    <span className="font-mono font-semibold" style={{ color: stage.color }}>
                      {stage.count}
                    </span>
                  </div>
                  <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full flex items-center justify-end pr-3 text-white text-xs font-semibold transition-all duration-500"
                      style={{
                        width: `${widthPercentage}%`,
                        backgroundColor: stage.color,
                      }}
                    >
                      {widthPercentage > 15 && `${Math.round(widthPercentage)}%`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Activity Feed */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-[var(--brand-navy)] mb-4">Today's Activity</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--warm-ivory)] transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--brand-saffron)]/20 to-[var(--brand-navy)]/20 flex items-center justify-center text-[var(--brand-navy)] text-sm font-semibold flex-shrink-0">
                    {getInitials(activity.studentName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--deep-charcoal)]">
                      <span className="font-semibold">{activity.studentName}</span> {activity.action}
                    </p>
                    <p className="text-xs text-[var(--neutral-gray)] mt-1">{activity.timestamp}</p>
                  </div>
                  <div className="flex-shrink-0">{getActivityIcon(activity.type)}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-[var(--brand-navy)] mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Button
                onClick={onViewLeads}
                className="w-full justify-start h-12 bg-[var(--brand-saffron)] hover:bg-[var(--brand-saffron)]/90"
              >
                <Users className="w-5 h-5 mr-3" />
                View All Leads
              </Button>

              <Button
                onClick={onGenerateQR}
                variant="outline"
                className="w-full justify-start h-12 border-2"
              >
                <QrCode className="w-5 h-5 mr-3" />
                Generate QR Code
              </Button>

              <Button variant="outline" className="w-full justify-start h-12 border-2">
                <MessageCircle className="w-5 h-5 mr-3" />
                Send Reminders
              </Button>

              <Button variant="outline" className="w-full justify-start h-12 border-2">
                <Phone className="w-5 h-5 mr-3" />
                Follow-up Calls
              </Button>
            </div>

            <div className="mt-6 pt-6 border-t border-[var(--border)]">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-[var(--success-green)]" style={{ fontFamily: 'var(--font-mono)' }}>
                    92%
                  </div>
                  <div className="text-xs text-[var(--neutral-gray)] mt-1">Occupancy Rate</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[var(--brand-saffron)]" style={{ fontFamily: 'var(--font-mono)' }}>
                    4.2
                  </div>
                  <div className="text-xs text-[var(--neutral-gray)] mt-1">Avg. Days to Convert</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
