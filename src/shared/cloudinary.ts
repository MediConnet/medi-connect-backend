import { v2 as cloudinary } from "cloudinary";
import * as path from "path";
import { randomUUID } from "crypto";
import { Readable } from "stream";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Sube una imagen (base64 o URL) a Cloudinary y retorna la URL pública.
 * @param image  base64 data URI  o  URL https://...
 * @param folder carpeta dentro de Cloudinary (ej: "providers", "clinics")
 */
export async function uploadImageToCloudinary(
  image: string,
  folder = "medi-connect",
): Promise<string> {
  if (!image) throw new Error("No image provided");

  const result = await cloudinary.uploader.upload(image, {
    folder,
    resource_type: "image",
    transformation: [{ width: 800, height: 800, crop: "limit", quality: "auto" }],
  });

  return result.secure_url;
}

/**
 * Sube una imagen de perfil (avatar) a Cloudinary optimizada para 400x400 1:1.
 */
export async function uploadAvatarToCloudinary(
  image: string,
  folder = "medi-connect/avatars",
): Promise<string> {
  if (!image) throw new Error("No image provided");

  const result = await cloudinary.uploader.upload(image, {
    folder,
    resource_type: "image",
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face", quality: "auto", fetch_format: "auto" },
    ],
  });

  return result.secure_url;
}

/**
 * Sube una imagen de vista previa a Cloudinary optimizada para 800x400 2:1.
 */
export async function uploadPreviewToCloudinary(
  image: string,
  folder = "medi-connect/previews",
): Promise<string> {
  if (!image) throw new Error("No image provided");

  const result = await cloudinary.uploader.upload(image, {
    folder,
    resource_type: "image",
    transformation: [
      { width: 800, height: 400, crop: "fill", quality: "auto", fetch_format: "auto" },
    ],
  });

  return result.secure_url;
}

/**
 * Determina si el valor es una imagen que debe subirse a Cloudinary.
 * Retorna true para base64, false para URLs ya alojadas o valores vacíos.
 */
export function isBase64Image(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("data:image/");
}

/**
 * Retorna true si el valor es un blob URL temporal (no persistible).
 * Los blob URLs solo existen en el navegador que los creó y no deben guardarse en DB.
 */
export function isBlobUrl(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("blob:");
}

/**
 * Sube cualquier archivo (buffer) a Cloudinary y retorna la URL segura.
 * Soporta imágenes, PDFs, etc.
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  mimetype: string,
  folder = "medi-connect/documents",
  filename?: string
): Promise<string> {
  const isImage = mimetype.startsWith("image/");
  
  if (isImage) {
    // Para imágenes, podemos seguir usando la subida directa con base64 Data URI
    const base64 = buffer.toString("base64");
    const dataURI = `data:${mimetype};base64,${base64}`;
    const result = await cloudinary.uploader.upload(dataURI, {
      folder,
      resource_type: "image",
    });
    return result.secure_url;
  } else {
    // Para archivos raw (PDFs, docs), debemos subir usando stream para evitar que
    // se guarde el string base64 en texto plano y corrompa el archivo binario.
    const isPdf = mimetype === "application/pdf";
    let ext = "";
    if (filename) {
      ext = path.extname(filename);
    } else if (isPdf) {
      ext = ".pdf";
    }
    const publicId = `${randomUUID()}${ext}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "raw",
          public_id: publicId,
        },
        (error, result) => {
          if (error) {
            console.error("❌ [CLOUDINARY] Error in upload_stream callback:", error);
            return reject(error);
          }
          resolve(result!.secure_url);
        }
      );

      // Convert buffer directly to readable stream using standard stream adapter
      Readable.from(buffer).pipe(uploadStream);
    });
  }
}
