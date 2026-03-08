import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';

const prisma = new PrismaClient();

async function main() {
  const componentsPath = resolve(__dirname, '../../../packages/data/components.yaml');
  const refSystemsPath = resolve(__dirname, '../../../packages/data/reference-systems.yaml');

  const components = parse(readFileSync(componentsPath, 'utf-8')).components;
  const refSystems = parse(readFileSync(refSystemsPath, 'utf-8')).reference_systems;

  console.log(`Seeding ${components.length} components...`);

  for (const c of components) {
    await prisma.component.upsert({
      where: { seedId: c.id },
      update: {
        name: c.name,
        brand: c.brand,
        category: c.category,
        confidenceLevel: c.confidence_level,
        roleConfidence: c.role_confidence ? JSON.stringify(c.role_confidence) : null,
        traitTendencies: JSON.stringify(c.trait_tendencies),
        riskFlags: JSON.stringify(c.risk_flags),
        trustedRefs: JSON.stringify(c.trusted_references),
        reviews: JSON.stringify(c.reviews),
        retailerLinks: JSON.stringify(c.retailer_links || []),
        isReference: c.is_reference,
        userSubmitted: c.user_submitted,
      },
      create: {
        seedId: c.id,
        name: c.name,
        brand: c.brand,
        category: c.category,
        confidenceLevel: c.confidence_level,
        roleConfidence: c.role_confidence ? JSON.stringify(c.role_confidence) : null,
        traitTendencies: JSON.stringify(c.trait_tendencies),
        riskFlags: JSON.stringify(c.risk_flags),
        trustedRefs: JSON.stringify(c.trusted_references),
        reviews: JSON.stringify(c.reviews),
        retailerLinks: JSON.stringify(c.retailer_links || []),
        isReference: c.is_reference,
        userSubmitted: c.user_submitted,
      },
    });
  }

  console.log(`Seeding ${refSystems.length} reference systems...`);

  for (const rs of refSystems) {
    await prisma.referenceSystem.upsert({
      where: { seedId: rs.id },
      update: {
        name: rs.name,
        archetype: rs.archetype,
        componentIds: JSON.stringify(rs.component_ids),
        description: rs.description,
        isCommercial: false,
      },
      create: {
        seedId: rs.id,
        name: rs.name,
        archetype: rs.archetype,
        componentIds: JSON.stringify(rs.component_ids),
        description: rs.description,
        isCommercial: false,
      },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
