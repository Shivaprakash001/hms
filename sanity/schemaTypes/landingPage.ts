import { defineField, defineType } from 'sanity';

export const landingPage = defineType({
  name: 'landingPage',
  title: 'Landing Page Assembly',
  type: 'document',
  initialValue: {
    title: 'Home Landing Page',
    pageKey: 'home',
    hostelProfile: { _type: 'reference', _ref: 'sri-adithya-hostel' },
    seo: { _type: 'reference', _ref: 'home-seo' },
    hero: { _type: 'reference', _ref: 'home-hero' },
    footer: { _type: 'reference', _ref: 'home-footer' },
  },
  fields: [
    defineField({
      name: 'title',
      title: 'Internal title',
      type: 'string',
      validation: (Rule) => Rule.required().max(120),
    }),
    defineField({
      name: 'pageKey',
      title: 'Page key',
      type: 'string',
      initialValue: 'home',
      validation: (Rule) => Rule.required().max(80),
    }),
    defineField({
      name: 'hostelProfile',
      title: 'Hostel profile',
      type: 'reference',
      to: [{ type: 'hostelProfile' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'seo',
      title: 'SEO',
      type: 'reference',
      to: [{ type: 'seo' }],
    }),
    defineField({
      name: 'hero',
      title: 'Hero',
      type: 'reference',
      to: [{ type: 'hero' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'announcements',
      title: 'Announcement banners',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'announcement' }] }],
    }),
    defineField({
      name: 'features',
      title: 'Why choose us features',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'feature' }] }],
    }),
    defineField({
      name: 'facilities',
      title: 'Facilities',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'facility' }] }],
    }),
    defineField({
      name: 'testimonials',
      title: 'Testimonials',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'testimonial' }] }],
    }),
    defineField({
      name: 'faqs',
      title: 'FAQs',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'faq' }] }],
    }),
    defineField({
      name: 'gallery',
      title: 'Gallery images',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'galleryImage' }] }],
    }),
    defineField({
      name: 'admissionSteps',
      title: 'Admission process steps',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'admissionStep' }] }],
    }),
    defineField({
      name: 'footer',
      title: 'Footer',
      type: 'reference',
      to: [{ type: 'footer' }],
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'pageKey' },
  },
});
