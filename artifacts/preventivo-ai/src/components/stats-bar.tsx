import { useCountUp } from "@/hooks/use-count-up";
import { TRADE_LABELS } from "@/i18n/translations";
import { AGGREGATE_RATING } from "@/components/testimonials-section";

const TRADES_COUNT = Object.keys(TRADE_LABELS.it).length;
const RATING = parseFloat(AGGREGATE_RATING.ratingValue);

function StatTile({
  target,
  decimals = 0,
  prefix = "",
  suffix = "",
  em = false,
  label,
}: {
  target: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  em?: boolean;
  label: string;
}) {
  const { ref, display } = useCountUp(target, 1400, decimals);
  const value = (
    <span className="tabular-nums">
      {prefix}
      {display}
      {suffix}
    </span>
  );
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="stat">
      <b>{em ? <em>{value}</em> : value}</b>
      <span>{label}</span>
    </div>
  );
}

/** Fascia scura "impatto" a tutta larghezza (docs/mockups/homepage-mockup-v2.html .impact) — numeri reali contati dal vivo, niente cifre inventate. */
export function StatsBar() {
  return (
    <section className="sec impact on-dark" id="impact">
      <div className="wrap">
        <div>
          <span className="eyebrow on-dark">Impatto</span>
          <h2 className="h2" style={{ margin: "14px 0 14px" }}>
            Pensato per come lavorano davvero gli artigiani italiani.
          </h2>
          <p className="lead">
            IVA gestita, burocrazia sparita — misurato nei numeri che i nostri utenti riportano.
          </p>
        </div>
        <div className="stat-grid">
          <StatTile
            target={30}
            suffix={" sec"}
            label={"tempo mediano per un preventivo finito, contro 30–60 min"}
          />
          <StatTile
            target={6}
            prefix="4–"
            suffix={" ore"}
            label={"risparmiate a settimana, restituite al cantiere o alla famiglia"}
          />
          <StatTile
            target={TRADES_COUNT}
            label={"mestieri con pagine e vocabolario dedicati"}
          />
          <StatTile
            target={RATING}
            decimals={1}
            suffix="/5"
            em
            label={"valutazione media verificata degli artigiani italiani"}
          />
        </div>
      </div>
    </section>
  );
}
