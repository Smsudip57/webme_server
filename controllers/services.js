const express = require("express");
const path = require("path");
const fs = require("fs");
const Service = require("../models/service");
const ParentService = require("../models/Parentservice");
const ChildService = require("../models/childService");
const Project = require("../models/project");
const Testimonial = require("../models/testimonial");
const Industry = require("../models/industry");
const Blog = require("../models/blog");
const KnowledgeBase = require("../models/knowledgebase");
const Faq = require("../models/faq");
const Booking = require("../models/bookings");
const BookingAvailability = require("../models/bookingAvailability");
const ServiceDetails = require("../models/servicedetails");
const { FileManager } = require("../helpers/FileManager");



// GET all services
const getAllServices = async (req, res) => {
  try {
    const services = await Service.find().exec();

    if (!services || services.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No services found",
        data: [],
      });
    }

    // Fetch ServiceDetails for each service
    const servicesWithDetails = await Promise.all(
      services.map(async (service) => {
        const serviceDetails = await ServiceDetails.findOne({
          relatedServices: service._id,
        })
          .populate("relatedServices")
          .exec();

        return {
          ...service.toObject(),
          details: serviceDetails || null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Services fetched successfully",
      data: servicesWithDetails,
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching services",
      error: error.message,
    });
  }
};

// GET single service by ID or SLUG with ALL related data
// Includes: Parent Services, Child Services, Blogs, FAQs, Knowledge Base, Projects, Testimonials, Industries, Bookings
const getSingleService = async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    let service;
    const isValidObjectId = idOrSlug.match(/^[0-9a-fA-F]{24}$/);

    // Search by ID if it's a valid MongoDB ObjectId, otherwise search by slug
    if (isValidObjectId) {
      service = await Service.findById(idOrSlug).exec();
    } else {
      service = await Service.findOne({ slug: idOrSlug }).exec();
    }

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const serviceId = service._id;

    // Fetch ServiceDetails for this service
    const serviceDetails = await ServiceDetails.findOne({
      relatedServices: serviceId,
    })
      .populate("relatedServices")
      .exec();

    // Fetch all parent services related to this service (via category field)
    const parentServices = await ParentService.find({ category: serviceId })
      .populate("category")
      .exec();

    // Extract all parent service IDs to find child services
    const parentServiceIds = parentServices.map((ps) => ps._id);

    // Fetch all child services for the parent services of this service
    const childServices = await ChildService.find({
      category: { $in: parentServiceIds },
    })
      .populate("category")
      .exec();

    // Extract all child service IDs
    const childServiceIds = childServices.map((cs) => cs._id);

    // Nest child services inside their respective parent services
    const parentServicesWithChildren = parentServices.map((parent) => {
      const childrenForParent = childServices.filter(
        (child) => child.category._id.toString() === parent._id.toString()
      );
      return {
        ...parent.toObject(),
        children: childrenForParent,
      };
    });

    // Fetch all blogs related to this service
    const relatedBlogs = await Blog.find({
      relatedServices: serviceId,
    })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch all FAQs related to this service
    const relatedFaqs = await Faq.find({
      relatedServices: serviceId,
    })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch all knowledge base articles related to this service
    const relatedKnowledgeBase = await KnowledgeBase.find({
      relatedServices: serviceId,
    })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch all projects related to this service
    const relatedProjects = await Project.find({
      relatedServices: serviceId,
    })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .exec();

    // Fetch all testimonials related to this service
    const relatedTestimonials = await Testimonial.find({
      relatedServices: serviceId,
    })
      .populate("relatedServices")
      .populate("relatedIndustries")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch all industries related to this service
    const relatedIndustries = await Industry.find({
      relatedServices: serviceId,
    })
      .populate("relatedServices")
      .populate("relatedProducts")
      .populate("relatedChikfdServices")
      .exec();

    // Fetch all bookings for child services of this service
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

    return res.status(200).json({
      success: true,
      message: "Service with all related data fetched successfully",
      data: {
        ...service.toObject(),
        details: serviceDetails,
        parentServices: parentServicesWithChildren,
        relatedBlogs: relatedBlogs,
        relatedFaqs: relatedFaqs,
        relatedKnowledgeBase: relatedKnowledgeBase,
        relatedProjects: relatedProjects,
        relatedTestimonials: relatedTestimonials,
        relatedIndustries: relatedIndustries,
        relatedBookings: relatedBookings,
        bookingAvailability: bookingAvailability,
      },
    });
  } catch (error) {
    console.error("Error fetching service with related data:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching service",
      error: error.message,
    });
  }
};

// CREATE a new service
const createService = async (req, res) => {
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
};

// EDIT an existing service
const editService = async (req, res) => {
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

    if (resolvedBodyImage) {
      service.image = resolvedBodyImage;
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
};

// DELETE a service
const deleteService = async (req, res) => {
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
};

module.exports = {
  getAllServices,
  getSingleService,
  createService,
  editService,
  deleteService,
};
