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
