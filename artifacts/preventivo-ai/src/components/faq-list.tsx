import { ChevronDown } from "lucide-react";

/**
 * APP-1h (QuoteAI Phase 112) — le domande come elenco chiuso. Una domanda che
 * si può aprire è una riga finché non la si vuole leggere.
 */
export function FaqList({ items }: { items: ReadonlyArray<{ q: string; a: string }> }) {
  return (
    <div className="faq-list">
      {items.map((item) => (
        <details key={item.q} className="faq-item">
          <summary>
            <h3>{item.q}</h3>
            <ChevronDown className="faq-chev h-4 w-4" aria-hidden="true" />
          </summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  );
}
