import { defineField, defineType } from 'sanity';

export const seo = defineType({
  name: 'seo',
  title: 'SEO',
  type: 'document',
  fields: [
    defineField({
      name: 'pageKey',
      title: 'Page key',
      type: 'string',
      description: 'Use home for the landing page.',
      validation: (Rule) => Rule.required().max(80),
    }),
    defineField({
      name: 'title',
      title: 'Meta title',
      type: 'string',
      validation: (Rule) => Rule.required().max(70),
    }),
    defineField({
      name: 'description',
      title: 'Meta description',
      type: 'text',
      rows: 2,
      validation: (Rule) => Rule.required().max(170),
    }),
    defineField({
      name: 'canonicalUrl',
      title: 'Canonical URL',
      type: 'url',
    }),
    defineField({
      name: 'ogImage',
      title: 'Social preview image',
      type: 'marketingImage',
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'pageKey', media: 'ogImage.image' },
  },
});
