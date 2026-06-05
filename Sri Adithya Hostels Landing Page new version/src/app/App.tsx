import { TopBar } from './components/TopBar';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { StatsStrip } from './components/StatsStrip';
import { WhyChooseUs } from './components/WhyChooseUs';
import { Facilities } from './components/Facilities';
import { Testimonials } from './components/Testimonials';
import { AdmissionProcess } from './components/AdmissionProcess';
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
      <Testimonials />
      <AdmissionProcess />
      <RoomPricing />
      <Location />
      <EnquiryForm />
      <Footer />
    </div>
  );
}