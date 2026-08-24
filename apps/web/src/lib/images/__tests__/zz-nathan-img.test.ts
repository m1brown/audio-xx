import { it } from 'vitest';
import { getProductImage, getProductImageEntry, resolveProductImageStrict, GOVERNED_REGISTRY } from '@/lib/product-images';
const N: [string,string][] = [['dCS','Rossini Apex'],['Audio Research','Reference 5'],['Butler Audio','MONAD A100'],['Butler','Monads'],['Acora Acoustics','QRC-2'],['Acora','QRC-2']];
it('coverage', () => {
  for (const [b,n] of N) {
    console.log(`${(b+' '+n).padEnd(30)} img=${getProductImage(b,n) ?? '(none)'}`);
  }
  console.log('--- registry rows mentioning these brands ---');
  for (const r of GOVERNED_REGISTRY) {
    if (/dcs|audio research|butler|acora|rossini|reference 5|monad|qrc/i.test(r.key)) {
      console.log(`  key="${r.key}" state=${r.state} src=${r.sourceClass} url=${r.url.slice(0,70)}`);
    }
  }
});
