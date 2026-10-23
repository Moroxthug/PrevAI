import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { chapterAt, clampPos, clock, knobX, playable, posterUrl, segmentFill, VIDEOS, videoEvents, videoUrl, type Chapter } from "./videos.ts";

const ch: Chapter[] = [{ at: 0, title: "a", caption: "" }, { at: 14, title: "b", caption: "" }, { at: 38, title: "c", caption: "" }, { at: 58, title: "d", caption: "" }];

test("seconds as a clock", () => {
  assert.equal(clock(72), "1:12");
  assert.equal(clock(60), "1:00");
  assert.equal(clock(58), "0:58");
  assert.equal(clock(-3), "0:00");
});

test("the chapter at a position", () => {
  assert.equal(chapterAt(ch, 0), 0);
  assert.equal(chapterAt(ch, 34), 1);
  assert.equal(chapterAt(ch, 58), 3);
  assert.equal(chapterAt(ch, 72), 3);
});

test("each segment fills as the position passes it", () => {
  assert.deepEqual(segmentFill(ch, 72, 34).map((n) => Math.round(n * 100) / 100), [1, 0.83, 0, 0]);
  assert.deepEqual(segmentFill(ch, 72, 72), [1, 1, 1, 1]);
});

test("the knob is at the start, and at the end of the bar", () => {
  assert.equal(knobX(ch, 72, 0, 350), 0);
  assert.ok(knobX(ch, 72, 72, 350) > 340);
});

test("positions stay inside the video", () => {
  assert.equal(clampPos(-5, 72), 0);
  assert.equal(clampPos(99, 72), 72);
});

test("every video has four chapters that start at 0 and grow inside its length", () => {
  for (const v of VIDEOS) {
    assert.equal(v.at.length, 4, v.id);
    assert.equal(v.at[0], 0, v.id);
    v.at.forEach((t, i) => { if (i) assert.ok(t > v.at[i - 1]! && t < v.secs, v.id); });
  }
});

test("the files live on the website", () => {
  assert.equal(videoUrl("quotes", "https://prevai.it/video/"), "https://prevai.it/video/quotes.mp4");
  assert.equal(posterUrl("quotes", "https://prevai.it/video/"), "https://prevai.it/video/quotes.jpg");
});

test("started once when it plays, finished once at the end", () => {
  const sent = { started: false, finished: false };
  assert.deepEqual(videoEvents(sent, { playing: false, pos: 0, total: 60 }), []);
  assert.deepEqual(videoEvents(sent, { playing: true, pos: 0, total: 60 }), ["video_started"]);
  assert.deepEqual(videoEvents(sent, { playing: true, pos: 30, total: 60 }), []);
  assert.deepEqual(videoEvents(sent, { playing: false, pos: 60, total: 60 }), ["video_finished"]);
  assert.deepEqual(videoEvents(sent, { playing: true, pos: 0, total: 60 }), []);
});

test("the website lists the same recorded videos, with the same length and chapters", () => {
  const site = readFileSync(new URL("../../../preventivo-ai/src/data/help-videos.ts", import.meta.url), "utf8");
  const recorded = VIDEOS.filter(playable);
  for (const v of recorded) {
    const block = new RegExp(`id: "${v.id}", file: "${v.file}",[\\s\\S]*?secs: (\\d+),[\\s\\S]*?chapters: \\[([\\s\\S]*?)\\],\\n    article`).exec(site);
    assert.ok(block, `${v.id} missing on the site`);
    assert.equal(Number(block[1]), v.secs, v.id);
    assert.deepEqual([...block[2]!.matchAll(/at: (\d+)/g)].map((m) => Number(m[1])), v.at, v.id);
  }
  assert.equal((site.match(/^    id: "/gm) ?? []).length, recorded.length);
});
