const express = require("express");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const User = require("../models/user");
const Service = require("../models/service");
const Product = require("../models/product");
const ChildService = require("../models/chikdService");
const Project = require("../models/project");
const Testimonial = require("../models/testimonial");
const Industry = require("../models/industry");
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const blog = require("../models/blog");
const Blog = require("../models/blog");
const KnowledgeBase = require("../models/knowledgebase");
const Faq = require("../models/faq");
const ServiceDetails = require("../models/servicedetails");

router.get("/service/getservice", async (req, res) => {
  try {
    const services = await Service.find({});
    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching services.",
    });
  }
});

router.get("/project/get", async (req, res) => {
  try {
    console.log("projects");
    const projects = await Project.find();
    if (!projects || projects.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No projects found",
        data: [],
      });
    }
    return res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
    });
  }
});

router.get("/testimonial/get", async (req, res) => {
  try {
    const testimonials = await Testimonial.find()
      .populate("relatedService")
      // .populate("relatedUser")
      .exec();
    return res.status(200).json({
      success: true,
      testimonials,
    });
  } catch (error) {
    console.error("Error fetching testimonials:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/industry/get", async (req, res) => {
  try {
    const industries = await Industry.find({}); // Fetch all industries from the database

    return res.status(200).json({
      success: true,
      industries,
    });
  } catch (error) {
    console.error("Error fetching industries:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch industries. Please try again.",
    });
  }
});

router.get("/product/get", async (req, res) => {
  try {
    // Step 4: Fetch all products from the database
    const products = await Product.find(); // Add filters or pagination if needed

    if (products.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No products found" });
    }

    // Step 5: Return the products data in the response
    return res.status(200).json({ success: true, products });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/child/get", async (req, res) => {
  try {
    const products = await ChildService.find();
    if (products.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No products found" });
    }

    // Step 5: Return the products data in the response
    return res.status(200).json({ success: true, products });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/blog/get", async (req, res) => {
  try {
    // Step 4: Fetch all products from the database
    const blogs = await Blog.find(); // Add filters or pagination if needed
    // Step 5: Return the products data in the response
    return res.status(200).json({ success: true, blogs });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
});

router.get("/knowledgebase/get", async (req, res) => {
  try {
    const knowledgebases = await KnowledgeBase.find().populate(
      "relatedServices"
    );
    return res.status(200).json({
      success: true,
      knowledgebases,
    });
  } catch (error) {
    console.error("Error fetching knowledgebase:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch knowledgebase. Please try again.",
    });
  }
});

router.get("/faq/get", async (req, res) => {
  try {
    const faqs = await Faq.find()
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")

    return res.status(200).json({
      success: true,
      faqs,
    });
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch FAQs. Please try again.",
    });
  }
});


router.get("/servicedetails/get", async (req, res) => {
  try {
    const servicedetails = await ServiceDetails.find().populate(
      "relatedServices"
    );
    return res.status(200).json({
      success: true,
      servicedetails,
    });
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch FAQs. Please try again.",
    });
  }
});

router.get("/search", async (req, res) => {
  try {
    const { search } = req.query;
    if (!search || typeof search !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Search query is required" });
    }

    // Perform searches across all models in parallel
    const [
      services,
      childServices,
      blogs,
      knowledgeBases,
      projects,
      products,
      testimonials,
    ] = await Promise.all([
      // Search in services
      Service.find({
        $or: [
          { Title: { $regex: search, $options: "i" } },
          { deltail: { $regex: search, $options: "i" } },
          { moreDetail: { $regex: search, $options: "i" } },
        ],
      }),

      // Search in child services
      ChildService.find({
        $or: [
          { Title: { $regex: search, $options: "i" } },
          { detail: { $regex: search, $options: "i" } },
          { moreDetail: { $regex: search, $options: "i" } },
        ],
      }),

      // Search in blogs
      Blog.find({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { type: { $regex: search, $options: "i" } },
        ],
      }),

      // Search in knowledge base
      KnowledgeBase.find({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { introduction: { $regex: search, $options: "i" } },
          { conclusion: { $regex: search, $options: "i" } },
        ],
      }),

      // Search in projects
      Project.find({
        $or: [
          { Title: { $regex: search, $options: "i" } },
          { detail: { $regex: search, $options: "i" } },
        ],
      }),

      // Search in products
      Product.find({
        $or: [
          { Title: { $regex: search, $options: "i" } },
          { detail: { $regex: search, $options: "i" } },
        ],
      }),

      // Search in testimonials
      Testimonial.find({
        $or: [
          { Testimonial: { $regex: search, $options: "i" } },
          { postedBy: { $regex: search, $options: "i" } },
          { role: { $regex: search, $options: "i" } },
        ],
      }),
    ]);

    const searchResults = {
      services: services,
      childServices: childServices,
      // blogs: blogs,
      knowledgeBase: knowledgeBases,
      projects: projects,
      products: products,
      testimonials: testimonials,
    };

    // Count total results
    const totalResults = Object.values(searchResults).reduce(
      (acc, curr) => acc + curr.length,
      0
    );

    return res.status(200).json({
      success: true,
      totalResults,
      searchTerm: search,
      results: searchResults,
    });
  } catch (err) {
    console.error("Search error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;
