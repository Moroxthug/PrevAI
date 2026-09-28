// SEC-3: pdfmake never reaches the network while rendering a PDF.

import { describe, expect, test } from "vitest";
import { getPdfmake } from "./pdfmake";

describe("pdfmake URL policy", () => {
  test("an http(s) image is refused instead of fetched", async () => {
    // pdfmake downloads what the `images` dictionary (and fonts) point at.
    const doc = getPdfmake().createPdf({ content: [{ image: "meta" }], images: { meta: "http://169.254.169.254/latest/meta-data/x.png" } });
    await expect(doc.getBuffer()).rejects.toThrow(/denied/i);
  });
  test("plain documents still render", async () => {
    const buf = await getPdfmake().createPdf({ content: ["ok"] }).getBuffer();
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
