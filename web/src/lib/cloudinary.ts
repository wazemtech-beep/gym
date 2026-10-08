import { v2 as cloudinary } from "cloudinary";

export function ensureCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  } else if (process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloudinary_url: process.env.CLOUDINARY_URL,
      secure: true,
    });
  }
  return cloudinary;
}

ensureCloudinaryConfig();

export { cloudinary };

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  width?: number;
  height?: number;
  bytes: number;
}

/**
 * Upload a file buffer or base64 data to Cloudinary under a specified folder
 */
export async function uploadToCloudinary(
  fileBufferOrDataUri: Buffer | string,
  options: {
    folder?: string;
    publicId?: string;
    transformation?: any[];
    resourceType?: "image" | "raw" | "auto";
    deliveryType?: "upload" | "authenticated";
  } = {}
): Promise<CloudinaryUploadResult> {
  ensureCloudinaryConfig();
  const { folder = "oxgen-gym", publicId, transformation, resourceType = "auto" } = options;

  return new Promise((resolve, reject) => {
    const uploadStreamOptions: any = {
      folder,
      resource_type: resourceType,
      type: options.deliveryType || "upload",
      ...(publicId ? { public_id: publicId } : {}),
      ...(transformation ? { transformation } : {}),
    };

    if (Buffer.isBuffer(fileBufferOrDataUri)) {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadStreamOptions,
        (error, result) => {
          if (error || !result) {
            console.error("CLOUDINARY_STREAM_UPLOAD_ERROR:", error);
            return reject(error || new Error("Cloudinary upload failed"));
          }
          resolve({
            url: result.url,
            secureUrl: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
          });
        }
      );
      uploadStream.end(fileBufferOrDataUri);
    } else {
      // Data URI or remote URL
      cloudinary.uploader
        .upload(fileBufferOrDataUri, uploadStreamOptions)
        .then((result) => {
          resolve({
            url: result.url,
            secureUrl: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
          });
        })
        .catch((err) => {
          console.error("CLOUDINARY_UPLOAD_ERROR:", err);
          reject(err);
        });
    }
  });
}

/**
 * Delete an asset from Cloudinary by its public ID
 */
export async function deleteFromCloudinary(publicId: string, deliveryType: "upload" | "authenticated" = "upload"): Promise<boolean> {
  ensureCloudinaryConfig();
  try {
    const result = await cloudinary.uploader.destroy(publicId, { type: deliveryType, invalidate: true });
    return result.result === "ok" || result.result === "not found";
  } catch (err) {
    console.error("CLOUDINARY_DELETE_ERROR:", err);
    return false;
  }
}
