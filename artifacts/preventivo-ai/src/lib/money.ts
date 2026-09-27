/** Euro amounts as the app shows them: "1.234,50 €" and, for round targets, "18.000 €". */
const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const eurWhole = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export const formatEur = (n: number) => eur.format(n);
export const formatEurWhole = (n: number) => eurWhole.format(n);
