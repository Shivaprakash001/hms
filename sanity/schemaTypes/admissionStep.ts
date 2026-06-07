import { defineField, defineType } from 'sanity';

export const admissionStep = defineType({
  name: 'admissionStep',
  title: 'Admission Step',
  type: 'document',
  fields: [
    defineField({
      name: 'stepNumber',
      title: 'Step number',
      type: 'number',
      validation: (Rule) => Rule.required().integer().min(1).max(12),
    }),
    defineField({
      name: 'number',
      title: 'Step number (deprecated)',
      type: 'number',
      readOnly: true,
      description: 'Deprecated: use Step number.',
      validation: (Rule) => Rule.integer().min(1).max(12),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required().max(80),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 2,
      validation: (Rule) => Rule.required().max(240),
    }),
    defineField({
      name: 'mobileDescription',
      title: 'Mobile description (deprecated)',
      type: 'string',
      readOnly: true,
      description: 'Deprecated: the public site now uses Description everywhere.',
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: 'icon',
      title: 'Icon (deprecated)',
      type: 'string',
      description: 'Supported frontend values: phone, building, bed, document, key.',
      readOnly: true,
      validation: (Rule) => Rule.max(40),
    }),
    defineField({
      name: 'isFinal',
      title: 'Final step (deprecated)',
      type: 'boolean',
      readOnly: true,
      description: 'Deprecated: final styling is derived from the last active step.',
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
    select: { title: 'title', subtitle: 'stepNumber' },
    prepare({ title, subtitle }) {
      return { title, subtitle: `Step ${subtitle}` };
    },
  },
});
