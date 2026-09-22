import type { SdiSettings } from "@workspace/db";
import { decryptField } from "../../lib/fieldCrypto.js";
import { IntermediarioSimulato } from "./simulato.js";
import { IntermediarioOpenapi } from "./openapi.js";
import type { CredenzialiProvider, IntermediarioSdi } from "./types.js";

export * from "./types.js";
export { IntermediarioSimulato, accodaPassivaSimulata, azzeraSimulatore, statoPerTipo } from "./simulato.js";
export { IntermediarioOpenapi, statoOpenapi } from "./openapi.js";

/** Credenziali in chiaro, decifrate al volo (A-0): non tornano mai al client. */
export function credenzialiDa(settings: Pick<SdiSettings, "providerAccountId" | "providerApiKey" | "webhookSecret" | "ambiente">): CredenzialiProvider {
  return {
    accountId: decryptField(settings.providerAccountId),
    apiKey: decryptField(settings.providerApiKey),
    webhookSecret: decryptField(settings.webhookSecret),
    ambiente: settings.ambiente,
  };
}

/**
 * L'intermediario dell'impresa. Se il provider scelto non è configurato si
 * torna al simulatore: meglio un documento che non parte di uno che parte
 * verso un canale a metà.
 */
export function intermediarioPer(settings: SdiSettings): IntermediarioSdi {
  const credenziali = credenzialiDa(settings);
  switch (settings.provider) {
    case "openapi": {
      const openapi = new IntermediarioOpenapi(credenziali);
      return openapi.configurato() ? openapi : new IntermediarioSimulato(settings.ambiente, settings.userId);
    }
    case "acube":
      // Non ancora implementato: in attesa del preventivo (decisione D8).
      return new IntermediarioSimulato(settings.ambiente, settings.userId);
    default:
      return new IntermediarioSimulato(settings.ambiente, settings.userId);
  }
}
