import test from "node:test";
import assert from "node:assert/strict";
import { announcement, parseScrollMap, remember, routeKey } from "./scroll-memory.ts";

test("routeKey keeps the query, drops an empty one", () => {
  assert.equal(routeKey("/dashboard/jobs/4", "?tab=notes"), "/dashboard/jobs/4?tab=notes");
  assert.equal(routeKey("/dashboard/jobs/4", "tab=notes"), "/dashboard/jobs/4?tab=notes");
  assert.equal(routeKey("/dashboard", ""), "/dashboard");
  assert.equal(routeKey("/dashboard", "?"), "/dashboard");
});

test("remember rounds, clamps and evicts the oldest", () => {
  let m = remember({}, "/a", 120.6);
  assert.deepEqual(m, { "/a": 121 });
  assert.equal(remember({}, "/a", -5)["/a"], 0);
  m = remember(remember(remember({}, "/a", 1, 2), "/b", 2, 2), "/c", 3, 2);
  assert.deepEqual(Object.keys(m), ["/b", "/c"]);
  // touching an old entry makes it the newest
  m = remember(remember(remember({}, "/a", 1, 2), "/b", 2, 2), "/a", 9, 2);
  assert.deepEqual(Object.keys(m), ["/b", "/a"]);
  assert.equal(m["/a"], 9);
});

test("parseScrollMap ignores garbage", () => {
  assert.deepEqual(parseScrollMap(null), {});
  assert.deepEqual(parseScrollMap("not json"), {});
  assert.deepEqual(parseScrollMap("[1,2]"), {});
  assert.deepEqual(parseScrollMap('{"/a":10,"/b":"x","/c":-1,"/d":null}'), { "/a": 10 });
});

test("announcement prefers the heading, strips the brand from the title", () => {
  assert.equal(announcement("  Preventivi \n recenti ", "Qualcosa · PrevAI"), "Preventivi recenti");
  assert.equal(announcement(null, "Clienti · PrevAI"), "Clienti");
  assert.equal(announcement("", "Oggi | PrevAI"), "Oggi");
  assert.equal(announcement(undefined, "PrevAI"), "PrevAI");
});
