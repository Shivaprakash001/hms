import { fallbackLandingContent, type LandingMarketingContent } from './landingContent';

const projectId = String(import.meta.env.VITE_SANITY_PROJECT_ID || '').trim();
const dataset = String(import.meta.env.VITE_SANITY_DATASET || 'production').trim();
const apiVersion = String(import.meta.env.VITE_SANITY_API_VERSION || '2026-06-01').trim();

const imageProjection = `{
  "url": image.asset->url,
  alt,
  caption
}`;

const landingQuery = `*[_type == "landingPage" && pageKey == "home"][0]{
  "hostelProfile": hostelProfile->{
    name,
    tagline,
    about,
    mission,
    foodPhilosophy,
    houseRules,
    ownerName,
    ownerMessage,
    "ownerPhoto": ownerPhoto${imageProjection},
    "gallery": gallery[]${imageProjection}
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
  "announcements": announcements[]->[isActive != false] | order(priority desc){
    title,
    description,
    cta,
    startDate,
    endDate,
    priority
  },
  "features": features[]->[isActive != false] | order(displayOrder asc){
    title,
    description,
    icon,
    "image": image${imageProjection},
    displayOrder
  },
  "facilities": facilities[]->[isActive != false] | order(displayOrder asc){
    label,
    icon,
    description,
    displayOrder
  },
  "testimonials": testimonials[]->[isActive != false && approvedAt != null] | order(displayOrder asc){
    name,
    details,
    quote,
    rating,
    duration,
    verificationType,
    "photo": photo${imageProjection},
    displayOrder
  },
  "faqs": faqs[]->[isActive != false] | order(displayOrder asc){
    question,
    answer,
    category,
    displayOrder
  },
  "gallery": gallery[]->[isActive != false] | order(displayOrder asc){
    title,
    category,
    "url": asset.image.asset->url,
    "alt": asset.alt,
    "caption": coalesce(asset.caption, title),
    displayOrder
  },
  "admissionSteps": admissionSteps[]->[isActive != false] | order(number asc){
    number,
    title,
    description,
    mobileDescription,
    icon,
    "isFinal": isFinal
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

function compactImages(images: any[] | undefined) {
  return Array.isArray(images) ? images.filter(hasImage) : [];
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
      gallery: compactImages(content?.hostelProfile?.gallery).length ? compactImages(content.hostelProfile.gallery) : fallbackLandingContent.hostelProfile.gallery,
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
      carouselImages: compactImages(content?.hero?.carouselImages).length ? compactImages(content.hero.carouselImages) : fallbackLandingContent.hero.carouselImages,
      highlights: Array.isArray(content?.hero?.highlights) && content.hero.highlights.length ? content.hero.highlights : fallbackLandingContent.hero.highlights,
    },
    announcements: activeAnnouncements(content?.announcements),
    features: Array.isArray(content?.features) && content.features.length ? content.features : fallbackLandingContent.features,
    facilities: Array.isArray(content?.facilities) && content.facilities.length ? content.facilities : fallbackLandingContent.facilities,
    testimonials: Array.isArray(content?.testimonials) && content.testimonials.length ? content.testimonials : fallbackLandingContent.testimonials,
    faqs: Array.isArray(content?.faqs) && content.faqs.length ? content.faqs : fallbackLandingContent.faqs,
    gallery: compactImages(content?.gallery).length ? compactImages(content.gallery) : fallbackLandingContent.gallery,
    admissionSteps: Array.isArray(content?.admissionSteps) && content.admissionSteps.length ? content.admissionSteps : fallbackLandingContent.admissionSteps,
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
