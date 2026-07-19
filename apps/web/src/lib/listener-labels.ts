/**
 * Listener-facing label translation — the single place internal trait
 * vocabulary becomes ordinary audiophile language. Every user-visible
 * surface (narrative composer, deterministic renderer) must route
 * internal labels through this before printing (editorial pass
 * 2026-07-19; launch guard test pins it).
 */
export function listenerPropertyLabel(p: string): string {
  const key = p.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const map: Record<string, string> = {
    low_stored_energy: 'clean note endings',
    transient_speed: 'attack and snap',
    tonal_density: 'body and weight',
    harmonic_density: 'tonal richness',
    dynamic_elasticity: 'elasticity',
    microdetail: 'inner detail',
    musical_flow: 'musical flow',
    stability: 'rhythmic grip',
    spatial_scale: 'soundstage size',
    // Stacked-trait internal labels → ordinary audiophile language
    // (internal taxonomy never prints raw).
    detail_emphasis: 'resolution and fine detail',
    control_emphasis: 'grip and control',
    smoothness_emphasis: 'smoothness and ease',
    lean_tonal_body: 'a lean tonal balance',
    high_damping_analytical_control: 'tight damping and control',
  };
  return map[key] ?? p.replace(/_/g, ' ');
}
