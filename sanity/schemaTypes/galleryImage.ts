import { defineField, defineType } from 'sanity';

export const galleryImage = defineType({
  name: 'galleryImage',
  title: 'Gallery Image',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required().max(120),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'Rooms', value: 'Rooms' },
          { title: 'Food', value: 'Food' },
          { title: 'Building', value: 'Building' },
          { title: 'Facilities', value: 'Facilities' },
          { title: 'Students', value: 'Students' },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'asset',
      title: 'Image',
      type: 'marketingImage',
      validation: (Rule) => Rule.required(),
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
    select: { title: 'title', subtitle: 'category', media: 'asset.image' },
  },
});
