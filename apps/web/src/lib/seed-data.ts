import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';

const COMPONENTS_PATH = resolve(process.cwd(), '../../packages/data/components.yaml');
const REFERENCE_SYSTEMS_PATH = resolve(process.cwd(), '../../packages/data/reference-systems.yaml');

export interface SeedComponent {
  id: string;
  name: string;
  brand: string;
  category: string;
  confidence_level: string;
  role_confidence?: Record<string, string>;
  trait_tendencies: Record<string, string>;
  risk_flags: string[];
  trusted_references: Array<{ source: string; note: string; type: string }>;
  reviews: Array<{ source: string; excerpt: string; role: string }>;
  retailer_links?: Array<{ label: string; url: string; region?: string }>;
  is_reference: boolean;
  user_submitted: boolean;
}

export interface SeedReferenceSystem {
  id: string;
  name: string;
  archetype: string;
  component_ids: string[];
  description: string;
}

export function loadSeedComponents(): SeedComponent[] {
  const raw = readFileSync(COMPONENTS_PATH, 'utf-8');
  return parse(raw).components;
}

export function loadSeedReferenceSystems(): SeedReferenceSystem[] {
  const raw = readFileSync(REFERENCE_SYSTEMS_PATH, 'utf-8');
  return parse(raw).reference_systems;
}
