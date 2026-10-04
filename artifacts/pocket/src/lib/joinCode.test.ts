import test from "node:test";
import assert from "node:assert/strict";
import { cleanCode, codeProblem, formatCode, isCodeComplete, kindForRole } from "./joinCode.ts";

test("cleanCode keeps eight upper-case letters and digits", () => {
  assert.equal(cleanCode(" k7qm-4xnp9 "), "K7QM4XNP");
  assert.equal(cleanCode(null), "");
  assert.equal(cleanCode("ab-c"), "ABC");
});
test("isCodeComplete needs all eight", () => {
  assert.equal(isCodeComplete("K7QM-4XNP"), true);
  assert.equal(isCodeComplete("K7QM"), false);
});
test("formatCode adds the dash after four", () => {
  assert.equal(formatCode("K7Q"), "K7Q");
  assert.equal(formatCode("K7QM"), "K7QM");
  assert.equal(formatCode("k7qm4x"), "K7QM-4X");
});
test("kindForRole", () => {
  assert.equal(kindForRole("foreman"), "foreman");
  assert.equal(kindForRole("admin"), "foreman");
  assert.equal(kindForRole("office"), "crew");
  assert.equal(kindForRole("viewer"), "crew");
});
test("codeProblem", () => {
  assert.equal(codeProblem({ status: 404, code: "NOT_FOUND" }), "invalid");
  assert.equal(codeProblem({ status: 400, code: "BAD_CODE" }), "invalid");
  assert.equal(codeProblem({ status: 409, code: "CODE_USED" }), "used");
  assert.equal(codeProblem({ status: 410, code: "EXPIRED" }), "expired");
  assert.equal(codeProblem({ status: 409, code: "OWN_COMPANY" }), "own");
  assert.equal(codeProblem({ status: 409, code: "ALREADY_MEMBER" }), "member");
  assert.equal(codeProblem({ status: 0 }), "offline");
  assert.equal(codeProblem({ status: 500 }), "failed");
  assert.equal(codeProblem({ status: 429, code: undefined }), "failed");
});
