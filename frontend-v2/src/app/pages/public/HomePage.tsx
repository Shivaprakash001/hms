import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { admissionsPublicService } from '@features/admissions/api';
import { queryKeys } from '@lib/queryKeys';
import { AdmissionProcess } from '@/components/landing-v2/AdmissionProcess';
import { AnnouncementBanner } from '@/components/landing-v2/AnnouncementBanner';
import { AnnouncementBar } from '@/components/landing-v2/AnnouncementBar';
import { EnquiryForm } from '@/components/landing-v2/EnquiryForm';
import { Facilities } from '@/components/landing-v2/Facilities';
import { Footer } from '@/components/landing-v2/Footer';
import { FaqSection } from '@/components/landing-v2/FaqSection';
import { GallerySection } from '@/components/landing-v2/GallerySection';
import { Hero } from '@/components/landing-v2/Hero';
import { Location } from '@/components/landing-v2/Location';
import { Navbar } from '@/components/landing-v2/Navbar';
import { RoomPricing } from '@/components/landing-v2/RoomPricing';
import { StatsStrip } from '@/components/landing-v2/StatsStrip';
import { Testimonials } from '@/components/landing-v2/Testimonials';
import { TopBar } from '@/components/landing-v2/TopBar';
import { WhyChooseUs } from '@/components/landing-v2/WhyChooseUs';
import { GoogleTrustBar } from '@/components/landing-v2/GoogleTrustBar';
import { WhatsAppFAB } from '@/components/landing-v2/WhatsAppFAB';
import type { LandingAvailability } from '@/components/landing-v2/landingTypes';
import { fallbackLandingContent, getLandingMarketingContent } from '@lib/sanity/client';

const PRIMARY_VISIT_SLUG = String(import.meta.env.VITE_PRIMARY_VISIT_SLUG || '').trim();

function roomPrice(room: any) {
  return Number(room?.pricing?.monthly_rent || room?.monthly_rent || 0);
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

  const content = marketingContent || fallbackLandingContent;

  const landingAvailability = useMemo<LandingAvailability>(() => {
    const rooms = Array.isArray(availability?.rooms) ? availability.rooms : [];
    const roomStartingPrice = rooms.map(roomPrice).filter(Boolean).sort((a: number, b: number) => a - b)[0];
    const startingPrice = content?.startingPrice || roomStartingPrice || availability?.hostel?.starting_price || 8000;

    const sanityBeds = content?.hostelAvailability?.bedsAvailable;
    const sanityIntake = content?.hostelAvailability?.intakeMonth;

    return {
      bedsAvailable: typeof sanityBeds === 'number' && sanityBeds > 0 ? sanityBeds : null,
      intakeMonth: sanityIntake || '',
      startingPrice,
      visitUrl: PRIMARY_VISIT_SLUG ? `/visit/${PRIMARY_VISIT_SLUG}` : '',
      hasLiveAvailability: typeof sanityBeds === 'number' && sanityBeds > 0,
    };
  }, [availability, content]);

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
      <TopBar hostelProfile={content.hostelProfile} />
      <Navbar hostelProfile={content.hostelProfile} />
      {content.announcementBarEnabled && content.announcementBarText && (
        <AnnouncementBar
          text={content.announcementBarText}
          linkText={content.announcementBarLinkText}
        />
      )}
      <GoogleTrustBar />
      <AnnouncementBanner announcements={content.announcements} />
      <Hero availability={landingAvailability} content={content.hero} />
      <StatsStrip stats={content.statsStrip} availability={landingAvailability} />
      <WhyChooseUs features={content.features} />
      <Facilities facilities={content.facilities} />
      <GallerySection images={content.gallery} />
      <Testimonials testimonials={content.testimonials} />
      <AdmissionProcess steps={content.admissionSteps} hostelProfile={content.hostelProfile} />
      <RoomPricing
        availability={landingAvailability}
        facilities={content.facilities}
        roomInclusions={content.roomInclusions}
        totalCostClarityText={content.totalCostClarityText}
        roomTypeTitle={content.roomTypeTitle}
        roomImage={content.roomImage}
      />
      <Location hostelProfile={content.hostelProfile} />
      <FaqSection faqs={content.faqs} />
      <EnquiryForm
        availability={landingAvailability}
        hostelProfile={content.hostelProfile}
        visitSlug={PRIMARY_VISIT_SLUG}
        buttonText={content.contactFormButtonText}
      />
      <Footer content={content.footer} hostelProfile={content.hostelProfile} />
      <WhatsAppFAB hostelProfile={content.hostelProfile} />
    </div>
  );
}
