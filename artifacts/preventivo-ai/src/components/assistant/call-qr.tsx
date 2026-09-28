import { useEffect, useState } from "react";

/**
 * APP-8g — on a computer the call card shows the number and this QR: scanned
 * with the phone's camera it opens the dialer with the number (`tel:`). The QR
 * library is loaded only when a call card needs it. Dark on white whatever the
 * theme, so every camera reads it.
 */
export function CallQr({ dial, label }: { dial: string; label: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void import("qrcode-generator").then(({ default: qrcode }) => {
      const qr = qrcode(0, "M");
      qr.addData(`tel:${dial}`);
      qr.make();
      if (alive) setSvg(qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }));
    }).catch(() => { /* no QR: the number is on the card anyway */ });
    return () => { alive = false; };
  }, [dial]);
  if (!svg) return null;
  return <div className="prop-qr" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}
