import { StructureBuilder } from 'sanity/structure'

export const structure = (S: StructureBuilder) =>
  S.list()
    .title('Sri Adithya Boys Hostel')
    .items([
      S.listItem()
        .title('⚙️ Site Settings')
        .child(
          S.document()
            .schemaType('siteSettings')
            .documentId('siteSettings')
        ),
      S.listItem()
        .title('📝 Marketing Page Copy')
        .child(
          S.document()
            .schemaType('landingHostel')
            .documentId('landingHostel')
        ),
      S.listItem()
        .title('🏢 Hostel Settings (Availability)')
        .child(
          S.document()
            .schemaType('hostel')
            .documentId('hostel-1')
        ),
      S.listItem()
        .title('🥗 Food & Dining')
        .child(
          S.document()
            .schemaType('food')
            .documentId('food')
        ),
      S.listItem()
        .title('👨‍👩‍👦 Parent Trust')
        .child(
          S.document()
            .schemaType('parentTrust')
            .documentId('parentTrust')
        ),
      S.listItem()
        .title('⭐ Testimonials')
        .child(
          S.documentTypeList('testimonial')
            .title('Testimonials')
            .defaultOrdering([{ field: 'order', direction: 'asc' }])
        ),
      S.listItem()
        .title('❓ FAQs')
        .child(
          S.documentTypeList('faq')
            .title('FAQs')
            .defaultOrdering([{ field: 'order', direction: 'asc' }])
        ),
      S.listItem()
        .title('📊 Ratings')
        .child(
          S.document()
            .schemaType('categoryRating')
            .documentId('categoryRating')
        ),
    ])
