import type React from "react";
import { Star } from "lucide-react";
import { useScrollFade } from "@/hooks/use-scroll-fade";

export const TESTIMONIALS = [
  {
    name: "RBA Edilizia",
    logo: "/images/testimonials/rba-edilizia-logo.svg",
    website: "rba-edilizia.it",
    rating: 5,
    text: "Ho sempre speso 3/4 ore dopo il lavoro per fare preventivi, gestire i cantieri ed avere un quadro completo su ciascun cantiere. Con PrevAI faccio tutto in pochi minuti, ed è sempre efficiente, consigliatissimo.",
  },
  {
    name: "Abdul Edilizia",
    logo: "/images/testimonials/abdul-edilizia-logo.png",
    website: "abduledilizia.it",
    rating: 5,
    text: "PrevAI è stata la soluzione al problema dei preventivi, li fa con logo, professionali ed impeccabili, grandissimi.",
  },
];

export const AGGREGATE_RATING = {
  ratingValue: "5.0",
  reviewCount: TESTIMONIALS.length,
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} stelle su 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "fill-gray-100 text-gray-100"}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function Logo({ src, name }: { src: string; name: string }) {
  return (
    <div className="h-9 w-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden p-1">
      <img src={src} alt={`Logo ${name}`} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

export function TestimonialsSection() {
  const ref = useScrollFade();
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="fade-in-section py-14 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <span className="inline-block bg-amber-50 text-amber-600 text-xs font-bold px-3 py-0.5 rounded-full uppercase tracking-wider mb-3">
            Recensioni verificate
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Cosa dicono <span className="gradient-text">di noi</span>
          </h2>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="flex gap-0.5" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-sm font-bold text-gray-800">
              {AGGREGATE_RATING.ratingValue}
            </span>
            <span className="text-sm text-gray-400">
              /5 &middot; {AGGREGATE_RATING.reviewCount} recensioni
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="bg-white rounded-xl border border-gray-100 p-5 card-soft flex flex-col gap-3"
            >
              <StarRating rating={t.rating} />
              <p className="text-sm text-gray-700 leading-relaxed flex-1">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
                <Logo src={t.logo} name={t.name} />
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {t.name}
                  </div>
                  <div className="text-xs text-gray-400">{t.website}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
