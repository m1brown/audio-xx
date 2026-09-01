/**
 * Display-only label normalisation for the assessment document.
 *
 * Lives here rather than beside `presentDossier` so the artifact renderer can
 * import it WITHOUT taking a runtime handle on the module that performs
 * dossier selection. The route-purity guard enforces that separation, and it
 * is the right call: a renderer that can reach selection logic eventually
 * uses it.
 *
 * This changes captions only. Same fact, same bucket, same order.
 */
const LABEL_OVERRIDES: Record<string, string> = {
  'driver complement': 'Drivers',
  'tube complement': 'Tube complement',
  'power output': 'Power output',
  'power handling': 'Power handling',
  'frequency response': 'Frequency response',
  'nominal impedance': 'Impedance',
  inputs: 'Inputs',
  outputs: 'Outputs',
  dimensions: 'Dimensions',
  weight: 'Weight',
  impedance: 'Impedance',
  sensitivity: 'Sensitivity',
};

export function prettyLabel(label: string): string {
  const key = label.trim().toLowerCase();
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  // Anything else — including publication names, which are already correctly
  // cased — keeps its own capitalisation beyond the first character.
  return label.charAt(0).toUpperCase() + label.slice(1);
}
