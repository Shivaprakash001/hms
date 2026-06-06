import { defineField, defineType } from 'sanity';

export const testimonial = defineType({
  name: 'testimonial',
  title: 'Testimonial',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Display name',
      type: 'string',
      validation: (Rule) => Rule.required().max(120),
    }),
    defineField({
      name: 'details',
      title: 'Details',
      type: 'string',
      description: 'Example: 3rd Year · B.Tech CSE · SNIST',
      validation: (Rule) => Rule.max(180),
    }),
    defineField({
      name: 'quote',
      title: 'Quote',
      type: 'text',
      rows: 4,
      validation: (Rule) => Rule.required().max(700),
    }),
    defineField({
      name: 'rating',
      title: 'Rating',
      type: 'number',
      initialValue: 5,
      validation: (Rule) => Rule.min(1).max(5),
    }),
    defineField({
      name: 'duration',
      title: 'Stay duration / label',
      type: 'string',
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: 'verificationType',
      title: 'Verification type',
      type: 'string',
      options: {
        layout: 'radio',
        list: [
          { title: 'Current tenant', value: 'CURRENT_TENANT' },
          { title: 'Former tenant', value: 'FORMER_TENANT' },
          { title: 'Parent', value: 'PARENT' },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'approvedBy',
      title: 'Approved by',
      type: 'string',
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: 'approvedAt',
      title: 'Approved at',
      type: 'datetime',
    }),
    defineField({
      name: 'photo',
      title: 'Photo',
      type: 'marketingImage',
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
    select: { title: 'name', subtitle: 'verificationType', media: 'photo.image' },
  },
});
