/**
 * QA harness — deterministic mutation engine.
 *
 * Curated natural-language mutation operators over a case's component
 * designations. Every generated input describes the SAME physical system, so
 * identity must be frame-invariant — that is the metamorphic contract the
 * 2026-09-14 ingestion P1 proved valuable. No LLM-generated mutations in the
 * blocking suite.
 *
 * A mutation marked `lossy` genuinely removes identity information (e.g. the
 * omitted repeated brand); for those, honest degradation (clarification /
 * low confidence) is an acceptable outcome and silent reduction is not.
 */
export interface Mutation {
  label: string;
  input: string;
  lossy?: boolean;
}

const ROLE_WORDS: Record<string, string> = {
  amplifier: 'amplifier',
  integrated: 'integrated amp',
  dac: 'DAC',
  speaker: 'speakers',
  subwoofer: 'subwoofer',
  streamer: 'streamer',
};

/** Standard operator set over component designations as typed. */
export function standardMutations(
  parts: string[],
  opts: { roleByPart?: Record<number, keyof typeof ROLE_WORDS> } = {},
): Mutation[] {
  if (parts.length < 2) return [];
  const [a, ...rest] = parts;
  const list = parts.join(', ');
  const oxford = `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  const muts: Mutation[] = [
    // frame operators
    { label: 'frame_assess_colon', input: `assess my system: ${oxford}` },
    { label: 'frame_ownership_copula', input: `my system is ${oxford}` },
    { label: 'frame_question_led', input: `what do you think of my system? ${list}` },
    { label: 'frame_imperative_verb', input: `please assess: ${parts.join('; ')}` },
    { label: 'frame_i_have', input: `I have an ${oxford}` },
    { label: 'frame_system_colon_slash', input: `system: ${parts.join(' / ')}` },
    // separators
    { label: 'sep_period', input: `assess my system: ${parts.join('. ')}.` },
    { label: 'sep_semicolon', input: `assess my system: ${parts.join('; ')}` },
    { label: 'sep_plus', input: `assess my system: ${parts.join(' + ')}` },
    { label: 'sep_newline', input: `assess my system:\n${parts.join('\n')}` },
    // prefix / politeness
    { label: 'greeting_prefix', input: `Hello! Please assess my system: ${oxford}.` },
    // order
    { label: 'order_reversed', input: `assess my system: ${[...parts].reverse().join(', ')}` },
    // rotated: last component first
    {
      label: 'order_rotated',
      input: `assess my system: ${[parts[parts.length - 1], a, ...rest.slice(0, -1)].join(', ')}`,
    },
  ];
  // listener role words appended (and one common misspelling)
  if (opts.roleByPart) {
    const withRoles = parts
      .map((p, i) => {
        const r = opts.roleByPart?.[i];
        return r ? `${p} ${ROLE_WORDS[r]}` : p;
      })
      .join('. ');
    muts.push({ label: 'role_words', input: `assess my system: ${withRoles}` });
    const misspelt = withRoles
      .replace(/\bamplifier\b/, 'amplifer')
      .replace(/\bspeakers\b/, 'speekers')
      .replace(/\breceiver\b/i, 'reciever');
    muts.push({ label: 'role_words_misspelt', input: `assess my system: ${misspelt}` });
  }
  return muts;
}

/**
 * Omitted-repeated-brand operator: drops the brand from the SECOND part when
 * it repeats the first part's brand. Lossy by design — the safe outcomes are
 * full preservation (brand inheritance) or honest degradation, never a
 * silent reduction.
 */
export function omittedBrandMutation(parts: string[]): Mutation | null {
  if (parts.length < 2) return null;
  const brand = parts[0].split(/\s+/)[0];
  if (!parts[1].startsWith(`${brand} `)) return null;
  const shortened = parts[1].slice(brand.length + 1);
  const list = [parts[0], shortened, ...parts.slice(2)];
  return {
    label: 'omitted_repeated_brand',
    input: `assess my system: ${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`,
    lossy: true,
  };
}
