import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

// Local-disk attachment storage behind a narrow interface — Phase 3 swaps
// this for cloud object storage (S3/Blob) without touching call sites in
// lib/claims.ts or the claim detail page.
const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export type StoredFile = {
  storagePath: string;
  filename: string;
  mimeType: string;
  size: number;
};

export async function saveAttachment(file: File): Promise<StoredFile> {
  await mkdir(UPLOAD_ROOT, { recursive: true });
  const ext = path.extname(file.name);
  const storedName = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_ROOT, storedName), buffer);
  return {
    storagePath: storedName,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    size: buffer.length,
  };
}

export async function readAttachment(storagePath: string): Promise<Buffer> {
  return readFile(path.join(UPLOAD_ROOT, storagePath));
}
