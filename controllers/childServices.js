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
// GET all child services
const getAllChildServices = async (req, res) => {
  try {
    const childServices = await ChildService.find().populate("category").exec();

    if (!childServices || childServices.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No child services found",
        data: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Child services fetched successfully",
      data: childServices,
    });
  } catch (error) {
    console.error("Error fetching child services:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching child services",
      error: error.message,
    });
  }
};

// GET single child service by ID or SLUG with ALL related data
// Includes: ParentService, Blogs, FAQs, Knowledge Base, Bookings, Booking Availability
const getSingleChildService = async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    let childService;
    const isValidObjectId = idOrSlug.match(/^[0-9a-fA-F]{24}$/);

    // Search by ID if it's a valid MongoDB ObjectId, otherwise search by slug
    if (isValidObjectId) {
      childService = await ChildService.findById(idOrSlug)
        .populate("category")
        .exec();
    } else {
      childService = await ChildService.findOne({ slug: idOrSlug })
        .populate("category")
        .exec();
    }

    if (!childService) {
      return res.status(404).json({
        success: false,
        message: "Child service not found",
      });
    }

    const childServiceId = childService._id;

    // Fetch parent service details (populate parent)
    const parentService = await ParentService.findById(
      childService.category
    ).exec();

    // Fetch all blogs related to this child service
    const relatedBlogs = await Blog.find({
      relatedChikfdServices: childServiceId,
    })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch all FAQs related to this child service
    const relatedFaqs = await Faq.find({
      relatedChikfdServices: childServiceId,
    })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch all knowledge base articles related to this child service
    const relatedKnowledgeBase = await KnowledgeBase.find({
      relatedChikfdServices: childServiceId,
    })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch all bookings for this specific child service
    const relatedBookings = await Booking.find({
      productId: childServiceId,
    })
      .populate("productId")
      .populate("userId")
      .exec();

    // Fetch booking availability data for this service
    const bookingAvailability = await BookingAvailability.find()
      .populate("adminId")
      .exec();

    // Fetch all testimonials related to this child service
    const relatedTestimonials = await Testimonial.find({
      relatedChikfdServices: childServiceId,
    })
      .populate("relatedService")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch all industries related to this child service
    const relatedIndustries = await Industry.find({
      relatedChikfdServices: childServiceId,
    })
      .populate("relatedServices")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    return res.status(200).json({
      success: true,
      message: "Child service with all related data fetched successfully",
      data: {
        ...childService.toObject(),
        parentService: parentService,
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
    console.error("Error fetching child service with related data:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching child service",
      error: error.message,
    });
  }
};

// GET all child services by parent service ID

module.exports = {
  getAllChildServices,
  getSingleChildService,
};
