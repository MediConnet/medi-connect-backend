import Busboy from "busboy";
import { Readable } from "stream";

export type MultipartFile = {
  fieldname: string;
  filename: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

export type MultipartParseResult = {
  fields: Record<string, string | string[]>;
  files: MultipartFile[];
};

function pushField(
  acc: Record<string, string | string[]>,
  key: string,
  value: string,
) {
  const existing = acc[key];
  if (existing === undefined) {
    acc[key] = value;
    return;
  }
  if (Array.isArray(existing)) {
    existing.push(value);
    return;
  }
  acc[key] = [existing, value];
}

export function isMultipartContentType(contentType?: string): boolean {
  if (!contentType) return false;
  return contentType.toLowerCase().includes("multipart/form-data");
}

export async function parseMultipartBody(params: {
  body: string | undefined;
  isBase64Encoded: boolean | undefined;
  headers: Record<string, string | undefined>;
  limits?: { fileSize?: number; files?: number; fields?: number };
}): Promise<MultipartParseResult> {
  const { body, isBase64Encoded, headers, limits } = params;
  if (!body) return { fields: {}, files: [] };

  const contentType =
    headers["content-type"] ||
    headers["Content-Type"] ||
    headers["CONTENT-TYPE"] ||
    "";

  const buf = isBase64Encoded ? Buffer.from(body, "base64") : Buffer.from(body);

  const bb = Busboy({
    headers: {
      "content-type": contentType,
    },
    limits,
  });

  const fields: Record<string, string | string[]> = {};
  const files: MultipartFile[] = [];

  const done = new Promise<MultipartParseResult>((resolve, reject) => {
    bb.on("field", (name, val) => {
      pushField(fields, name, val);
    });

    bb.on("file", (name, stream, info) => {
      const chunks: Buffer[] = [];
      let size = 0;

      stream.on("data", (d: Buffer) => {
        chunks.push(d);
        size += d.length;
      });
      stream.on("limit", () => {
        // Busboy will emit 'error' if fileSize limit exceeded in some cases,
        // but we keep collecting and let caller decide.
      });
      stream.on("error", reject);
      stream.on("end", () => {
        files.push({
          fieldname: name,
          filename: info.filename || "file",
          encoding: info.encoding,
          mimetype: info.mimeType,
          buffer: Buffer.concat(chunks),
          size,
        });
      });
    });

    bb.on("error", reject);
    bb.on("finish", () => resolve({ fields, files }));
  });

  Readable.from(buf).pipe(bb);
  return await done;
}

