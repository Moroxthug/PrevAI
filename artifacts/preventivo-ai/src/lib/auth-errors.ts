// better-auth risponde in inglese: gli schermi non mostrano mai il suo messaggio,
// ma la chiave di traduzione del suo codice (o quella generica dello schermo).
const KEY_BY_CODE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "signIn.errorInvalidCredentials",
  EMAIL_NOT_VERIFIED: "signIn.errorNotVerified",
  USER_ALREADY_EXISTS: "signUp.errorAlreadyRegistered",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "signUp.errorAlreadyRegistered",
  PASSWORD_TOO_SHORT: "signUp.errorPasswordLength",
  PASSWORD_TOO_LONG: "auth.errorPasswordTooLong",
  INVALID_EMAIL: "auth.errorInvalidEmail",
  INVALID_PASSWORD: "auth.errorWrongPassword",
  INVALID_CODE: "auth.errorInvalidCode",
  INVALID_BACKUP_CODE: "auth.errorInvalidCode",
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "auth.errorTooManyAttempts",
  INVALID_TWO_FACTOR_COOKIE: "auth.errorSessionExpired",
  SESSION_EXPIRED: "auth.errorSessionExpired",
  SESSION_NOT_FRESH: "auth.errorSessionExpired",
};

export function authErrorKey(error: { code?: string; status?: number }, fallback: string): string {
  if (error.code && KEY_BY_CODE[error.code]) return KEY_BY_CODE[error.code]!;
  return error.status === 429 ? "auth.errorTooManyAttempts" : fallback;
}
