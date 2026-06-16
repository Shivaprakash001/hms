import { defineType, defineField } from 'sanity'

export const parentTrust = defineType({
  name: 'parentTrust',
  title: 'Parent Trust Section',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Section Title',
      type: 'string',
      initialValue: 'Why Parents Trust Sri Adithya Boys Hostel',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'subtitle',
      title: 'Section Subtitle',
      type: 'string',
      initialValue: 'We provide a safe, secure, and disciplined environment for your son’s academic journey.',
    }),
    defineField({
      name: 'points',
      title: 'Trust Highlights',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'title', type: 'string', title: 'Title', validation: Rule => Rule.required() },
            { name: 'description', type: 'text', title: 'Description', rows: 2, validation: Rule => Rule.required() },
            { name: 'icon', type: 'string', title: 'Icon (e.g., warden, cctv, whatsapp, emergency)' }
          ]
        }
      ]
    }),
    defineField({
      name: 'image',
      title: 'Security/Trust Image',
      type: 'image',
      options: { hotspot: true }
    })
  ]
})
