import { defineType, defineField } from 'sanity'

export const food = defineType({
  name: 'food',
  title: 'Food & Dining Section',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Section Title',
      type: 'string',
      initialValue: 'Homely & Hygienic Meals',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Section Description',
      type: 'text',
      rows: 3,
      initialValue: 'We serve three fresh, delicious, and nutritious meals daily, prepared in our hygienic kitchen with high-quality ingredients.',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'images',
      title: 'Food & Dining Gallery',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'image', type: 'image', title: 'Image', options: { hotspot: true } },
            { name: 'caption', type: 'string', title: 'Caption' },
            { name: 'alt', type: 'string', title: 'Alt Text' }
          ]
        }
      ]
    }),
    defineField({
      name: 'foodHighlights',
      title: 'Food Highlights',
      type: 'array',
      of: [{ type: 'string' }],
      initialValue: ['Homely Taste', 'Unlimited Serving', 'Pure Veg & Non-Veg Kitchens', 'Hygienic Preparation'],
    }),
    defineField({
      name: 'weeklyMenu',
      title: 'Weekly Menu',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'menuDay',
          fields: [
            { name: 'day', type: 'string', title: 'Day (e.g. Monday)' },
            { name: 'breakfast', type: 'string', title: 'Breakfast Menu' },
            { name: 'lunch', type: 'string', title: 'Lunch Menu' },
            { name: 'dinner', type: 'string', title: 'Dinner Menu' }
          ]
        }
      ]
    }),
    defineField({
      name: 'parentQuote',
      title: 'Parent Trust Quote',
      type: 'text',
      rows: 3,
      initialValue: 'I was worried about my son’s food habits. After visiting Sri Adithya’s kitchen, I am completely satisfied that he gets fresh, homely meals every single day.',
    }),
    defineField({
      name: 'parentName',
      title: 'Parent Name',
      type: 'string',
      initialValue: 'R. Srinivasa Rao (Father of Karthik, SNIST 3rd Year)',
    }),
    defineField({
      name: 'parentPhoto',
      title: 'Parent Photo',
      type: 'image',
      options: { hotspot: true }
    })
  ]
})
