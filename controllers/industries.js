const express = require("express");
const Industry = require("../models/industry");
const Blog = require("../models/blog");
const KnowledgeBase = require("../models/knowledgebase");
const Testimonial = require("../models/testimonial");
const Project = require("../models/project");
const Faq = require("../models/faq");

// GET all industries with their descriptive relationships
const getAllIndustries = async (req, res) => {
  try {
    const industries = await Industry.find()
      .populate("relatedServices")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    if (!industries || industries.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No industries found",
        data: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Industries fetched successfully",
      data: industries,
    });
  } catch (error) {
    console.error("Error fetching industries:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching industries",
      error: error.message,
    });
  }
};

// GET single industry by ID or SLUG with ALL related data
// Includes: Services, Products, Child Services, Testimonials, Projects, Blogs, Knowledge Base, FAQs
const getSingleIndustry = async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    let industry;
    const isValidObjectId = idOrSlug.match(/^[0-9a-fA-F]{24}$/);

    // Search by ID if it's a valid MongoDB ObjectId, otherwise search by slug
    if (isValidObjectId) {
      industry = await Industry.findById(idOrSlug)
        .populate("relatedServices")
        .populate("relatedProducts")
        .populate("relatedChikfdServices")
        .exec();
    } else {
      // Search by title or create a slug-like query
      industry = await Industry.findOne({
        $or: [
          { Title: { $regex: idOrSlug, $options: "i" } },
          { Heading: { $regex: idOrSlug, $options: "i" } }
        ]
      })
        .populate("relatedServices")
        .populate("relatedProducts")
        .populate("relatedChikfdServices")
        .exec();
    }

    if (!industry) {
      return res.status(404).json({
        success: false,
        message: "Industry not found",
      });
    }

    const industryId = industry._id;

    // Fetch all testimonials related to this industry (testimonials own the relationship)
    const relatedTestimonials = await Testimonial.find({
      relatedIndustries: industryId,
    })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch all projects related to this industry (projects own the relationship)
    const relatedProjects = await Project.find({
      relatedIndustries: industryId,
    })
      .populate("relatedServices")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .populate("relatedIndustries")
      .exec();

    // Fetch all blogs related to this industry (blogs own the relationship)
    const relatedBlogs = await Blog.find({
      relatedIndustries: industryId,
    })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch all knowledge base articles related to this industry
    const relatedKnowledgeBase = await KnowledgeBase.find({
      relatedIndustries: industryId,
    })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch all FAQs related to this industry
    const relatedFaqs = await Faq.find({
      relatedIndustries: industryId,
    })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    return res.status(200).json({
      success: true,
      message: "Industry with all related data fetched successfully",
      data: {
        ...industry.toObject(),
        relatedTestimonials: relatedTestimonials,
        relatedProjects: relatedProjects,
        relatedBlogs: relatedBlogs,
        relatedKnowledgeBase: relatedKnowledgeBase,
        relatedFaqs: relatedFaqs,
        relatedServices: industry.relatedServices,
        relatedParentServices: industry.relatedProducts,
        relatedChikfdServices: industry.relatedChikfdServices,  
      },
    });
  } catch (error) {
    console.error("Error fetching industry with related data:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching industry",
      error: error.message,
    });
  }
};

module.exports = {
  getAllIndustries,
  getSingleIndustry,
};
