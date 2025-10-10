const express = require("express");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const User = require("../models/user");
const Service = require("../models/service");
const Industry = require("../models/industry");
const Testimonial = require("../models/testimonial");
const ParentService = require("../models/Parentservice");
const ChildService = require("../models/childService");
const { route } = require("./user");
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

const UPLOAD_DIR = path.join(process.cwd(), "public");

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

const upload = multer({ storage });
const getImageUrl = (filename) => `${process.env.Current_Url}/${filename}`;
const getFileUrl = (filename) => `${process.env.Current_Url}/${filename}`;

router.post(
  "/testimonial/create",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        Testimonial: TestimonialText,
        postedBy,
        role,
        relatedService,
        relatedIndustries,
        relatedProduct,
        relatedChikfdServices,
      } = req.body;

      if (
        !TestimonialText ||
        !postedBy ||
        !role ||
        !req.files.image ||
        !req.files.video
      ) {
        return res.status(400).json({
          success: false,
          message: "All information are required.",
        });
      }

      const imageUrl = getFileUrl(req.files.image[0].filename);
      const videoUrl = getFileUrl(req.files.video[0].filename);

      try {
        const newTestimonial = new Testimonial({
          Testimonial: TestimonialText,
          postedBy,
          role,
          relatedService,
          relatedIndustries,
          relatedProduct,
          relatedChikfdServices,
          image: imageUrl,
          video: videoUrl,
        });

        await newTestimonial.save();

        return res.status(201).json({
          success: true,
          message: "Testimonial created successfully",
          testimonial: newTestimonial,
        });
      } catch (dbError) {
        console.error("Error saving to database:", dbError);

        // Delete files if database save fails
        if (req.files.image)
          fs.unlinkSync(path.join(UPLOAD_DIR, req.files.image[0].filename));
        if (req.files.video)
          fs.unlinkSync(path.join(UPLOAD_DIR, req.files.video[0].filename));

        return res.status(500).json({
          success: false,
          message: "Error saving testimonial data. Files deleted.",
        });
      }
    } catch (error) {
      console.error("Unexpected error:", error);

      // Delete files if any other error occurs
      if (req.files.image)
        fs.unlinkSync(path.join(UPLOAD_DIR, req.files.image[0].filename));
      if (req.files.video)
        fs.unlinkSync(path.join(UPLOAD_DIR, req.files.video[0].filename));

      return res.status(500).json({
        success: false,
        message: "Unexpected error occurred while creating testimonial.",
      });
    }
  }
);

router.post(
  "/testimonial/edit",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        testimonialId,
        Testimonial: TestimonialText,
        postedBy,
        role,
        relatedService,
        relatedIndustries,
        relatedProduct,
        relatedChikfdServices,
      } = req.body;

      if (!testimonialId) {
        return res
          .status(400)
          .json({ success: false, message: "Testimonial ID is required." });
      }

      // Find the testimonial
      const testimonial = await Testimonial.findById(testimonialId);
      if (!testimonial) {
        return res
          .status(404)
          .json({ success: false, message: "Testimonial not found." });
      }

      // Update fields
      testimonial.Testimonial = TestimonialText || testimonial.Testimonial;
      testimonial.postedBy = postedBy || testimonial.postedBy;
      testimonial.role = role || testimonial.role;

      // Update relation fields if provided
      if (relatedService) testimonial.relatedService = relatedService;
      if (relatedIndustries) testimonial.relatedIndustries = relatedIndustries;
      if (relatedProduct) testimonial.relatedProduct = relatedProduct;
      if (relatedChikfdServices)
        testimonial.relatedChikfdServices = relatedChikfdServices;

      // Handle image update if provided
      if (req.files.image) {
        if (testimonial.image) {
          const oldImagePath = path.join(
            UPLOAD_DIR,
            testimonial.image.split("/").pop()
          );
          try {
            if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
          } catch (err) {
            console.error("Error deleting old image:", err);
          }
        }
        testimonial.image = getFileUrl(req.files.image[0].filename);
      }

      // Handle video update if provided
      if (req.files.video) {
        if (testimonial.video) {
          const oldVideoPath = path.join(
            UPLOAD_DIR,
            testimonial.video.split("/").pop()
          );
          try {
            if (fs.existsSync(oldVideoPath)) fs.unlinkSync(oldVideoPath);
          } catch (err) {
            console.error("Error deleting old video:", err);
          }
        }
        testimonial.video = getFileUrl(req.files.video[0].filename);
      }

      await testimonial.save();
      return res.status(200).json({
        success: true,
        message: "Testimonial updated successfully.",
        testimonial,
      });
    } catch (error) {
      console.error("Error updating testimonial:", error);
      return res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again.",
      });
    }
  }
);

