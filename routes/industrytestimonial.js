const express = require("express");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const User = require("../models/user");
const Service = require("../models/service");
const Industry = require("../models/industry");
const Testimonial = require("../models/testimonial");
const Product = require("../models/product");
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
          image: imageUrl,
          video: videoUrl, // ✅ Save video URL
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
      testimonial.relatedService = relatedService || testimonial.relatedService;
      testimonial.relatedIndustries =
        relatedIndustries || testimonial.relatedIndustries;

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

      const newIndustry = new Industry({
        Title,
        Heading,
        detail,
        Efficiency: Number(Efficiency) || 0,
        costSaving: Number(costSaving) || 0,
        customerSatisfaction: Number(customerSatisfaction) || 0,
        image: imageUrl,
        logo: logoUrl,
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

      // Update fields
      industry.Title = Title;
      industry.Heading = Heading;
      industry.detail = detail;
      if (Efficiency) industry.Efficiency = Number(Efficiency);
      if (costSaving) industry.costSaving = Number(costSaving);
      if (customerSatisfaction)
        industry.customerSatisfaction = Number(customerSatisfaction);
      industry.image = imageUrl;
      industry.logo = logoUrl;

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

router.post("/product/create", upload.single("image"), async (req, res) => {
  try {
    const {
      Title,
      detail,
      category,
      subHeading1,
      subHeading1edtails,
      subHeading2,
      subHeading2edtails,
      subHeading3,
      subHeading3edtails,
    } = req.body;
    const image = req.file; // File uploaded by multer

    console.log("FormData Received:");
    console.log({
      Title,
      detail,
      category,
      image,
      subHeading1,
      subHeading1edtails,
      subHeading2,
      subHeading2edtails,
      subHeading3,
      subHeading3edtails,
    });

    // Validate input
    if (
      !Title ||
      !detail ||
      !category ||
      !image ||
      !subHeading1 ||
      !subHeading1edtails ||
      !subHeading2 ||
      !subHeading2edtails ||
      !subHeading3 ||
      !subHeading3edtails
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    const imageUrl = getImageUrl(image.filename); // Public access path for the image

    // Create new product
    const newProduct = new Product({
      Title,
      detail,
      category,
      image: imageUrl,
      subHeading1,
      subHeading1edtails,
      subHeading2,
      subHeading2edtails,
      subHeading3,
      subHeading3edtails,
    });

    await newProduct.save();

    return res.status(201).json({
      success: true,
      message: "Product created successfully.",
    });
  } catch (error) {
    console.error("Error creating product:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
});

router.use("/product/delete", express.json());

router.post("/product/delete", async (req, res) => {
  try {
    // Get the product ID from the request body
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    // Find the product by ID
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete the associated image file from the public folder if it exists
    const imagePath = path.join(
      process.cwd(),
      "public",
      product.image.split("/").pop()
    );
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath); // Delete the image file from disk
    }

    // Delete the product from the database
    await Product.findByIdAndDelete(productId);

    // Return success response
    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Error deleting product:", err);
    return res.status(500).json({ message: "Failed to delete product" });
  }
});

router.put("/product/edit", upload.single("image"), async (req, res) => {
  try {
    // Parse the request body
    const {
      productId,
      Title,
      detail,
      category,
      subHeading1,
      subHeading1edtails,
      subHeading2,
      subHeading2edtails,
      subHeading3,
      subHeading3edtails,
    } = req.body;

    // Get the existing product
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    let newImagePath = existingProduct.image; // Default to the existing image path

    // Handle the new image upload if available
    if (req.file) {
      const oldImagePath = path.join(
        process.cwd(),
        "public",
        existingProduct.image.split("/").pop()
      );
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath); // Delete the old image file if it exists
      }

      // Save the new image file path
      newImagePath = getImageUrl(req.file.filename); // New image path stored in public
    }

    // Update the product with the new image (if provided)
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        Title,
        detail,
        category,
        subHeading1,
        subHeading1edtails,
        subHeading2,
        subHeading2edtails,
        subHeading3,
        subHeading3edtails,
        image: newImagePath, // Use the new image path (if updated)
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    return res.status(200).json({ success: true, product: updatedProduct });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
