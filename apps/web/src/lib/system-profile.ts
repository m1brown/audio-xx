/**
 * System profile types for describing a user's existing audio chain.
 *
 * Extracted from conversation text via keyword matching.
 * Used by product scoring to nudge recommendations toward
 * system-coherent choices.
 */

export type OutputType = 'speakers' | 'headphones' | 'both' | 'unknown';
export type SystemCharacter = 'bright' | 'warm' | 'neutral' | 'unknown';

export interface SystemProfile {
  outputType: OutputType;
  systemCharacter: SystemCharacter;
  tubeAmplification: boolean;
  lowPowerContext: boolean;
  /**
   * True when the user's existing chain already contains external amplification
   * (integrated amp, power amp, tube amp, receiver, or a named amp product).
   * Used as a hard compatibility gate: when true, active / powered / wireless
   * speakers become architecturally incompatible as primary recommendations
   * because the user would be buying duplicate amplification.
   */
  hasExternalAmplification: boolean;
}

export const DEFAULT_SYSTEM_PROFILE: SystemProfile = {
  outputType: 'unknown',
  systemCharacter: 'unknown',
  tubeAmplification: false,
  lowPowerContext: false,
  hasExternalAmplification: false,
};
