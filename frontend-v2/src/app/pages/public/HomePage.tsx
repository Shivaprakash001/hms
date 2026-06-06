import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { admissionsPublicService } from '@features/admissions/api';
import { queryKeys } from '@lib/queryKeys';
import { AdmissionProcess } from '@/components/landing-v2/AdmissionProcess';
import { AnnouncementBanner } from '@/components/landing-v2/AnnouncementBanner';
import { EnquiryForm } from '@/components/landing-v2/EnquiryForm';
import { Facilities } from '@/components/landing-v2/Facilities';
import { Footer } from '@/components/landing-v2/Footer';
import { FaqSection } from '@/components/landing-v2/FaqSection';
import { Hero } from '@/components/landing-v2/Hero';
import { Location } from '@/components/landing-v2/Location';
import { Navbar } from '@/components/landing-v2/Navbar';
import { RoomPricing } from '@/components/landing-v2/RoomPricing';
import { StatsStrip } from '@/components/landing-v2/StatsStrip';
import { Testimonials } from '@/components/landing-v2/Testimonials';
import { TopBar } from '@/components/landing-v2/TopBar';
import { WhyChooseUs } from '@/components/landing-v2/WhyChooseUs';
import type { LandingAvailability } from '@/components/landing-v2/landingTypes';
import { fallbackLandingContent, getLandingMarketingContent } from '@lib/sanity/client';

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
  const { data: marketingContent } = useQuery({
    queryKey: ['landing-marketing-content', 'home'],
    queryFn: getLandingMarketingContent,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

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

  const content = marketingContent || fallbackLandingContent;

  useEffect(() => {
    document.title = content.seo.title;
    const desc = document.querySelector('meta[name="description"]');
    desc?.setAttribute('content', content.seo.description);
    const canonical = document.querySelector('link[rel="canonical"]');
    canonical?.setAttribute('href', content.seo.canonicalUrl || 'https://sriadithyahostels.in/');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    ogTitle?.setAttribute('content', content.seo.title);
    const ogDescription = document.querySelector('meta[property="og:description"]');
    ogDescription?.setAttribute('content', content.seo.description);
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (content.seo.ogImage?.url) ogImage?.setAttribute('content', content.seo.ogImage.url);
  }, [content.seo]);

  return (
    <div className="min-h-screen">
      <TopBar />
      <Navbar hostelProfile={content.hostelProfile} />
      <AnnouncementBanner announcements={content.announcements} />
      <Hero availability={landingAvailability} content={content.hero} />
      <StatsStrip availability={landingAvailability} />
      <WhyChooseUs features={content.features} />
      <Facilities facilities={content.facilities} />
      <Testimonials testimonials={content.testimonials} />
      <AdmissionProcess steps={content.admissionSteps} />
      <RoomPricing availability={landingAvailability} facilities={content.facilities} />
      <Location />
      <FaqSection faqs={content.faqs} />
      <EnquiryForm availability={landingAvailability} hostelProfile={content.hostelProfile} visitSlug={PRIMARY_VISIT_SLUG} />
      <Footer content={content.footer} hostelProfile={content.hostelProfile} />
    </div>
  );
}
