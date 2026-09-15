/**
 * QA harness — golden corpus.
 *
 * Each case exists for a DISTINCT semantic condition (no filler). Landmark
 * inputs are real: production incidents, released repairs, and the standing
 * regression systems. Expectations are semantic (sets, states, licences),
 * never prose snapshots.
 */
import type { GoldenCase } from './schema';

const ACCUPHASE_EVIDENCE = [
  { component: 'Accuphase E-600', label: 'power output',
    value: '30W/ch into 8 ohms; 60W/ch into 4 ohms; 120W/ch into 2 ohms; 150W/ch into 1 ohm (music signals)' },
  { component: 'Harbeth SHL5 Plus', label: 'sensitivity', value: '86dB/2.83V/1m axial' },
  { component: 'Harbeth SHL5 Plus', label: 'nominal impedance', value: '6 ohms' },
];

export const GOLDEN_CORPUS: GoldenCase[] = [
  {
    id: 'accuphase-trio',
    why: 'same-brand siblings · three-component preservation · frame invariance · '
      + 'load-specific power provenance · unresolved bracketed-ladder headroom · no contradiction',
    input: 'assess my system: Accuphase E-600, Accuphase DP-450 and Harbeth SHL5 Plus',
    components: [/^accuphase e-600/, /^accuphase dp-450/, /harbeth shl5 plus/],
    roles: { 0: /amplifier/, 2: /speaker/ },
    forbidden: [/^accuphase$/],
    parts: ['Accuphase E-600', 'Accuphase DP-450', 'Harbeth SHL5 Plus'],
    standardMutations: true,
    landmarkMutations: [
      // Follow-on P1 class (802ae4e→7b610bf): an "and"-joined re-mention
      // must neither block the assessment nor grow a fourth component.
      { label: 'followon_re_mention',
        input: 'assess my system: Accuphase E-600, Accuphase DP-450, Harbeth SHL5 Plus and the E-600 runs warm' },
    ],
    evidence: ACCUPHASE_EVIDENCE,
    composeRoles: {
      'Accuphase DP-450': 'other', 'Accuphase E-600': 'amplifier', 'Harbeth SHL5 Plus': 'speaker',
    },
    headroom: 'unresolved',
    must: [
      { id: 'third-state', re: /stated loads do not include/ },
      { id: 'no-cross-load-inference', re: /does not infer output across loads/ },
      { id: 'dp450-acknowledged', re: /DP-450(?:'|’)s place in this chain isn(?:'|’)t established/ },
      // BOUNDED SYSTEM JUDGMENT (capability escalation, 2026-09-15): the
      // bracketing published loads must yield a bounded judgment and a
      // listener-observable test — not only the named gap.
      { id: 'bounded-bracket', re: /bracket/i },
      { id: 'listener-test', re: /hardening|strain|compress/i },
    ],
    mustNot: [
      { id: 'false-6ohm', re: /30 watts into 6 ohms|30W (?:at|into) the 6-ohm/ },
      { id: 'phantom-maker-rating', re: /figure that applies is the one at your loudspeaker/ },
    ],
    ladder: {
      value: ACCUPHASE_EVIDENCE[0].value,
      expect: { 8: 30, 4: 60, 2: 120, 6: undefined },
    },
    soft: [
      'Does the assessment reason about the E-600 → SHL5 Plus relationship rather than listing dossiers?',
      'Is the unresolved 6-ohm output presented as the maker\'s gap, not the listener\'s homework?',
    ],
    related: ['naim-siblings', 'chord-siblings', 'omitted-brand-in-mutations'],
  },
  {
    id: 'nad-vintage',
    why: 'vintage/sparse evidence · A35/A3 substring collision (no phantom) · partial '
      + 'relationship resolution · no fabricated numbers or sonic profile on empty evidence',
    input: 'assess my system: NAD AV716 Reciever. TOPPING D70 Pro OCTO DAC. Dynaco A35 Speakers',
    components: [/nad av716/, /topping d70 pro octo/, /dynaco a35/],
    roles: { 0: /integrated/, 1: /dac/, 2: /speaker/ },
    forbidden: [/topping a3\b/, /magico/],
    // Direct-call e2e degrades to low_confidence on the sparse local store —
    // measured pre- and post-ingestion-repair; the production surface renders
    // the review from the same canonical parse. Safe degradation, not a drop.
    allowedKinds: ['assessment', 'low_confidence'],
    // The maker's archived amplifier facts — the speaker side stays absent,
    // which is the one-sided condition this case exists for.
    evidence: [
      { component: 'Nad AV716', label: 'power output',
        value: '80W per channel into 8 ohms, continuous (20Hz–20kHz at rated distortion); '
          + '145W IHF dynamic into 4 ohms' },
    ],
    composeRoles: {
      'Nad AV716': 'integrated', 'Topping D70 Pro OCTO': 'dac', 'Dynaco A35': 'speaker',
    },
    headroom: 'none',
    must: [
      { id: 'amp-on-record', re: /side of that question is on the record/ },
      // BOUNDED SYSTEM JUDGMENT: when the public path is exhausted, the
      // uncertainty converts to a listener-observable diagnostic.
      { id: 'listener-test', re: /hardening|strain|compress|listening seat/i },
    ],
    mustNot: [
      { id: 'no-spec-homework', re: /as per their specifications|look up the|check the (?:maker|manufacturer)/i },
    ],
    // The maker's archived ladder answers each load with ITS figure —
    // 80W continuous is an 8-ohm fact, 145W IHF dynamic a 4-ohm fact,
    // and no figure exists at 6 ohms.
    ladder: {
      value: '80W per channel into 8 ohms, continuous (20Hz–20kHz at rated distortion); '
        + '145W IHF dynamic into 4 ohms',
      expect: { 8: 80, 4: 145, 6: undefined },
    },
    soft: [
      'Does the closing question ask for listener-unique information rather than specifications Audio XX already said it could not find?',
      'Is the Topping-feeds-NAD path presented as likely/assumed rather than established?',
    ],
    related: ['accuphase-trio', 'fictional-unknown'],
  },
  {
    id: 'job-boenicke',
    why: 'one-sided electrical relationship: speaker side on record, amplifier rated '
      + 'output absent — must stay unresolved, family evidence never becomes arithmetic',
    input: 'assess my system: JOB INTegrated amplifier, Boenicke W5 speakers',
    components: [/job.*integrated/, /boenicke w5/],
    roles: { 1: /speaker/ },
    evidence: [
      { component: 'Boenicke W5', label: 'sensitivity', value: '84dB/2.83V/1m' },
      { component: 'Boenicke W5', label: 'nominal impedance', value: '4 ohms' },
    ],
    composeRoles: { 'Job integrated': 'amplifier', 'Boenicke W5': 'speaker' },
    headroom: 'none',
    mustNot: [
      { id: 'falsely-resolved-generous', re: /amply powered/ },
      { id: 'falsely-resolved-constrained', re: /genuinely power-constrained/ },
    ],
    related: ['decware-magnepan'],
  },
  {
    id: 'decware-magnepan',
    why: 'a strong established mismatch must remain strong (severe band; '
      + 'load-less nominal watts stay assessable)',
    input: 'assess my system: Decware SE84UFO amplifier and Magnepan LRS+ speakers',
    components: [/decware se84ufo/, /magnepan lrs\+/],
    roles: { 1: /speaker/ },
    // KNOWN P2: SE84UFO extraction category is 'other' despite the role word —
    // identity intact, chain role correct downstream. Role not pinned for it.
    drive: {
      power: ['Decware SE84UFO', '5 watt'],
      impedance: ['Magnepan LRS+', '4 ohm'],
      sensitivity: ['Magnepan LRS+', '86 dB'],
      expectStatus: 'assessable',
      // The severe band speaks as "a genuine power deficit" in the drive
      // lane and "genuinely power-constrained" at the interface owner —
      // one calibration, two surface phrasings (calibration 2026-09-15,
      // classified EXPECTATION BUG).
      must: [/genuine power deficit|power-constrained|live constraint/i],
      mustNot: [/amply powered/i, /depends on how far you sit/i],
    },
    related: ['job-boenicke'],
  },
  {
    id: 'nathan-2',
    why: 'rich multi-component evidence · Butler multi-figure ladder answers each load '
      + 'with ITS wattage · generous band licensed at the stated load · KNOWN P2: '
      + 'extraction forms a phantom bare-brand ARC candidate pre-degradation, so '
      + 'extraction-level identity is not pinned here (e2e stays safe)',
    input: 'assess my system: dCS Rossini Apex, ARC ref 5, Butler Monads, Acora QRC-2',
    components: [/rossini apex/, /arc ref 5/, /butler monads/, /acora qrc-2/],
    skipIdentity: true,
    allowedKinds: ['assessment', 'low_confidence', 'clarification'],
    ladder: {
      // At 8Ω the product selects the 128W typical figure over the 100W
      // minimum — the pinned Butler behaviour (calibration 2026-09-15,
      // classified EXPECTATION BUG: the fixture had guessed "minimum").
      value: 'Minimum 100 Watts RMS @ 8 Ohms; 128 Watts, RMS typical @ 8 Ohms; 200 Watts, RMS typical @ 4 Ohms',
      expect: { 4: 200, 8: 128, 6: undefined },
    },
    drive: {
      power: ['Butler Monads',
        'Minimum 100 Watts RMS @ 8 Ohms; 128 Watts, RMS typical @ 8 Ohms; 200 Watts, RMS typical @ 4 Ohms'],
      impedance: ['Acora QRC-2', '4 ohm'],
      sensitivity: ['Acora QRC-2', '92.5dB 1W/1m'],
      expectStatus: 'assessable',
      mustNot: [/power-constrained|live constraint/i],
    },
    related: ['accuphase-trio'],
  },
  {
    id: 'restraint-trio',
    why: 'restraint: a coherent, fully-resolved system must keep "change nothing" '
      + 'possible — no manufactured weakness, no unlicensed synergy language',
    input: 'Assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus',
    components: [/chord qutest/, /naim supernait 3|supernait 3/, /harbeth super hl5 plus|super hl5 plus/],
    evidence: [],
    composeRoles: {
      'Chord Qutest': 'dac', 'Naim SuperNait 3': 'amplifier', 'Harbeth Super HL5 Plus': 'speaker',
    },
    headroom: 'none',
    mustNot: [
      { id: 'manufactured-weakness', re: /genuinely power-constrained|the match is the problem/ },
    ],
    landmarkMutations: [
      { label: 'followon_re_mention',
        input: 'assess my system: Chord Qutest, Naim SuperNait 3, Harbeth Super HL5 Plus; the SuperNait 3 is the newest box' },
    ],
    related: ['nathan-2', 'followon-discourse'],
  },
  {
    id: 'naim-siblings',
    why: 'same-brand siblings independent of Accuphase-specific logic (Naim source + amp). '
      + 'KNOWN P2s: the SuperNait can extract brandless, and the uncatalogued NDX 2 is '
      + 'role-misinferred as an amplifier, so e2e asks the (answerable, conservative) '
      + 'duplicate-role question — identical on 7ed380e, pre-existing, non-blocking',
    input: 'my system is Naim NDX 2, Naim SuperNait 3 and Harbeth SHL5 Plus',
    components: [/supernait 3/, /ndx 2/, /shl5 plus/],
    allowedKinds: ['assessment', 'clarification'],
    related: ['accuphase-trio', 'chord-siblings'],
  },
  {
    id: 'chord-siblings',
    why: 'same-brand siblings, second maker (Chord DAC + Chord amplifier), copula frame',
    input: 'my system is Chord Qutest, Chord TToby and Harbeth SHL5 Plus',
    components: [/chord qutest/, /chord ttoby/, /shl5 plus/],
    related: ['naim-siblings'],
  },
  {
    id: 'subwoofer-chain',
    why: 'non-main-chain role preservation (subwoofer survives with its role) and '
      + 'slash-bearing model integrity (T/5x)',
    input: 'assess my system: KEF LS50 Meta speakers, REL T/5x subwoofer, Cambridge CXA81 amplifier',
    components: [/ls50 meta/, /t\/5x/, /cxa81/],
    roles: { 0: /speaker/, 1: /subwoofer/ },
    related: [],
  },
  {
    id: 'fictional-unknown',
    why: 'identity preservation for gear Audio XX has never seen — no invented '
      + 'reputation, specifications, or sonic character',
    input: 'assess my system: Veyron Acoustics VA-9 amplifier, Cormorant DAC Two, Pelham Model 12 speakers',
    components: [/veyron acoustics va-9/, /cormorant dac two/, /pelham model 12/],
    roles: { 0: /amplifier/, 2: /speaker/ },
    // A fully-unknown system degrades to the low-confidence intake — the
    // KNOWN BASELINE conservative behaviour (identical direct-call shape on
    // 7ed380e); identity preservation is the hard part and is pinned above.
    allowedKinds: ['assessment', 'low_confidence'],
    evidence: [],
    composeRoles: {
      'Veyron Acoustics VA-9': 'amplifier', 'Cormorant DAC Two': 'other', 'Pelham Model 12': 'speaker',
    },
    headroom: 'none',
    related: ['nad-vintage'],
  },
  {
    id: 'duplicate-mention',
    why: 'a component named twice in natural language is ONE physical unit — '
      + 'true-duplicate collapse without sibling deletion',
    input: 'assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; the SuperNait 3 also takes a digital input',
    components: [/supernait 3/, /shl5 plus/],
    physicalUnits: 2,
    related: ['naim-siblings'],
  },
  {
    id: 'bare-brand-ambiguity',
    why: 'models the listener genuinely never typed must still produce the '
      + 'exact-make-and-model clarification, never an assessment over bare brands',
    input: 'Assess my system: Denafrips Ares II, Rega, Spendor',
    components: [/ares ii/],
    skipIdentity: true,
    allowedKinds: ['clarification'],
    related: ['sparse-mainstream'],
  },
  {
    id: 'sparse-mainstream',
    why: 'uncatalogued mainstream identities survive whole (no bare-brand shedding: '
      + '"Wharfedale Diamond 12.1" stays a model, not "Wharfedale")',
    input: 'Assess my system: WiiM Pro, Fosi Audio V3, Wharfedale Diamond 12.1',
    components: [/wiim pro/, /fosi audio v3/, /wharfedale diamond 12\.1/],
    related: ['bare-brand-ambiguity'],
  },
];