router.post(
  "/industry/create",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "logo", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        Title,
        Heading,
        detail,
        Efficiency,
        costSaving,
        customerSatisfaction,
        relatedServices,
        relatedSuccessStory,
        relatedProducts,
        relatedChikfdServices,
        relatedProjects,
      } = req.body;

      const files = req.files; // Access uploaded files
      const image = files.image ? files.image[0] : null;
      const logo = files.logo ? files.logo[0] : null;
      if (!Title || !Heading || !detail || !image || !logo) {
        return res.status(400).json({
          success: false,
          message: "Title, Heading, detail, and image are required.",
        });
      }

      const imageUrl = getImageUrl(image.filename);
      const logoUrl = getImageUrl(logo.filename);

      // Helper function to parse related items
      const parseRelatedItems = (items) => {
        if (!items) return [];

        // If it's a string that could be JSON
        if (typeof items === "string" && items.startsWith("[")) {
          try {
            return JSON.parse(items);
          } catch (e) {
            // If JSON parsing fails, treat as comma-separated string
            return items.split(",").map((id) => id.trim()).filter(id => id);
          }
        }
        // If it's a comma-separated string
        else if (typeof items === "string") {
          return items.split(",").map((id) => id.trim()).filter(id => id);
        }
        // If it's already an array
        else if (Array.isArray(items)) {
          return items;
        }
        // If it's a single ID
        else {
          return [items];
        }
      };

      // Process all related items arrays
      const relatedServicesArray = parseRelatedItems(relatedServices);
      const relatedSuccessStoryArray = parseRelatedItems(relatedSuccessStory);
      const relatedProductsArray = parseRelatedItems(relatedProducts);
      const relatedChikfdServicesArray = parseRelatedItems(relatedChikfdServices);
      const relatedProjectsArray = parseRelatedItems(relatedProjects);

      const newIndustry = new Industry({
        Title,
        Heading,
        detail,
        Efficiency: Number(Efficiency) || 0,
        costSaving: Number(costSaving) || 0,
        customerSatisfaction: Number(customerSatisfaction) || 0,
        image: imageUrl,
        logo: logoUrl,
        relatedServices: relatedServicesArray,
        relatedSuccessStory: relatedSuccessStoryArray,
        relatedProducts: relatedProductsArray,
        relatedChikfdServices: relatedChikfdServicesArray,
        relatedProjects: relatedProjectsArray,
      });

      await newIndustry.save();

      return res.status(201).json({
        success: true,
        message: "Industry created successfully.",
        industry: newIndustry,
      });
    } catch (error) {
      console.error("Error creating industry:", error);
      return res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again.",
      });
    }
  }
);

