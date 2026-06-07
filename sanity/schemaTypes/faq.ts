import { defineField, defineType } from 'sanity';

export const faq = defineType({
  name: 'faq',
  title: 'FAQ',
  type: 'document',
  fields: [
    defineField({
      name: 'question',
      title: 'Question',
      type: 'string',
      validation: (Rule) => Rule.required().max(180),
    }),
    defineField({
      name: 'answer',
      title: 'Answer',
      type: 'text',
      rows: 4,
      validation: (Rule) => Rule.required().max(900),
    }),
    defineField({
      name: 'category',
      title: 'Category (deprecated)',
      type: 'string',
      readOnly: true,
      description: 'Deprecated: FAQ categories are no longer rendered on the landing page.',
      options: {
        list: [
          { title: 'Food', value: 'Food' },
          { title: 'Security', value: 'Security' },
          { title: 'Visitors', value: 'Visitors' },
          { title: 'Fees', value: 'Fees' },
          { title: 'Rooms', value: 'Rooms' },
          { title: 'Move-In', value: 'Move-In' },
          { title: 'Parents', value: 'Parents' },
        ],
      },
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
    select: { title: 'question', subtitle: 'displayOrder' },
  },
});
