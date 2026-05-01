const express = require("express");
const multer = require("multer");
const { FileManager } = require("../helpers/FileManager.js");

const router = express.Router();
const upload = multer(); // memory storage by default

// POST /api/files/upload
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    // Save to junk temp
    const tempResult = await FileManager.Temp(req.file);
    return res.json({ url: tempResult.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/files/presigned-url
// Generate presigned URL for direct browser-to-R2 uploads
router.post("/presigned-url", express.json(), async (req, res) => {
  try {
    const { filename, contentType = "video/mp4", expiresIn = 3600 } = req.body;

    if (!filename) {
      return res.status(400).json({ error: "filename is required" });
    }

    // Validate video MIME type
    if (!contentType.startsWith("video/")) {
      return res.status(400).json({ error: "Only video files are supported for presigned uploads" });
    }

    // Generate unique filename with timestamp and UUID
    const { v4: uuidv4 } = require("uuid");
    const timestamp = Date.now();
    const ext = filename.split(".").pop();
    const uniqueFilename = `${timestamp}-${uuidv4()}-${filename.replace(/\.[^.]+$/, "")}.${ext}`;

    const presignedData = await FileManager.generatePresignedUrl(uniqueFilename, contentType, expiresIn);

    return res.json({
      success: true,
      presignedUrl: presignedData.presignedUrl,
      finalUrl: presignedData.finalUrl,
      uploadKey: presignedData.uploadKey,
      expiresIn: presignedData.expiresIn,
      message: "Use presignedUrl to upload directly to R2 using PUT method",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