router.post(
  "/industry/edit",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "logo", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        id,
        Title,
        Heading,
        detail,
        Efficiency,
        costSaving,
        customerSatisfaction,
        relatedServices,
        relatedSuccessStory,
        relatedProducts,
        relatedChikfdServices,
        relatedProjects,
      } = req.body;

      if (!id || !Title || !Heading || !detail) {
        return res.status(400).json({
          success: false,
          message: "ID, Title, Heading, and Detail are required.",
        });
      }

      const industry = await Industry.findById(id);
      if (!industry) {
        return res.status(404).json({
          success: false,
          message: "Industry not found.",
        });
      }

      const files = req.files; // Access uploaded files
      const image = files.image ? files.image[0] : null;
      const logo = files.logo ? files.logo[0] : null;

      let imageUrl = industry.image; // Default to existing image
      let logoUrl = industry.logo; // Default to existing logo

      // Handle image update
      if (image) {
        imageUrl = getImageUrl(image.filename);

        // Delete the old image if it exists
        try {
          const oldImagePath = path.join(
            process.cwd(),
            "public",
            industry.image.split("/").pop()
          );
          if (industry.image && fs.existsSync(oldImagePath)) {
            await fs.promises.unlink(oldImagePath);
          }
        } catch (error) {
          console.log("Error deleting old image:", error);
        }
      }

      // Handle logo update
      if (logo) {
        logoUrl = getImageUrl(logo.filename);

        // Delete the old logo if it exists
        try {
          const oldLogoPath = path.join(
            process.cwd(),
            "public",
            industry.logo.split("/").pop()
          );
          if (industry.logo && fs.existsSync(oldLogoPath)) {
            await fs.promises.unlink(oldLogoPath);
          }
        } catch (error) {
          console.log("Error deleting old logo:", error);
        }
      }

      // Helper function to parse related items
      const parseRelatedItems = (items, existingItems = []) => {
        if (!items) return existingItems;

        // If it's a string that could be JSON
        if (typeof items === "string" && items.startsWith("[")) {
          try {
            return JSON.parse(items);
          } catch (e) {
            // If JSON parsing fails, treat as comma-separated string
            return items.split(",").map((id) => id.trim()).filter(id => id);
          }
        }
        // If it's a comma-separated string
        else if (typeof items === "string") {
          return items.split(",").map((id) => id.trim()).filter(id => id);
        }
        // If it's already an array
        else if (Array.isArray(items)) {
          return items;
        }
        // If it's a single ID
        else {
          return [items];
        }
      };

      // Process all related items arrays with existing values as defaults
      const relatedServicesArray = parseRelatedItems(relatedServices, industry.relatedServices);
      const relatedSuccessStoryArray = parseRelatedItems(relatedSuccessStory, industry.relatedSuccessStory);
      const relatedProductsArray = parseRelatedItems(relatedProducts, industry.relatedProducts);
      const relatedChikfdServicesArray = parseRelatedItems(relatedChikfdServices, industry.relatedChikfdServices);
      const relatedProjectsArray = parseRelatedItems(relatedProjects, industry.relatedProjects);

      // Update fields
      industry.Title = Title;
      industry.Heading = Heading;
      industry.detail = detail;
      if (Efficiency !== undefined) industry.Efficiency = Number(Efficiency);
      if (costSaving !== undefined) industry.costSaving = Number(costSaving);
      if (customerSatisfaction !== undefined)
        industry.customerSatisfaction = Number(customerSatisfaction);
      industry.image = imageUrl;
      industry.logo = logoUrl;

      // Update all related items arrays
      industry.relatedServices = relatedServicesArray;
      industry.relatedSuccessStory = relatedSuccessStoryArray;
      industry.relatedProducts = relatedProductsArray;
      industry.relatedChikfdServices = relatedChikfdServicesArray;
      industry.relatedProjects = relatedProjectsArray;

      await industry.save();

      return res.status(200).json({
        success: true,
        message: "Industry updated successfully.",
        updatedIndustry: industry,
      });
    } catch (error) {
      console.error("Error updating industry:", error);
      return res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again.",
      });
    }
  }
);

router.use("/industry/delete", express.json());

router.delete("/industry/delete", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Industry ID is required.",
      });
    }

    const industry = await Industry.findById(id);
    if (!industry) {
      return res.status(404).json({
        success: false,
        message: "Industry not found.",
      });
    }

    // Remove the associated image file from the public folder
    const fs = require("fs").promises; // Use fs.promises for async/await support

    const imagePath = path.join(
      process.cwd(),
      "public",
      industry.image.split("/").pop()
    );
    try {
      await fs.unlink(imagePath); // Delete the image file from disk
    } catch (error) {
      console.error("Error deleting image:", error);
      return res
        .status(500)
        .json({ success: false, message: "Error deleting image." });
    }

    // Delete the industry from the database
    await Industry.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Industry deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting industry:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
});

