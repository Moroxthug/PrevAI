/**
 * Seed script: crea i 4 piani prevai su Stripe (idempotente).
 * Eseguire dopo aver connesso l'integrazione Stripe:
 *   pnpm --filter @workspace/scripts exec tsx src/seed-products.ts
 */
import { getUncachableStripeClient } from './stripeClient';

const PLANS = [
  {
    name: 'prevai Starter',
    description: '20 preventivi professionali al mese con PDF incluso.',
    planId: 'monthly_starter',
    unitAmount: 2900,   // €29.00
    currency: 'eur',
    recurring: { interval: 'month' as const },
  },
  {
    name: 'prevai Pro',
    description: 'Preventivi illimitati, nessun watermark, branding personalizzabile.',
    planId: 'monthly_pro',
    unitAmount: 7900,   // €79.00
    currency: 'eur',
    recurring: { interval: 'month' as const },
  },
  {
    name: 'prevai Singolo Watermark',
    description: '1 preventivo PDF con watermark. Pagamento unico, nessun abbonamento.',
    planId: 'oneshot_watermark',
    unitAmount: 2900,   // €29.00
    currency: 'eur',
    recurring: null,
  },
  {
    name: 'prevai Singolo Pulito',
    description: '1 preventivo PDF senza watermark. Pagamento unico, nessun abbonamento.',
    planId: 'oneshot_clean',
    unitAmount: 3900,   // €39.00
    currency: 'eur',
    recurring: null,
  },
];

async function seedProducts() {
  const stripe = await getUncachableStripeClient();
  console.log('Connessione a Stripe OK. Creazione prodotti...\n');

  for (const plan of PLANS) {
    // Check if product with this planId already exists
    const existing = await stripe.products.search({
      query: `metadata['planId']:'${plan.planId}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      const prod = existing.data[0];
      const prices = await stripe.prices.list({ product: prod.id, active: true, limit: 5 });
      console.log(`✓ ${plan.name} già esistente`);
      console.log(`  Product ID: ${prod.id}`);
      prices.data.forEach((p) => console.log(`  Price ID:   ${p.id}  (€${(p.unit_amount ?? 0) / 100})`));
      console.log('');
      continue;
    }

    // Create product
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: { planId: plan.planId },
    });
    console.log(`✓ Prodotto creato: ${product.name} (${product.id})`);

    // Create price
    const pricePayload: Parameters<typeof stripe.prices.create>[0] = {
      product: product.id,
      unit_amount: plan.unitAmount,
      currency: plan.currency,
      metadata: { planId: plan.planId },
    };
    if (plan.recurring) pricePayload.recurring = plan.recurring;

    const price = await stripe.prices.create(pricePayload);
    console.log(`  Price ID: ${price.id}  (€${plan.unitAmount / 100}${plan.recurring ? '/mese' : ' una tantum'})`);
    console.log('');
  }

  console.log('✅ Seeding completato. Copia i Price ID sopra e aggiorna payments.ts.');
}

seedProducts().catch((err) => {
  console.error('Errore:', err.message);
  process.exit(1);
});
