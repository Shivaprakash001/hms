import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { structure } from './sanity/structure'
import {
  siteSettings,
  hostel,
  testimonial,
  faq,
  categoryRating,
  food,
  parentTrust,
} from './sanity/schemaTypes'

export default defineConfig({
  name: 'sri-adithya-hostels',
  title: 'Sri Adithya Hostels',
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  basePath: '/studio',
  plugins: [
    structureTool({ structure }),
    visionTool(),
  ],
  schema: {
    types: [siteSettings, hostel, testimonial, faq, categoryRating, food, parentTrust],
  },
})
