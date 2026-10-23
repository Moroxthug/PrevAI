// POCKET-7: un video breve dell'aiuto. Il lettore del browser (niente player di terzi, niente tracciamento),
// muto, sottotitoli italiani accesi, locandina subito e il file solo quando si preme play (preload="none").
// Sotto, i capitoli: un tocco porta il video a quel punto.
import { useRef } from "react";
import { clock, type HelpVideo } from "@/data/help-videos";

export function HelpVideoPlayer({ video, headingLevel = 2 }: { video: HelpVideo; headingLevel?: 2 | 3 }) {
  const ref = useRef<HTMLVideoElement>(null);
  const seek = (at: number) => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = at;
    void el.play().catch(() => {});
  };
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <figure className="card" style={{ padding: 0, overflow: "hidden", margin: 0 }}>
      <video
        ref={ref}
        controls
        muted
        playsInline
        preload="none"
        poster={`/video/${video.file}.jpg`}
        width={1280}
        height={776}
        style={{ display: "block", width: "100%", height: "auto", aspectRatio: "1280 / 776", background: "#141418" }}
        aria-label={video.title}
      >
        <source src={`/video/${video.file}.mp4`} type="video/mp4" />
        <track kind="captions" srcLang="it" label="Italiano" src={`/video/${video.file}.vtt`} default />
      </video>
      <figcaption style={{ padding: "16px 20px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, fontSize: 12.5, color: "var(--faint)" }}>
          <span className="chip chip-teal">{video.topic}</span>
          <span>{clock(video.secs)}</span>
        </div>
        <H style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>{video.title}</H>
        <p style={{ fontSize: 13.5, color: "var(--muted-mk)", lineHeight: 1.5, marginBottom: 10 }}>{video.sub}</p>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {video.chapters.map((c) => (
            <li key={c.at}>
              <button type="button" onClick={() => seek(c.at)} className="btn btn-outline btn-sm" style={{ fontSize: 12.5 }}>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--faint)", marginRight: 6 }}>{clock(c.at)}</span>{c.title}
              </button>
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
