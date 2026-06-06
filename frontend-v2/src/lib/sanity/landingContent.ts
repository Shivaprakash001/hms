export type MarketingImage = {
  url: string;
  alt: string;
  caption?: string;
};

export type LandingCta = {
  label: string;
  href: string;
  style?: 'primary' | 'secondary' | 'text';
};

export type LandingAnnouncement = {
  title: string;
  description?: string;
  cta?: LandingCta;
  startDate?: string;
  endDate?: string;
  priority?: number;
};

export type HostelProfileContent = {
  name: string;
  tagline: string;
  about: string;
  mission?: string;
  foodPhilosophy?: string;
  houseRules?: string[];
  ownerName?: string;
  ownerMessage?: string;
  ownerPhoto?: MarketingImage;
  gallery?: MarketingImage[];
};

export type HeroContent = {
  title: string;
  subtitle: string;
  supportingCopy?: string;
  trustBadge?: string;
  highlights: string[];
  primaryCta?: LandingCta;
  secondaryCta?: LandingCta;
  ownerImage?: MarketingImage;
  carouselImages: MarketingImage[];
};

export type FeatureContent = {
  title: string;
  description: string;
  icon: string;
  image?: MarketingImage;
};

export type FacilityContent = {
  label: string;
  icon: string;
  description?: string;
};

export type TestimonialContent = {
  name: string;
  details?: string;
  quote: string;
  rating: number;
  duration?: string;
  verificationType: 'CURRENT_TENANT' | 'FORMER_TENANT' | 'PARENT';
  photo?: MarketingImage;
};

export type FaqContent = {
  question: string;
  answer: string;
  category: 'Food' | 'Security' | 'Visitors' | 'Fees' | 'Rooms' | 'Move-In' | 'Parents';
};

export type AdmissionStepContent = {
  number: number;
  title: string;
  description: string;
  mobileDescription?: string;
  icon: string;
  isFinal?: boolean;
};

export type SeoContent = {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: MarketingImage;
};

export type FooterContent = {
  title: string;
  description?: string;
  quickLinks: LandingCta[];
  copyright?: string;
};

export type LandingMarketingContent = {
  hostelProfile: HostelProfileContent;
  seo: SeoContent;
  hero: HeroContent;
  announcements: LandingAnnouncement[];
  features: FeatureContent[];
  facilities: FacilityContent[];
  testimonials: TestimonialContent[];
  faqs: FaqContent[];
  gallery: MarketingImage[];
  admissionSteps: AdmissionStepContent[];
  footer: FooterContent;
};

const fallbackImages = {
  room: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  food: 'https://images.unsplash.com/photo-1542367592-8849eb950fd8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  building: 'https://images.unsplash.com/photo-1779062553813-e2047a686036?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
};

