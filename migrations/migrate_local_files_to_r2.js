#!/usr/bin/env node

/**
 * Migrate local/public file links stored in MongoDB documents to Cloudflare R2 links.
 *
 * Behavior:
 * - Loads all models from ../models
 * - Scans all documents recursively for string values that look like file links
 * - Matches files by exact filename in public/ or public/junk/
 * - Uploads matched files to R2 at uploads/<filename>
 * - Replaces the original DB value with R2 public URL
 *
 * Usage:
 *   node migrations/migrate_local_files_to_r2.js --dry-run
 *   node migrations/migrate_local_files_to_r2.js --execute
 *   node migrations/migrate_local_files_to_r2.js --test
 */

require("dotenv").config();

const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const mongoose = require("mongoose");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/webmedigital";
const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const PUBLIC_JUNK_DIR = path.resolve(PUBLIC_DIR, "junk");

const args = new Set(process.argv.slice(2));
const testMode = args.has("--test");
const dryRun = args.has("--dry-run") || (!args.has("--execute") && !testMode);

const ALLOWED_EXT = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".ico", ".jfif", ".bmp", ".tif", ".tiff", ".avif",
  ".mp4", ".mov", ".avi", ".webm", ".m4v", ".mkv", ".wmv",
]);

function getR2Client() {
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

function getR2PublicUrl(key) {
  // If a custom domain is configured, prefer it. Otherwise fall back
  // to the Cloudflare-account-provided S3-compatible hostname.
  if (process.env.CLOUDFLARE_R2_CUSTOM_DOMAIN) {
    return `https://${process.env.CLOUDFLARE_R2_CUSTOM_DOMAIN}/${key}`;
  }

  if (!process.env.CLOUDFLARE_R2_ACCOUNT_ID) {
    throw new Error("CLOUDFLARE_R2_CUSTOM_DOMAIN and CLOUDFLARE_R2_ACCOUNT_ID are missing in environment variables");
  }

  return `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

function getMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".jfif": "image/jpeg",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".avif": "image/avif",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".webm": "video/webm",
    ".m4v": "video/x-m4v",
    ".mkv": "video/x-matroska",
    ".wmv": "video/x-ms-wmv",
  };
  return map[ext] || "application/octet-stream";
}

function normalizeUrl(value) {
  return String(value || "").trim();
}

function decodePathnameSafe(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function extractCandidateFilename(value) {
  const raw = normalizeUrl(value);
  if (!raw) return null;

  // Skip already-migrated or non-file payloads
  if (raw.startsWith("data:")) return null;
  if (raw.includes("r2.cloudflarestorage.com")) return null;
  if (process.env.CLOUDFLARE_R2_CUSTOM_DOMAIN && raw.includes(process.env.CLOUDFLARE_R2_CUSTOM_DOMAIN)) return null;

  let fileName = null;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const pathnameDecoded = decodePathnameSafe(parsed.pathname || "");
      fileName = path.basename(pathnameDecoded);
    } catch {
      return null;
    }
  } else {
    const noQuery = raw.split("?")[0].split("#")[0];
    fileName = path.basename(noQuery);
  }

  if (!fileName || fileName === "/" || fileName === ".") return null;

  const ext = path.extname(fileName).toLowerCase();
  if (!ext || !ALLOWED_EXT.has(ext)) return null;

  return fileName;
}

async function resolveLocalFilePath(fileName) {
  const primary = path.resolve(PUBLIC_DIR, fileName);
  const fallback = path.resolve(PUBLIC_JUNK_DIR, fileName);

  try {
    await fsp.access(primary);
    return primary;
  } catch {
    // no-op
  }

  try {
    await fsp.access(fallback);
    return fallback;
  } catch {
    return null;
  }
}

function walkStringPaths(node, currentPath = [], out = []) {
  if (typeof node === "string") {
    out.push({ path: currentPath, value: node });
    return out;
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      walkStringPaths(node[i], [...currentPath, i], out);
    }
    return out;
  }

  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      walkStringPaths(value, [...currentPath, key], out);
    }
  }

  return out;
}

function toMongoosePath(pathSegments) {
  return pathSegments.map((x) => String(x)).join(".");
}

async function uploadToR2(localFilePath, fileName, s3Client) {
  const key = `uploads/${fileName}`;
  const contentType = getMimeType(fileName);

  const cmd = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    Body: fs.createReadStream(localFilePath),
    ContentType: contentType,
  });

  await s3Client.send(cmd);
  return getR2PublicUrl(key);
}

async function verifyPublicUrl(url) {
  try {
    const response = await fetch(url, { method: "HEAD", timeout: 5000 });
    return response.ok;
  } catch (err) {
    // Network error, DNS failure, timeout — log but don't throw
    console.warn(`  [Verify] HEAD ${url} failed: ${err.message}`);
    return false;
  }
}

async function loadAllModels() {
  const modelsDir = path.resolve(__dirname, "../models");
  const files = await fsp.readdir(modelsDir);
  const modelFiles = files.filter((f) => f.endsWith(".js"));

  for (const modelFile of modelFiles) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    require(path.join(modelsDir, modelFile));
  }
}

async function main() {
  if (!process.env.CLOUDFLARE_R2_BUCKET_NAME) {
    throw new Error("CLOUDFLARE_R2_BUCKET_NAME is missing");
  }

  console.log(`Mode: ${dryRun ? "DRY RUN" : "EXECUTE"}`);
  if (testMode) {
    console.log("Test mode: will upload only one file and exit after printing the public URL");
  }
  console.log(`Mongo URI: ${MONGO_URI}`);
  console.log(`Public dir: ${PUBLIC_DIR}`);

  await mongoose.connect(MONGO_URI);
  await loadAllModels();

  // Avoid creating an S3 client when doing a dry-run to allow running
  // the dry-run without valid R2 credentials. Real uploads still require creds.
  const s3Client = dryRun ? null : getR2Client();
  const modelNames = mongoose.modelNames();
  const uploadCache = new Map(); // filename -> r2 url

  const summary = {
    modelsProcessed: 0,
    docsScanned: 0,
    docsChanged: 0,
    dbFieldsUpdated: 0,
    filesUploaded: 0,
    localFilesMissing: 0,
    skippedNonFileValues: 0,
    skippedAlreadyMigrated: 0,
    uploadErrors: 0,
  };

  for (const modelName of modelNames) {
    const Model = mongoose.model(modelName);
    summary.modelsProcessed += 1;
    console.log(`\n[Model] ${modelName}`);

    const cursor = Model.find({}).cursor();

    for await (const doc of cursor) {
      summary.docsScanned += 1;

      const snapshot = doc.toObject({ depopulate: true });
      const stringValues = walkStringPaths(snapshot);

      let docDirty = false;

      for (const entry of stringValues) {
        const raw = normalizeUrl(entry.value);

        // Check if already migrated (already points to R2 or custom domain)
        if (raw.includes("r2.cloudflarestorage.com") ||
          (process.env.CLOUDFLARE_R2_CUSTOM_DOMAIN && raw.includes(process.env.CLOUDFLARE_R2_CUSTOM_DOMAIN))) {
          summary.skippedAlreadyMigrated += 1;
          continue;
        }

        const fileName = extractCandidateFilename(entry.value);
        if (!fileName) {
          summary.skippedNonFileValues += 1;
          continue;
        }

        let r2Url = uploadCache.get(fileName);

        if (!r2Url) {
          const localFilePath = await resolveLocalFilePath(fileName);
          if (!localFilePath) {
            summary.localFilesMissing += 1;
            continue;
          }

          if (dryRun) {
            r2Url = `DRY_RUN::${getR2PublicUrl(`uploads/${fileName}`)}`;
          } else {
            try {
              r2Url = await uploadToR2(localFilePath, fileName, s3Client);
              summary.filesUploaded += 1;

              // Verify file is publicly accessible before updating DB
              const publicUrlOk = await verifyPublicUrl(r2Url);
              if (testMode) {
                console.log(`\n[Test] Uploaded file: ${fileName}`);
                console.log(`[Test] Public URL: ${r2Url}`);
                console.log(`[Test] Public URL accessible: ${publicUrlOk ? "YES" : "NO"}`);

                await mongoose.disconnect();
                process.exit(publicUrlOk ? 0 : 2);
              }

              if (!publicUrlOk) {
                console.warn(`  [Verify] File uploaded but not yet accessible: ${fileName}`);
                console.warn(`  [Verify] Skipping DB update for this file; you may need to retry after DNS propagation.`);
                continue;
              }
            } catch (err) {
              summary.uploadErrors += 1;
              console.error(`  Upload failed for ${fileName}: ${err.message}`);
              if (process.env.DEBUG) console.error(err.stack);
              continue;
            }
          }

          uploadCache.set(fileName, r2Url);
        }

        const finalUrl = dryRun ? r2Url.replace(/^DRY_RUN::/, "") : r2Url;

        if (entry.value !== finalUrl) {
          const mongoosePath = toMongoosePath(entry.path);
          doc.set(mongoosePath, finalUrl);
          summary.dbFieldsUpdated += 1;
          docDirty = true;
        }
      }

      if (docDirty) {
        summary.docsChanged += 1;
        if (!dryRun) {
          // Skip validation since we're only updating URLs, not core fields
          await doc.save({ validateBeforeSave: false });
        }
      }
    }
  }

  console.log("\nMigration summary:");
  console.log(JSON.stringify(summary, null, 2));

  await mongoose.disconnect();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Migration failed:", err.message);
    try {
      await mongoose.disconnect();
    } catch {
      // no-op
    }
    process.exit(1);
  });
