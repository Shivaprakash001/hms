import { Metadata } from "next";
import { admissionsService } from "@/src/services/admissions/admissions-service";
import { TopBar } from "@/components/landing/TopBar";
import { Navbar } from "@/components/landing/Navbar";
import { GoogleTrustBar } from "@/components/landing/GoogleTrustBar";
import { AnnouncementBanner } from "@/components/landing/AnnouncementBanner";
import { Hero } from "@/components/landing/Hero";
import { StatsStrip } from "@/components/landing/StatsStrip";
import { WhyChooseUs } from "@/components/landing/WhyChooseUs";
import { FoodSection } from "@/components/landing/FoodSection";
import { ParentTrust } from "@/components/landing/ParentTrust";
import { Facilities } from "@/components/landing/Facilities";
import { GallerySection } from "@/components/landing/GallerySection";
import { Testimonials } from "@/components/landing/Testimonials";
import { AdmissionProcess } from "@/components/landing/AdmissionProcess";
import { RoomPricing } from "@/components/landing/RoomPricing";
import { Location } from "@/components/landing/Location";
import { FaqSection } from "@/components/landing/FaqSection";
import { EnquiryForm } from "@/components/landing/EnquiryForm";
import { Footer } from "@/components/landing/Footer";
import { WhatsAppFAB } from "@/components/landing/WhatsAppFAB";
import type { LandingAvailability } from "@/components/landing/landingTypes";
import { client } from "@/sanity/lib/client";
import {
  SITE_SETTINGS_QUERY,
  LANDING_HOSTEL_QUERY,
  TESTIMONIALS_QUERY,
  FAQS_QUERY,
  CATEGORY_RATINGS_QUERY,
  FOOD_QUERY,
  PARENT_TRUST_QUERY,
} from "@/sanity/lib/queries";
import { urlFor } from "@/sanity/lib/image";
import { fallbackLandingContent } from "@/lib/sanity/landingContent";

export const revalidate = 3600; // Cache page for up to 1 hour, revalidated via webhooks

const PRIMARY_VISIT_SLUG = process.env.NEXT_PUBLIC_PRIMARY_VISIT_SLUG || "sah-1-ea89eed3";

function currentIntakeMonth() {
  return new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date());
}

