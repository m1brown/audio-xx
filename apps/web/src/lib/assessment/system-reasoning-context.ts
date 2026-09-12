/**
 * ONE system reasoning context (architectural convergence, 2026-09-11).
 *
 * The deterministic system computations — conversion-path authority,
 * interface conclusions, decision-relevant gaps — were owned by the review
 * composer, so only surfaces that COMPOSE A REVIEW ever saw them. The
 * provisional lane's model prompt re-derived its own drive reasoning from a
 * narrower evidence feed and had no topology authority at all: two lanes,
 * two intellectual capabilities, one product.
 *
 * This module is the single owner. The composer consumes the structured
 * context; the model prompt consumes its serialization. Canonical and
 * provisional differ in what the substrate CONTAINS (evidence density,
 * identity confidence), never in which computations exist.
 *
 * Licensing: nothing here is new reasoning. It is the same conversion-path
 * and interface analysis the composer has always run, computed once and
 * projected. The serialization states facts and refusals — never sonic
 * character, never a conclusion the analysis did not reach.
 */
import type { DossierView } from '@/lib/evidence/dossier-presentation';
import { analyzeConversionPath, type ConversionPathAnalysis } from './conversion-path';
import {
  interfaceConclusions, type InterfaceConclusion,
} from '@/lib/artifact/interface-conclusions';

export interface SystemReasoningContext {
  conversion: ConversionPathAnalysis;
  conclusions: InterfaceConclusion[];
  /** Decision-relevant evidence needs, named per component. */
  typedGaps: Array<{ component: string; quantity?: string; text: string }>;
}

export function buildSystemReasoningContext(
  components: Array<{ displayName: string; role?: string | null }>,
  dossiers: DossierView[],
  rawQuery?: string,
): SystemReasoningContext {
  const comps = components.map((c) => ({
    displayName: c.displayName, role: c.role ?? '',
  }));
  const conversion = analyzeConversionPath(comps, dossiers, rawQuery);
  const conclusions = interfaceConclusions(comps, dossiers, {
    conversionPathAmbiguous: conversion.ambiguous,
  });
  const typedGaps = dossiers.flatMap((d) =>
    (d.typedGaps ?? (d.gaps ?? []).map((text) => ({ text, quantity: undefined })))
      .map((g) => ({ component: d.displayName, quantity: g.quantity, text: g.text })));
  return { conversion, conclusions, typedGaps };
}

/**
 * The context as governed prompt material. Facts and refusals only, each
 * line something the application established — the model interprets what
 * they mean together and may not contradict or re-derive them.
 */
export function serializeSystemReasoningContext(ctx: SystemReasoningContext): string {
  const lines: string[] = [];

  if (ctx.conversion.ambiguous) {
    const stages = ctx.conversion.stages.map((s) => (s.kind === 'amp_with_dac'
      ? `${s.name} (onboard conversion)` : s.name)).join('; ');
    lines.push(
      `Conversion topology: UNSETTLED. Capable stages: ${stages}. The listener has `
      + `not stated which is in the signal path. Do not assume one; any claim that `
      + `depends on which component converts must remain conditional.`,
    );
  } else if (ctx.conversion.explicit) {
    lines.push(
      'Conversion topology: established from the listener’s own description. '
      + 'Reason over the stated connections only.',
    );
  }

  for (const c of ctx.conclusions) {
    lines.push(`Interface (application-established): ${c.statement}`);
  }

  for (const g of ctx.typedGaps) {
    lines.push(
      `Unresolved and decision-relevant — ${g.component}: `
      + `${g.text.replace(/[.\s]*$/, '')}. Do not estimate or substitute this figure.`,
    );
  }

  if (lines.length === 0) return '';
  return `\nSYSTEM FACTS ESTABLISHED BY AUDIO XX (deterministic; interpret their meaning, `
    + `never contradict or re-derive them):\n- ${lines.join('\n- ')}\n`;
}
