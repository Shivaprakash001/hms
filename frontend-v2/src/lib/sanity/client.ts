import { fallbackLandingContent, type LandingMarketingContent } from './landingContent';

const projectId = String(import.meta.env.VITE_SANITY_PROJECT_ID || '').trim();
const dataset = String(import.meta.env.VITE_SANITY_DATASET || 'production').trim();
const apiVersion = String(import.meta.env.VITE_SANITY_API_VERSION || '2026-06-01').trim();

const imageProjection = `{
  "url": coalesce(image.asset->url, externalUrl),
  alt,
  caption
}`;

const landingQuery = `*[_type == "landingPage" && pageKey == "home"] | order(_updatedAt desc)[0]{
  "hostelProfile": hostelProfile->{
    name,
    phone,
    whatsappNumber,
    email,
    shortLocation,
    addressLines,
    locationTitle,
    locationDescription,
    distanceTitle,
    distanceDescription,
    googleMapsUrl,
    googleMapsEmbedUrl,
    ownerName,
    ownerMessage,
    "ownerPhoto": ownerPhoto${imageProjection}
  },
  "seo": seo->{
    title,
    description,
    canonicalUrl,
    "ogImage": ogImage${imageProjection}
  },
  "hero": hero->{
    title,
    subtitle,
    supportingCopy,
    trustBadge,
    highlights,
    primaryCta,
    secondaryCta,
    "ownerImage": ownerImage${imageProjection},
    "carouselImages": carouselImages[]${imageProjection}
  },
  "announcements": *[_type == "announcement" && _id in ^.announcements[]._ref && isActive != false] | order(priority desc){
    title,
    description,
    cta,
    startDate,
    endDate,
    priority
  },
  "features": *[_type == "feature" && _id in ^.features[]._ref && isActive != false] | order(displayOrder asc){
    title,
    description,
    icon,
    "image": image${imageProjection},
    displayOrder
  },
  "facilities": *[_type == "facility" && _id in ^.facilities[]._ref && isActive != false] | order(displayOrder asc){
    "title": coalesce(title, label),
    icon,
    description,
    displayOrder
  },
  "testimonials": *[_type == "testimonial" && _id in ^.testimonials[]._ref && isActive != false] | order(displayOrder asc){
    name,
    "role": coalesce(role, details, duration),
    "review": coalesce(review, quote),
    rating,
    "image": select(
      defined(image.image) => image${imageProjection},
      defined(photo.image) => photo${imageProjection},
      null
    ),
    displayOrder
  },
  "faqs": *[_type == "faq" && _id in ^.faqs[]._ref && isActive != false] | order(displayOrder asc){
    question,
    answer,
    displayOrder
  },
  "gallery": *[_type == "galleryImage" && _id in ^.gallery[]._ref && isActive != false] | order(displayOrder asc){
    title,
    category,
    "url": coalesce(asset.image.asset->url, asset.externalUrl),
    "alt": asset.alt,
    "caption": coalesce(asset.caption, title),
    displayOrder
  },
  "admissionSteps": *[_type == "admissionStep" && _id in ^.admissionSteps[]._ref && isActive != false] | order(coalesce(stepNumber, number) asc){
    "stepNumber": coalesce(stepNumber, number),
    title,
    description
  },
  "footer": footer->{
    title,
    description,
    quickLinks,
    copyright
  }
}`;

function hasImage(image: any) {
  return Boolean(image?.url && image?.alt);
}

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function compactImages(images: any[] | undefined) {
  return Array.isArray(images) ? images.filter(hasImage) : [];
}

function compactFeatures(features: any[] | undefined) {
  return (Array.isArray(features) ? features : []).filter(
    (feature) => feature && hasText(feature.title) && hasText(feature.description) && hasText(feature.icon),
  );
}

function compactFacilities(facilities: any[] | undefined) {
  return (Array.isArray(facilities) ? facilities : []).filter(
    (facility) => facility && hasText(facility.title) && hasText(facility.icon),
  );
}

