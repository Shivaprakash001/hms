import { defineType, defineField } from 'sanity'

export const landingHostel = defineType({
  name: 'landingHostel',
  title: 'Landing Page Hostel Copy',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Hostel Name',
      type: 'string',
      validation: Rule => Rule.required(),
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
      name: 'heroSupportingCopy',
      title: 'Hero Supporting Copy override',
      type: 'string',
      description: 'Optional supporting text below subtitle. E.g., "Join senior SNIST students at Sri Adithya."',
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
    defineField({
      name: 'tourVideos',
      title: 'Tour Videos',
      type: 'array',
      description: 'Tour videos for room, common area, and dining sections.',
      of: [
        {
          type: 'object',
          name: 'tourVideo',
          title: 'Tour Video',
          fields: [
            {
              name: 'id',
              title: 'Section Identifier',
              type: 'string',
              description: 'Matches the video tab ID (e.g., common, room, dining)',
              options: {
                list: [
                  { title: 'Common Area', value: 'common' },
                  { title: 'Room', value: 'room' },
                  { title: 'Dining', value: 'dining' },
                ],
              },
              validation: Rule => Rule.required(),
            },
            {
              name: 'label',
              title: 'Tab Label',
              type: 'string',
              description: 'Display name on the tab button (e.g., Common Tour, Room Tour, Dining Area)',
              validation: Rule => Rule.required(),
            },
            {
              name: 'videoUrl',
              title: 'External Video URL',
              type: 'url',
              description: 'Link to an externally hosted MP4 video (Alternative to direct upload)',
            },
            {
              name: 'videoFile',
              title: 'Direct Video File Upload',
              type: 'file',
              description: 'Direct MP4 video file upload (Recommended)',
              options: {
                accept: 'video/mp4',
              },
            },
            {
              name: 'icon',
              title: 'Icon Type',
              type: 'string',
              options: {
                list: [
                  { title: 'Building (Common Area)', value: 'building' },
                  { title: 'Bed (Room)', value: 'bed' },
                  { title: 'Utensils (Dining)', value: 'utensils' },
                  { title: 'TV (Entertainment)', value: 'tv' },
                  { title: 'WiFi (Internet)', value: 'wifi' },
                  { title: 'Security (CCTV)', value: 'security' },
                ],
              },
              validation: Rule => Rule.required(),
            },
          ],
          preview: {
            select: {
              title: 'label',
              subtitle: 'id',
            },
          },
        },
      ],
    }),
  ],
  preview: {
    select: { title: 'name' },
    prepare({ title }) {
      return { title: title || 'Landing Page Copy', subtitle: 'Single Source of Truth' }
    },
  },
})
