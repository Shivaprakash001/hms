import { defineField, defineType } from 'sanity';

export const hostelProfile = defineType({
  name: 'hostelProfile',
  title: 'Hostel Profile',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Hostel name',
      type: 'string',
      validation: (Rule) => Rule.required().max(120),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'name' },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'tagline',
      title: 'Tagline',
      type: 'string',
      validation: (Rule) => Rule.required().max(160),
    }),
    defineField({
      name: 'about',
      title: 'About',
      type: 'text',
      rows: 4,
      validation: (Rule) => Rule.required().max(900),
    }),
    defineField({
      name: 'mission',
      title: 'Mission',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.max(600),
    }),
    defineField({
      name: 'foodPhilosophy',
      title: 'Food philosophy',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.max(600),
    }),
    defineField({
      name: 'houseRules',
      title: 'House rules summary',
      type: 'array',
      of: [{ type: 'string' }],
      validation: (Rule) => Rule.max(12),
    }),
    defineField({
      name: 'ownerMessage',
      title: 'Owner message',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.max(500),
    }),
    defineField({
      name: 'ownerName',
      title: 'Owner name',
      type: 'string',
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: 'ownerPhoto',
      title: 'Owner photo',
      type: 'marketingImage',
    }),
    defineField({
      name: 'gallery',
      title: 'Profile gallery',
      type: 'array',
      of: [{ type: 'marketingImage' }],
      validation: (Rule) => Rule.max(20),
    }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'tagline', media: 'ownerPhoto.image' },
  },
});
