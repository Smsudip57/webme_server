const path = require("path");
const { promises: fs } = require("fs");
const { v2: cloudinary } = require("cloudinary");
const { v4: uuidv4 } = require("uuid");

class FileManager {
  static async normal(file) {
    // Use env to determine storage type
    const storageType = process.env.FILE_STORAGE_TYPE || "local";
    if (storageType === "cloudinary") {
      return await FileManager.cloudinary(file);
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

  static async delete(fileUrl) {
    if (!fileUrl) throw new Error("No file URL provided");
    const isLocal = fileUrl.includes(process.env.Current_Url);
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
