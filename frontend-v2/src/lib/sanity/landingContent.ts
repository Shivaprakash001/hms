export type MarketingImage = {
  url: string;
  alt: string;
  caption?: string;
};

export type LandingCta = {
  label: string;
  href: string;
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
  phone?: string;
  whatsappNumber?: string;
  email?: string;
  shortLocation?: string;
  addressLines?: string[];
  locationTitle?: string;
  locationDescription?: string;
  distanceTitle?: string;
  distanceDescription?: string;
  googleMapsUrl?: string;
  googleMapsEmbedUrl?: string;
  ownerName?: string;
  ownerMessage?: string;
  ownerPhoto?: MarketingImage;
};

export type TourVideoContent = {
  id: string;
  label: string;
  url: string;
  icon: 'bed' | 'building' | 'utensils' | 'tv' | 'wifi' | 'security';
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
  tourVideos?: TourVideoContent[];
};

export type FeatureContent = {
  title: string;
  description: string;
  icon: string;
  image?: MarketingImage;
};

export type FacilityContent = {
  title: string;
  icon: string;
  description?: string;
};

export type TestimonialContent = {
  name: string;
  role?: string;
  review: string;
  rating: number;
  image?: MarketingImage;
};

export type FaqContent = {
  question: string;
  answer: string;
};

export type AdmissionStepContent = {
  stepNumber: number;
  title: string;
  description: string;
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
  gallery: GalleryImageContent[];
  admissionSteps: AdmissionStepContent[];
  footer: FooterContent;
};

export type GalleryImageContent = MarketingImage & {
  title?: string;
  category?: string;
};

const fallbackImages = {
  room: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  food: 'https://images.unsplash.com/photo-1542367592-8849eb950fd8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  building: 'https://images.unsplash.com/photo-1779062553813-e2047a686036?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
};

