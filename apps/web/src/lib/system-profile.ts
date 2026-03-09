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
}

export const DEFAULT_SYSTEM_PROFILE: SystemProfile = {
  outputType: 'unknown',
  systemCharacter: 'unknown',
  tubeAmplification: false,
  lowPowerContext: false,
};
