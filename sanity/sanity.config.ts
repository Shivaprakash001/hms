import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schemaTypes } from './schemaTypes';
import { deskStructure } from './desk/structure';

const singletonTypes = new Set(['landingPage', 'hostelProfile', 'hero', 'seo', 'footer']);
const studioEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
const nodeEnv =
  typeof process === 'undefined' ? {} : (process.env as Record<string, string | undefined>);

const projectId =
  studioEnv.SANITY_STUDIO_PROJECT_ID ||
  studioEnv.SANITY_PROJECT_ID ||
  studioEnv.VITE_SANITY_PROJECT_ID ||
  nodeEnv.SANITY_STUDIO_PROJECT_ID ||
  nodeEnv.SANITY_PROJECT_ID ||
  nodeEnv.VITE_SANITY_PROJECT_ID ||
  '';

const dataset =
  studioEnv.SANITY_STUDIO_DATASET ||
  studioEnv.SANITY_DATASET ||
  studioEnv.VITE_SANITY_DATASET ||
  nodeEnv.SANITY_STUDIO_DATASET ||
  nodeEnv.SANITY_DATASET ||
  nodeEnv.VITE_SANITY_DATASET ||
  'production';

export default defineConfig({
  name: 'hms_marketing',
  title: 'HMS Marketing Content',
  projectId,
  dataset,
  plugins: [structureTool({ structure: deskStructure }), visionTool()],
  schema: { types: schemaTypes },
  document: {
    newDocumentOptions: (previous) =>
      previous.filter((templateItem) => !singletonTypes.has(String(templateItem.templateId))),
    actions: (previous, context) => {
      if (!singletonTypes.has(context.schemaType)) return previous;
      return previous.filter((action) => action.action !== 'delete' && action.action !== 'duplicate');
    },
  },
});
