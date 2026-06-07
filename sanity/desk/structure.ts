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
      singleton(S, 'Home Landing Page', 'landingPage', '6e322218-b0fe-4524-9157-b1d8f23a09c0'),
      singleton(S, 'Hostel Profile', 'hostelProfile', 'b13e8301-3155-4932-9224-68f350b0b203'),
      singleton(S, 'Home Hero', 'hero', 'e9f24321-7675-4486-8441-6b36b146955d'),
      singleton(S, 'Home SEO', 'seo', '5faae1fe-a8ef-4dc0-a98e-e5bf3d834640'),
      singleton(S, 'Home Footer', 'footer', 'c7dfa040-0dfd-467e-96a1-de9fd4b298d9'),
      S.divider(),
      S.documentTypeListItem('announcement').title('Announcements'),
      S.documentTypeListItem('feature').title('Features'),
      S.documentTypeListItem('facility').title('Facilities'),
      S.documentTypeListItem('testimonial').title('Testimonials'),
      S.documentTypeListItem('faq').title('FAQs'),
      S.documentTypeListItem('galleryImage').title('Gallery'),
      S.documentTypeListItem('admissionStep').title('Admission Steps'),
    ]);
