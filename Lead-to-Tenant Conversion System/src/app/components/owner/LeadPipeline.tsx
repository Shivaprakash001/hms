import { Phone, MessageCircle, ArrowRight, Clock, Eye, Heart } from "lucide-react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useState } from "react";

interface Lead {
  id: string;
  studentName: string;
  studentPhone: string;
  parentPhone?: string;
  roomsViewed: string[];
  roomsInterested: string[];
  lastActivity: string;
  source: string;
  status: "new" | "interested" | "follow_up" | "ready_to_join" | "invited" | "joined" | "lost";
}

interface LeadPipelineProps {
  onViewLead: (leadId: string) => void;
}

export function LeadPipeline({ onViewLead }: LeadPipelineProps) {
  const [activeTab, setActiveTab] = useState<Lead["status"]>("new");

  const leads: Lead[] = [
    {
      id: "1",
      studentName: "Rahul Kumar",
      studentPhone: "9876543210",
      parentPhone: "9876543211",
      roomsViewed: ["101", "102"],
      roomsInterested: ["101"],
      lastActivity: "2 hours ago",
      source: "QR - Block 1",
      status: "interested",
    },
    {
      id: "2",
      studentName: "Arjun Reddy",
      studentPhone: "9876543212",
      roomsViewed: ["203", "201"],
      roomsInterested: ["203"],
      lastActivity: "5 hours ago",
      source: "QR - Block 2",
      status: "interested",
    },
    {
      id: "3",
      studentName: "Karthik M",
      studentPhone: "9876543213",
      parentPhone: "9876543214",
      roomsViewed: ["101"],
      roomsInterested: [],
      lastActivity: "1 hour ago",
      source: "QR - Block 1",
      status: "new",
    },
    {
      id: "4",
      studentName: "Sai Teja",
      studentPhone: "9876543215",
      roomsViewed: ["102", "103", "201"],
      roomsInterested: ["102"],
      lastActivity: "3 hours ago",
      source: "QR - Block 1",
      status: "follow_up",
    },
    {
      id: "5",
      studentName: "Pranav S",
      studentPhone: "9876543216",
      parentPhone: "9876543217",
      roomsViewed: ["201"],
      roomsInterested: ["201"],
      lastActivity: "6 hours ago",
      source: "QR - Block 2",
      status: "ready_to_join",
    },
  ];

  const stages: { status: Lead["status"]; label: string; color: string }[] = [
    { status: "new", label: "NEW", color: "var(--neutral-gray)" },
    { status: "interested", label: "INTERESTED", color: "var(--brand-saffron)" },
    { status: "follow_up", label: "FOLLOW UP", color: "var(--alert-amber)" },
    { status: "ready_to_join", label: "READY TO JOIN", color: "var(--success-green)" },
    { status: "invited", label: "INVITED", color: "var(--brand-navy)" },
    { status: "joined", label: "JOINED", color: "var(--success-green)" },
    { status: "lost", label: "LOST", color: "var(--danger-red)" },
  ];

  const getLeadsByStatus = (status: Lead["status"]) => {
    return leads.filter((lead) => lead.status === status);
  };

  const handleCall = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `tel:${phone}`;
  };

  const handleWhatsApp = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://wa.me/${phone}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-20 lg:pb-6">
      <div className="bg-[var(--brand-navy)] text-white px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-1">Lead Pipeline</h1>
          <p className="text-white/70 text-sm">Track and manage all leads</p>
        </div>
      </div>

      {/* Desktop Kanban View */}
      <div className="hidden lg:block max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageLeads = getLeadsByStatus(stage.status);
            return (
              <div key={stage.status} className="flex-shrink-0 w-80">
                {/* Column Header */}
                <div
                  className="rounded-t-lg p-3 flex items-center justify-between mb-3"
                  style={{ backgroundColor: stage.color }}
                >
                  <h3 className="font-semibold text-white text-sm">{stage.label}</h3>
                  <Badge className="bg-white/20 text-white hover:bg-white/30">
                    {stageLeads.length}
                  </Badge>
                </div>

                {/* Lead Cards */}
                <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
                  {stageLeads.map((lead) => (
                    <Card
                      key={lead.id}
                      className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => onViewLead(lead.id)}
                    >
                      {/* Student Info */}
                      <div className="mb-3">
                        <h4 className="font-semibold text-[var(--deep-charcoal)] mb-1">
                          {lead.studentName}
                        </h4>
                        <p className="text-xs text-[var(--neutral-gray)] font-mono">
                          {lead.studentPhone}
                        </p>
                      </div>

                      {/* Viewed & Interested Rooms */}
                      <div className="mb-3 space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <Eye className="w-3 h-3 text-[var(--neutral-gray)]" />
                          <span className="text-[var(--neutral-gray)]">
                            Viewed: {lead.roomsViewed.join(", ")}
                          </span>
                        </div>
                        {lead.roomsInterested.length > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <Heart className="w-3 h-3 text-[var(--brand-saffron)]" />
                            <span className="text-[var(--brand-saffron)] font-medium">
                              Interested: {lead.roomsInterested.join(", ")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Last Activity */}
                      <div className="flex items-center gap-2 text-xs text-[var(--neutral-gray)] mb-3">
                        <Clock className="w-3 h-3" />
                        <span>{lead.lastActivity}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs"
                          onClick={(e) => handleCall(lead.studentPhone, e)}
                        >
                          <Phone className="w-3 h-3 mr-1" />
                          Call
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs"
                          onClick={(e) => handleWhatsApp(lead.studentPhone, e)}
                        >
                          <MessageCircle className="w-3 h-3 mr-1" />
                          WhatsApp
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Stacked View */}
      <div className="lg:hidden">
        <div className="sticky top-0 bg-white border-b border-[var(--border)] overflow-x-auto scrollbar-hide z-10">
          <div className="flex gap-2 px-6 py-3">
            {stages.map((stage) => {
              const count = getLeadsByStatus(stage.status).length;
              return (
                <button
                  key={stage.status}
                  onClick={() => setActiveTab(stage.status)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === stage.status
                      ? "text-white"
                      : "bg-gray-100 text-[var(--neutral-gray)] hover:bg-gray-200"
                  }`}
                  style={{
                    backgroundColor: activeTab === stage.status ? stage.color : undefined,
                  }}
                >
                  {stage.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 space-y-3">
          {getLeadsByStatus(activeTab).map((lead) => (
            <Card
              key={lead.id}
              className="p-4 cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => onViewLead(lead.id)}
            >
              <div className="mb-3">
                <h4 className="font-semibold text-[var(--deep-charcoal)] mb-1">
                  {lead.studentName}
                </h4>
                <p className="text-xs text-[var(--neutral-gray)] font-mono">
                  {lead.studentPhone}
                </p>
              </div>

              <div className="mb-3 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <Eye className="w-3 h-3 text-[var(--neutral-gray)]" />
                  <span className="text-[var(--neutral-gray)]">
                    Viewed: {lead.roomsViewed.join(", ")}
                  </span>
                </div>
                {lead.roomsInterested.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <Heart className="w-3 h-3 text-[var(--brand-saffron)]" />
                    <span className="text-[var(--brand-saffron)] font-medium">
                      Interested: {lead.roomsInterested.join(", ")}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-[var(--neutral-gray)] mb-3">
                <Clock className="w-3 h-3" />
                <span>{lead.lastActivity}</span>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-9"
                  onClick={(e) => handleCall(lead.studentPhone, e)}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-9"
                  onClick={(e) => handleWhatsApp(lead.studentPhone, e)}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