router.post(
  "/product/create",
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "sectionImages", maxCount: 30 },
  ]),
  async (req, res) => {
    try {
      // Extract basic product fields
      const {
        Title,
        detail,
        moreDetail,
        category,
        slug,
        sections: sectionsJSON,
      } = req.body;

      // Validate required fields
      if (
        !Title ||
        !detail ||
        !moreDetail ||
        !category ||
        !slug ||
        !sectionsJSON ||
        !req.files.mainImage
      ) {
        return res.status(400).json({
          success: false,
          message:
            "All fields are required: Title, detail, moreDetail, category, slug, sections, and mainImage",
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
      const existingProduct = await ParentService.findOne({ slug });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "Slug already exists. Please use a unique slug.",
        });
      }

      // Get main image URL
      const mainImageUrl = getImageUrl(req.files.mainImage[0].filename);

      // Parse sections from JSON
      let sectionsData;
      try {
        sectionsData = JSON.parse(sectionsJSON);
        if (!Array.isArray(sectionsData) || sectionsData.length === 0) {
          return res.status(400).json({
            success: false,
            message: "Sections must be a non-empty array",
          });
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid sections JSON format",
        });
      }

      // Process sections with uploaded images
      const sectionImages = req.files.sectionImages || [];
      let imageIndex = 0;

      const processedSections = sectionsData.map((section) => {
        // Validate section data
        if (
          !section.title ||
          !Array.isArray(section.points) ||
          section.points.length === 0
        ) {
          throw new Error(
            `Section ${section.title || "unknown"} is missing required fields`
          );
        }

        // Use uploaded image if available, otherwise use URL from JSON
        let sectionImage;
        if (section.useUploadedImage && imageIndex < sectionImages.length) {
          sectionImage = getImageUrl(sectionImages[imageIndex++].filename);
        } else {
          sectionImage = section.image;
          // Validate that image URL is provided if not uploading
          if (!sectionImage) {
            throw new Error(`Image is required for section: ${section.title}`);
          }
        }

        // Process points
        const processedPoints = section.points.map((point) => {
          if (!point.title || !point.detail) {
            throw new Error(
              `Point in section ${section.title} is missing title or detail`
            );
          }
          return {
            title: point.title,
            detail: point.detail,
          };
        });

        return {
          title: section.title,
          image: sectionImage,
          points: processedPoints,
        };
      });

      // Create product with processed data
      const newProduct = new ParentService({
        Title,
        detail,
        moreDetail,
        slug,
        image: mainImageUrl,
        category,
        sections: processedSections,
      });

      // Save to database
      await newProduct.save();

      return res.status(201).json({
        success: true,
        message: "Product created successfully",
        product: newProduct,
      });
    } catch (error) {
      console.error("Error creating product:", error);

      // Clean up uploaded files on error
      try {
        if (req.files.mainImage) {
          fs.unlinkSync(path.join(UPLOAD_DIR, req.files.mainImage[0].filename));
        }
        if (req.files.sectionImages) {
          req.files.sectionImages.forEach((file) => {
            fs.unlinkSync(path.join(UPLOAD_DIR, file.filename));
          });
        }
      } catch (cleanupError) {
        console.error("Error cleaning up files:", cleanupError);
      }

      return res.status(500).json({
        success: false,
        message: error.message || "Something went wrong. Please try again.",
      });
    }
  }
);

router.use("/product/delete", express.json());

