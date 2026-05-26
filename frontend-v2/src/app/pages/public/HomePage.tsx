import { useEffect } from 'react';
import { TopBar } from '@/components/marketing/TopBar';
import { Navbar } from '@/components/marketing/Navbar';
import { Hero } from '@/components/marketing/Hero';
import { StatsStrip } from '@/components/marketing/StatsStrip';
import { WhyChooseUs } from '@/components/marketing/WhyChooseUs';
import { Facilities } from '@/components/marketing/Facilities';
import { RoomPricing } from '@/components/marketing/RoomPricing';
import { Location } from '@/components/marketing/Location';
import { EnquiryForm } from '@/components/marketing/EnquiryForm';
import { Footer } from '@/components/marketing/Footer';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';

export function HomePage() {
  useEffect(() => {
    document.title = 'Sri Adithya Boys Hostel | Student Accommodation in Hyderabad';
    const desc = document.querySelector('meta[name="description"]');
    desc?.setAttribute(
      'content',
      'Sri Adithya Boys Hostel offers safe, affordable student accommodation near SNIST, Yamnampet, Secunderabad — furnished rooms, homely meals, 24/7 security, and modern facilities.',
    );
    const canonical = document.querySelector('link[rel="canonical"]');
    canonical?.setAttribute('href', 'https://sriadithyahostels.in/');
  }, []);

  return (
    <div className="min-h-screen" style={{ fontFamily: 'var(--font-body)' }}>
      <TopBar />
      <Navbar />
      <Hero />
      <ScrollReveal>
        <StatsStrip />
      </ScrollReveal>
      <ScrollReveal>
        <WhyChooseUs />
      </ScrollReveal>
      <ScrollReveal>
        <Facilities />
      </ScrollReveal>
      <ScrollReveal>
        <RoomPricing />
      </ScrollReveal>
      <ScrollReveal>
        <Location />
      </ScrollReveal>
      <ScrollReveal>
        <EnquiryForm />
      </ScrollReveal>
      <ScrollReveal>
        <Footer />
      </ScrollReveal>
    </div>
  );
}
