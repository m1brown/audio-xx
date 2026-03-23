import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/session';
import { evaluateText } from '@/lib/engine';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { symptoms: symptomText, text } = body;

  // Support both {symptoms} and {text} for homepage compatibility
  const input = symptomText || text;
  if (!input) {
    return NextResponse.json({ error: 'symptoms or text required' }, { status: 400 });
  }

  // Load archetypes from profile if authenticated
  const userId = await getUserId();
  let archetypes: string[] = [];
  if (userId) {
    try {
      const profile = await prisma.profile.findUnique({ where: { userId } });
      if (profile) archetypes = JSON.parse(profile.archetypes);
    } catch {
      // Database unavailable or malformed JSON — continue without profile data
    }
  }

  const { signals, result } = evaluateText(input, archetypes);

  return NextResponse.json({
    interpretation: {
      matched_phrases: signals.matched_phrases,
      symptoms: signals.symptoms,
      traits: signals.traits,
      archetype_hints: signals.archetype_hints,
      uncertainty_level: signals.uncertainty_level,
    },
    diagnosis: result.fired_rules.map((rule) => ({
      rule_id: rule.id,
      label: rule.label,
      likely_cause: rule.outputs.explanation,
      suggestions: rule.outputs.suggestions,
      risks: rule.outputs.risks,
      next_step: rule.outputs.next_step,
      archetype_note: rule.outputs.archetype_note,
    })),
    archetype_conflict: result.archetype_conflict_detected,
    note: 'Diagnosis is based on pattern matching against known symptoms. It suggests likely causes and reversible next steps — not definitive conclusions.',
  });
}
