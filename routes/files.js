import express from "express";
import multer from "multer";
import { FileManager } from "../helpers/FileManager.js";

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

export default router;