router.post("/product/delete", async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const product = await ParentService.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const fileDeleteOperations = [];

    if (product.image) {
      const mainImagePath = path.join(
        process.cwd(),
        "public",
        product.image.split("/").pop()
      );
      if (fs.existsSync(mainImagePath)) {
        fileDeleteOperations.push(fs.promises.unlink(mainImagePath));
      }
    }

    if (product.sections && product.sections.length > 0) {
      for (const section of product.sections) {
        if (section.image) {
          const sectionImagePath = path.join(
            process.cwd(),
            "public",
            section.image.split("/").pop()
          );
          if (fs.existsSync(sectionImagePath)) {
            fileDeleteOperations.push(fs.promises.unlink(sectionImagePath));
          }
        }
      }
    }
    await Promise.allSettled(fileDeleteOperations);
    
    // Delete all child services that reference this parent product
    await ChildService.deleteMany({ category: productId });
    
    await ParentService.findByIdAndDelete(productId);
    return res.status(200).json({
      success: true,
      message: "Product, all child services, and all associated images deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting product:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
});

router.put(
  "/product/edit",
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "sectionImages", maxCount: 30 },
  ]),
  async (req, res) => {
    try {
      const {
        productId,
        Title,
        detail,
        moreDetail,
        category,
        slug,
        sections: sectionsJSON,
        imagesToDelete,
      } = req.body;

      // Validate product ID
      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "Product ID is required",
        });
      }

      // Find existing product
      const existingProduct = await ParentService.findById(productId);
      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      // Validate slug if provided
      if (slug) {
        // Validate slug format
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          return res.status(400).json({
            success: false,
            message:
              "Slug must be lowercase, containing only letters, numbers, and hyphens",
          });
        }

        // Check if slug already exists and belongs to a different product
        if (existingProduct.slug !== slug) {
          const slugExists = await ParentService.findOne({
            slug,
            _id: { $ne: productId },
          });
          if (slugExists) {
            return res.status(400).json({
              success: false,
              message: "Slug already exists. Please use a unique slug.",
            });
          }
        }
      }

      // Handle main image update
      let mainImageUrl = existingProduct.image;
      if (req.files.mainImage) {
        // Delete old image if it exists
        try {
          const oldImagePath = path.join(
            UPLOAD_DIR,
            existingProduct.image.split("/").pop()
          );
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (error) {
          console.error("Error deleting old main image:", error);
        }

        // Set new image URL
        mainImageUrl = getImageUrl(req.files.mainImage[0].filename);
      }

      // Process sections update
      let updatedSections;
      if (sectionsJSON) {
        try {
          const sectionsData = JSON.parse(sectionsJSON);

          // Delete images that need to be removed
          if (imagesToDelete) {
            const imagesToRemove = JSON.parse(imagesToDelete);
            for (const imageUrl of imagesToRemove) {
              try {
                const imagePath = path.join(
                  UPLOAD_DIR,
                  imageUrl.split("/").pop()
                );
                if (fs.existsSync(imagePath)) {
                  fs.unlinkSync(imagePath);
                }
              } catch (error) {
                console.error(`Error deleting image ${imageUrl}:`, error);
              }
            }
          }

          // Process section images
          const sectionImages = req.files.sectionImages || [];
          let imageIndex = 0;

          updatedSections = sectionsData.map((section) => {
            // Use uploaded image if specified
            let sectionImage = section.image;
            if (section.useUploadedImage && imageIndex < sectionImages.length) {
              sectionImage = getImageUrl(sectionImages[imageIndex++].filename);
            }

            return {
              title: section.title,
              image: sectionImage,
              points: section.points.map((point) => ({
                title: point.title,
                detail: point.detail,
              })),
            };
          });
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: "Invalid sections data: " + error.message,
          });
        }
      } else {
        // Keep existing sections if none provided
        updatedSections = existingProduct.sections;
      }

      // Update product with all fields
      const updatedProduct = await ParentService.findByIdAndUpdate(
        productId,
        {
          Title: Title || existingProduct.Title,
          detail: detail || existingProduct.detail,
          moreDetail: moreDetail || existingProduct.moreDetail,
          slug: slug || existingProduct.slug,
          image: mainImageUrl,
          category: category || existingProduct.category,
          sections: updatedSections,
        },
        { new: true, runValidators: true }
      );

      return res.status(200).json({
        success: true,
        message: "Product updated successfully",
        product: updatedProduct,
      });
    } catch (error) {
      console.error("Error updating product:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Something went wrong. Please try again.",
      });
    }
  }
);

