const path = require("path");
const { promises: fs } = require("fs");
const { v2: cloudinary } = require("cloudinary");
const { v4: uuidv4 } = require("uuid");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

class FileManager {
  static async normal(file) {
    // Use env to determine storage type
    const storageType = process.env.FILE_STORAGE_TYPE || "local";
    if (storageType === "cloudinary") {
      return await FileManager.cloudinary(file);
    } else if (storageType === "cloudflare-r2") {
      return await FileManager.cloudflareR2(file);
    } else {
      return await FileManager.local(file);
    }
  }

  static async local(file) {
    const junkDir = path.resolve(process.cwd(), "public", "junk");
    const publicDir = path.resolve(process.cwd(), "public");
    try {
      await fs.mkdir(publicDir, { recursive: true });
    } catch { }
    // Extract filename from url
    const urlParts = file.url.split("/");
    const filename = urlParts[urlParts.length - 1];
    const junkPath = path.join(junkDir, filename);
    const destPath = path.join(publicDir, filename);
    // Check if file exists in junk
    try {
      await fs.access(junkPath);
    } catch {
      throw new Error("File not found in junk directory");
    }
    // Move file from junk to public
    await fs.rename(junkPath, destPath);
    return { url: `${process.env.Current_Url}/${filename}` };
  }

  static async Temp(file) {
    const uploadDir = path.resolve(process.cwd(), "public", "junk");
    try {
      await fs.mkdir(uploadDir, { recursive: true });
    } catch { }
    const uniqueName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
    const filePath = path.join(uploadDir, uniqueName);
    await fs.writeFile(filePath, file.buffer);
    return { url: `${process.env.Current_Url}/junk/${uniqueName}` };
  }