GOLDEN_CORPUS.push(
  {
    id: 'followon-discourse',
    why: 'P1 landmark (802ae4e→7b610bf): a recognized system plus follow-on discourse '
      + '(re-mention, listener context) must assess with the component set unchanged — '
      + 'never the wrong-premise "couldn\'t match" clarification, never a phantom from prose',
    input: 'assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; the SuperNait 3 also takes a digital input',
    components: [/supernait 3/, /shl5 plus/],
    physicalUnits: 2,
    landmarkMutations: [
      { label: 'context_jazz', input: 'assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; I mostly listen to jazz' },
      { label: 'context_room', input: 'assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; my room is about 20 square metres' },
      { label: 'context_level', input: 'assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; I listen fairly quietly' },
    ],
    related: ['followon-inverse-catalogued', 'followon-inverse-uncatalogued', 'followon-inverse-bare-brand', 'accuphase-trio'],
  },
  {
    id: 'followon-inverse-catalogued',
    why: 'INVERSE control of the follow-on class: a genuinely new cataloged product '
      + 'after ";" or "and" joins the system — never read as commentary',
    input: 'assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; Chord Qutest',
    components: [/supernait 3/, /shl5 plus/, /chord qutest/],
    skipIdentity: true,
    landmarkMutations: [
      { label: 'and_joined', input: 'assess my system: Naim SuperNait 3 and Harbeth SHL5 Plus and Chord Qutest' },
    ],
    related: ['followon-discourse'],
  },
  {
    id: 'followon-inverse-uncatalogued',
    why: 'INVERSE control: an unknown model-shaped product after ";" is preserved '
      + 'whole or asked about — never silently ignored',
    input: 'assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; Zorblax Z9',
    components: [/supernait 3/, /shl5 plus/, /zorblax z9/],
    skipIdentity: true,
    allowedKinds: ['assessment', 'clarification', 'low_confidence'],
    related: ['followon-discourse'],
  },
  {
    id: 'followon-inverse-bare-brand',
    why: 'INVERSE control: a bare brand after ";" is preserved or asked about — '
      + 'never silently ignored as prose',
    input: 'assess my system: Naim SuperNait 3, Harbeth SHL5 Plus; Rega',
    components: [/supernait 3/, /shl5 plus/, /rega/],
    skipIdentity: true,
    allowedKinds: ['assessment', 'clarification', 'low_confidence'],
    related: ['followon-discourse'],
  },
);

export function caseById(id: string): GoldenCase | undefined {
  return GOLDEN_CORPUS.find((c) => c.id === id);
}

/**
 * Named targeted-P1 groups: `qa-harness.mjs p1 <group>` runs every member
 * (plus their `related` controls) when the argument names a group rather
 * than a case.
 */
export const TARGET_GROUPS: Record<string, string[]> = {
  'bounded-system-judgment': [
    'accuphase-trio', 'nad-vintage', 'job-boenicke', 'decware-magnepan',
    'restraint-trio', 'fictional-unknown',
  ],
  'follow_on_clause': [
    'followon-discourse', 'followon-inverse-catalogued',
    'followon-inverse-uncatalogued', 'followon-inverse-bare-brand',
  ],
  'accuphase_same_brand': ['accuphase-trio', 'naim-siblings', 'chord-siblings'],
  'a35_a3': ['nad-vintage'],
};
