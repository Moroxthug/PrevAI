// @workspace/config/fiscale — motore fiscale del regime forfettario (A-2).
// Funzioni pure e tabelle versionate per anno: nessuna dipendenza, quindi
// importabile identico da frontend, API server e test.
export * from "./types";
export * from "./ateco";
export * from "./regole/index";
export * from "./calcolo";
export * from "./f24";
export * from "./golden";
