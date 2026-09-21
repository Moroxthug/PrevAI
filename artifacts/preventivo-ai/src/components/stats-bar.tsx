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

/** Dark full-bleed "impact" band (docs/mockups/homepage-mockup-v2.html .impact) — real, live-counted stats, no invented numbers. */
export function StatsBar() {


  return (
    <section className="sec impact on-dark" id="impact">
      <div className="wrap">
        <div>
          <span className="eyebrow on-dark">Impact</span>
          <h2 className="h2" style={{ margin: "14px 0 14px" }}>
            Built for the way Canadian trades actually work.
          </h2>
          <p className="lead">
            Tax handled, languages covered, and the paperwork gone — measured in the numbers our users report.
          </p>
        </div>
        <div className="stat-grid">
          <StatTile
            target={30}
            suffix={" sec"}
            label={"median time to a finished quote, down from 30–60 min"}
          />
          <StatTile
            target={6}
            prefix="4–"
            suffix={" hrs"}
            label={"saved per week, back into the job site or family"}
          />
          <StatTile
            target={TRADES_COUNT}
            label={"trade verticals with dedicated pages and vocabulary"}
          />
          <StatTile
            target={RATING}
            decimals={1}
            suffix="/5"
            em
            label={"average verified rating from Canadian contractors"}
          />
        </div>
      </div>
    </section>
  );
}
