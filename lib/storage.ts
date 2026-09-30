import "server-only";
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { supabaseUrl } from "@/lib/supabase/server";

const BUCKET = "invoices";
const LOCAL_DIR = path.join(process.cwd(), ".uploads");

function secretKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function admin() {
  const url = supabaseUrl();
  const key = secretKey();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isLocalMode() {
  return !admin() && process.env.DEV_AUTH === "true" && !process.env.VERCEL;
}

export async function uploadInvoicePdf(objectPath: string, file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  if (isLocalMode()) {
    const target = path.join(LOCAL_DIR, objectPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
    return;
  }
  const client = admin();
  if (!client) throw new Error("Filuppladdning är inte konfigurerad (SUPABASE_SECRET_KEY saknas).");
  const { error } = await client.storage
    .from(BUCKET)
    .upload(objectPath, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Uppladdningen misslyckades: ${error.message}`);
}

export async function removeInvoicePdf(objectPath: string) {
  if (isLocalMode()) {
    await fs.rm(path.join(LOCAL_DIR, objectPath), { force: true });
    return;
  }
  await admin()?.storage.from(BUCKET).remove([objectPath]);
}

/** Returnerar antingen en tidsbegränsad länk (Supabase) eller filinnehållet (lokalt). */
export async function getInvoicePdf(
  objectPath: string,
): Promise<{ url: string } | { bytes: Buffer } | null> {
  if (isLocalMode()) {
    try {
      return { bytes: await fs.readFile(path.join(LOCAL_DIR, objectPath)) };
    } catch {
      return null;
    }
  }
  const client = admin();
  if (!client) return null;
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(objectPath, 60);
  if (error || !data) return null;
  return { url: data.signedUrl };
}
