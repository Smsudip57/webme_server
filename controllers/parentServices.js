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
const JWT_SECRET = process.env.JWT_SECRET;
const Blog = require("../models/blog");
const KnowledgeBase = require("../models/knowledgebase");
const Faq = require("../models/faq");
const ServiceDetails = require("../models/servicedetails");
const Booking = require("../models/bookings");
const BookingAvailability = require("../models/bookingAvailability");

// GET all parent services
const getAllParentServices = async (req, res) => {
  try {
    const parentServices = await ParentService.find()
      .populate("category")
      .exec();

    if (!parentServices || parentServices.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No parent services found",
        data: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Parent services fetched successfully",
      data: parentServices,
    });
  } catch (error) {
    console.error("Error fetching parent services:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching parent services",
      error: error.message,
    });
  }
};

// GET single parent service by ID or SLUG with ALL related data (Blogs, FAQs, Child Services, Bookings)
const getSingleParentService = async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    let parentService;
    const isValidObjectId = idOrSlug.match(/^[0-9a-fA-F]{24}$/);

    // Search by ID if it's a valid MongoDB ObjectId, otherwise search by slug
    if (isValidObjectId) {
      parentService = await ParentService.findById(idOrSlug)
        .populate("category")
        .exec();
    } else {
      parentService = await ParentService.findOne({ slug: idOrSlug })
        .populate("category")
        .exec();
    }

    if (!parentService) {
      return res.status(404).json({
        success: false,
        message: "Parent service not found",
      });
    }

    const parentServiceId = parentService._id;

    // Fetch all child services for this parent service
    const childServices = await ChildService.find({ category: parentServiceId })
      .populate("category")
      .exec();

    // Fetch all blogs related to this parent service
    const relatedBlogs = await Blog.find({ relatedProducts: parentServiceId })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch all FAQs related to this parent service
    const relatedFaqs = await Faq.find({ relatedProducts: parentServiceId })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch all knowledge base articles related to this parent service
    const relatedKnowledgeBase = await KnowledgeBase.find({
      relatedProducts: parentServiceId,
    })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch bookings for all child services of this parent
    const childServiceIds = childServices.map((cs) => cs._id);
    const relatedBookings = await Booking.find({
      productId: { $in: childServiceIds },
    })
      .populate("productId")
      .populate("userId")
      .exec();

    // Fetch booking availability data
    const bookingAvailability = await BookingAvailability.find()
      .populate("adminId")
      .exec();

    // Fetch all testimonials related to this parent service
    const relatedTestimonials = await Testimonial.find({
      relatedProducts: parentServiceId,
    })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch all industries related to this parent service
    const relatedIndustries = await Industry.find({
      relatedProducts: parentServiceId,
    })
      .populate("relatedServices")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    return res.status(200).json({
      success: true,
      message: "Parent service with all related data fetched successfully",
      data: {
        ...parentService.toObject(),
        childServices: childServices,
        relatedBlogs: relatedBlogs,
        relatedFaqs: relatedFaqs,
        relatedKnowledgeBase: relatedKnowledgeBase,
        relatedBookings: relatedBookings,
        bookingAvailability: bookingAvailability,
        relatedTestimonials: relatedTestimonials,
        relatedIndustries: relatedIndustries,
      },
    });
  } catch (error) {
    console.error("Error fetching parent service with related data:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching parent service",
      error: error.message,
    });
  }
};

module.exports = {
  getAllParentServices,
  getSingleParentService,
};
