import assert from "node:assert/strict";
import { test } from "node:test";
import { ARTICLES, countsByTopic, findBySlug, popular, related, search, textOf } from "./help.ts";

test("the web help centre's articles are here, in Italian, with every title filled", () => {
  assert.ok(ARTICLES.length >= 10);
  for (const a of ARTICLES) { assert.ok(a.title.it && a.summary.it, a.slug); assert.ok(a.blocks.length > 0); }
});

test("search matches the words of an article, ignoring accents and case", () => {
  const hits = search(ARTICLES, "fattura", "it");
  assert.ok(hits.length > 0);
  assert.ok(textOf(hits[0]!, "it").includes("fattur"));
  assert.ok(search(ARTICLES, "FATTURA", "it").length === hits.length);
  assert.deepEqual(search(ARTICLES, "  ", "it"), []);
  assert.deepEqual(search(ARTICLES, "zzzqqq", "it"), []);
});

test("a title match comes first", () => {
  const hits = search(ARTICLES, "contratti", "it");
  assert.ok(hits.length > 0);
  assert.ok(hits[0]!.title.it.toLowerCase().includes("contratt"));
});

test("topic counts add up to the articles", () => {
  assert.equal(countsByTopic(ARTICLES).reduce((n, c) => n + c.n, 0), ARTICLES.length);
});

test("related starts with the same topic and never the article itself", () => {
  const a = ARTICLES.find((x) => x.category === "quotes")!;
  const r = related(a, ARTICLES);
  assert.equal(r.length, 2);
  assert.ok(r.every((x) => x.slug !== a.slug));
  assert.equal(popular(ARTICLES).length, 5);
  assert.equal(findBySlug("getting-started")?.slug, "getting-started");
  assert.equal(findBySlug("nope"), undefined);
});
