const express = require("express");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const User = require("../models/user");
const Service = require("../models/service");
const ParentService = require("../models/Parentservice");
const ChildService = require("../models/childService");
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const UPLOAD_DIR = path.join(process.cwd(), "public");
const Project = require("../models/project");
const formidable = require("formidable");
const Blog = require("../models/blog");
const KnowledgeBase = require("../models/knowledgebase");
const Faq = require("../models/faq");
const ServiceDetails = require("../models/servicedetails");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const getImageUrl = (filename) => `${process.env.Current_Url}/${filename}`;

const upload = multer({ storage });

// Image upload endpoint
router.post("/upload/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    // Get the image URL using the existing function
    const imageUrl = getImageUrl(req.file.filename);

    return res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      imageUrl: imageUrl,
      filename: req.file.filename,
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    return res.status(500).json({
      success: false,
      message: "Error uploading image",
      error: error.message,
    });
  }
});

router.post(
  "/service/createservice",
  upload.single("image"),
  async (req, res) => {
    try {
      const { Title, Name, detail, moreDetail, category, slug } = req.body;
      const file = req.file;

      if (
        !Title ||
        !Name ||
        !detail ||
        !moreDetail ||
        !category ||
        !file ||
        !slug
      ) {
        return res
          .status(400)
          .json({ success: false, message: "All fields are required" });
      }

      // Validate slug format
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res.status(400).json({
          success: false,
          message:
            "Slug must be lowercase, containing only letters, numbers, and hyphens",
        });
      }

      // Check if slug already exists
      const existingService = await Service.findOne({ slug });
      if (existingService) {
        return res.status(400).json({
          success: false,
          message:
            "A service with this slug already exists. Please use a unique slug.",
        });
      }

      const imageUrl = getImageUrl(file.filename);
      console.log(imageUrl);
      const newService = new Service({
        Title,
        Name,
        slug,
        deltail: detail,
        moreDetail,
        category,
        image: imageUrl,
      });

      await newService.save();

      return res.status(200).json({
        success: true,
        message: "Service created successfully",
        service: newService,
      });
    } catch (error) {
      console.error("Error creating service:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.use("/service/deleteservice", express.json());

router.post("/service/deleteservice", async (req, res) => {
  try {
    const { serviceId } = req.body;
    if (!serviceId) {
      return res.status(400).json({
        success: false,
        message: "Service ID is required",
      });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    if (service.image) {
      const imagePath = path.join(
        process.cwd(),
        "public",
        service.image.split("/").pop()
      );
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error(`Error deleting image file: ${err.message}`);
        }
      });
    }

    await Service.findByIdAndDelete(serviceId);

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting service:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while deleting the service",
    });
  }
});
router.post(
  "/service/editservice",
  upload.single("image"),
  async (req, res) => {
    try {
      const { serviceId, Title, Name, deltail, moreDetail, category, slug } =
        req.body;
      const file = req.file;

      if (
        !serviceId ||
        !Title ||
        !Name ||
        !deltail ||
        !category ||
        !moreDetail ||
        !slug
      ) {
        return res.status(400).json({
          success: false,
          message: "All fields are required.",
        });
      }

      // Validate slug format
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res.status(400).json({
          success: false,
          message:
            "Slug must be lowercase, containing only letters, numbers, and hyphens",
        });
      }

      const service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: "Service not found.",
        });
      }

      // Check if slug already exists and belongs to a different service
      if (service.slug !== slug) {
        const existingService = await Service.findOne({ slug });
        if (existingService && existingService._id.toString() !== serviceId) {
          return res.status(400).json({
            success: false,
            message:
              "A service with this slug already exists. Please use a unique slug.",
          });
        }
      }

      service.Title = Title;
      service.Name = Name;
      service.slug = slug;
      service.deltail = deltail;
      service.category = category;
      service.moreDetail = moreDetail;

      if (file) {
        if (service.image) {
          const imagePath = path.join(
            process.cwd(),
            "public",
            service.image.split("/").pop()
          );
          try {
            if (fs.existsSync(imagePath)) {
              fs.unlinkSync(imagePath);
            }
          } catch (err) {
            console.error("Error deleting old image:", err);
          }
        }

        const imageUrl = getImageUrl(file.filename);
        service.image = imageUrl;
      }

      await service.save();

      return res.status(200).json({
        success: true,
        message: "Service updated successfully.",
        service: service,
      });
    } catch (error) {
      console.error("Error updating service:", error);
      return res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again.",
      });
    }
  }
);

