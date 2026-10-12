// Scarica il file di ore del periodo per il consulente del lavoro (GET /api/pay/export.csv, che il server registra: chi ha esportato cosa).
import { downloadCsv } from "./download";
import { payApi } from "./payApi";

export const exportPayPeriod = (date: string): Promise<string> => downloadCsv(payApi.exportPath(date), `ore-${date}.csv`);
