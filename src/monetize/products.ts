/** What real money buys. Prices are in naira. `api/_products.js` repeats the kobo amounts for server-side checking: keep both in step (npm run check:products). */
export type ProductKind = 'coins' | 'gas' | 'vip' | 'style' | 'car';
export interface Product { id: string; kind: ProductKind; name: string; blurb: string; naira: number; coins?: number; car?: string }
export const PRODUCTS: Product[] = [
  { id: 'coins_s', kind: 'coins', name: 'Coin Stash', blurb: '5,000 coins', naira: 500, coins: 5000 },
  { id: 'coins_m', kind: 'coins', name: 'Coin Bag', blurb: '20,000 coins', naira: 1500, coins: 20000 },
  { id: 'coins_l', kind: 'coins', name: 'Coin Vault', blurb: '60,000 coins', naira: 4000, coins: 60000 },
  { id: 'gas_full', kind: 'gas', name: 'Full Tank', blurb: 'Refill all 7 gas bars now', naira: 200 },
  { id: 'vip', kind: 'vip', name: 'Turbo Pass', blurb: '+25% coins on every run, and gas refills in 90 minutes instead of 3 hours. Forever.', naira: 2000 },
  { id: 'style', kind: 'style', name: 'Style Pack', blurb: 'Unlock every wheel, decal, smoke, horn and tint at once', naira: 1000 },
  { id: 'car_sclass', kind: 'car', name: 'Mercedes S-Class', blurb: 'Premium sedan. Top speed and brakes 9+. No rank needed.', naira: 2500, car: 's-class' },
  { id: 'car_escalade', kind: 'car', name: 'Cadillac Escalade', blurb: 'Premium SUV. Heavy, fast, and it wins every shoving match.', naira: 3500, car: 'escalade' },
];
export const productById = (id: string) => PRODUCTS.find(p => p.id === id);
export const ngn = (n: number) => '₦' + n.toLocaleString('en-NG');
