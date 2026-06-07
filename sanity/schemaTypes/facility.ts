import { defineField, defineType } from 'sanity';

export const facility = defineType({
  name: 'facility',
  title: 'Facility',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required().max(80),
    }),
    defineField({
      name: 'label',
      title: 'Label (deprecated)',
      type: 'string',
      readOnly: true,
      description: 'Deprecated: use Title. Existing content can still be queried as a fallback.',
      validation: (Rule) => Rule.max(80),
    }),
    defineField({
      name: 'icon',
      title: 'Icon',
      type: 'string',
      description: 'Supported frontend values: wifi, water, cleaning, security, cctv, laundry, storage, power, food.',
      validation: (Rule) => Rule.required().max(40),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 2,
      validation: (Rule) => Rule.max(220),
    }),
    defineField({
      name: 'displayOrder',
      title: 'Display order',
      type: 'number',
      initialValue: 10,
      validation: (Rule) => Rule.integer().min(0),
    }),
    defineField({
      name: 'isActive',
      title: 'Active',
      type: 'boolean',
      initialValue: true,
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'icon' },
  },
});
