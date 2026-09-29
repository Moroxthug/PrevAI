import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// I file di una persona/impresa stanno in `<cartella>/<userId>/…` nei due
// bucket. Li elencano la cancellazione dell'account (APP-1c, per toglierli) e
// l'esportazione dei dati (GDPR-1, per impacchettarli).

export type StorageFile = { bucket: string; path: string; size: number };

export function storageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function storageClient(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export const storageBuckets = () => [process.env.SUPABASE_PRIVATE_BUCKET ?? "private-assets", process.env.SUPABASE_PUBLIC_BUCKET ?? "public-assets"];

/** Tutti i file sotto `<cartella>/<userId>` in un bucket (ricorsivo, fino a 5 livelli). */
export async function listFolder(supabase: SupabaseClient, bucketName: string, prefix: string): Promise<StorageFile[]> {
  const bucket = supabase.storage.from(bucketName);
  const out: StorageFile[] = [];
  const collect = async (dir: string, depth: number) => {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await bucket.list(dir, { limit: 1000, offset });
      if (error) throw error;
      for (const entry of data ?? []) {
        const path = `${dir}/${entry.name}`;
        // Nelle liste di Supabase una cartella non ha id.
        if (entry.id === null && depth < 5) await collect(path, depth + 1);
        else out.push({ bucket: bucketName, path, size: Number((entry.metadata as { size?: number } | null)?.size ?? 0) });
      }
      if ((data?.length ?? 0) < 1000) break;
    }
  };
  await collect(prefix, 0);
  return out;
}

/** I file di `userId` nelle cartelle date, in entrambi i bucket. Gli errori per cartella tornano a parte. */
export async function listUserFiles(userId: string, folders: readonly string[]): Promise<{ files: StorageFile[]; errors: string[] }> {
  const supabase = storageClient();
  const files: StorageFile[] = [];
  const errors: string[] = [];
  for (const bucketName of storageBuckets()) {
    for (const folder of folders) {
      try {
        files.push(...(await listFolder(supabase, bucketName, `${folder}/${userId}`)));
      } catch (err) {
        errors.push(`${bucketName}/${folder}: ${(err as Error).message}`);
      }
    }
  }
  return { files, errors };
}
