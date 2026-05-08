import type React from "react";
import { Star } from "lucide-react";
import { useScrollFade } from "@/hooks/use-scroll-fade";

export const TESTIMONIALS = [
  {
    name: "Marco R.",
    role: "Imbianchino",
    city: "Milano",
    rating: 5,
    text: "Faccio il doppio dei preventivi in metà tempo. Prima ci mettevo un'ora, adesso 2 minuti. I clienti sono sorpresi dalla qualità del documento.",
  },
  {
    name: "Giulia T.",
    role: "Titolare, Termoidraulica srl",
    city: "Torino",
    rating: 5,
    text: "Ho vinto 2 lavori nel primo giorno solo perché ho risposto prima dei concorrenti. prevai mi ha dato un vantaggio enorme sulla concorrenza.",
  },
  {
    name: "Luca S.",
    role: "Elettricista",
    city: "Roma",
    rating: 5,
    text: "Il PDF è professionale come quello di una grande azienda. I clienti non chiedono più sconti — si fidano subito di più.",
  },
  {
    name: "Antonio B.",
    role: "Muratore",
    city: "Napoli",
    rating: 4,
    text: "Uso prevai dal telefono direttamente in cantiere. In 3 minuti ho il preventivo pronto da mandare su WhatsApp. Prima me lo dimenticavo.",
  },
  {
    name: "Sara M.",
    role: "Gestione Immobiliare",
    city: "Bologna",
    rating: 5,
    text: "Non sono artigiana ma coordino molti interventi. prevai mi ha tolto ore di burocrazia ogni settimana — l'adozione è stata immediata.",
  },
  {
    name: "Roberto C.",
    role: "Falegname",
    city: "Brescia",
    rating: 5,
    text: "Ho alzato i prezzi del 15% senza perdere lavori. Quando il cliente vede un preventivo ben strutturato, la fiducia aumenta automaticamente.",
  },
];

export const AGGREGATE_RATING = {
  ratingValue: "4.9",
  reviewCount: 127,
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

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
      style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
      aria-hidden="true"
    >
      {initials}
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
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
                <Avatar name={t.name} />
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {t.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {t.role} &middot; {t.city}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