function compactTestimonials(testimonials: any[] | undefined) {
  return (Array.isArray(testimonials) ? testimonials : [])
    .filter((testimonial) => testimonial && hasText(testimonial.name) && hasText(testimonial.review))
    .map((testimonial) => ({
      ...testimonial,
      rating: Number(testimonial.rating || 5),
      image: hasImage(testimonial.image) ? testimonial.image : undefined,
    }));
}

function compactFaqs(faqs: any[] | undefined) {
  return (Array.isArray(faqs) ? faqs : []).filter(
    (faq) => faq && hasText(faq.question) && hasText(faq.answer),
  );
}

function compactAdmissionSteps(steps: any[] | undefined) {
  return (Array.isArray(steps) ? steps : [])
    .filter((step) => step && Number.isFinite(Number(step.stepNumber)) && hasText(step.title) && hasText(step.description))
    .map((step) => ({ ...step, stepNumber: Number(step.stepNumber) }));
}

function activeAnnouncements(announcements: any[] | undefined) {
  const now = Date.now();
  return (Array.isArray(announcements) ? announcements : []).filter((item) => {
    const startsOk = !item?.startDate || new Date(item.startDate).getTime() <= now;
    const endsOk = !item?.endDate || new Date(item.endDate).getTime() >= now;
    return item?.title && startsOk && endsOk;
  });
}

function mergeLandingContent(content: any): LandingMarketingContent {
  return {
    ...fallbackLandingContent,
    hostelProfile: {
      ...fallbackLandingContent.hostelProfile,
      ...(content?.hostelProfile || {}),
      ownerPhoto: hasImage(content?.hostelProfile?.ownerPhoto) ? content.hostelProfile.ownerPhoto : fallbackLandingContent.hostelProfile.ownerPhoto,
    },
    seo: {
      ...fallbackLandingContent.seo,
      ...(content?.seo || {}),
      ogImage: hasImage(content?.seo?.ogImage) ? content.seo.ogImage : fallbackLandingContent.seo.ogImage,
    },
    hero: {
      ...fallbackLandingContent.hero,
      ...(content?.hero || {}),
      ownerImage: hasImage(content?.hero?.ownerImage) ? content.hero.ownerImage : fallbackLandingContent.hero.ownerImage,
      carouselImages: Array.isArray(content?.hero?.carouselImages) ? compactImages(content.hero.carouselImages) : [],
      highlights: Array.isArray(content?.hero?.highlights) ? content.hero.highlights.filter(Boolean) : [],
    },
    announcements: activeAnnouncements(content?.announcements),
    features: compactFeatures(content?.features),
    facilities: compactFacilities(content?.facilities),
    testimonials: compactTestimonials(content?.testimonials),
    faqs: compactFaqs(content?.faqs),
    gallery: Array.isArray(content?.gallery) ? compactImages(content.gallery) : [],
    admissionSteps: compactAdmissionSteps(content?.admissionSteps),
    footer: {
      ...fallbackLandingContent.footer,
      ...(content?.footer || {}),
      quickLinks: Array.isArray(content?.footer?.quickLinks) && content.footer.quickLinks.length ? content.footer.quickLinks : fallbackLandingContent.footer.quickLinks,
    },
  };
}

export async function getLandingMarketingContent(): Promise<LandingMarketingContent> {
  if (!projectId || !dataset) return fallbackLandingContent;

  const url = new URL(`https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`);
  url.searchParams.set('query', landingQuery);

  const response = await fetch(url.toString(), { credentials: 'omit' });
  if (!response.ok) throw new Error(`Sanity content request failed: ${response.status}`);

  const payload = await response.json();
  if (!payload?.result) return fallbackLandingContent;
  return mergeLandingContent(payload.result);
}

export { fallbackLandingContent };
export type { LandingMarketingContent };