async function getAvailability(slug: string): Promise<LandingAvailability> {
  try {
    const data = await admissionsService.getPublicHostel(slug);
    const rooms = Array.isArray(data?.rooms) ? data.rooms : [];
    
    const bedsAvailable = rooms.reduce((sum: number, room: any) => sum + Number(room.available_beds || 0), 0);
    const totalBeds = rooms.reduce((sum: number, room: any) => sum + Number(room.capacity || 0), 0);
    const occupiedBeds = rooms.reduce((sum: number, room: any) => sum + Number(room.occupied_count || 0), 0);
    const reservedBeds = rooms.reduce((sum: number, room: any) => sum + Number(room.reserved_count || 0), 0);

    const roomTypeMap = new Map<string, {
      roomType: string;
      capacity: number;
      rents: number[];
      availableBeds: number;
      occupiedCount: number;
      totalRoomsCount: number;
      photos: string[];
    }>();

    for (const room of rooms) {
      let typeName = room.room_type || "Standard";
      if (typeName === "Standard" && room.capacity) {
        typeName = `${room.capacity}-Sharing`;
      }
      const rent = Number(room.pricing?.monthly_rent || 0);

      if (!roomTypeMap.has(typeName)) {
        roomTypeMap.set(typeName, {
          roomType: typeName,
          capacity: room.capacity || 0,
          rents: [],
          availableBeds: 0,
          occupiedCount: 0,
          totalRoomsCount: 0,
          photos: [],
        });
      }

      const entry = roomTypeMap.get(typeName)!;
      if (rent > 0) entry.rents.push(rent);
      entry.availableBeds += Number(room.available_beds || 0);
      entry.occupiedCount += Number(room.occupied_count || 0);
      entry.totalRoomsCount += 1;
      if (Array.isArray(room.photos)) {
        for (const p of room.photos) {
          if (p && !entry.photos.includes(p)) {
            entry.photos.push(p);
          }
        }
      }
    }

    const roomTypesList = Array.from(roomTypeMap.values()).map((entry) => {
      const minRent = entry.rents.length > 0 ? Math.min(...entry.rents) : 0;
      return {
        roomType: entry.roomType,
        capacity: entry.capacity,
        baseRent: minRent || data?.hostel?.starting_price || 8000,
        availableBeds: entry.availableBeds,
        occupiedCount: entry.occupiedCount,
        totalRoomsCount: entry.totalRoomsCount,
        photos: entry.photos,
      };
    });

    const roomPrices = rooms
      .map((room: any) => Number(room.pricing?.monthly_rent || 0))
      .filter(Boolean)
      .sort((a: number, b: number) => a - b);
    const startingPrice = roomPrices[0] || data?.hostel?.starting_price || 8000;

    const sharingTypesList = Array.from(new Set(roomTypesList.map((r) => r.roomType)));
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return {
      bedsAvailable,
      totalBeds,
      occupiedBeds,
      reservedBeds,
      occupancyRate,
      startingPrice,
      sharingTypes: sharingTypesList,
      roomTypes: roomTypesList,
      intakeMonth: currentIntakeMonth(),
      visitUrl: slug ? `/visit/${slug}` : "",
      hasLiveAvailability: true,
    };
  } catch (error) {
    console.error("Failed to fetch public hostel availability:", error);
    return {
      bedsAvailable: 0,
      totalBeds: 0,
      occupiedBeds: 0,
      reservedBeds: 0,
      occupancyRate: 0,
      startingPrice: 8000,
      sharingTypes: ["2-Sharing", "3-Sharing", "4-Sharing"],
      roomTypes: [
        {
          roomType: "2-Sharing",
          capacity: 2,
          baseRent: 9500,
          availableBeds: 0,
          occupiedCount: 0,
          totalRoomsCount: 0,
          photos: [],
        },
        {
          roomType: "3-Sharing",
          capacity: 3,
          baseRent: 8500,
          availableBeds: 0,
          occupiedCount: 0,
          totalRoomsCount: 0,
          photos: [],
        },
        {
          roomType: "4-Sharing",
          capacity: 4,
          baseRent: 8000,
          availableBeds: 0,
          occupiedCount: 0,
          totalRoomsCount: 0,
          photos: [],
        },
      ],
      intakeMonth: currentIntakeMonth(),
      visitUrl: slug ? `/visit/${slug}` : "",
      hasLiveAvailability: false,
    };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await client.fetch(SITE_SETTINGS_QUERY, {}, { next: { tags: ["siteSettings"] } });
  
  if (!siteSettings) {
    throw new Error("Missing siteSettings in CMS");
  }
  if (!siteSettings.seoTitle) {
    throw new Error("Missing seoTitle in CMS");
  }
  if (!siteSettings.seoDescription) {
    throw new Error("Missing seoDescription in CMS");
  }
  if (!siteSettings.seoSiteName) {
    throw new Error("Missing seoSiteName in CMS");
  }
  if (!siteSettings.canonicalUrl) {
    throw new Error("Missing canonicalUrl in CMS");
  }

  const title = siteSettings.seoTitle;
  const description = siteSettings.seoDescription;
  const imageUrl = siteSettings.ownerPhoto ? urlFor(siteSettings.ownerPhoto).url() : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: siteSettings.canonicalUrl,
    },
    openGraph: {
      title: siteSettings.ogTitle || title,
      description: siteSettings.ogDescription || description,
      url: siteSettings.canonicalUrl,
      siteName: siteSettings.seoSiteName,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              alt: title,
            },
          ]
        : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: siteSettings.ogTitle || title,
      description: siteSettings.ogDescription || description,
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

