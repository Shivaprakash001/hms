import { defineType, defineField } from 'sanity'

export const hostel = defineType({
  name: 'hostel',
  title: 'Hostel',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Hostel Name',
      type: 'string',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'name' },
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'bedsAvailable',
      title: 'Beds Available',
      type: 'number',
      description: 'Update this every week. This drives the scarcity signal across the entire page.',
      validation: Rule => Rule.required().min(0).max(50).integer(),
    }),
    defineField({
      name: 'intakeMonth',
      title: 'Intake Month',
      type: 'string',
      description: 'Example: July, August. Shown as "4 beds left for July"',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'startingPrice',
      title: 'Starting Price (₹ per month)',
      type: 'number',
      description: 'Shown as ₹8,000/month across the page.',
      validation: Rule => Rule.required().min(1000).integer(),
    }),
    defineField({
      name: 'heroTitle',
      title: 'Hero Section Title',
      type: 'string',
      description: 'Main heading on the landing page. E.g., "400m from SNIST. Home Food. Everything Included."',
    }),
    defineField({
      name: 'heroSubtitle',
      title: 'Hero Section Subtitle',
      type: 'string',
      description: 'Sub-heading on the landing page. E.g., "Comfortable boys hostel rooms designed for focus and peace of mind"',
    }),
    defineField({
      name: 'heroHighlights',
      title: 'Hero Section Highlights',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'A list of highlights shown on the hero section. E.g., ["Meals Included", "CCTV + Warden", "400m from SNIST"]',
    }),
    defineField({
      name: 'gallery',
      title: 'Hostel Gallery',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {
              name: 'image',
              title: 'Image',
              type: 'image',
              options: { hotspot: true },
            },
            {
              name: 'caption',
              title: 'Caption',
              type: 'string',
              description: 'Example: Room Interior, Daily Meals, Hostel Building',
            },
            {
              name: 'alt',
              title: 'Alt Text',
              type: 'string',
            },
          ],
          preview: {
            select: { title: 'caption', media: 'image' },
          },
        },
      ],
    }),
    defineField({
      name: 'mapEmbedUrl',
      title: 'Google Maps Embed URL',
      type: 'url',
      description: 'The src URL from Google Maps embed code',
    }),
    defineField({
      name: 'totalBuildings',
      title: 'Total Buildings',
      type: 'number',
      description: 'Total number of hostel buildings (e.g. 2)',
      validation: Rule => Rule.min(0).integer(),
    }),
    defineField({
      name: 'sharingTypes',
      title: 'Sharing Types',
      type: 'string',
      description: 'E.g., "2, 3, 4" or "2-4"',
    }),
    defineField({
      name: 'amenitiesCount',
      title: 'Amenities Count',
      type: 'string',
      description: 'E.g., "9+"',
    }),
    defineField({
      name: 'roomTypeTitle',
      title: 'Room Type Title',
      type: 'string',
      description: 'E.g., "4-Sharing Room"',
    }),
    defineField({
      name: 'roomImage',
      title: 'Room Image',
      type: 'image',
      options: { hotspot: true },
      description: 'The room image shown in the Rooms & Pricing section',
    }),
    defineField({
      name: 'locationTitle',
      title: 'Location Section Title',
      type: 'string',
      description: 'E.g., "Prime Location"',
    }),
    defineField({
      name: 'locationDescription',
      title: 'Location Section Description',
      type: 'text',
      rows: 2,
      description: 'E.g., "Conveniently located near SNIST — your daily commute is just a 5-minute walk"',
    }),
    defineField({
      name: 'distanceTitle',
      title: 'Distance Title',
      type: 'string',
      description: 'E.g., "Just 400m from SNIST"',
    }),
    defineField({
      name: 'distanceDescription',
      title: 'Distance Description',
      type: 'string',
      description: 'E.g., "5 minute walk to campus gate"',
    }),
    defineField({
      name: 'shortLocation',
      title: 'Short Location Text',
      type: 'string',
      description: 'E.g., "Yamnampet, Secunderabad, Telangana"',
    }),
    defineField({
      name: 'features',
      title: 'Why Choose Us Features',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'title', type: 'string', title: 'Title' },
            { name: 'description', type: 'text', title: 'Description', rows: 3 },
            { name: 'icon', type: 'string', title: 'Icon (e.g., food, home, location)' },
            { name: 'image', type: 'image', title: 'Image', options: { hotspot: true } },
            {
              name: 'highlights',
              title: 'Highlights',
              type: 'array',
              of: [{ type: 'string' }],
            },
          ],
        },
      ],
    }),
    defineField({
      name: 'facilities',
      title: 'Facilities & Amenities',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'title', type: 'string', title: 'Title' },
            { name: 'icon', type: 'string', title: 'Icon (e.g., wifi, water, cleaning, security, cctv, laundry, storage, power, food)' },
            { name: 'description', type: 'text', title: 'Description', rows: 2 },
          ],
        },
      ],
    }),
    defineField({
      name: 'admissionSteps',
      title: 'Admission Steps',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'stepNumber', type: 'number', title: 'Step Number' },
            { name: 'title', type: 'string', title: 'Title' },
            { name: 'description', type: 'text', title: 'Description', rows: 2 },
          ],
        },
      ],
    }),
    defineField({
      name: 'roomTypesImages',
      title: 'Room Type Images Mapping',
      type: 'array',
      description: 'Provide an image for each sharing configuration. Name should match room type (e.g. "4-Sharing", "2-Sharing" or "Standard").',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'roomType', type: 'string', title: 'Room Type / Name (e.g., 4-Sharing)', validation: Rule => Rule.required() },
            { name: 'image', type: 'image', title: 'Room Image', options: { hotspot: true }, validation: Rule => Rule.required() },
          ]
        }
      ]
    }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'bedsAvailable' },
    prepare({ title, subtitle }) {
      return { title, subtitle: `${subtitle} beds available` }
    },
  },
})
