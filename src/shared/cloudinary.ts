import { v2 as cloudinary } from "cloudinary";

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
    // Limitar tamaño máximo de salida para no desperdiciar storage
    transformation: [{ width: 800, height: 800, crop: "limit", quality: "auto" }],
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