router.post("/project/create", async (req, res) => {
  try {
    const form = new formidable.IncomingForm({ multiples: true }); // Enable handling multiple files
    form.uploadDir = UPLOAD_DIR;
    form.keepExtensions = true;

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Formidable error:", err);
        return res
          .status(500)
          .json({ success: false, message: "Error parsing form data." });
      }

      // Extract basic fields
      const Title = Array.isArray(fields.Title)
        ? fields.Title[0]
        : fields.Title;
      const detail = Array.isArray(fields.detail)
        ? fields.detail[0]
        : fields.detail;
      const slug = Array.isArray(fields.slug) ? fields.slug[0] : fields.slug;
      const mediaType = Array.isArray(fields.mediaType)
        ? fields.mediaType[0]
        : fields.mediaType || "image";

      // Parse related items as arrays


      const relatedServices = ensureArray(fields.relatedServices);
      const relatedProducts = ensureArray(fields.relatedProducts);
      const relatedChikfdServices = ensureArray(fields.relatedChikfdServices);

      // Validate required fields
      const hasMediaFile = files.media && files.media[0];
      if (!Title || !detail || !hasMediaFile || !slug) {
        return res.status(400).json({
          success: false,
          message: "Title, detail, media file, and slug are required.",
        });
      }

      // Validate slug format
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res.status(400).json({
          success: false,
          message:
            "Slug must be lowercase, containing only letters, numbers, and hyphens",
        });
      }

      // Check if slug already exists
      const existingProject = await Project.findOne({ slug });
      if (existingProject) {
        return res.status(400).json({
          success: false,
          message:
            "A project with this slug already exists. Please use a unique slug.",
        });
      }

      // Validate that at least one related item is provided
      const totalRelatedItems =
        relatedServices.length +
        relatedProducts.length +
        relatedChikfdServices.length;
      if (totalRelatedItems === 0) {
        return res.status(400).json({
          success: false,
          message:
            "At least one related service, product, or child service is required.",
        });
      }

      // Validate related services exist (if any provided)
      if (relatedServices.length > 0) {
        for (const serviceId of relatedServices) {
          const serviceExists = await Service.findById(serviceId);
          if (!serviceExists) {
            return res.status(400).json({
              success: false,
              message: `Related service with ID ${serviceId} does not exist.`,
            });
          }
        }
      }

      // Validate related products exist (if any provided)
      if (relatedProducts.length > 0) {
        for (const productId of relatedProducts) {
          const productExists = await ParentService.findById(productId);
          if (!productExists) {
            return res.status(400).json({
              success: false,
              message: `Related product with ID ${productId} does not exist.`,
            });
          }
        }
      }

      // Validate related child services exist (if any provided)
      if (relatedChikfdServices.length > 0) {
        for (const childServiceId of relatedChikfdServices) {
          const childServiceExists = await ChildService.findById(
            childServiceId
          );
          if (!childServiceExists) {
            return res.status(400).json({
              success: false,
              message: `Related child service with ID ${childServiceId} does not exist.`,
            });
          }
        }
      }

      // Process media file
      const mediaFile = files.media[0];
      if (!mediaFile.filepath) {
        return res
          .status(400)
          .json({ success: false, message: "Media file upload failed." });
      }

      const mediaFilename = `${Date.now()}-${mediaFile.originalFilename}`;
      const mediaPath = path.join(form.uploadDir, mediaFilename);

      try {
        fs.renameSync(mediaFile.filepath, mediaPath);
      } catch (error) {
        console.error("Error moving media file:", error);
        return res
          .status(500)
          .json({ success: false, message: "Error saving media file." });
      }

      const mediaUrl = getImageUrl(mediaFilename);

      // Extract sections
      const sections = [];
      let sectionIndex = 0;

      while (fields[`section[${sectionIndex}][title]`]) {
        const title = Array.isArray(fields[`section[${sectionIndex}][title]`])
          ? fields[`section[${sectionIndex}][title]`][0]
          : fields[`section[${sectionIndex}][title]`];

        // Process section images (multiple)
        const sectionImages = [];
        const sectionImageFiles = files[`section[${sectionIndex}][image]`];

        if (sectionImageFiles) {
          // Ensure sectionImageFiles is always treated as an array
          const imageFilesArray = Array.isArray(sectionImageFiles)
            ? sectionImageFiles
            : [sectionImageFiles];

          for (const imageFile of imageFilesArray) {
            if (imageFile && imageFile.filepath) {
              const imageFilename = `${Date.now()}-${imageFile.originalFilename
                }`;
              const imagePath = path.join(form.uploadDir, imageFilename);

              try {
                fs.renameSync(imageFile.filepath, imagePath);
                sectionImages.push(getImageUrl(imageFilename));
              } catch (error) {
                console.error(
                  `Error moving section ${sectionIndex} image:`,
                  error
                );
                return res.status(500).json({
                  success: false,
                  message: `Error saving image for section ${sectionIndex}.`,
                });
              }
            }
          }
        }

        // Process points
        const points = [];
        let pointIndex = 0;

        while (
          fields[`section[${sectionIndex}][points][${pointIndex}][title]`]
        ) {
          const pointTitle = Array.isArray(
            fields[`section[${sectionIndex}][points][${pointIndex}][title]`]
          )
            ? fields[
            `section[${sectionIndex}][points][${pointIndex}][title]`
            ][0]
            : fields[`section[${sectionIndex}][points][${pointIndex}][title]`];

          const pointDetail = Array.isArray(
            fields[`section[${sectionIndex}][points][${pointIndex}][detail]`]
          )
            ? fields[
            `section[${sectionIndex}][points][${pointIndex}][detail]`
            ][0]
            : fields[`section[${sectionIndex}][points][${pointIndex}][detail]`];

          if (pointTitle && pointDetail) {
            points.push({
              title: pointTitle,
              detail: pointDetail,
            });
          }

          pointIndex++;
        }

        if (title && sectionImages.length > 0 && points.length > 0) {
          sections.push({
            title,
            image: sectionImages, // Now storing an array of image URLs
            points,
          });
        }

        sectionIndex++;
      }

      // Save project to database
      const newProject = new Project({
        Title,
        slug,
        detail,
        relatedServices,
        relatedProducts,
        relatedChikfdServices,
        media: {
          url: mediaUrl,
          type: mediaType,
        },
        section: sections,
      });

      try {
        await newProject.save();
        return res.status(201).json({
          success: true,
          message: "Project created successfully.",
        });
      } catch (saveError) {
        console.error("Error saving project to DB:", saveError);
        return res.status(500).json({
          success: false,
          message: "Failed to save project to the database.",
        });
      }
    });
  } catch (error) {
    console.error("Error creating project:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
});

