import { TopBar } from './components/TopBar';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { StatsStrip } from './components/StatsStrip';
import { WhyChooseUs } from './components/WhyChooseUs';
import { Facilities } from './components/Facilities';
import { RoomPricing } from './components/RoomPricing';
import { Location } from './components/Location';
import { EnquiryForm } from './components/EnquiryForm';
import { Footer } from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen">
      <TopBar />
      <Navbar />
      <Hero />
      <StatsStrip />
      <WhyChooseUs />
      <Facilities />
      <RoomPricing />
      <Location />
      <EnquiryForm />
      <Footer />
    </div>
  );
}