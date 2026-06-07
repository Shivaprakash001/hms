import { defineField, defineType } from 'sanity';

export const hero = defineType({
  name: 'hero',
  title: 'Hero',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Headline',
      type: 'string',
      validation: (Rule) => Rule.required().max(120),
    }),
    defineField({
      name: 'subtitle',
      title: 'Subtitle',
      type: 'string',
      validation: (Rule) => Rule.required().max(180),
    }),
    defineField({
      name: 'supportingCopy',
      title: 'Supporting copy',
      type: 'text',
      rows: 2,
      validation: (Rule) => Rule.max(260),
    }),
    defineField({
      name: 'trustBadge',
      title: 'Trust badge',
      type: 'string',
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: 'highlights',
      title: 'Highlights',
      type: 'array',
      of: [{ type: 'string' }],
      validation: (Rule) => Rule.max(5),
    }),
    defineField({
      name: 'primaryCta',
      title: 'Primary CTA',
      type: 'cta',
    }),
    defineField({
      name: 'secondaryCta',
      title: 'Secondary CTA',
      type: 'cta',
    }),
    defineField({
      name: 'ownerImage',
      title: 'Owner image',
      type: 'marketingImage',
    }),
    defineField({
      name: 'carouselImages',
      title: 'Carousel images',
      type: 'array',
      of: [{ type: 'marketingImage' }],
      validation: (Rule) => Rule.min(1).max(8),
    }),
    defineField({
      name: 'tourVideos',
      title: 'Hostel & Room Tour Videos',
      type: 'array',
      of: [{ type: 'tourVideo' }],
      description: 'The interactive video tour tabs shown in the Hero section (Room, Common, Dining).',
      validation: (Rule) => Rule.max(6),
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'subtitle', media: 'ownerImage.image' },
  },
});
