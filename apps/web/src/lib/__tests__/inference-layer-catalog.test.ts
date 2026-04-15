import { runInference } from '../inference-layer';
import { DAC_PRODUCTS } from '../products/dacs';
import { AMPLIFIER_PRODUCTS } from '../products/amplifiers';
import { SPEAKER_PRODUCTS } from '../products/speakers';

describe('real catalog product verification', () => {
  const find = (list: any[], id: string) => list.find((p: any) => p.id === id);

  it('Denafrips Pontus II: curated R2R → high confidence, warm + smooth', () => {
    const p = find(DAC_PRODUCTS, 'denafrips-pontus-ii-12th-1');
    expect(p).toBeDefined();
    const r = runInference(p);
    // Pontus has curated tendencyProfile → source is curated_profile
    expect(r.source).toBe('curated_profile');
    expect(r.confidence).toBe('high');
    expect(r.perception!.axes.warm_bright).toBe('warm');
    expect(r.perception!.axes.smooth_detailed).toBe('smooth');
    expect(r.hasCuratedData).toBe(true);
  });

  it('Chord Qutest: curated FPGA → high confidence from curated data', () => {
    const p = find(DAC_PRODUCTS, 'chord-qutest');
    expect(p).toBeDefined();
    const r = runInference(p);
    // Qutest has curated tendencyProfile → curated wins over archetype
    expect(r.source).toBe('curated_profile');
    expect(r.confidence).toBe('high');
    expect(r.hasCuratedData).toBe(true);
    // Design archetype is still FPGA
    expect(r.designSignals.archetype?.id).toBe('fpga');
  });

  it('Decware SE84UFO: curated SET → high confidence from curated data', () => {
    const p = find(AMPLIFIER_PRODUCTS, 'decware-se84ufo');
    expect(p).toBeDefined();
    const r = runInference(p);
    // Decware has curated tendencyProfile → curated wins over amp topology
    expect(r.source).toBe('curated_profile');
    expect(r.confidence).toBe('high');
    expect(r.perception!.axes.warm_bright).toBe('warm');
    expect(r.perception!.axes.smooth_detailed).toBe('smooth');
    expect(r.hasCuratedData).toBe(true);
  });

  it('all products with curated data get high confidence', () => {
    const allProducts = [...DAC_PRODUCTS, ...AMPLIFIER_PRODUCTS, ...SPEAKER_PRODUCTS];
    const curated = allProducts.filter(
      (p: any) => p.tendencyProfile && p.tendencyProfile.confidence !== 'low',
    );
    expect(curated.length).toBeGreaterThan(0);
    for (const p of curated) {
      const r = runInference(p);
      // Every product with usable curated data should use it
      expect(r.source).toBe('curated_profile');
      expect(r.confidence).toBe('high');
    }
  });

  it('products with only numeric traits get high confidence', () => {
    const allProducts = [...DAC_PRODUCTS, ...AMPLIFIER_PRODUCTS, ...SPEAKER_PRODUCTS];
    // Find products with traits but no curated profile
    const numericOnly = allProducts.filter(
      (p: any) =>
        (!p.tendencyProfile || p.tendencyProfile.confidence === 'low') &&
        p.traits &&
        Object.keys(p.traits).length > 0,
    );
    for (const p of numericOnly) {
      const r = runInference(p);
      // Should fall through to numeric_traits
      if (r.source === 'numeric_traits') {
        expect(r.confidence).toBe('high');
      }
    }
  });

  it('delta-sigma DACs without curated data infer detailed', () => {
    const dsDacs = DAC_PRODUCTS.filter(
      (p: any) =>
        p.topology === 'delta-sigma' &&
        (!p.tendencyProfile || p.tendencyProfile.confidence === 'low'),
    );
    for (const p of dsDacs) {
      const r = runInference(p);
      if (r.source === 'design_archetype' && r.behavior) {
        // delta_sigma archetype: clarity↑, speed↑, spatial_precision↑, tonal_density↓
        expect(r.perception!.axes.smooth_detailed).toBe('detailed');
        expect(r.perception!.axes.warm_bright).toBe('bright');
        // Now spatial_precision is tracked → airy
        expect(r.perception!.axes.airy_closed).toBe('airy');
      }
    }
  });
});