router.post(
  "/child/create",
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "sectionImages", maxCount: 30 },
  ]),
  async (req, res) => {
    try {
      // Extract basic product fields
      const {
        Title,
        detail,
        moreDetail,
        category,
        slug,
        itemsTag,
        sections: sectionsJSON,
      } = req.body;

      // Validate required fields
      if (
        !Title ||
        !detail ||
        !moreDetail ||
        !category ||
        !slug ||
        !itemsTag ||
        !sectionsJSON ||
        !req.files.mainImage
      ) {
        return res.status(400).json({
          success: false,
          message:
            "All fields are required: Title, detail, moreDetail, category, slug, itemsTag, sections, and mainImage",
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
      const existingChildService = await ChildService.findOne({ slug });
      if (existingChildService) {
        return res.status(400).json({
          success: false,
          message: "Slug already exists. Please use a unique slug.",
        });
      }

      // Process itemsTag - convert to string if needed
      let itemsTagString = "";
      if (itemsTag) {
        if (typeof itemsTag === "string") {
          // If it's already a string, use it directly
          itemsTagString = itemsTag.trim();
        } else if (Array.isArray(itemsTag)) {
          // If it's an array, join with commas
          itemsTagString = itemsTag.join(", ");
        } else {
          // Convert other types to string
          itemsTagString = String(itemsTag).trim();
        }
      }

      // Validate itemsTag string
      if (!itemsTagString || itemsTagString.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one item tag is required",
        });
      }

      // Get main image URL
      const mainImageUrl = getImageUrl(req.files.mainImage[0].filename);

      // Parse sections from JSON
      let sectionsData;
      try {
        sectionsData = JSON.parse(sectionsJSON);
        if (!Array.isArray(sectionsData) || sectionsData.length === 0) {
          return res.status(400).json({
            success: false,
            message: "Sections must be a non-empty array",
          });
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid sections JSON format",
        });
      }

      // Process sections with uploaded images
      const sectionImages = req.files.sectionImages || [];
      let imageIndex = 0;

      const processedSections = sectionsData.map((section) => {
        // Validate section data
        if (
          !section.title ||
          !Array.isArray(section.points) ||
          section.points.length === 0
        ) {
          throw new Error(
            `Section ${section.title || "unknown"} is missing required fields`
          );
        }

        // Use uploaded image if available, otherwise use URL from JSON
        let sectionImage;
        if (section.useUploadedImage && imageIndex < sectionImages.length) {
          sectionImage = getImageUrl(sectionImages[imageIndex++].filename);
        } else {
          sectionImage = section.image;
          // Validate that image URL is provided if not uploading
          if (!sectionImage) {
            throw new Error(`Image is required for section: ${section.title}`);
          }
        }

        // Process points
        const processedPoints = section.points.map((point) => {
          if (!point.title || !point.detail) {
            throw new Error(
              `Point in section ${section.title} is missing title or detail`
            );
          }
          return {
            title: point.title,
            detail: point.detail,
          };
        });

        return {
          title: section.title,
          image: sectionImage,
          points: processedPoints,
        };
      });

      // Create child service with processed data
      const newChildService = new ChildService({
        Title,
        detail,
        moreDetail,
        slug,
        itemsTag: itemsTagString,
        image: mainImageUrl,
        category,
        sections: processedSections,
      });

      // Save to database
      await newChildService.save();

      try {
        await fetch("https://erp.webmedigital.com/product/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "erp-secret-key": process.env.ERP_COMMUNICATION_SECRET_KEY,
          },
          body: JSON.stringify(newChildService.toObject()),
        });
      } catch (erpError) {
        console.error("Failed to send user to ERP system:", erpError);
      }

      return res.status(201).json({
        success: true,
        message: "Child service created successfully",
        product: newChildService,
      });
    } catch (error) {
      console.error("Error creating child service:", error);

      // Clean up uploaded files on error
      try {
        if (req.files.mainImage) {
          fs.unlinkSync(path.join(UPLOAD_DIR, req.files.mainImage[0].filename));
        }
        if (req.files.sectionImages) {
          req.files.sectionImages.forEach((file) => {
            fs.unlinkSync(path.join(UPLOAD_DIR, file.filename));
          });
        }
      } catch (cleanupError) {
        console.error("Error cleaning up files:", cleanupError);
      }

      return res.status(500).json({
        success: false,
        message: error.message || "Something went wrong. Please try again.",
      });
    }
  }
);
router.use("/child/delete", express.json());

router.post("/child/delete", async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const product = await ChildService.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Create an array to track all file operations
    const fileDeleteOperations = [];

    // Delete the main product image
    if (product.image) {
      const mainImagePath = path.join(
        process.cwd(),
        "public",
        product.image.split("/").pop()
      );
      if (fs.existsSync(mainImagePath)) {
        fileDeleteOperations.push(fs.promises.unlink(mainImagePath));
      }
    }

    // Delete all section images
    if (product.sections && product.sections.length > 0) {
      for (const section of product.sections) {
        if (section.image) {
          const sectionImagePath = path.join(
            process.cwd(),
            "public",
            section.image.split("/").pop()
          );
          if (fs.existsSync(sectionImagePath)) {
            fileDeleteOperations.push(fs.promises.unlink(sectionImagePath));
          }
        }
      }
    }

    // Wait for all file delete operations to complete
    await Promise.allSettled(fileDeleteOperations);

    // Delete the product from the database
    await ChildService.findByIdAndDelete(productId);

     try {
        await fetch("https://erp.webmedigital.com/product/delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "erp-secret-key": process.env.ERP_COMMUNICATION_SECRET_KEY,
          },
          body: JSON.stringify({ _id: productId }),
        });
      } catch (erpError) {
        console.error("Failed to send user to ERP system:", erpError);
      }

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Child service and all associated images deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting child service:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete child service",
    });
  }
});

