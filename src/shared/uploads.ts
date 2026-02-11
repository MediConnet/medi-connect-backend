import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

export type StoredDocument = {
  id: string;
  name: string;
  type: "pdf" | "image" | "other";
  url: string;
  category: "licenses" | "certificates" | "titles" | "other";
  mimeType: string;
  size: number;
  createdAt: string;
};

function inferDocType(mimeType: string): StoredDocument["type"] {
  const mt = (mimeType || "").toLowerCase();
  if (mt === "application/pdf") return "pdf";
  if (mt.startsWith("image/")) return "image";
  return "other";
}

function inferCategory(fieldname: string): StoredDocument["category"] {
  const f = (fieldname || "").toLowerCase();
  if (f.includes("license")) return "licenses";
  if (f.includes("certificate")) return "certificates";
  if (f.includes("title")) return "titles";
  return "other";
}

export async function storeFilesLocally(params: {
  files: Array<{
    fieldname: string;
    filename: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
  }>;
  baseUrl?: string; // e.g. http://localhost:3000
}): Promise<StoredDocument[]> {
  const { files, baseUrl } = params;
  if (!files.length) return [];

  const uploadsDir = path.join(process.cwd(), "uploads");
  await fs.promises.mkdir(uploadsDir, { recursive: true });

  const nowIso = new Date().toISOString();

  const stored: StoredDocument[] = [];
  for (const f of files) {
    const id = randomUUID();
    const safeName = f.filename.replace(/[^\w.\-() ]+/g, "_");
    const ext = path.extname(safeName);
    const basename = path.basename(safeName, ext);
    const storedName = `${basename}-${id}${ext || ""}`;
    const diskPath = path.join(uploadsDir, storedName);

    await fs.promises.writeFile(diskPath, f.buffer);

    const urlPath = `/uploads/${encodeURIComponent(storedName)}`;
    const url = baseUrl ? `${baseUrl}${urlPath}` : urlPath;

    stored.push({
      id,
      name: f.filename,
      type: inferDocType(f.mimetype),
      url,
      category: inferCategory(f.fieldname),
      mimeType: f.mimetype,
      size: f.size,
      createdAt: nowIso,
    });
  }

  return stored;
}

