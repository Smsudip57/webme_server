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

module.exports = router;
