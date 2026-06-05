import { ArrowLeft, Phone, MessageCircle, Calendar, MapPin, Eye, Heart, Share2, QrCode, Clock } from "lucide-react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface LeadProfileProps {
  leadId: string;
  onBack: () => void;
}

export function LeadProfile({ leadId, onBack }: LeadProfileProps) {
  const lead = {
    id: leadId,
    studentName: "Rahul Kumar",
    studentPhone: "9876543210",
    parentPhone: "9876543211",
    source: "QR Scan - Block 1",
    createdAt: "May 28, 2026 at 2:30 PM",
  };

  const activities = [
    { id: "1", type: "interest", description: "Marked Room 101 as Interested", timestamp: "May 28, 2026 at 3:15 PM" },
    { id: "2", type: "view", description: "Viewed Room 203", timestamp: "May 28, 2026 at 3:10 PM", duration: "2 min" },
    { id: "3", type: "view", description: "Viewed Room 101", timestamp: "May 28, 2026 at 3:05 PM", duration: "4 min" },
    { id: "4", type: "view", description: "Viewed Hostel overview", timestamp: "May 28, 2026 at 2:45 PM", duration: "3 min" },
    { id: "5", type: "scan", description: "Scanned QR at Block 1", timestamp: "May 28, 2026 at 2:30 PM" },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "scan":
        return <QrCode className="w-5 h-5 text-[var(--success-green)]" />;
      case "view":
        return <Eye className="w-5 h-5 text-[var(--brand-navy)]" />;
      case "interest":
        return <Heart className="w-5 h-5 text-[var(--brand-saffron)]" />;
      default:
        return <Share2 className="w-5 h-5 text-[var(--brand-saffron)]" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-20 lg:pb-6">
      <div className="bg-[var(--brand-navy)] text-white px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/70 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Pipeline</span>
          </button>
          <h1 className="text-2xl font-bold">Lead Profile</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--brand-saffron)]/20 to-[var(--brand-navy)]/20 flex items-center justify-center text-[var(--brand-navy)] text-xl font-bold">
                  {lead.studentName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--deep-charcoal)]">
                    {lead.studentName}
                  </h2>
                  <p className="text-sm text-[var(--neutral-gray)]">Lead #{lead.id}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[var(--neutral-gray)] mb-1 block">
                    Student Phone
                  </label>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[var(--brand-navy)]" />
                    <span className="text-sm font-mono font-medium">{lead.studentPhone}</span>
                  </div>
                </div>

                {lead.parentPhone && (
                  <div>
                    <label className="text-xs text-[var(--neutral-gray)] mb-1 block">
                      Parent Phone
                    </label>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-[var(--brand-navy)]" />
                      <span className="text-sm font-mono font-medium">{lead.parentPhone}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs text-[var(--neutral-gray)] mb-1 block">Source</label>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[var(--success-green)]" />
                    <span className="text-sm">{lead.source}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[var(--neutral-gray)] mb-1 block">
                    Created At
                  </label>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[var(--brand-navy)]" />
                    <span className="text-sm">{lead.createdAt}</span>
                  </div>
                </div>

                <Badge className="bg-[var(--brand-saffron)] text-white">
                  INTERESTED
                </Badge>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-[var(--brand-navy)] mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button
                  className="w-full justify-start bg-[var(--brand-navy)] hover:bg-[var(--brand-navy)]/90"
                  onClick={() => (window.location.href = `tel:${lead.studentPhone}`)}
                >
                  <Phone className="w-4 h-4 mr-3" />
                  Call Student
                </Button>
                <Button
                  className="w-full justify-start bg-[var(--success-green)] hover:bg-[var(--success-green)]/90"
                  onClick={() => window.open(`https://wa.me/${lead.studentPhone}`, "_blank")}
                >
                  <MessageCircle className="w-4 h-4 mr-3" />
                  WhatsApp Student
                </Button>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-[var(--brand-navy)] mb-6">
                Activity Timeline
              </h3>

              <div className="space-y-6">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-[var(--warm-ivory)] flex items-center justify-center border-2 border-white shadow-sm">
                        {getActivityIcon(activity.type)}
                      </div>
                      {index < activities.length - 1 && (
                        <div className="w-0.5 flex-1 bg-[var(--border)] mt-2 min-h-[40px]"></div>
                      )}
                    </div>

                    <div className="flex-1 pb-6">
                      <div className="bg-[var(--warm-ivory)] rounded-lg p-4">
                        <p className="font-medium text-[var(--deep-charcoal)] mb-2">
                          {activity.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-[var(--neutral-gray)]">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{activity.timestamp}</span>
                          </div>
                          {activity.duration && (
                            <>
                              <span>·</span>
                              <span>{activity.duration}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
