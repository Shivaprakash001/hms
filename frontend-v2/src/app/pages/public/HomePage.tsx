import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { admissionsPublicService } from '@features/admissions/api';
import { queryKeys } from '@lib/queryKeys';
import { AdmissionProcess } from '@/components/landing-v2/AdmissionProcess';
import { EnquiryForm } from '@/components/landing-v2/EnquiryForm';
import { Facilities } from '@/components/landing-v2/Facilities';
import { Footer } from '@/components/landing-v2/Footer';
import { Hero } from '@/components/landing-v2/Hero';
import { Location } from '@/components/landing-v2/Location';
import { Navbar } from '@/components/landing-v2/Navbar';
import { RoomPricing } from '@/components/landing-v2/RoomPricing';
import { StatsStrip } from '@/components/landing-v2/StatsStrip';
import { Testimonials } from '@/components/landing-v2/Testimonials';
import { TopBar } from '@/components/landing-v2/TopBar';
import { WhyChooseUs } from '@/components/landing-v2/WhyChooseUs';
import type { LandingAvailability } from '@/components/landing-v2/landingTypes';

const PRIMARY_VISIT_SLUG = String(import.meta.env.VITE_PRIMARY_VISIT_SLUG || '').trim();

function availableBeds(room: any) {
  return Number(room?.available_beds || room?.vacant_count || 0);
}

function roomPrice(room: any) {
  return Number(room?.pricing?.monthly_rent || room?.monthly_rent || 0);
}

function currentIntakeMonth() {
  return new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date());
}

export function HomePage() {
  const { data: availability } = useQuery({
    queryKey: PRIMARY_VISIT_SLUG ? queryKeys.admissions.visit(PRIMARY_VISIT_SLUG) : ['landing-availability-disabled'],
    queryFn: () => admissionsPublicService.getVisitHostel(PRIMARY_VISIT_SLUG),
    enabled: Boolean(PRIMARY_VISIT_SLUG),
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });

  const landingAvailability = useMemo<LandingAvailability>(() => {
    const rooms = Array.isArray(availability?.rooms) ? availability.rooms : [];
    const bedsAvailable = rooms.reduce((sum: number, room: any) => sum + availableBeds(room), 0);
    const startingPrice =
      availability?.hostel?.starting_price ||
      rooms.map(roomPrice).filter(Boolean).sort((a: number, b: number) => a - b)[0] ||
      null;

    return {
      bedsAvailable: bedsAvailable > 0 ? bedsAvailable : null,
      intakeMonth: currentIntakeMonth(),
      startingPrice,
      visitUrl: PRIMARY_VISIT_SLUG ? `/visit/${PRIMARY_VISIT_SLUG}` : '',
      hasLiveAvailability: bedsAvailable > 0,
    };
  }, [availability]);

  useEffect(() => {
    document.title = 'Sri Adithya Boys Hostel | Student Accommodation Near SNIST';
    const desc = document.querySelector('meta[name="description"]');
    desc?.setAttribute(
      'content',
      'Sri Adithya Boys Hostel offers safe student accommodation near SNIST with homely meals, transparent pricing, parent-friendly admissions, and easy room visit booking.',
    );
    const canonical = document.querySelector('link[rel="canonical"]');
    canonical?.setAttribute('href', 'https://sriadithyahostels.in/');
  }, []);

  return (
    <div className="min-h-screen">
      <TopBar />
      <Navbar />
      <Hero availability={landingAvailability} />
      <StatsStrip />
      <WhyChooseUs />
      <Facilities />
      <Testimonials />
      <AdmissionProcess />
      <RoomPricing availability={landingAvailability} />
      <Location />
      <EnquiryForm availability={landingAvailability} />
      <Footer />
    </div>
  );
}
