import { defineField, defineType } from 'sanity';

export const admissionStep = defineType({
  name: 'admissionStep',
  title: 'Admission Step',
  type: 'document',
  fields: [
    defineField({
      name: 'number',
      title: 'Step number',
      type: 'number',
      validation: (Rule) => Rule.required().integer().min(1).max(12),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required().max(80),
    }),
    defineField({
      name: 'description',
      title: 'Desktop description',
      type: 'text',
      rows: 2,
      validation: (Rule) => Rule.required().max(240),
    }),
    defineField({
      name: 'mobileDescription',
      title: 'Mobile description',
      type: 'string',
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: 'icon',
      title: 'Icon',
      type: 'string',
      description: 'Supported frontend values: phone, building, bed, document, key.',
      validation: (Rule) => Rule.required().max(40),
    }),
    defineField({
      name: 'isFinal',
      title: 'Final step',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'isActive',
      title: 'Active',
      type: 'boolean',
      initialValue: true,
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'number' },
    prepare({ title, subtitle }) {
      return { title, subtitle: `Step ${subtitle}` };
    },
  },
});
