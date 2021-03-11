export default {
  type: 'object',
  name: 'section_faq',
  title: 'FAQ Section',
  fields: [
    {
      type: 'string',
      name: 'section_id',
      title: 'Section ID',
      description: 'A unique identifier of the section, must not contain whitespace',
      validation: null,
    },
    {
      type: 'string',
      name: 'title',
      title: 'Title',
      description: 'The title of the section',
      validation: null,
    },
    {
      type: 'string',
      name: 'subtitle',
      title: 'Subtitle',
      description: 'The subtitle of the section',
      validation: null,
    },
    {
      type: 'string',
      name: 'background',
      title: 'Background',
      description: 'The background of the section',
      initialValue: 'gray',
      validation: null,
      options: {
        list: ['gray', 'white'],
      },
    },
    {
      type: 'array',
      name: 'faq_items',
      title: 'FAQ Items',
      validation: null,
      of: [
        {
          type: 'faq_item',
        },
      ],
    },
  ],
  preview: {
    select: {
      title: 'title',
    },
  },
}