export default async function HomePage() {
  const startTime = Date.now();
  
  let siteSettings, hostel, testimonials, faqs, categoryRating, food, parentTrust, availability;
  
  try {
    [
      siteSettings,
      hostel,
      testimonials,
      faqs,
      categoryRating,
      food,
      parentTrust,
      availability,
    ] = await Promise.all([
      client.fetch(SITE_SETTINGS_QUERY, {}, { next: { tags: ["siteSettings"] } }),
      client.fetch(LANDING_HOSTEL_QUERY, {}, { next: { tags: ["landingHostel"] } }),
      client.fetch(TESTIMONIALS_QUERY, {}, { next: { tags: ["testimonial"] } }),
      client.fetch(FAQS_QUERY, {}, { next: { tags: ["faq"] } }),
      client.fetch(CATEGORY_RATINGS_QUERY, {}, { next: { tags: ["categoryRating"] } }),
      client.fetch(FOOD_QUERY, {}, { next: { tags: ["food"] } }),
      client.fetch(PARENT_TRUST_QUERY, {}, { next: { tags: ["parentTrust"] } }),
      getAvailability(PRIMARY_VISIT_SLUG),
    ]);
  } catch (err: any) {
    console.error(`[CMS Debug Error] Promise.all fetch failed:`, err);
    throw err;
  }

  const latency = Date.now() - startTime;
  console.log(`[CMS Debug] Fetch completed in ${latency}ms`);
  console.log(`[CMS Debug Query Result] hostel:`, hostel);
  console.log(`[CMS Debug Env] dataset:`, process.env.NEXT_PUBLIC_SANITY_DATASET, `projectId:`, process.env.NEXT_PUBLIC_SANITY_PROJECT_ID);
  console.log(`[CMS Debug] siteSettings: ${siteSettings ? 'LOADED' : 'MISSING'}`);
  console.log(`[CMS Debug] landingHostel (singleton): ${hostel ? `LOADED (ID: ${hostel._id || 'landingHostel'})` : 'MISSING'}`);
  console.log(`[CMS Debug] testimonials count: ${testimonials?.length || 0}`);
  console.log(`[CMS Debug] faqs count: ${faqs?.length || 0}`);
  console.log(`[CMS Debug] availability: bedsAvailable=${availability?.bedsAvailable}, startingPrice=${availability?.startingPrice}, hasLiveAvailability=${availability?.hasLiveAvailability}`);

  // Strict CMS Contract Validation
  if (!siteSettings) {
    throw new Error("Missing siteSettings in CMS");
  }
  if (!siteSettings.phoneNumber) {
    throw new Error("Missing phoneNumber in CMS");
  }
  if (!siteSettings.whatsappNumber) {
    throw new Error("Missing whatsappNumber in CMS");
  }
  if (!siteSettings.ownerName) {
    throw new Error("Missing ownerName in CMS");
  }
  if (siteSettings.googleRating === undefined || siteSettings.googleRating === null) {
    throw new Error("Missing googleRating in CMS");
  }
  if (siteSettings.googleReviewCount === undefined || siteSettings.googleReviewCount === null) {
    throw new Error("Missing googleReviewCount in CMS");
  }
  if (!hostel) {
    console.error("[CMS Debug Critical] landingHostel document was not found in Sanity. Reverting to fallback or throwing error.");
    throw new Error("Missing landingHostel in CMS");
  }
  if (!hostel.name) {
    throw new Error("Missing landingHostel.name in CMS");
  }

  const testimonialsFormatted = testimonials?.map((t: any) => ({
    name: t.name,
    role: t.type === "parent"
      ? `Parent of Resident · Verified Stay`
      : `${t.year || "4th"} Year · ${t.branch || "CSE"} · ${t.college || "SNIST"}`,
    review: t.quote,
    rating: t.rating || 5,
    initials: t.name ? t.name.split(" ").map((n: string) => n[0]).join("") : "SA",
    image: t.image ? { url: urlFor(t.image).url(), alt: t.name } : undefined,
  })) || [];

  const categoryRatingsFormatted = categoryRating ? [
    { label: "Food Quality", value: categoryRating.foodQuality || 4.9, percentage: Math.round((categoryRating.foodQuality || 4.9) * 20) },
    { label: "Cleanliness", value: categoryRating.cleanliness || 4.7, percentage: Math.round((categoryRating.cleanliness || 4.7) * 20) },
    { label: "Safety", value: categoryRating.safety || 4.8, percentage: Math.round((categoryRating.safety || 4.8) * 20) },
    { label: "Value for Money", value: categoryRating.valueForMoney || 4.6, percentage: Math.round((categoryRating.valueForMoney || 4.6) * 20) },
  ] : [];

  const faqsFormatted = faqs?.map((f: any) => ({
    question: f.question,
    answer: f.answer,
  })) || [];

  const galleryImagesFormatted = hostel.gallery?.map((g: any) => ({
    url: urlFor(g.image).url(),
    alt: g.alt || g.caption || "",
    caption: g.caption || "",
  })) || [];

  const foodFormatted = food ? {
    title: food.title || fallbackLandingContent.food!.title,
    description: food.description || fallbackLandingContent.food!.description,
    images: food.images?.map((g: any) => ({
      url: urlFor(g.image).url(),
      caption: g.caption || "",
      alt: g.alt || "",
    })) || fallbackLandingContent.food!.images,
    foodHighlights: food.foodHighlights || fallbackLandingContent.food!.foodHighlights,
    weeklyMenu: food.weeklyMenu || fallbackLandingContent.food!.weeklyMenu,
    parentQuote: food.parentQuote || fallbackLandingContent.food!.parentQuote,
    parentName: food.parentName || fallbackLandingContent.food!.parentName,
    parentPhotoUrl: food.parentPhoto ? urlFor(food.parentPhoto).url() : undefined,
  } : fallbackLandingContent.food;

  const parentTrustFormatted = parentTrust ? {
    title: parentTrust.title || fallbackLandingContent.parentTrust!.title,
    subtitle: parentTrust.subtitle || fallbackLandingContent.parentTrust!.subtitle,
    points: parentTrust.points?.map((p: any) => ({
      title: p.title,
      description: p.description,
      icon: p.icon || "cctv",
    })) || fallbackLandingContent.parentTrust!.points,
    imageUrl: parentTrust.image ? urlFor(parentTrust.image).url() : undefined,
  } : fallbackLandingContent.parentTrust;

  const hostelProfileForEnquiry = {
    name: hostel.name,
    phone: siteSettings.phoneNumber,
    whatsappNumber: siteSettings.whatsappNumber,
    email: siteSettings.email || "",
    shortLocation: hostel.shortLocation || "",
    addressLines: siteSettings.address ? siteSettings.address.split("\n").filter(Boolean) : [],
    locationTitle: hostel.locationTitle || "",
    locationDescription: hostel.locationDescription || "",
    distanceTitle: hostel.distanceTitle || "",
    distanceDescription: hostel.distanceDescription || "",
    googleMapsUrl: siteSettings.googleMapsUrl || "",
    googleMapsEmbedUrl: hostel.mapEmbedUrl || "",
    ownerName: siteSettings.ownerName,
    ownerMessage: siteSettings.ownerQuote || "",
    ownerPhoto: siteSettings.ownerPhoto ? { url: urlFor(siteSettings.ownerPhoto).url(), alt: siteSettings.ownerName || "Owner" } : undefined,
    whatsappEnquiryTemplate: siteSettings.whatsappEnquiryTemplate,
  };

  const footerContent = {
    title: hostel.name,
    description: "Providing clean, high-quality, and secure student accommodation.",
    quickLinks: [
      { label: "Home", href: "#home" },
      { label: "Facilities", href: "#facilities" },
      { label: "Rooms", href: "#rooms" },
      { label: "Location", href: "#location" },
      { label: "Contact", href: "#contact" },
    ],
    copyright: `© ${new Date().getFullYear()} ${hostel.name}. All rights reserved.`,
  };

  return (
    <div className="min-h-screen bg-[#FFFDF5]/20">
      <TopBar siteSettings={siteSettings} shortLocation={hostel.shortLocation} />
      <Navbar hostelName={hostel.name} />
      <GoogleTrustBar siteSettings={siteSettings} />
      <AnnouncementBanner announcements={siteSettings.announcements?.filter((a: any) => a.isActive) || []} />
      <Hero availability={availability} siteSettings={siteSettings} hostel={hostel} />
      <StatsStrip availability={availability} hostel={hostel} />
      <WhyChooseUs features={hostel.features || fallbackLandingContent.features} />
      <Facilities facilities={hostel.facilities || fallbackLandingContent.facilities} />
      <FoodSection food={foodFormatted} />
      <ParentTrust parentTrust={parentTrustFormatted} />
      <GallerySection images={galleryImagesFormatted} />
      <Testimonials testimonials={testimonialsFormatted} categoryRatings={categoryRatingsFormatted} />
      <AdmissionProcess steps={hostel.admissionSteps || fallbackLandingContent.admissionSteps} siteSettings={siteSettings} hostelName={hostel.name} />
      <RoomPricing availability={availability} facilities={hostel.facilities || fallbackLandingContent.facilities} siteSettings={siteSettings} hostel={hostel} />
      <Location siteSettings={siteSettings} hostel={hostel} />
      <FaqSection faqs={faqsFormatted} />
      <EnquiryForm availability={availability} hostelProfile={hostelProfileForEnquiry} visitSlug={PRIMARY_VISIT_SLUG} />
      <Footer content={footerContent} hostelProfile={hostelProfileForEnquiry} />
      <WhatsAppFAB 
        whatsappNumber={siteSettings.whatsappNumber} 
        ownerName={siteSettings.ownerName} 
        hostelName={hostel.name} 
        whatsappFABTemplate={siteSettings.whatsappFABTemplate} 
      />
      {process.env.NODE_ENV === 'development' && (
        <div id="dev-debug-panel" className="fixed bottom-4 left-4 z-50 bg-slate-900/90 text-white p-3 rounded-lg border border-slate-700 shadow-2xl text-xs font-mono max-w-sm backdrop-blur-sm">
          <div className="flex items-center justify-between mb-1.5 border-b border-slate-700 pb-1">
            <span className="font-semibold text-[#F07B1D]">CMS Debug Status</span>
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p><strong>Connection:</strong> Connected (Sanity Production)</p>
          <p><strong>Latency:</strong> {latency}ms</p>
          <p><strong>Document ID:</strong> {hostel?._id || 'landingHostel'}</p>
          <p><strong>Name:</strong> {hostel?.name || 'fallback'}</p>
          <p><strong>Beds:</strong> {availability?.bedsAvailable ?? 'N/A'} (Dynamic API)</p>
          <p><strong>Starting Price:</strong> {availability?.startingPrice ?? 'N/A'} (Dynamic API)</p>
        </div>
      )}
    </div>
  );
}