router.post("/project/edit", async (req, res) => {
  try {
    const form = new formidable.IncomingForm({ multiples: true });
    form.uploadDir = UPLOAD_DIR;
    form.keepExtensions = true;

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Formidable error:", err);
        return res
          .status(500)
          .json({ success: false, message: "Error parsing form data." });
      }

      // Extract project ID
      const projectId = Array.isArray(fields._id) ? fields._id[0] : fields._id;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: "Project ID is required.",
        });
      }

      // Find existing project
      const existingProject = await Project.findById(projectId);
      if (!existingProject) {
        return res.status(404).json({
          success: false,
          message: "Project not found.",
        });
      }

      // Extract basic fields
      const Title = Array.isArray(fields.Title)
        ? fields.Title[0]
        : fields.Title;
      const detail = Array.isArray(fields.detail)
        ? fields.detail[0]
        : fields.detail;
      const slug = Array.isArray(fields.slug) ? fields.slug[0] : fields.slug;
      const mediaType = Array.isArray(fields.mediaType)
        ? fields.mediaType[0]
        : fields.mediaType || existingProject.media.type;

      const relatedServices = ensureArray(fields.relatedServices);
      const relatedProducts = ensureArray(fields.relatedProducts);
      const relatedChikfdServices = ensureArray(fields.relatedChikfdServices);

      if (!Title || !detail || !slug) {
        return res.status(400).json({
          success: false,
          message: "Title, detail, and slug are required.",
        });
      }

      // Validate slug format
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res.status(400).json({
          success: false,
          message:
            "Slug must be lowercase, containing only letters, numbers, and hyphens",
        });
      }

      // Check if slug already exists and belongs to a different project
      if (slug !== existingProject.slug) {
        const slugExists = await Project.findOne({
          slug,
          _id: { $ne: projectId },
        });
        if (slugExists) {
          return res.status(400).json({
            success: false,
            message:
              "A project with this slug already exists. Please use a unique slug.",
          });
        }
      }

      // Validate that at least one related item is provided
      const totalRelatedItems =
        relatedServices.length +
        relatedProducts.length +
        relatedChikfdServices.length;
      if (totalRelatedItems === 0) {
        return res.status(400).json({
          success: false,
          message:
            "At least one related service, product, or child service is required.",
        });
      }

      // Validate related services exist (if any provided)
      if (relatedServices.length > 0) {
        for (const serviceId of relatedServices) {
          const serviceExists = await Service.findById(serviceId);
          if (!serviceExists) {
            return res.status(400).json({
              success: false,
              message: `Related service with ID ${serviceId} does not exist.`,
            });
          }
        }
      }

      // Validate related products exist (if any provided)
      if (relatedProducts.length > 0) {
        for (const productId of relatedProducts) {
          const productExists = await ParentService.findById(productId);
          if (!productExists) {
            return res.status(400).json({
              success: false,
              message: `Related product with ID ${productId} does not exist.`,
            });
          }
        }
      }

      // Validate related child services exist (if any provided)
      if (relatedChikfdServices.length > 0) {
        for (const childServiceId of relatedChikfdServices) {
          const childServiceExists = await ChildService.findById(
            childServiceId
          );
          if (!childServiceExists) {
            return res.status(400).json({
              success: false,
              message: `Related child service with ID ${childServiceId} does not exist.`,
            });
          }
        }
      }

      // Update basic project fields
      existingProject.Title = Title;
      existingProject.slug = slug;
      existingProject.detail = detail;
      existingProject.relatedServices = relatedServices;
      existingProject.relatedProducts = relatedProducts;
      existingProject.relatedChikfdServices = relatedChikfdServices;

      // Process media file if provided
      if (files.media && files.media[0]) {
        const mediaFile = files.media[0];
        if (mediaFile.filepath) {
          const mediaFilename = `${Date.now()}-${mediaFile.originalFilename}`;
          const mediaPath = path.join(form.uploadDir, mediaFilename);

          try {
            // Delete old media file if it exists
            if (existingProject.media && existingProject.media.url) {
              const oldMediaPath = path.join(
                UPLOAD_DIR,
                existingProject.media.url.split("/").pop()
              );
              if (fs.existsSync(oldMediaPath)) {
                fs.unlinkSync(oldMediaPath);
              }
            }

            // Save new media file
            fs.renameSync(mediaFile.filepath, mediaPath);
            existingProject.media.url = getImageUrl(mediaFilename);
            existingProject.media.type = mediaType;
          } catch (error) {
            console.error("Error processing media file:", error);
            return res
              .status(500)
              .json({ success: false, message: "Error saving media file." });
          }
        }
      } else {
        // Update media type even if no new file is uploaded
        existingProject.media.type = mediaType;
      }

      // Process sections
      if (fields["section[0][title]"]) {
        const sections = [];
        let sectionIndex = 0;

        while (fields[`section[${sectionIndex}][title]`]) {
          const title = Array.isArray(fields[`section[${sectionIndex}][title]`])
            ? fields[`section[${sectionIndex}][title]`][0]
            : fields[`section[${sectionIndex}][title]`];

          // Process section images
          // Handle keeping existing images
          let sectionImages = [];

          // Get images to keep from existing section
          const keepImagesKeys = Object.keys(fields).filter((key) =>
            key.startsWith(`section[${sectionIndex}][keepImages]`)
          );

          for (const key of keepImagesKeys) {
            const imageUrl = Array.isArray(fields[key])
              ? fields[key][0]
              : fields[key];
            if (imageUrl) {
              sectionImages.push(imageUrl);
            }
          }

          // Process new uploaded images
          const sectionImageKeys = Object.keys(files).filter((key) =>
            key.startsWith(`section[${sectionIndex}][image]`)
          );

          for (const key of sectionImageKeys) {
            const imageFile = files[key];
            // Handle both single file and array of files
            const imageFiles = Array.isArray(imageFile)
              ? imageFile
              : [imageFile];

            for (const file of imageFiles) {
              if (file && file.filepath) {
                const imageFilename = `${Date.now()}-${file.originalFilename}`;
                const imagePath = path.join(form.uploadDir, imageFilename);

                try {
                  fs.renameSync(file.filepath, imagePath);
                  sectionImages.push(getImageUrl(imageFilename));
                } catch (error) {
                  console.error(`Error processing section image:`, error);
                  return res.status(500).json({
                    success: false,
                    message: `Error saving image for section ${sectionIndex}.`,
                  });
                }
              }
            }
          }

          // Process points for this section
          const points = [];
          let pointIndex = 0;

          while (
            fields[`section[${sectionIndex}][points][${pointIndex}][title]`]
          ) {
            const pointTitle = Array.isArray(
              fields[`section[${sectionIndex}][points][${pointIndex}][title]`]
            )
              ? fields[
              `section[${sectionIndex}][points][${pointIndex}][title]`
              ][0]
              : fields[
              `section[${sectionIndex}][points][${pointIndex}][title]`
              ];

            const pointDetail = Array.isArray(
              fields[`section[${sectionIndex}][points][${pointIndex}][detail]`]
            )
              ? fields[
              `section[${sectionIndex}][points][${pointIndex}][detail]`
              ][0]
              : fields[
              `section[${sectionIndex}][points][${pointIndex}][detail]`
              ];

            if (pointTitle && pointDetail) {
              points.push({
                title: pointTitle,
                detail: pointDetail,
              });
            }

            pointIndex++;
          }

          // Validate section has required fields
          if (title && sectionImages.length > 0 && points.length > 0) {
            sections.push({
              title,
              image: sectionImages,
              points,
            });
          } else {
            // Log what's missing for debugging
            const missing = [];
            if (!title) missing.push("title");
            if (sectionImages.length === 0) missing.push("images");
            if (points.length === 0) missing.push("points");

            console.warn(
              `Section ${sectionIndex} is missing required fields: ${missing.join(
                ", "
              )}`
            );
          }

          sectionIndex++;
        }

        // Replace sections if we have new ones
        if (sections.length > 0) {
          existingProject.section = sections;
        } else {
          return res.status(400).json({
            success: false,
            message:
              "At least one complete section with title, image, and points is required.",
          });
        }
      }

      try {
        await existingProject.save();
        return res.status(200).json({
          success: true,
          message: "Project updated successfully.",
          project: existingProject,
        });
      } catch (saveError) {
        console.error("Error saving updated project:", saveError);
        return res.status(500).json({
          success: false,
          message: "Failed to save project updates to the database.",
          error: saveError.message,
        });
      }
    });
  } catch (error) {
    console.error("Error updating project:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
});

