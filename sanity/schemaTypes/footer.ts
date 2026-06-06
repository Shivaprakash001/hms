import { defineField, defineType } from 'sanity';

export const footer = defineType({
  name: 'footer',
  title: 'Footer',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required().max(120),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.max(500),
    }),
    defineField({
      name: 'quickLinks',
      title: 'Quick links',
      type: 'array',
      of: [{ type: 'linkItem' }],
      validation: (Rule) => Rule.max(12),
    }),
    defineField({
      name: 'copyright',
      title: 'Copyright text',
      type: 'string',
      validation: (Rule) => Rule.max(160),
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'description' },
  },
});
