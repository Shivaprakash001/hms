import { useState } from "react";
import { ModeSelector } from "./components/ModeSelector";

// Visitor Components
import { WelcomeLanding } from "./components/visitor/WelcomeLanding";
import { QuickRegistration } from "./components/visitor/QuickRegistration";
import { HostelExplorer } from "./components/visitor/HostelExplorer";
import { RoomExplorer } from "./components/visitor/RoomExplorer";
import { RoomDetail } from "./components/visitor/RoomDetail";
import { InterestConfirmation } from "./components/visitor/InterestConfirmation";
import { ShareWithParents } from "./components/visitor/ShareWithParents";

// Owner Components
import { OwnerNavigation } from "./components/owner/OwnerNavigation";
import { OwnerDashboard } from "./components/owner/OwnerDashboard";
import { LeadPipeline } from "./components/owner/LeadPipeline";
import { LeadProfile } from "./components/owner/LeadProfile";
import { RoomOccupancy } from "./components/owner/RoomOccupancy";
import { Analytics } from "./components/owner/Analytics";
import { QRGenerator } from "./components/owner/QRGenerator";

type AppMode = "visitor" | "owner";

type VisitorScreen =
  | "welcome"
  | "hostel-explorer"
  | "room-explorer"
  | "room-detail"
  | "interest-confirmation"
  | "share-with-parents";

type OwnerScreen = "dashboard" | "pipeline" | "lead-profile" | "rooms" | "analytics" | "qr-generator";

interface UserData {
  studentName: string;
  studentMobile: string;
  parentMobile?: string;
}

export default function App() {
  const [mode, setMode] = useState<AppMode>("visitor");

  // Visitor State
  const [visitorScreen, setVisitorScreen] = useState<VisitorScreen>("welcome");
  const [showRegistration, setShowRegistration] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [interestedRooms, setInterestedRooms] = useState<Set<string>>(new Set());

  // Owner State
  const [ownerScreen, setOwnerScreen] = useState<OwnerScreen>("dashboard");
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");

  // Mode Switching
  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode);
    if (newMode === "visitor") {
      setVisitorScreen("welcome");
    } else {
      setOwnerScreen("dashboard");
    }
  };

  // Visitor Handlers
  const handleExplore = () => {
    setShowRegistration(true);
  };

  const handleRegistrationComplete = (data: UserData) => {
    setUserData(data);
    setShowRegistration(false);
    setVisitorScreen("hostel-explorer");
  };

  const handleViewRooms = () => {
    setVisitorScreen("room-explorer");
  };

  const handleViewRoomDetails = (roomId: string) => {
    setSelectedRoomId(roomId);
    setVisitorScreen("room-detail");
  };

  const handleMarkInterested = (roomId?: string) => {
    const targetRoomId = roomId || selectedRoomId;
    setInterestedRooms((prev) => new Set([...prev, targetRoomId]));
    setVisitorScreen("interest-confirmation");
  };

  const handleExploreMore = () => {
    setVisitorScreen("room-explorer");
  };

  const handleShare = () => {
    setVisitorScreen("share-with-parents");
  };

  const handleBackToRooms = () => {
    setVisitorScreen("room-explorer");
  };

  const handleBackToConfirmation = () => {
    setVisitorScreen("interest-confirmation");
  };

  // Owner Handlers
  const handleViewLeads = () => {
    setOwnerScreen("pipeline");
  };

  const handleViewLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    setOwnerScreen("lead-profile");
  };

  const handleBackToPipeline = () => {
    setOwnerScreen("pipeline");
  };

  const handleGenerateQR = () => {
    setOwnerScreen("qr-generator");
  };

  const handleOwnerNavigate = (screen: OwnerScreen) => {
    setOwnerScreen(screen);
  };

  return (
    <div className="size-full overflow-auto">
      {/* Mode Selector */}
      <ModeSelector currentMode={mode} onModeChange={handleModeChange} />

      {/* Visitor Side */}
      {mode === "visitor" && (
        <>
          {visitorScreen === "welcome" && (
            <>
              <WelcomeLanding onExplore={handleExplore} />
              <QuickRegistration
                isOpen={showRegistration}
                onClose={() => setShowRegistration(false)}
                onComplete={handleRegistrationComplete}
              />
            </>
          )}

          {visitorScreen === "hostel-explorer" && (
            <HostelExplorer
              hostelName="Sri Adithya Boys Hostel — Block 1"
              onViewRooms={handleViewRooms}
            />
          )}

          {visitorScreen === "room-explorer" && (
            <RoomExplorer
              onViewDetails={handleViewRoomDetails}
              onInterest={handleMarkInterested}
            />
          )}

          {visitorScreen === "room-detail" && (
            <RoomDetail
              roomId={selectedRoomId}
              onBack={handleBackToRooms}
              onMarkInterested={() => handleMarkInterested()}
              isInterested={interestedRooms.has(selectedRoomId)}
            />
          )}

          {visitorScreen === "interest-confirmation" && userData && (
            <InterestConfirmation
              roomNumber={selectedRoomId}
              studentName={userData.studentName}
              onExploreMore={handleExploreMore}
              onShare={handleShare}
            />
          )}

          {visitorScreen === "share-with-parents" && userData && (
            <ShareWithParents
              roomNumber={selectedRoomId}
              studentName={userData.studentName}
              onBack={handleBackToConfirmation}
            />
          )}
        </>
      )}

      {/* Owner Side */}
      {mode === "owner" && (
        <>
          <OwnerNavigation
            currentScreen={ownerScreen === "lead-profile" ? "pipeline" : ownerScreen}
            onNavigate={handleOwnerNavigate}
          />

          <div className="lg:ml-64">
            {ownerScreen === "dashboard" && (
              <OwnerDashboard
                onViewLeads={handleViewLeads}
                onGenerateQR={handleGenerateQR}
              />
            )}

            {ownerScreen === "pipeline" && (
              <LeadPipeline onViewLead={handleViewLead} />
            )}

            {ownerScreen === "lead-profile" && (
              <LeadProfile
                leadId={selectedLeadId}
                onBack={handleBackToPipeline}
              />
            )}

            {ownerScreen === "rooms" && <RoomOccupancy />}

            {ownerScreen === "analytics" && <Analytics />}

            {ownerScreen === "qr-generator" && <QRGenerator />}
          </div>
        </>
      )}
    </div>
  );
}