router.use("/project/delete", express.json());

router.post("/project/delete", async (req, res) => {
  try {
    const { _id } = req.body;

    if (!_id) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required.",
      });
    }

    const project = await Project.findById(_id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    // Delete media files
    if (project.media && project.media.url) {
      const mediaPath = path.join(
        UPLOAD_DIR,
        project.media.url.split("/").pop()
      );
      if (fs.existsSync(mediaPath)) {
        try {
          fs.unlinkSync(mediaPath);
        } catch (error) {
          console.error("Error deleting project media file:", error);
        }
      }
    }

    if (project.section && project.section.length > 0) {
      for (const section of project.section) {
        if (section.image && Array.isArray(section.image)) {
          for (const imageUrl of section.image) {
            const sectionImagePath = path.join(
              UPLOAD_DIR,
              imageUrl.split("/").pop()
            );
            if (fs.existsSync(sectionImagePath)) {
              try {
                fs.unlinkSync(sectionImagePath);
              } catch (error) {
                console.error("Error deleting section image:", error);
              }
            }
          }
        }
      }
    }

    await project.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
});

router.post("/blog/create", upload.single("image"), async (req, res) => {
  try {
    const {
      type,
      title,
      description,
      contents,
      relatedServices,
      relatedIndustries,
      relatedProducts,
      relatedChikfdServices,
    } = req.body;
    const image = req.file ? getImageUrl(req.file.filename) : null;

    // Check required fields
    if (!type || !title || !description || !contents || !image) {
      return res.status(400).json({
        success: false,
        message: "Type, title, description, contents, and image are required fields",
      });
    }

    // Validate that contents is a string (HTML content)
    if (typeof contents !== "string") {
      return res.status(400).json({
        success: false,
        message: "Contents must be a string (HTML content)",
      });
    }

    // Basic validation for non-empty contents (after stripping HTML tags)
    const textContent = contents.replace(/<[^>]*>/g, '').trim();
    if (textContent.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Contents cannot be empty",
      });
    }

    // Parse related items if they're sent as strings
    const parsedRelatedServices = typeof relatedServices === "string"
      ? JSON.parse(relatedServices)
      : relatedServices || [];
    const parsedRelatedIndustries = typeof relatedIndustries === "string"
      ? JSON.parse(relatedIndustries)
      : relatedIndustries || [];
    const parsedRelatedProducts = typeof relatedProducts === "string"
      ? JSON.parse(relatedProducts)
      : relatedProducts || [];
    const parsedRelatedChikfdServices = typeof relatedChikfdServices === "string"
      ? JSON.parse(relatedChikfdServices)
      : relatedChikfdServices || [];

    const newBlog = new Blog({
      type,
      image,
      title,
      description,
      contents,
      relatedServices: parsedRelatedServices,
      relatedIndustries: parsedRelatedIndustries,
      relatedProducts: parsedRelatedProducts,
      relatedChikfdServices: parsedRelatedChikfdServices,
    });

    await newBlog.save();
    return res.status(201).json({
      success: true,
      message: "Blog created successfully",
      blog: newBlog,
    });
  } catch (error) {
    console.error("Error creating blog:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.post("/blog/edit", upload.single("image"), async (req, res) => {
  try {
    const {
      blogId,
      type,
      title,
      description,
      contents,
      relatedServices,
      relatedIndustries,
      relatedProducts,
      relatedChikfdServices,
    } = req.body;

    if (!blogId) {
      return res.status(400).json({
        success: false,
        message: "Blog ID is required",
      });
    }

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Update basic fields if provided
    if (type) blog.type = type;
    if (title) blog.title = title;
    if (description) blog.description = description;

    // Parse and update related items if provided
    if (relatedServices !== undefined) {
      const parsedRelatedServices = typeof relatedServices === "string"
        ? JSON.parse(relatedServices)
        : relatedServices || [];
      blog.relatedServices = parsedRelatedServices;
    }

    console.log(typeof relatedIndustries === "string");
    if (relatedIndustries !== undefined) {
      const parsedRelatedIndustries = typeof relatedIndustries === "string"
        ? JSON.parse(relatedIndustries)
        : relatedIndustries || [];
      blog.relatedIndustries = parsedRelatedIndustries;
    }

    if (relatedProducts !== undefined) {
      const parsedRelatedProducts = typeof relatedProducts === "string"
        ? JSON.parse(relatedProducts)
        : relatedProducts || [];
      blog.relatedProducts = parsedRelatedProducts;
    }

    if (relatedChikfdServices !== undefined) {
      const parsedRelatedChikfdServices = typeof relatedChikfdServices === "string"
        ? JSON.parse(relatedChikfdServices)
        : relatedChikfdServices || [];
      blog.relatedChikfdServices = parsedRelatedChikfdServices;
    }

    // Handle image update
    if (req.file) {
      if (blog.image) {
        const oldImagePath = path.join(
          process.cwd(),
          "public",
          blog.image.split("/").pop()
        );
        try {
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (err) {
          console.error("Error deleting old blog image:", err);
        }
      }
      blog.image = getImageUrl(req.file.filename);
    }

    // Handle contents update if provided
    if (contents !== undefined) {
      // Validate that contents is a string (HTML content)
      if (typeof contents !== "string") {
        return res.status(400).json({
          success: false,
          message: "Contents must be a string (HTML content)",
        });
      }

      // Basic validation for non-empty contents (after stripping HTML tags)
      const textContent = contents.replace(/<[^>]*>/g, '').trim();
      if (textContent.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Contents cannot be empty",
        });
      }

      blog.contents = contents;
    }

    await blog.save();
    return res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      blog: blog,
    });
  } catch (error) {
    console.error("Error updating blog:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.use("/blog/delete", express.json());

router.post("/blog/delete", async (req, res) => {
  try {
    const { blogId } = req.body;

    if (!blogId) {
      return res.status(400).json({
        success: false,
        message: "Blog ID is required",
      });
    }

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Delete the associated image file if it exists
    if (blog.image) {
      const imagePath = path.join(
        process.cwd(),
        "public",
        blog.image.split("/").pop()
      );
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (err) {
        console.error("Error deleting blog image file:", err);
        // Continue with deletion even if image removal fails
      }
    }

    await blog.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting blog:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
      error: error.message,
    });
  }
});

