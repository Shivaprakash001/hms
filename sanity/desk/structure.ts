import type { StructureResolver } from 'sanity/structure';

const singleton = (S: Parameters<StructureResolver>[0], title: string, type: string, id: string) =>
  S.listItem()
    .title(title)
    .schemaType(type)
    .child(S.document().schemaType(type).documentId(id).title(title));

export const deskStructure: StructureResolver = (S) =>
  S.list()
    .title('Marketing Content')
    .items([
      singleton(S, 'Home Landing Page', 'landingPage', 'home'),
      singleton(S, 'Hostel Profile', 'hostelProfile', 'sri-adithya-hostel'),
      singleton(S, 'Home Hero', 'hero', 'home-hero'),
      singleton(S, 'Home SEO', 'seo', 'home-seo'),
      singleton(S, 'Home Footer', 'footer', 'home-footer'),
      S.divider(),
      S.documentTypeListItem('announcement').title('Announcements'),
      S.documentTypeListItem('feature').title('Features'),
      S.documentTypeListItem('facility').title('Facilities'),
      S.documentTypeListItem('testimonial').title('Testimonials'),
      S.documentTypeListItem('faq').title('FAQs'),
      S.documentTypeListItem('galleryImage').title('Gallery'),
      S.documentTypeListItem('admissionStep').title('Admission Steps'),
    ]);
