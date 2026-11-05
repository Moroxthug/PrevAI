import test from "node:test";
import assert from "node:assert/strict";
import { authErrorKey } from "./auth-errors.ts";
import { translations } from "../i18n/translations.ts";

test("a known code wins over the screen's fallback", () => {
  assert.equal(authErrorKey({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }, "x"), "signIn.errorInvalidCredentials");
  assert.equal(authErrorKey({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" }, "x"), "signUp.errorAlreadyRegistered");
});

test("too many requests has its own text, anything else falls back", () => {
  assert.equal(authErrorKey({ status: 429 }, "x"), "auth.errorTooManyAttempts");
  assert.equal(authErrorKey({ code: "SOMETHING_NEW", status: 500 }, "x"), "x");
  assert.equal(authErrorKey({}, "x"), "x");
});

test("every code has a text in Italian", () => {
  for (const code of ["INVALID_EMAIL_OR_PASSWORD", "EMAIL_NOT_VERIFIED", "USER_ALREADY_EXISTS", "PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG", "INVALID_EMAIL", "INVALID_PASSWORD", "INVALID_CODE", "INVALID_BACKUP_CODE", "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE", "INVALID_TWO_FACTOR_COOKIE", "SESSION_EXPIRED", "SESSION_NOT_FRESH"]) {
    assert.ok(translations.it[authErrorKey({ code }, "x")], code);
  }
});