router.post("/knowledgebase/create",
  upload.single("Image"),
  async (req, res) => {
    try {
      const {
        title,
        introduction,
        contents,
        tags,
        relatedServices,
        relatedIndustries,
        relatedProducts,
        relatedChikfdServices,
        status = "draft",
      } = req.body;

      // Check required fields
      if (
        !title ||
        !introduction ||
        !contents ||
        !req.file
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Required fields are missing (title, introduction, contents, and image)",
        });
      }

      // Get image URL
      const imageUrl = getImageUrl(req.file.filename);

      // Validate that contents is a string (HTML content)
      if (typeof contents !== "string") {
        return res.status(400).json({
          success: false,
          message: "Contents must be a string",
        });
      }

      // Basic validation for non-empty contents (after stripping HTML tags)
      const textContent = contents.replace(/<[^>]*>/g, '').trim();
      if (textContent.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Contents cannot be empty",
        });
      }

      // Parse tags if they're sent as a string
      const parsedTags =
        typeof tags === "string" ? JSON.parse(tags) : tags || [];

      // Parse related items if they're sent as strings
      const parsedRelatedServices =
        typeof relatedServices === "string"
          ? JSON.parse(relatedServices)
          : relatedServices || [];

      const parsedRelatedIndustries =
        typeof relatedIndustries === "string"
          ? JSON.parse(relatedIndustries)
          : relatedIndustries || [];

      const parsedRelatedProducts =
        typeof relatedProducts === "string"
          ? JSON.parse(relatedProducts)
          : relatedProducts || [];

      const parsedRelatedChikfdServices =
        typeof relatedChikfdServices === "string"
          ? JSON.parse(relatedChikfdServices)
          : relatedChikfdServices || [];

      // Create new article
      const newArticle = new KnowledgeBase({
        title,
        Image: imageUrl,
        introduction,
        contents,
        tags: parsedTags,
        relatedServices: parsedRelatedServices,
        relatedIndustries: parsedRelatedIndustries,
        relatedProducts: parsedRelatedProducts,
        relatedChikfdServices: parsedRelatedChikfdServices,
        status,
      });

      await newArticle.save();

      return res.status(201).json({
        success: true,
        message: "Knowledge base article created successfully",
        knowledgeBase: newArticle,
      });
    } catch (error) {
      console.error("Error creating knowledge base article:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

router.post("/knowledgebase/edit", upload.single("Image"), async (req, res) => {
  try {
    const {
      articleId,
      title,
      introduction,
      contents,
      tags,
      relatedServices,
      relatedIndustries,
      relatedProducts,
      relatedChikfdServices,
      status,
    } = req.body;

    // Check if article exists
    if (!articleId) {
      return res.status(400).json({
        success: false,
        message: "Article ID is required",
      });
    }

    const article = await KnowledgeBase.findById(articleId);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // Handle image update
    if (req.file) {
      // If there's an existing image, delete it
      if (article.Image) {
        const oldImagePath = path.join(
          process.cwd(),
          "public",
          article.Image.split("/").pop()
        );
        try {
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (err) {
          console.error("Error deleting old article image:", err);
        }
      }
      // Set new image URL
      article.Image = getImageUrl(req.file.filename);
    }

    // Parse tags if provided
    if (tags) {
      const parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
      article.tags = parsedTags;
    }

    // Update other fields if provided
    if (title) article.title = title;
    if (introduction) article.introduction = introduction;

    // Handle contents update if provided
    if (contents !== undefined) {
      // Validate that contents is a string (HTML content)
      if (typeof contents !== "string") {
        return res.status(400).json({
          success: false,
          message: "Contents must be a string",
        });
      }

      // Basic validation for non-empty contents (after stripping HTML tags)
      const textContent = contents.replace(/<[^>]*>/g, '').trim();
      if (textContent.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Contents cannot be empty",
        });
      }

      article.contents = contents;
    }

    // Parse and update related items if provided
    if (relatedServices !== undefined) {
      const parsedRelatedServices =
        typeof relatedServices === "string"
          ? JSON.parse(relatedServices)
          : relatedServices || [];
      article.relatedServices = parsedRelatedServices;
    }

    if (relatedIndustries !== undefined) {
      const parsedRelatedIndustries =
        typeof relatedIndustries === "string"
          ? JSON.parse(relatedIndustries)
          : relatedIndustries || [];
      article.relatedIndustries = parsedRelatedIndustries;
    }

    if (relatedProducts !== undefined) {
      const parsedRelatedProducts =
        typeof relatedProducts === "string"
          ? JSON.parse(relatedProducts)
          : relatedProducts || [];
      article.relatedProducts = parsedRelatedProducts;
    }

    if (relatedChikfdServices !== undefined) {
      const parsedRelatedChikfdServices =
        typeof relatedChikfdServices === "string"
          ? JSON.parse(relatedChikfdServices)
          : relatedChikfdServices || [];
      article.relatedChikfdServices = parsedRelatedChikfdServices;
    }

    if (status) article.status = status;

    await article.save();

    return res.status(200).json({
      success: true,
      message: "Knowledge base article updated successfully",
      article,
    });
  } catch (error) {
    console.error("Error updating knowledge base article:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.use("/knowledgebase/delete", express.json());

router.post("/knowledgebase/delete", async (req, res) => {
  try {
    const { articleId } = req.body;

    if (!articleId) {
      return res.status(400).json({
        success: false,
        message: "Article ID is required",
      });
    }

    const article = await KnowledgeBase.findById(articleId);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // Delete the associated image file if it exists
    if (article.Image) {
      const imagePath = path.join(
        process.cwd(),
        "public",
        article.Image.split("/").pop()
      );
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (err) {
        console.error("Error deleting article image file:", err);
        // Continue with deletion even if image removal fails
      }
    }

    await article.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Knowledge base article deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting knowledge base article:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
      error: error.message,
    });
  }
});

router.use("/faq/create", express.json());
router.post("/faq/create", async (req, res) => {
  try {
    const {
      title,
      questions,
      relatedServices,
      relatedIndustries,
      relatedProducts,
      relatedChikfdServices,
    } = req.body;

    // Check required fields
    if (!title || !questions || !Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        message: "Title and questions array are required",
      });
    }

    // Validate questions format
    for (const qa of questions) {
      if (!qa.question || !qa.answer) {
        return res.status(400).json({
          success: false,
          message: "Each question must have both question and answer fields",
        });
      }
    }

    // Ensure all related fields are arrays
    const parsedRelatedServices = ensureArray(relatedServices);
    const parsedRelatedIndustries = ensureArray(relatedIndustries);
    const parsedRelatedProducts = ensureArray(relatedProducts);
    const parsedRelatedChildServices = ensureArray(relatedChikfdServices);

    // Create new FAQ with all related items as arrays
    const newFaq = new Faq({
      title,
      questions,
      relatedServices: parsedRelatedServices,
      relatedIndustries: parsedRelatedIndustries,
      relatedProducts: parsedRelatedProducts,
      relatedChikfdServices: parsedRelatedChildServices,
    });

    await newFaq.save();

    return res.status(201).json({
      success: true,
      message: "FAQ created successfully",
      faq: newFaq,
    });
  } catch (error) {
    console.error("Error creating FAQ:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// UPDATE FAQ
router.use("/faq/edit", express.json());
router.post("/faq/edit", async (req, res) => {
  try {
    const {
      faqId,
      title,
      questions,
      relatedServices,
      relatedIndustries,
      relatedProducts,
      relatedChikfdServices,
    } = req.body;

    // Check if FAQ exists
    if (!faqId) {
      return res.status(400).json({
        success: false,
        message: "FAQ ID is required",
      });
    }

    const faq = await Faq.findById(faqId);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    // Update fields if provided
    if (title) faq.title = title;

    if (questions && Array.isArray(questions)) {
      // Validate questions format
      for (const qa of questions) {
        if (!qa.question || !qa.answer) {
          return res.status(400).json({
            success: false,
            message: "Each question must have both question and answer fields",
          });
        }
      }
      faq.questions = questions;
    }

    // Update relations if provided, ensuring they're arrays
    if (relatedServices !== undefined) {
      faq.relatedServices = ensureArray(relatedServices);
    }

    if (relatedIndustries !== undefined) {
      faq.relatedIndustries = ensureArray(relatedIndustries);
    }

    if (relatedProducts !== undefined) {
      faq.relatedProducts = ensureArray(relatedProducts);
    }

    if (relatedChikfdServices !== undefined) {
      faq.relatedChikfdServices = ensureArray(relatedChikfdServices);
    }

    await faq.save();

    return res.status(200).json({
      success: true,
      message: "FAQ updated successfully",
      faq,
    });
  } catch (error) {
    console.error("Error updating FAQ:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Helper function to ensure a value is an array
function ensureArray(value) {
  if (!value) return [];

  // If formidable passes an array with a single string element, get the first element
  if (
    Array.isArray(value) &&
    value.length === 1 &&
    typeof value[0] === "string"
  ) {
    value = value[0];
  }

  // If it's already an array (and not the formidable case above), return it
  if (Array.isArray(value)) return value;

  // If it's a string that looks like JSON, try to parse it
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch (e) {
      // If parsing fails, treat it as a single value
      return [value];
    }
  }

  return [value];
}

// DELETE FAQ
router.use("/faq/delete", express.json());
router.post("/faq/delete", async (req, res) => {
  try {
    const { faqId } = req.body;

    if (!faqId) {
      return res.status(400).json({
        success: false,
        message: "FAQ ID is required",
      });
    }

    const faq = await Faq.findById(faqId);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    await faq.deleteOne();

    return res.status(200).json({
      success: true,
      message: "FAQ deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting FAQ:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.post(
  "/servicedetails/create",
  upload.array("images"),
  async (req, res) => {
    try {
      const uploadedFiles = req.files.map(
        (file) => `${process.env.CURRENT_URL}/public/${file.filename}`
      );

      const parsedSections = JSON.parse(req.body.sections);

      const sectionsWithImages = parsedSections.map((section, index) => {
        return {
          ...section,
          image: uploadedFiles[index] || section.image,
        };
      });

      const serviceDetails = new ServiceDetails({
        relatedServices: req.body.relatedServices,
        description: req.body.description,
        sections: sectionsWithImages,
      });

      const savedServiceDetail = await serviceDetails.save();

      res.status(201).json({
        success: true,
        data: savedServiceDetail,
      });
    } catch (error) {
      console.error("Error creating service details:", error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

module.exports = router;