router.put(
  "/child/edit",
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "sectionImages", maxCount: 30 },
  ]),
  async (req, res) => {
    try {
      // Extract fields from request
      const {
        productId,
        Title,
        detail,
        moreDetail,
        category,
        slug,
        itemsTag,
        sections: sectionsJSON,
        imagesToDelete,
      } = req.body;

      // Validate product ID
      if (!productId) {
        return res.status(400).json({
          success: false,
          message: "Product ID is required",
        });
      }

      // Find existing child service
      const existingChildService = await ChildService.findById(productId);
      if (!existingChildService) {
        return res.status(404).json({
          success: false,
          message: "Child service not found",
        });
      }

      // Validate slug if provided
      if (slug) {
        // Validate slug format
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          return res.status(400).json({
            success: false,
            message:
              "Slug must be lowercase, containing only letters, numbers, and hyphens",
          });
        }

        // Check if slug already exists and belongs to a different child service
        if (existingChildService.slug !== slug) {
          const slugExists = await ChildService.findOne({
            slug,
            _id: { $ne: productId },
          });
          if (slugExists) {
            return res.status(400).json({
              success: false,
              message: "Slug already exists. Please use a unique slug.",
            });
          }
        }
      }

      // Process itemsTag if provided
      let itemsTagString = existingChildService.itemsTag || "";
      if (itemsTag !== undefined) {
        if (typeof itemsTag === "string") {
          // If it's already a string, use it directly
          itemsTagString = itemsTag.trim();
        } else if (Array.isArray(itemsTag)) {
          // If it's an array, join with commas
          itemsTagString = itemsTag.join(", ");
        } else {
          // Convert other types to string
          itemsTagString = String(itemsTag).trim();
        }

        // Validate itemsTag string
        if (!itemsTagString || itemsTagString.length === 0) {
          return res.status(400).json({
            success: false,
            message: "At least one item tag is required",
          });
        }
      }

      // Handle main image update
      let mainImageUrl = existingChildService.image;
      if (req.files.mainImage) {
        // Delete old image if it exists
        try {
          const oldImagePath = path.join(
            UPLOAD_DIR,
            existingChildService.image.split("/").pop()
          );
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (error) {
          console.error("Error deleting old main image:", error);
        }

        // Set new image URL
        mainImageUrl = getImageUrl(req.files.mainImage[0].filename);
      }

      // Process sections update
      let updatedSections;
      if (sectionsJSON) {
        try {
          const sectionsData = JSON.parse(sectionsJSON);

          // Delete images that need to be removed
          if (imagesToDelete) {
            const imagesToRemove = JSON.parse(imagesToDelete);
            for (const imageUrl of imagesToRemove) {
              try {
                const imagePath = path.join(
                  UPLOAD_DIR,
                  imageUrl.split("/").pop()
                );
                if (fs.existsSync(imagePath)) {
                  fs.unlinkSync(imagePath);
                }
              } catch (error) {
                console.error(`Error deleting image ${imageUrl}:`, error);
              }
            }
          }

          // Process section images
          const sectionImages = req.files.sectionImages || [];
          let imageIndex = 0;

          updatedSections = sectionsData.map((section) => {
            // Use uploaded image if specified
            let sectionImage = section.image;
            if (section.useUploadedImage && imageIndex < sectionImages.length) {
              sectionImage = getImageUrl(sectionImages[imageIndex++].filename);
            }

            return {
              title: section.title,
              image: sectionImage,
              points: section.points.map((point) => ({
                title: point.title,
                detail: point.detail,
              })),
            };
          });
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: "Invalid sections data: " + error.message,
          });
        }
      } else {
        // Keep existing sections if none provided
        updatedSections = existingChildService.sections;
      }

      // Update child service with all fields
      const updatedChildService = await ChildService.findByIdAndUpdate(
        productId,
        {
          Title: Title || existingChildService.Title,
          detail: detail || existingChildService.detail,
          moreDetail: moreDetail || existingChildService.moreDetail,
          slug: slug || existingChildService.slug,
          itemsTag: itemsTagString,
          image: mainImageUrl,
          category: category || existingChildService.category,
          sections: updatedSections,
        },
        { new: true, runValidators: true }
      );

       try {
        await fetch("https://erp.webmedigital.com/product/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "erp-secret-key": process.env.ERP_COMMUNICATION_SECRET_KEY,
          },
          body: JSON.stringify(updatedChildService.toObject()),
        });
      } catch (erpError) {
        console.error("Failed to send user to ERP system:", erpError);
      }

      return res.status(200).json({
        success: true,
        message: "Child service updated successfully",
        product: updatedChildService,
      });
    } catch (error) {
      console.error("Error updating child service:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Something went wrong. Please try again.",
      });
    }
  }
);

module.exports = router;
