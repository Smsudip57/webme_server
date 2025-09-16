const express = require("express");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const User = require("../models/user");
const Service = require("../models/service");
const ParentService = require("../models/Parentservice");
const ChildService = require("../models/childService");
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
    const industries = await Industry.find({})
      .populate("relatedServices")
      .populate("relatedSuccessStory")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .populate("relatedProjects");

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
    const products = await ParentService.find(); // Add filters or pagination if needed

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
    const { slug } = req.query;

    // If slug is provided, find specific blog
    if (slug) {
      const blog = await Blog.findOne({ slug });
      if (!blog) {
        return res.status(404).json({
          success: false,
          message: "Blog not found with the provided slug"
        });
      }
      return res.status(200).json({ success: true, blog });
    }

    // If no slug, return all blogs
    const blogs = await Blog.find();
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
    const { slug } = req.query;

    // If slug is provided, find specific knowledge base article
    if (slug) {
      const knowledgebase = await KnowledgeBase.findOne({ slug }).populate("relatedServices");
      if (!knowledgebase) {
        return res.status(404).json({
          success: false,
          message: "Knowledge base article not found with the provided slug"
        });
      }
      return res.status(200).json({ success: true, knowledgebase });
    }

    // If no slug, return all knowledge base articles
    const knowledgebases = await KnowledgeBase.find().populate("relatedServices");
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
      .populate("relatedChikfdServices");

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
      Products.find({
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
          { contents: { $regex: search, $options: "i" } },
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
      ChildService.find({
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


router.get("/get/bulk", async (req, res) => {
  try {
    const { keys } = req.query;

    if (!keys) {
      return res.status(400).json({
        success: false,
        message: "Keys parameter is required. Example: ?keys=services,projects,industries"
      });
    }

    const requestedKeys = Array.isArray(keys) ? keys : keys.split(',').map(k => k.trim());

    const startTime = Date.now();

    const dataSources = {
      services: () => Service.find({}),
      projects: () => Project.find({}),
      industries: () => Industry.find({}).populate("relatedServices")
        .populate("relatedSuccessStory")
        .populate("relatedProducts")
        .populate("relatedChikfdServices")
        .populate("relatedProjects"),
      testimonials: () => Testimonial.find().populate("relatedService"),
      products: () => ParentService.find({}),
      childServices: () => ChildService.find({}),
      blogs: () => Blog.find({}),
      knowledgebase: () => KnowledgeBase.find().populate("relatedServices"),
      faqs: () => Faq.find()
        .populate("relatedServices")
        .populate("relatedIndustries")
        .populate("relatedProducts")
        .populate("relatedChikfdServices"),
      serviceDetails: () => ServiceDetails.find().populate("relatedServices"),
      users: () => User.find({}).select('-password')
    };

    const invalidKeys = requestedKeys.filter(key => !dataSources[key]);
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid keys: ${invalidKeys.join(', ')}. Available keys: ${Object.keys(dataSources).join(', ')}`
      });
    }

    // Create parallel promises for requested data
    const promises = requestedKeys.map(async (key) => {
      try {
        const data = await dataSources[key]();
        return { key, data: data || [] };
      } catch (error) {
        return { key, data: [], error: error.message };
      }
    });

    // Execute all queries in parallel
    const results = await Promise.all(promises);
    // console.log(results?.find(item => item?.key ==="products")?.data?.find(item=> item?.Title ==="Custom eCommerce Mobile App Development"));  

    // Transform results into a clean object
    const responseData = {};
    let totalItems = 0;
    const errors = {};

    results.forEach(({ key, data, error }) => {
      if (error) {
        errors[key] = error;
        responseData[key] = [];
      } else {
        responseData[key] = data;
        totalItems += data.length;
      }
    });

    const endTime = Date.now();
    console.log(`Bulk API: ${requestedKeys.join(', ')} → ${endTime - startTime}ms (${totalItems} items)`);

    // Send response
    return res.status(200).json({
      success: true,
      message: `Successfully fetched ${requestedKeys.length} data sources`,
      requestedKeys,
      totalItems,
      executionTime: `${endTime - startTime}ms`,
      data: responseData,
      ...(Object.keys(errors).length > 0 && { errors })
    });

  } catch (error) {
    console.error("Bulk API error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
})


//endpoints for erp, seperate from this project
router.get("/get/users", async (req, res) => {
  try {
    const TargetHeader = req.headers['erp-secret-key'];
    if (!TargetHeader || TargetHeader !== process.env.ERP_COMMUNICATION_SECRET_KEY) {
      return res.status(403).json({
        success: false,
        message: "Invalid Endpoint"
      });
    }
    const users = await User.find().select('-password');
    return res.status(200).json({
      success: true,
      users,
    });

  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});
router.get("/get/products", async (req, res) => {
  try {
    const TargetHeader = req.headers['erp-secret-key'];
    if (!TargetHeader || TargetHeader !== process.env.ERP_COMMUNICATION_SECRET_KEY) {
      return res.status(403).json({
        success: false,
        message: "Invalid Endpoint"
      });
    }
    const products = await ChildService.find().select('-category');
    return res.status(200).json({
      success: true,
      products,
    });

  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
