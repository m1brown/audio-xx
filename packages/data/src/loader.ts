import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';
import type { SeedComponent, ReferenceSystem } from './types';

const DATA_DIR = resolve(__dirname, '..');

export function loadComponents(): SeedComponent[] {
  const raw = readFileSync(resolve(DATA_DIR, 'components.yaml'), 'utf-8');
  const parsed = parse(raw);
  return parsed.components as SeedComponent[];
}

export function loadReferenceSystems(): ReferenceSystem[] {
  const raw = readFileSync(resolve(DATA_DIR, 'reference-systems.yaml'), 'utf-8');
  const parsed = parse(raw);
  return parsed.reference_systems as ReferenceSystem[];
}

export function getComponentById(id: string): SeedComponent | undefined {
  const components = loadComponents();
  return components.find((c) => c.id === id);
}

export function getComponentsByCategory(category: string): SeedComponent[] {
  const components = loadComponents();
  return components.filter((c) => c.category === category);
}

export function getReferenceSystemById(id: string): ReferenceSystem | undefined {
  const systems = loadReferenceSystems();
  return systems.find((s) => s.id === id);
}
