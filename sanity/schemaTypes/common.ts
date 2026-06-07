import { defineField, defineType } from 'sanity';

export const cta = defineType({
  name: 'cta',
  title: 'Call to action',
  type: 'object',
  fields: [
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      validation: (Rule) => Rule.required().max(60),
    }),
    defineField({
      name: 'href',
      title: 'Link',
      type: 'string',
      description: 'Use a page anchor such as #contact, a path such as /login, or an external URL.',
      validation: (Rule) => Rule.required().max(300),
    }),
    defineField({
      name: 'style',
      title: 'Style (deprecated)',
      type: 'string',
      readOnly: true,
      description: 'Deprecated: button styling is determined by its visible position on the website.',
      options: {
        layout: 'radio',
        list: [
          { title: 'Primary', value: 'primary' },
          { title: 'Secondary', value: 'secondary' },
          { title: 'Text', value: 'text' },
        ],
      },
      initialValue: 'primary',
    }),
  ],
  preview: {
    select: { title: 'label', subtitle: 'href' },
  },
});

export const marketingImage = defineType({
  name: 'marketingImage',
  title: 'Marketing image',
  type: 'object',
  fields: [
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
      description: 'Upload an image, or use External image URL below.',
    }),
    defineField({
      name: 'externalUrl',
      title: 'External image URL',
      type: 'url',
      description: 'Optional remote image URL. Use this when seeding draft images before uploading final Sanity assets.',
      validation: (Rule) => Rule.uri({ scheme: ['http', 'https'] }).warning('Use a valid image URL.'),
    }),
    defineField({
      name: 'alt',
      title: 'Alt text',
      type: 'string',
      validation: (Rule) => Rule.required().max(160),
    }),
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'string',
      validation: (Rule) => Rule.max(180),
    }),
  ],
  preview: {
    select: { title: 'alt', subtitle: 'caption', media: 'image' },
  },
});

export const linkItem = defineType({
  name: 'linkItem',
  title: 'Link',
  type: 'object',
  fields: [
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      validation: (Rule) => Rule.required().max(80),
    }),
    defineField({
      name: 'href',
      title: 'URL or path',
      type: 'string',
      validation: (Rule) => Rule.required().max(300),
    }),
  ],
  preview: {
    select: { title: 'label', subtitle: 'href' },
  },
});

export const tourVideo = defineType({
  name: 'tourVideo',
  title: 'Tour Video',
  type: 'object',
  fields: [
    defineField({
      name: 'id',
      title: 'Video ID / Identifier',
      type: 'slug',
      description: 'Unique identifier for the video tab (e.g., "room", "common", "dining").',
      options: { source: 'label', maxLength: 30 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'label',
      title: 'Tab Label',
      type: 'string',
      description: 'The title shown on the navigation tab (e.g., "Room", "Common", "Dining").',
      validation: (Rule) => Rule.required().max(20),
    }),
    defineField({
      name: 'videoFile',
      title: 'Upload Video File',
      type: 'file',
      description: 'Upload the tour video file (MP4/WebM).',
      options: {
        accept: 'video/*'
      }
    }),
    defineField({
      name: 'externalUrl',
      title: 'External Video URL',
      type: 'url',
      description: 'Alternative URL to an externally hosted MP4/WebM video file.',
      validation: (Rule) => Rule.uri({ scheme: ['http', 'https'] }),
    }),
    defineField({
      name: 'icon',
      title: 'Icon Type',
      type: 'string',
      options: {
        list: [
          { title: 'Bed (Room)', value: 'bed' },
          { title: 'Building (Common Area)', value: 'building' },
          { title: 'Utensils (Dining / Kitchen)', value: 'utensils' },
          { title: 'TV / Screen', value: 'tv' },
          { title: 'WiFi', value: 'wifi' },
          { title: 'Security / Shield', value: 'security' },
        ],
      },
      initialValue: 'bed',
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: { title: 'label', subtitle: 'id.current' },
  },
});
