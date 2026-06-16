export const SITE_SETTINGS_QUERY = `
  *[_type == "siteSettings"][0] {
    phoneNumber,
    whatsappNumber,
    email,
    address,
    googleRating,
    googleReviewCount,
    totalStudents,
    ownerName,
    ownerTitle,
    ownerQuote,
    ownerPhoto,
    establishmentYear,
    googleMapsUrl,
    googleReadReviewsUrl,
    googleWriteReviewUrl,
    seoTitle,
    seoDescription,
    ogTitle,
    ogDescription,
    seoSiteName,
    canonicalUrl,
    whatsappFABTemplate,
    whatsappHeroTemplate,
    whatsappRoomBookingTemplate,
    whatsappAdmissionTemplate,
    whatsappEnquiryTemplate,
    announcements[] {
      title,
      description,
      cta {
        label,
        href
      },
      isActive
    }
  }
`

export const LANDING_HOSTEL_QUERY = `
  *[_type == "landingHostel"][0] {
    name,
    heroTitle,
    heroSubtitle,
    heroSupportingCopy,
    heroHighlights,
    gallery[] {
      image,
      caption,
      alt
    },
    mapEmbedUrl,
    totalBuildings,
    sharingTypes,
    amenitiesCount,
    roomTypeTitle,
    roomImage,
    locationTitle,
    locationDescription,
    distanceTitle,
    distanceDescription,
    shortLocation,
    features[] {
      title,
      description,
      icon,
      image,
      highlights
    },
    facilities[] {
      title,
      icon,
      description
    },
    admissionSteps[] {
      stepNumber,
      title,
      description
    },
    roomTypesImages[] {
      roomType,
      image
    },
    tourVideos[] {
      id,
      label,
      videoUrl,
      "videoFileUrl": videoFile.asset->url,
      icon
    }
  }
`

export const ACTIVE_HOSTEL_QUERY = `
  *[_type == "hostel" && slug.current == $slug][0] {
    name,
    bedsAvailable,
    intakeMonth,
    startingPrice,
    heroTitle,
    heroSubtitle,
    heroHighlights,
    gallery[] {
      image,
      caption,
      alt
    },
    mapEmbedUrl,
    totalBuildings,
    sharingTypes,
    amenitiesCount,
    roomTypeTitle,
    roomImage,
    locationTitle,
    locationDescription,
    distanceTitle,
    distanceDescription,
    shortLocation,
    features[] {
      title,
      description,
      icon,
      image,
      highlights
    },
    facilities[] {
      title,
      icon,
      description
    },
    admissionSteps[] {
      stepNumber,
      title,
      description
    },
    roomTypesImages[] {
      roomType,
      image
    },
    tourVideos[] {
      id,
      label,
      videoUrl,
      "videoFileUrl": videoFile.asset->url,
      icon
    }
  }
`

export const TESTIMONIALS_QUERY = `
  *[_type == "testimonial" && isActive == true]
  | order(order asc) {
    name,
    type,
    year,
    branch,
    college,
    location,
    rating,
    quote,
    tag
  }
`

export const FAQS_QUERY = `
  *[_type == "faq" && isActive == true]
  | order(order asc) {
    question,
    answer,
    category
  }
`

export const CATEGORY_RATINGS_QUERY = `
  *[_type == "categoryRating"][0] {
    overallRating,
    totalReviews,
    foodQuality,
    cleanliness,
    safety,
    valueForMoney
  }
`

export const FOOD_QUERY = `
  *[_type == "food"][0] {
    title,
    description,
    images[] {
      image,
      caption,
      alt
    },
    foodHighlights,
    weeklyMenu[] {
      day,
      breakfast,
      lunch,
      dinner
    },
    parentQuote,
    parentName,
    parentPhoto
  }
`

export const PARENT_TRUST_QUERY = `
  *[_type == "parentTrust"][0] {
    title,
    subtitle,
    points[] {
      title,
      description,
      icon
    },
    image
  }
`

