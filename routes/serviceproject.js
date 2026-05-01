const express = require("express");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const User = require("../models/user");
const Service = require("../models/service");
const ParentService = require("../models/Parentservice");
const ChildService = require("../models/childService");
const { FileManager } = require("../helpers/FileManager");
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
  express.json(),
  async (req, res) => {
    try {
      const { Title, Name, detail, moreDetail, category, slug } = req.body;
      const bodyImage = typeof req.body.image === "string" ? req.body.image : "";
      const imageUrl = bodyImage ? (await FileManager.normal({ url: bodyImage })).url : "";

      if (
        !Title ||
        !Name ||
        !detail ||
        !moreDetail ||
        !category ||
        !imageUrl ||
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

router.post("/service/deleteservice", express.json(), async (req, res) => {
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
      try {
        await FileManager.delete(service.image);
      } catch (err) {
        console.error(`Error deleting image: ${err.message}`);
      }
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
  express.json(),
  async (req, res) => {
    try {
      const { serviceId, Title, Name, deltail, moreDetail, category, slug } =
        req.body;
      const bodyImage = typeof req.body.image === "string" ? req.body.image : "";
      const resolvedBodyImage = bodyImage ? (await FileManager.normal({ url: bodyImage })).url : "";

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

      if (resolvedBodyImage) service.image = resolvedBodyImage;

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

router.post("/project/create", express.json(), async (req, res) => {
  try {
    const { Title, detail, slug, mediaType, mediaUrl, relatedServices, relatedIndustries, relatedProducts, relatedChikfdServices, sections } = req.body;

    // Validate required fields
    if (!Title || !detail || !mediaUrl || !slug) {
      return res.status(400).json({
        success: false,
        message: "Title, detail, mediaUrl, and slug are required.",
      });
    }

    // Validate slug format
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return res.status(400).json({
        success: false,
        message: "Slug must be lowercase, containing only letters, numbers, and hyphens",
      });
    }

    // Check if slug already exists
    const existingProject = await Project.findOne({ slug });
    if (existingProject) {
      return res.status(400).json({
        success: false,
        message: "A project with this slug already exists. Please use a unique slug.",
      });
    }

    // Parse related items as arrays (handle both string and array formats)
    const parseRelatedItems = (items) => {
      if (!items) return [];
      if (typeof items === 'string') {
        try {
          return JSON.parse(items);
        } catch {
          return [items];
        }
      }
      return Array.isArray(items) ? items : [items];
    };

    const parsedServices = parseRelatedItems(relatedServices);
    const parsedIndustries = parseRelatedItems(relatedIndustries);
    const parsedProducts = parseRelatedItems(relatedProducts);
    const parsedChildServices = parseRelatedItems(relatedChikfdServices);

    // Validate related services exist (if any provided)
    if (parsedServices.length > 0) {
      for (const serviceId of parsedServices) {
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
    if (parsedProducts.length > 0) {
      for (const productId of parsedProducts) {
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
    if (parsedChildServices.length > 0) {
      for (const childServiceId of parsedChildServices) {
        const childServiceExists = await ChildService.findById(childServiceId);
        if (!childServiceExists) {
          return res.status(400).json({
            success: false,
            message: `Related child service with ID ${childServiceId} does not exist.`,
          });
        }
      }
    }

    // Promote main media from junk to permanent
    let promotedMediaUrl;
    try {
      const mediaResult = await FileManager.normal({ url: mediaUrl });
      promotedMediaUrl = mediaResult.url;
    } catch (error) {
      console.error("Error promoting media file:", error);
      return res.status(400).json({
        success: false,
        message: "Media file not found in temporary storage. Please re-upload.",
      });
    }

    // Process sections and promote images
    const processedSections = [];
    if (sections && Array.isArray(sections)) {
      for (const section of sections) {
        if (!section.title || !section.image) {
          return res.status(400).json({
            success: false,
            message: "Each section must have a title and image.",
          });
        }

        if (!section.points || section.points.length === 0) {
          return res.status(400).json({
            success: false,
            message: "Each section must have at least one point.",
          });
        }

        // Promote section image from junk to permanent
        let promotedImageUrl;
        try {
          const imageResult = await FileManager.normal({ url: section.image });
          promotedImageUrl = imageResult.url;
        } catch (error) {
          console.error(`Error promoting section image for "${section.title}":`, error);
          return res.status(400).json({
            success: false,
            message: `Section image for "${section.title}" not found in temporary storage.`,
          });
        }

        processedSections.push({
          title: section.title,
          image: promotedImageUrl,
          points: section.points,
        });
      }
    }

    // Save project to database
    const newProject = new Project({
      Title,
      slug,
      detail,
      relatedServices: parsedServices,
      relatedIndustries: parsedIndustries,
      relatedProducts: parsedProducts,
      relatedChikfdServices: parsedChildServices,
      media: {
        url: promotedMediaUrl,
        type: mediaType || "image",
      },
      section: processedSections,
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
  } catch (error) {
    console.error("Error creating project:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
});

router.post("/project/edit", express.json(), async (req, res) => {
  try {
    const { _id, Title, detail, slug, mediaType, mediaUrl, relatedServices, relatedIndustries, relatedProducts, relatedChikfdServices, sections } = req.body;

    if (!_id) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required.",
      });
    }

    // Find existing project
    const existingProject = await Project.findById(_id);
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    // Validate required fields
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
        message: "Slug must be lowercase, containing only letters, numbers, and hyphens",
      });
    }

    // Check if slug already exists and belongs to a different project
    if (slug !== existingProject.slug) {
      const slugExists = await Project.findOne({
        slug,
        _id: { $ne: _id },
      });
      if (slugExists) {
        return res.status(400).json({
          success: false,
          message: "A project with this slug already exists. Please use a unique slug.",
        });
      }
    }

    // Parse related items
    const parseRelatedItems = (items) => {
      if (!items) return [];
      if (typeof items === 'string') {
        try {
          return JSON.parse(items);
        } catch {
          return [items];
        }
      }
      return Array.isArray(items) ? items : [items];
    };

    const parsedServices = parseRelatedItems(relatedServices);
    const parsedIndustries = parseRelatedItems(relatedIndustries);
    const parsedProducts = parseRelatedItems(relatedProducts);
    const parsedChildServices = parseRelatedItems(relatedChikfdServices);

    // Validate related services exist
    if (parsedServices.length > 0) {
      for (const serviceId of parsedServices) {
        const serviceExists = await Service.findById(serviceId);
        if (!serviceExists) {
          return res.status(400).json({
            success: false,
            message: `Related service with ID ${serviceId} does not exist.`,
          });
        }
      }
    }

    // Validate related products exist
    if (parsedProducts.length > 0) {
      for (const productId of parsedProducts) {
        const productExists = await ParentService.findById(productId);
        if (!productExists) {
          return res.status(400).json({
            success: false,
            message: `Related product with ID ${productId} does not exist.`,
          });
        }
      }
    }

    // Validate related child services exist
    if (parsedChildServices.length > 0) {
      for (const childServiceId of parsedChildServices) {
        const childServiceExists = await ChildService.findById(childServiceId);
        if (!childServiceExists) {
          return res.status(400).json({
            success: false,
            message: `Related child service with ID ${childServiceId} does not exist.`,
          });
        }
      }
    }

    // Update basic fields
    existingProject.Title = Title;
    existingProject.slug = slug;
    existingProject.detail = detail;
    existingProject.relatedServices = parsedServices;
    existingProject.relatedIndustries = parsedIndustries;
    existingProject.relatedProducts = parsedProducts;
    existingProject.relatedChikfdServices = parsedChildServices;

    // Update media if provided
    if (mediaUrl) {
      try {
        const mediaResult = await FileManager.normal({ url: mediaUrl });

        // Delete old media if exists
        if (existingProject.media && existingProject.media.url) {
          try {
            await FileManager.delete(existingProject.media.url);
          } catch (error) {
            console.error("Error deleting old media:", error);
          }
        }

        existingProject.media.url = mediaResult.url;
        existingProject.media.type = mediaType || "image";
      } catch (error) {
        console.error("Error promoting media file:", error);
        return res.status(400).json({
          success: false,
          message: "Media file not found in temporary storage.",
        });
      }
    }

    // Update sections if provided
    if (sections && Array.isArray(sections) && sections.length > 0) {
      const processedSections = [];

      for (const section of sections) {
        if (!section.title || !section.image || !section.points || section.points.length === 0) {
          return res.status(400).json({
            success: false,
            message: "Each section must have a title, image, and at least one point.",
          });
        }

        // Promote section image from junk if it's a junk URL
        let promotedImageUrl = section.image;

        if (section.image && section.image.includes('/junk/')) {
          try {
            const imageResult = await FileManager.normal({ url: section.image });
            promotedImageUrl = imageResult.url;
          } catch (error) {
            console.error(`Error promoting section image for "${section.title}":`, error);
            return res.status(400).json({
              success: false,
              message: `Section image for "${section.title}" not found in temporary storage.`,
            });
          }
        }

        processedSections.push({
          title: section.title,
          image: promotedImageUrl,
          points: section.points,
        });
      }

      existingProject.section = processedSections;
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
        message:
          "Type, title, description, contents, and image are required fields",
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
    const textContent = contents.replace(/<[^>]*>/g, "").trim();
    if (textContent.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Contents cannot be empty",
      });
    }

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
      const parsedRelatedServices =
        typeof relatedServices === "string"
          ? JSON.parse(relatedServices)
          : relatedServices || [];
      blog.relatedServices = parsedRelatedServices;
    }

    console.log(typeof relatedIndustries === "string");
    if (relatedIndustries !== undefined) {
      const parsedRelatedIndustries =
        typeof relatedIndustries === "string"
          ? JSON.parse(relatedIndustries)
          : relatedIndustries || [];
      blog.relatedIndustries = parsedRelatedIndustries;
    }

    if (relatedProducts !== undefined) {
      const parsedRelatedProducts =
        typeof relatedProducts === "string"
          ? JSON.parse(relatedProducts)
          : relatedProducts || [];
      blog.relatedProducts = parsedRelatedProducts;
    }

    if (relatedChikfdServices !== undefined) {
      const parsedRelatedChikfdServices =
        typeof relatedChikfdServices === "string"
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
      const textContent = contents.replace(/<[^>]*>/g, "").trim();
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

router.post(
  "/knowledgebase/create",
  express.json(),
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
        Image,
        status = "draft",
      } = req.body;

      // Check required fields
      if (!title || !introduction || !contents || !Image) {
        return res.status(400).json({
          success: false,
          message:
            "Required fields are missing (title, introduction, contents, and image)",
        });
      }

      // Promote image from junk to permanent storage
      const imageUrl = (await FileManager.normal({ url: Image })).url;

      // Validate that contents is a string (HTML content)
      if (typeof contents !== "string") {
        return res.status(400).json({
          success: false,
          message: "Contents must be a string",
        });
      }

      // Basic validation for non-empty contents (after stripping HTML tags)
      const textContent = contents.replace(/<[^>]*>/g, "").trim();
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

router.post("/knowledgebase/edit", express.json(), async (req, res) => {
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
      Image,
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

    // Handle image update - promote from junk if needed
    if (Image && Image !== article.Image) {
      try {
        // Delete old image
        if (article.Image) {
          try {
            await FileManager.delete(article.Image);
          } catch (err) {
            console.error("Error deleting old article image:", err.message);
          }
        }
        // Promote new image from junk
        article.Image = (await FileManager.normal({ url: Image })).url;
      } catch (err) {
        console.error("Error processing image:", err.message);
        return res.status(500).json({
          success: false,
          message: "Failed to process image.",
        });
      }
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
      const textContent = contents.replace(/<[^>]*>/g, "").trim();
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
  express.json(),
  async (req, res) => {
    try {
      const parsedSections = JSON.parse(req.body.sections);

      // Promote all section images from junk to permanent storage
      const sectionsWithImages = await Promise.all(
        parsedSections.map(async (section) => {
          if (section.image) {
            try {
              const promotedUrl = (await FileManager.normal({ url: section.image })).url;
              return { ...section, image: promotedUrl };
            } catch (err) {
              console.error("Error processing section image:", err.message);
              throw new Error(`Failed to process image for section: ${section.title}`);
            }
          }
          return section;
        })
      );

      if (!req.body.relatedServices) {
        return res.status(400).json({
          success: false,
          error: "relatedServices is required",
        });
      }

      const relatedServiceId =
        typeof req.body.relatedServices === "string"
          ? new mongoose.Types.ObjectId(req.body.relatedServices)
          : req.body.relatedServices;

      const existingDetails = await ServiceDetails.find({
        relatedServices: relatedServiceId,
      });

      if (existingDetails && existingDetails.length > 0) {
        const deleteResult = await ServiceDetails.deleteMany({
          relatedServices: relatedServiceId,
        });
      }

      const serviceDetails = new ServiceDetails({
        relatedServices: relatedServiceId,
        description: req.body.description,
        sections: sectionsWithImages,
      });

      const savedServiceDetail = await serviceDetails.save();

      return res.status(201).json({
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