  static async cloudinary(file) {
    // file: { url } expected from junk
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error("Cloudinary credentials missing in environment variables");
    }
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const junkDir = path.resolve(process.cwd(), "public", "junk");
    // Extract filename from url
    const urlParts = file.url.split("/");
    const filename = urlParts[urlParts.length - 1];
    const junkPath = path.join(junkDir, filename);
    // Check if file exists in junk
    let fileBuffer;
    try {
      fileBuffer = await fs.readFile(junkPath);
    } catch {
      throw new Error("File not found in junk directory");
    }
    // Upload to cloudinary
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "auto",
          folder: "uploads",
        },
        async (error, result) => {
          // Delete from junk after upload attempt
          await fs.unlink(junkPath).catch(() => { });
          if (error) return reject(error);
          resolve({ url: result.secure_url });
        }
      );
      stream.end(fileBuffer);
    });
  }

  static getR2Client() {
    if (
      !process.env.CLOUDFLARE_R2_ACCOUNT_ID ||
      !process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
      !process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    ) {
      throw new Error("Cloudflare R2 credentials missing in environment variables");
    }

    return new S3Client({
      region: "auto",
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
      endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    });
  }

  static getR2PublicUrl(key) {
    if (process.env.CLOUDFLARE_R2_CUSTOM_DOMAIN) {
      return `https://${process.env.CLOUDFLARE_R2_CUSTOM_DOMAIN}/${key}`;
    }
    else{
      throw new Error("CLOUDFLARE_R2_CUSTOM_DOMAIN missing in environment variables for public URL generation");
    }
  }

  static async cloudflareR2(file) {
    // file: { url } expected from junk
    // Validate R2 credentials
    if (!process.env.CLOUDFLARE_R2_BUCKET_NAME) {
      throw new Error("CLOUDFLARE_R2_BUCKET_NAME missing in environment variables");
    }

    const junkDir = path.resolve(process.cwd(), "public", "junk");
    // Extract filename from url
    const urlParts = file.url.split("/");
    const filename = urlParts[urlParts.length - 1];
    const junkPath = path.join(junkDir, filename);

    // Check if file exists in junk
    let fileBuffer;
    try {
      fileBuffer = await fs.readFile(junkPath);
    } catch {
      throw new Error("File not found in junk directory");
    }

    const s3Client = FileManager.getR2Client();
    const uploadKey = `uploads/${filename}`;

    try {
      // Upload to R2
      const command = new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: uploadKey,
        Body: fileBuffer,
        ContentType: file.mimetype || "application/octet-stream",
      });

      await s3Client.send(command);

      // Delete from junk after successful upload
      await fs.unlink(junkPath).catch(() => { });

      return { url: FileManager.getR2PublicUrl(uploadKey) };
    } catch (error) {
      // Delete from junk on error
      await fs.unlink(junkPath).catch(() => { });
      throw new Error(`R2 upload failed: ${error.message}`);
    }
  }

  static async generatePresignedUrl(filename, contentType = "video/mp4", expiresIn = 3600) {
    // Generate presigned URL for direct browser upload to R2
    if (!process.env.CLOUDFLARE_R2_BUCKET_NAME) {
      throw new Error("CLOUDFLARE_R2_BUCKET_NAME missing in environment variables");
    }

    const s3Client = FileManager.getR2Client();
    const uploadKey = `uploads/${filename}`;

    try {
      const command = new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: uploadKey,
        ContentType: contentType,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });

      return {
        presignedUrl,
        finalUrl: FileManager.getR2PublicUrl(uploadKey),
        uploadKey,
        expiresIn,
      };
    } catch (error) {
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  static async delete(fileUrl) {
    if (!fileUrl) throw new Error("No file URL provided");
    const isLocal = fileUrl.includes(process.env.Current_Url);
    const isR2 = fileUrl.includes("r2.cloudflarestorage.com") ||
      (process.env.CLOUDFLARE_R2_CUSTOM_DOMAIN && fileUrl.includes(process.env.CLOUDFLARE_R2_CUSTOM_DOMAIN));

    if (isLocal) {
      // Local file: extract filename and delete from public dir
      const urlParts = fileUrl.split("/");
      const filename = urlParts[urlParts.length - 1];
      const publicDir = path.resolve(process.cwd(), "public");
      const filePath = path.join(publicDir, filename);
      try {
        await fs.unlink(filePath);
        return { success: true, message: "Deleted from local storage" };
      } catch (err) {
        if (err.code === "ENOENT") {
          return { success: false, message: "File not found in local storage" };
        }
        throw err;
      }
    } else if (isR2) {
      // Cloudflare R2 file: extract key and delete
      if (
        !process.env.CLOUDFLARE_R2_ACCOUNT_ID ||
        !process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
        !process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
        !process.env.CLOUDFLARE_R2_BUCKET_NAME
      ) {
        throw new Error("Cloudflare R2 credentials missing in environment variables");
      }

      // Extract the key from URL
      const uploadsIdx = fileUrl.indexOf("/uploads/");
      if (uploadsIdx === -1) {
        throw new Error("Not a recognized R2 uploads URL");
      }
      const fileKey = fileUrl.substring(uploadsIdx + 1); // after first '/'

      try {
        const s3Client = FileManager.getR2Client();
        const command = new DeleteObjectCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
          Key: fileKey,
        });

        await s3Client.send(command);

        return {
          success: true,
          message: "Deleted from Cloudflare R2",
        };
      } catch (err) {
        throw new Error("Cloudflare R2 delete error: " + err.message);
      }
    } else {
      // Cloudinary file: extract public_id and delete
      const uploadsIdx = fileUrl.indexOf("/uploads/");
      if (uploadsIdx === -1) {
        throw new Error("Not a recognized Cloudinary uploads URL");
      }
      let publicIdWithExt = fileUrl.substring(uploadsIdx + 9); // after '/uploads/'
      // Remove extension
      const dotIdx = publicIdWithExt.lastIndexOf(".");
      const publicId =
        dotIdx !== -1 ? publicIdWithExt.substring(0, dotIdx) : publicIdWithExt;
      if (
        !process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET
      ) {
        throw new Error("Cloudinary credentials missing in environment variables");
      }
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      try {
        const result = await cloudinary.uploader.destroy(
          `uploads/${publicId}`,
          { resource_type: "auto" }
        );
        if (result.result === "ok" || result.result === "not found") {
          return {
            success: true,
            message: `Deleted from Cloudinary: ${result.result}`,
          };
        } else {
          return {
            success: false,
            message: `Cloudinary delete failed: ${result.result}`,
          };
        }
      } catch (err) {
        throw new Error("Cloudinary delete error: " + err.message);
      }
    }
  }
}

module.exports = { FileManager };
