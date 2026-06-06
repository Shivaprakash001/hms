import { defineCliConfig } from 'sanity/cli';
import fs from 'node:fs';
import path from 'node:path';

function readLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};

  return fs.readFileSync(envPath, 'utf8').split(/\r?\n/).reduce<Record<string, string>>((env, rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return env;

    const separator = line.indexOf('=');
    if (separator === -1) return env;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) env[key] = value;
    return env;
  }, {});
}

const localEnv = readLocalEnv();
const projectId =
  process.env.SANITY_STUDIO_PROJECT_ID ||
  process.env.SANITY_PROJECT_ID ||
  process.env.VITE_SANITY_PROJECT_ID ||
  localEnv.SANITY_STUDIO_PROJECT_ID ||
  localEnv.SANITY_PROJECT_ID ||
  localEnv.VITE_SANITY_PROJECT_ID ||
  '';

const dataset =
  process.env.SANITY_STUDIO_DATASET ||
  process.env.SANITY_DATASET ||
  process.env.VITE_SANITY_DATASET ||
  localEnv.SANITY_STUDIO_DATASET ||
  localEnv.SANITY_DATASET ||
  localEnv.VITE_SANITY_DATASET ||
  'production';

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
});