export const fallbackLandingContent: LandingMarketingContent = {
  hostelProfile: {
    name: 'Sri Adithya Hostels',
    tagline: 'Your home away from home',
    about: 'Comfortable, safe, and affordable accommodation for students near SNIST.',
    foodPhilosophy: 'Fresh homely meals included daily.',
    ownerName: 'Srinivasa Rao',
    ownerMessage: 'I personally respond to every enquiry.',
  },
  seo: {
    title: 'Sri Adithya Boys Hostel | Student Accommodation Near SNIST',
    description:
      'Sri Adithya Boys Hostel offers safe student accommodation near SNIST with homely meals, transparent pricing, parent-friendly admissions, and easy room visit booking.',
    canonicalUrl: 'https://sriadithyahostels.in/',
  },
  hero: {
    title: 'Feel at Home, Every Day',
    subtitle: 'Boys hostel, just 5 mins walk from SNIST',
    supportingCopy: 'Join 78+ SNIST students, everything included.',
    trustBadge: 'Trusted by SNIST students since 2019',
    highlights: ['Meals Included', 'CCTV + Warden', '400m from SNIST'],
    primaryCta: { label: 'Book a Room Visit', href: '#contact', style: 'primary' },
    secondaryCta: { label: 'Check Availability on WhatsApp', href: 'https://api.whatsapp.com/send?phone=919392433422', style: 'secondary' },
    carouselImages: [
      { url: fallbackImages.room, alt: 'Room Interior', caption: 'Room Interior' },
      { url: fallbackImages.food, alt: 'Daily Meals', caption: 'Daily Meals' },
      { url: fallbackImages.building, alt: 'Hostel Building', caption: 'Hostel Building' },
    ],
  },
  announcements: [],
  features: [
    {
      icon: 'food',
      title: 'Homely Food',
      description: "Fresh, daily meals included — just like mom's cooking",
      image: { url: fallbackImages.food, alt: 'Homely food served at Sri Adithya Hostels' },
    },
    {
      icon: 'home',
      title: 'Homely Atmosphere',
      description: 'Warm, safe & comfortable — designed for students',
      image: { url: fallbackImages.room, alt: 'Student room at Sri Adithya Hostels' },
    },
    {
      icon: 'location',
      title: 'Prime Location',
      description: '400m from SNIST gate — walk in 5 minutes',
      image: { url: fallbackImages.building, alt: 'Sri Adithya Hostels building location' },
    },
  ],
  facilities: [
    { icon: 'wifi', label: 'Free WiFi' },
    { icon: 'water', label: 'Hot Water' },
    { icon: 'cleaning', label: 'Daily Cleaning' },
    { icon: 'security', label: 'Warden Security' },
    { icon: 'cctv', label: '24/7 CCTV' },
    { icon: 'laundry', label: 'Washing Machine' },
    { icon: 'storage', label: 'Secure Storage' },
    { icon: 'power', label: 'Emergency Generator' },
    { icon: 'food', label: 'Meals Included' },
  ],
  testimonials: [
    {
      name: 'Ravi K.',
      details: '3rd Year · B.Tech CSE · SNIST',
      quote: 'Food is the biggest surprise. I expected mess food — I got home food. My mother actually approved after tasting it.',
      rating: 5,
      duration: 'Stayed 18 months',
      verificationType: 'FORMER_TENANT',
    },
    {
      name: 'Arjun M.',
      details: '2nd Year · B.Tech ECE · SNIST',
      quote: '5 minutes to college gate. I sleep until 8:55 for a 9 AM class. No other hostel near SNIST gives you that.',
      rating: 5,
      duration: 'Current Resident',
      verificationType: 'CURRENT_TENANT',
    },
    {
      name: 'Father of Karthik R.',
      details: 'Vizag',
      quote: "My biggest worry was food. After visiting once and seeing the kitchen, I stopped worrying. They also WhatsApp me if anything unusual happens.",
      rating: 5,
      duration: 'Verified Stay',
      verificationType: 'PARENT',
    },
  ],
  faqs: [
    {
      category: 'Food',
      question: 'Are meals included in the hostel fee?',
      answer: 'Yes. Daily meals are included, with a focus on homely food for students.',
    },
    {
      category: 'Security',
      question: 'Is the hostel suitable for parents who want regular safety updates?',
      answer: 'Yes. Parents can speak with the owner and understand rules, safety, and visit process before admission.',
    },
    {
      category: 'Fees',
      question: 'Are there hidden charges?',
      answer: 'No. Room pricing and inclusions are discussed clearly before admission confirmation.',
    },
  ],
  gallery: [
    { url: fallbackImages.room, alt: 'Room Interior', caption: 'Room Interior' },
    { url: fallbackImages.food, alt: 'Daily Meals', caption: 'Daily Meals' },
    { url: fallbackImages.building, alt: 'Hostel Building', caption: 'Hostel Building' },
  ],
  admissionSteps: [
    { number: 1, icon: 'phone', title: 'Reach Out', description: 'Call or WhatsApp Srinivasa Rao — get answers in minutes.', mobileDescription: 'Call or WhatsApp for quick answers.' },
    { number: 2, icon: 'building', title: 'Visit the Hostel', description: 'Come see the room, food, and facilities in person.', mobileDescription: 'See rooms, food, and facilities.' },
    { number: 3, icon: 'bed', title: 'Pick Your Room', description: 'Select your preferred block and bed. We show you who your roommates are.', mobileDescription: 'Choose your block and bed.' },
    { number: 4, icon: 'document', title: 'Pay & Confirm', description: 'Simple deposit to reserve your bed. No hidden charges.', mobileDescription: 'Reserve your bed with a deposit.' },
    { number: 5, icon: 'key', title: 'Move In', description: 'Bring your things. Your home near SNIST is ready.', mobileDescription: 'Move into your hostel room.', isFinal: true },
  ],
  footer: {
    title: 'Sri Adithya Hostels',
    description: 'Your home away from home — providing comfortable, safe, and affordable accommodation for students near SNIST.',
    quickLinks: [
      { label: 'Home', href: '#home' },
      { label: 'Facilities', href: '#facilities' },
      { label: 'Rooms & Pricing', href: '#rooms' },
      { label: 'Location', href: '#location' },
      { label: 'Contact', href: '#contact' },
      { label: 'Tenant / Owner Login', href: '/login' },
    ],
    copyright: '© 2026 Sri Adithya Hostels. All rights reserved.',
  },
};