export const fallbackLandingContent: LandingMarketingContent = {
  hostelProfile: {
    name: 'Sri Adithya Hostels',
    phone: '9392433422',
    whatsappNumber: '919392433422',
    email: 'sriadithyahostels@gmail.com',
    shortLocation: 'Yamnampet, Secunderabad',
    addressLines: ['Sri Adithya Hostels', 'Yamnampet', 'Secunderabad, Telangana'],
    locationTitle: 'Prime Location',
    locationDescription: 'Conveniently located near SNIST — your daily commute is just a 5-minute walk',
    distanceTitle: 'Just 400m from SNIST',
    distanceDescription: '5 minute walk to campus gate',
    googleMapsUrl: 'https://maps.app.goo.gl/tUrcbuFmST7Zyt1c9',
    googleMapsEmbedUrl:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d951.5284365512007!2d78.66220596962678!3d17.454269078321268!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb770dd641583b%3A0xde3e95b9afb8c1b1!2sSri%20Adithya%20Boys%20Hostel!5e0!3m2!1sen!2sin!4v1780503771881!5m2!1sen!2sin',
    ownerName: 'Srinivasa Rao',
    ownerMessage: 'I personally respond to every enquiry.',
  },
  seo: {
    title: 'Best Boys Hostel in Yamnampet, Secunderabad | Sri Adithya Hostels',
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
    primaryCta: { label: 'Book a Room Visit', href: '#contact' },
    secondaryCta: { label: 'Check Availability on WhatsApp', href: 'https://api.whatsapp.com/send?phone=919392433422' },
    carouselImages: [
      { url: fallbackImages.room, alt: 'Room Interior', caption: 'Room Interior' },
      { url: fallbackImages.food, alt: 'Daily Meals', caption: 'Daily Meals' },
      { url: fallbackImages.building, alt: 'Hostel Building', caption: 'Hostel Building' },
    ],
    tourVideos: [
      {
        id: 'room',
        label: 'Room',
        url: 'https://www.w3schools.com/html/mov_bbb.mp4',
        icon: 'bed',
      },
      {
        id: 'common',
        label: 'Common',
        url: 'https://media.w3.org/2010/05/sintel/trailer_hd.mp4',
        icon: 'building',
      },
      {
        id: 'dining',
        label: 'Dining',
        url: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
        icon: 'utensils',
      },
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
    { icon: 'wifi', title: 'Free WiFi' },
    { icon: 'water', title: 'Hot Water' },
    { icon: 'cleaning', title: 'Daily Cleaning' },
    { icon: 'security', title: 'Warden Security' },
    { icon: 'cctv', title: '24/7 CCTV' },
    { icon: 'laundry', title: 'Washing Machine' },
    { icon: 'storage', title: 'Secure Storage' },
    { icon: 'power', title: 'Emergency Generator' },
    { icon: 'food', title: 'Meals Included' },
  ],
  testimonials: [
    {
      name: 'Ravi K.',
      role: '3rd Year · B.Tech CSE · SNIST',
      review: 'Food is the biggest surprise. I expected mess food — I got home food. My mother actually approved after tasting it.',
      rating: 5,
    },
    {
      name: 'Arjun M.',
      role: '2nd Year · B.Tech ECE · SNIST',
      review: '5 minutes to college gate. I sleep until 8:55 for a 9 AM class. No other hostel near SNIST gives you that.',
      rating: 5,
    },
    {
      name: 'Father of Karthik R.',
      role: 'Parent · Vizag',
      review: "My biggest worry was food. After visiting once and seeing the kitchen, I stopped worrying. They also WhatsApp me if anything unusual happens.",
      rating: 5,
    },
  ],
  faqs: [
    {
      question: 'Are meals included in the hostel fee?',
      answer: 'Yes. Daily meals are included, with a focus on homely food for students.',
    },
    {
      question: 'Is the hostel suitable for parents who want regular safety updates?',
      answer: 'Yes. Parents can speak with the owner and understand rules, safety, and visit process before admission. We provide regular updates to parents.',
    },
    {
      question: 'Are there hidden charges?',
      answer: 'No. Room pricing and inclusions are discussed clearly before admission confirmation.',
    },
    {
      question: 'What is the internet speed at the hostel?',
      answer: 'The hostel has high-speed fiber broadband WiFi. Students use it for online classes, assignments, and streaming without interruption. Separate network access points are available per room.',
    },
    {
      question: 'Can we visit the hostel before confirming admission?',
      answer: 'Absolutely. We encourage all students and parents to visit in person. Call or WhatsApp Srinivasa Rao at 9392433422 to schedule a visit — most visits happen within 24 hours of enquiry.',
    },
    {
      question: 'What is the deposit amount and refund policy?',
      answer: 'A simple security deposit is required to confirm your bed. The deposit is fully refundable when you move out, subject to room condition. No hidden booking fees.',
    },
    {
      question: 'Is there a study room or quiet area for students?',
      answer: 'Yes. Students have access to a dedicated study area within the hostel. The environment is designed to support academic focus, especially during exam season.',
    },
    {
      question: 'What happens during semester breaks and summer vacation?',
      answer: 'Students may choose to keep their room during semester breaks. We offer flexible semester and annual packages. WhatsApp us for details based on your academic calendar.',
    },
  ],
  gallery: [
    { url: fallbackImages.room, alt: 'Room Interior', caption: 'Room Interior' },
    { url: fallbackImages.food, alt: 'Daily Meals', caption: 'Daily Meals' },
    { url: fallbackImages.building, alt: 'Hostel Building', caption: 'Hostel Building' },
  ],
  admissionSteps: [
    { stepNumber: 1, title: 'Reach Out', description: 'Call or WhatsApp Srinivasa Rao — get answers in minutes.' },
    { stepNumber: 2, title: 'Visit the Hostel', description: 'Come see the room, food, and facilities in person.' },
    { stepNumber: 3, title: 'Pick Your Room', description: 'Select your preferred block and bed. We show you who your roommates are.' },
    { stepNumber: 4, title: 'Pay & Confirm', description: 'Simple deposit to reserve your bed. No hidden charges.' },
    { stepNumber: 5, title: 'Move In', description: 'Bring your things. Your home near SNIST is ready.' },
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
