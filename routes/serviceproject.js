const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const User = require('../models/user');
const Service = require('../models/service');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const UPLOAD_DIR = path.join(process.cwd(), 'public');
const Project = require('../models/project');
const formidable = require('formidable');
const Blog = require('../models/blog');
const KnowledgeBase = require('../models/knowledgebase');
const Faq = require('../models/faq');
const ServiceDetails = require('../models/servicedetails');

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
router.post('/service/createservice', upload.single('image'), async (req, res) => {
  try {
    const { Title, detail, moreDetail, category, slug } = req.body;
    const file = req.file;

    if (!Title || !detail || !moreDetail || !category || !file || !slug) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Validate slug format
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Slug must be lowercase, containing only letters, numbers, and hyphens'
      });
    }

    // Check if slug already exists
    const existingService = await Service.findOne({ slug });
    if (existingService) {
      return res.status(400).json({ 
        success: false, 
        message: 'A service with this slug already exists. Please use a unique slug.'
      });
    }

    const imageUrl = getImageUrl(file.filename);
    console.log(imageUrl);
    const newService = new Service({
      Title,
      slug,
      deltail: detail,
      moreDetail,
      category,
      image: imageUrl,
    });

    await newService.save();

    return res.status(200).json({
      success: true,
      message: 'Service created successfully',
      service: newService,
    });
  } catch (error) {
    console.error('Error creating service:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.use('/service/deleteservice', express.json());

router.post('/service/deleteservice', async (req, res) => {
  try {
    const { serviceId } = req.body;
    if (!serviceId) {
      return res.status(400).json({
        success: false,
        message: 'Service ID is required',
      });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    if (service.image) {
      const imagePath = path.join(process.cwd(), 'public', service.image.split('/').pop());
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error(`Error deleting image file: ${err.message}`);
        }
      });
    }

    await Service.findByIdAndDelete(serviceId);

    return res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while deleting the service',
    });
  }
});

router.post('/service/editservice', upload.single('image'), async (req, res) => {
  try {
    const { serviceId, Title, deltail, moreDetail, category, slug } = req.body;
    const file = req.file;

    if (!serviceId || !Title || !deltail || !category || !moreDetail || !slug) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.',
      });
    }

    // Validate slug format
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Slug must be lowercase, containing only letters, numbers, and hyphens'
      });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.',
      });
    }

    // Check if slug already exists and belongs to a different service
    if (service.slug !== slug) {
      const existingService = await Service.findOne({ slug });
      if (existingService && existingService._id.toString() !== serviceId) {
        return res.status(400).json({ 
          success: false, 
          message: 'A service with this slug already exists. Please use a unique slug.'
        });
      }
    }

    service.Title = Title;
    service.slug = slug;
    service.deltail = deltail;
    service.category = category;
    service.moreDetail = moreDetail;

    if (file) {
      if (service.image) {
        const imagePath = path.join(process.cwd(), 'public', service.image.split('/').pop());
        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (err) {
          console.error('Error deleting old image:', err);
        }
      }

      const imageUrl = getImageUrl(file.filename);
      service.image = imageUrl;
    }

    await service.save();

    return res.status(200).json({
      success: true,
      message: 'Service updated successfully.',
      service: service,
    });
  } catch (error) {
    console.error('Error updating service:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
});


router.post('/project/create', async (req, res) => {
  try {
    const form = new formidable.IncomingForm({ multiples: true }); // Enable handling multiple files
    form.uploadDir = UPLOAD_DIR;
    form.keepExtensions = true;

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Formidable error:', err);
        return res.status(500).json({ success: false, message: 'Error parsing form data.' });
      }

      // Extract basic fields
      const Title = Array.isArray(fields.Title) ? fields.Title[0] : fields.Title;
      const detail = Array.isArray(fields.detail) ? fields.detail[0] : fields.detail;
      const slug = Array.isArray(fields.slug) ? fields.slug[0] : fields.slug;
      const mediaType = Array.isArray(fields.mediaType) ? fields.mediaType[0] : fields.mediaType || 'image';
      const relatedServices = Array.isArray(fields.relatedServices) ? fields.relatedServices[0] : fields.relatedServices;

      // Validate required fields
      const hasMediaFile = files.media && files.media[0];
      if (!Title || !detail || !hasMediaFile || !slug || !relatedServices) {
        return res.status(400).json({ success: false, message: 'All fields are required, including related services.' });
      }

      // Validate slug format
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Slug must be lowercase, containing only letters, numbers, and hyphens'
        });
      }

      // Check if slug already exists
      const existingProject = await Project.findOne({ slug });
      if (existingProject) {
        return res.status(400).json({ 
          success: false, 
          message: 'A project with this slug already exists. Please use a unique slug.'
        });
      }

      // Check if the related service exists
      const serviceExists = await Service.findById(relatedServices);
      if (!serviceExists) {
        return res.status(400).json({
          success: false,
          message: 'The specified related service does not exist.'
        });
      }

      // Process media file
      const mediaFile = files.media[0];
      if (!mediaFile.filepath) {
        return res.status(400).json({ success: false, message: 'Media file upload failed.' });
      }

      const mediaFilename = `${Date.now()}-${mediaFile.originalFilename}`;
      const mediaPath = path.join(form.uploadDir, mediaFilename);

      try {
        fs.renameSync(mediaFile.filepath, mediaPath);
      } catch (error) {
        console.error('Error moving media file:', error);
        return res.status(500).json({ success: false, message: 'Error saving media file.' });
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
          const imageFilesArray = Array.isArray(sectionImageFiles) ? sectionImageFiles : [sectionImageFiles];
          
          for (const imageFile of imageFilesArray) {
            if (imageFile && imageFile.filepath) {
              const imageFilename = `${Date.now()}-${imageFile.originalFilename}`;
              const imagePath = path.join(form.uploadDir, imageFilename);
              
              try {
                fs.renameSync(imageFile.filepath, imagePath);
                sectionImages.push(getImageUrl(imageFilename));
              } catch (error) {
                console.error(`Error moving section ${sectionIndex} image:`, error);
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
        
        while (fields[`section[${sectionIndex}][points][${pointIndex}][title]`]) {
          const pointTitle = Array.isArray(fields[`section[${sectionIndex}][points][${pointIndex}][title]`])
            ? fields[`section[${sectionIndex}][points][${pointIndex}][title]`][0]
            : fields[`section[${sectionIndex}][points][${pointIndex}][title]`];
            
          const pointDetail = Array.isArray(fields[`section[${sectionIndex}][points][${pointIndex}][detail]`])
            ? fields[`section[${sectionIndex}][points][${pointIndex}][detail]`][0]
            : fields[`section[${sectionIndex}][points][${pointIndex}][detail]`];
            
          if (pointTitle && pointDetail) {
            points.push({
              title: pointTitle,
              detail: pointDetail
            });
          }
          
          pointIndex++;
        }

        if (title && sectionImages.length > 0 && points.length > 0) {
          sections.push({
            title,
            image: sectionImages, // Now storing an array of image URLs
            points
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
        media: {
          url: mediaUrl,
          type: mediaType
        },
        section: sections
      });

      try {
        await newProject.save();
        return res.status(201).json({
          success: true,
          message: 'Project created successfully.',
        });
      } catch (saveError) {
        console.error('Error saving project to DB:', saveError);
        return res.status(500).json({
          success: false,
          message: 'Failed to save project to the database.',
        });
      }
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
});

router.post('/project/edit', async (req, res) => {
  try {
    const form = new formidable.IncomingForm({ multiples: true });
    form.uploadDir = UPLOAD_DIR;
    form.keepExtensions = true;

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Formidable error:', err);
        return res.status(500).json({ success: false, message: 'Error parsing form data.' });
      }

      // Extract project ID
      const projectId = Array.isArray(fields._id) ? fields._id[0] : fields._id;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'Project ID is required.'
        });
      }

      // Find existing project
      const existingProject = await Project.findById(projectId);
      if (!existingProject) {
        return res.status(404).json({
          success: false,
          message: 'Project not found.'
        });
      }

      // Extract basic fields
      const Title = Array.isArray(fields.Title) ? fields.Title[0] : fields.Title;
      const detail = Array.isArray(fields.detail) ? fields.detail[0] : fields.detail;
      const slug = Array.isArray(fields.slug) ? fields.slug[0] : fields.slug;
      const mediaType = Array.isArray(fields.mediaType) ? fields.mediaType[0] : fields.mediaType || existingProject.media.type;
      const relatedServices = Array.isArray(fields.relatedServices) ? fields.relatedServices[0] : fields.relatedServices;

      // Validate required fields
      if (!Title || !detail || !slug || !relatedServices) {
        return res.status(400).json({ 
          success: false, 
          message: 'All fields are required, including related services.' 
        });
      }

      // Validate slug format
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Slug must be lowercase, containing only letters, numbers, and hyphens'
        });
      }

      // Check if slug already exists and belongs to a different project
      if (slug !== existingProject.slug) {
        const slugExists = await Project.findOne({ slug, _id: { $ne: projectId } });
        if (slugExists) {
          return res.status(400).json({ 
            success: false, 
            message: 'A project with this slug already exists. Please use a unique slug.'
          });
        }
      }

      // Check if the related service exists
      const serviceExists = await Service.findById(relatedServices);
      if (!serviceExists) {
        return res.status(400).json({
          success: false,
          message: 'The specified related service does not exist.'
        });
      }

      // Update basic project fields
      existingProject.Title = Title;
      existingProject.slug = slug;
      existingProject.detail = detail;
      existingProject.relatedServices = relatedServices;

      // Process media file if provided
      if (files.media && files.media[0]) {
        const mediaFile = files.media[0];
        if (mediaFile.filepath) {
          const mediaFilename = `${Date.now()}-${mediaFile.originalFilename}`;
          const mediaPath = path.join(form.uploadDir, mediaFilename);

          try {
            // Delete old media file if it exists
            if (existingProject.media && existingProject.media.url) {
              const oldMediaPath = path.join(UPLOAD_DIR, existingProject.media.url.split('/').pop());
              if (fs.existsSync(oldMediaPath)) {
                fs.unlinkSync(oldMediaPath);
              }
            }

            // Save new media file
            fs.renameSync(mediaFile.filepath, mediaPath);
            existingProject.media.url = getImageUrl(mediaFilename);
            existingProject.media.type = mediaType;
          } catch (error) {
            console.error('Error processing media file:', error);
            return res.status(500).json({ success: false, message: 'Error saving media file.' });
          }
        }
      } else {
        // Update media type even if no new file is uploaded
        existingProject.media.type = mediaType;
      }

      // Process sections
      if (fields['section[0][title]']) {
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
          const keepImagesKeys = Object.keys(fields).filter(key => 
            key.startsWith(`section[${sectionIndex}][keepImages]`)
          );
          
          for (const key of keepImagesKeys) {
            const imageUrl = Array.isArray(fields[key]) ? fields[key][0] : fields[key];
            if (imageUrl) {
              sectionImages.push(imageUrl);
            }
          }
          
          // Process new uploaded images
          const sectionImageKeys = Object.keys(files).filter(key => 
            key.startsWith(`section[${sectionIndex}][image]`)
          );
          
          for (const key of sectionImageKeys) {
            const imageFile = files[key];
            // Handle both single file and array of files
            const imageFiles = Array.isArray(imageFile) ? imageFile : [imageFile];
            
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
          
          while (fields[`section[${sectionIndex}][points][${pointIndex}][title]`]) {
            const pointTitle = Array.isArray(fields[`section[${sectionIndex}][points][${pointIndex}][title]`])
              ? fields[`section[${sectionIndex}][points][${pointIndex}][title]`][0]
              : fields[`section[${sectionIndex}][points][${pointIndex}][title]`];
              
            const pointDetail = Array.isArray(fields[`section[${sectionIndex}][points][${pointIndex}][detail]`])
              ? fields[`section[${sectionIndex}][points][${pointIndex}][detail]`][0]
              : fields[`section[${sectionIndex}][points][${pointIndex}][detail]`];
              
            if (pointTitle && pointDetail) {
              points.push({
                title: pointTitle,
                detail: pointDetail
              });
            }
            
            pointIndex++;
          }

          // Validate section has required fields
          if (title && sectionImages.length > 0 && points.length > 0) {
            sections.push({
              title,
              image: sectionImages,
              points
            });
          } else {
            // Log what's missing for debugging
            const missing = [];
            if (!title) missing.push('title');
            if (sectionImages.length === 0) missing.push('images');
            if (points.length === 0) missing.push('points');
            
            console.warn(`Section ${sectionIndex} is missing required fields: ${missing.join(', ')}`);
          }
          
          sectionIndex++;
        }

        // Replace sections if we have new ones
        if (sections.length > 0) {
          existingProject.section = sections;
        } else {
          return res.status(400).json({
            success: false,
            message: 'At least one complete section with title, image, and points is required.'
          });
        }
      }

      try {
        await existingProject.save();
        return res.status(200).json({
          success: true,
          message: 'Project updated successfully.',
          project: existingProject
        });
      } catch (saveError) {
        console.error('Error saving updated project:', saveError);
        return res.status(500).json({
          success: false,
          message: 'Failed to save project updates to the database.',
          error: saveError.message
        });
      }
    });
  } catch (error) {
    console.error('Error updating project:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
});

router.use('/project/delete', express.json());

router.post('/project/delete', async (req, res) => {
  try {
    const { _id } = req.body;

    if (!_id) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required.',
      });
    }

    const project = await Project.findById(_id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found.',
      });
    }

    // Delete media files
    if (project.media && project.media.url) {
      const mediaPath = path.join(UPLOAD_DIR, project.media.url.split('/').pop());
      if (fs.existsSync(mediaPath)) {
        try {
          fs.unlinkSync(mediaPath);
        } catch (error) {
          console.error('Error deleting project media file:', error);
        }
      }
    }

    if (project.section && project.section.length > 0) {
      for (const section of project.section) {
        if (section.image && Array.isArray(section.image)) {
          for (const imageUrl of section.image) {
            const sectionImagePath = path.join(UPLOAD_DIR, imageUrl.split('/').pop());
            if (fs.existsSync(sectionImagePath)) {
              try {
                fs.unlinkSync(sectionImagePath);
              } catch (error) {
                console.error('Error deleting section image:', error);
              }
            }
          }
        }
      }
    }

    await project.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
});


router.post("/blog/create", upload.single("image"), async (req, res) => {
  try {
    const { type, title, description, points, relatedService, relatedIndustries } = req.body;
    const image = req.file ? getImageUrl(req.file.filename) : null;
    if (!type || !title || !description || !image || !points) {
      return res.status(400).json({ success: false, message: "All required fields must be provided" });
    }

    // Parse points if it's sent as a JSON string
    const parsedPoints = typeof points === "string" ? JSON.parse(points) : points;

    const newBlog = new Blog({
      type,
      image,
      title,
      description,
      points: parsedPoints,
      relatedService,
      relatedIndustries,
    });

    await newBlog.save();
    return res.status(201).json({ success: true, message: "Blog created successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});






router.post("/blog/edit", upload.single("image"), async (req, res) => {
  try {
    const { blogId, type, title, description, points, relatedService, relatedIndustries } = req.body;

    if (!blogId) {
      return res.status(400).json({ success: false, message: "Blog ID is required" });
    }

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }

    if (type) blog.type = type;
    if (title) blog.title = title;
    if (description) blog.description = description;

    if (req.file) {
      if (blog.image) {
        const oldImagePath = path.join(process.cwd(), 'public', blog.image.split('/').pop());
        try {
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (err) {
          console.error('Error deleting old blog image:', err);
        }
      }
      blog.image = getImageUrl(req.file.filename);
    }

    if (points) {
      const parsedPoints = typeof points === "string" ? JSON.parse(points) : points;
      blog.points = parsedPoints;
    }

    if (relatedService) blog.relatedService = relatedService;
    if (relatedIndustries) blog.relatedIndustries = relatedIndustries;

    await blog.save();
    return res.status(200).json({ success: true, message: "Blog updated successfully" });
  } catch (error) {
    console.error("Error updating blog:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});


router.use("/knowledgebase/create", express.json())
router.post("/knowledgebase/create", async (req, res) => {
  try {
    const {
      title,
      introduction,
      mainSections,
      conclusion,
      tags,
      relatedService,
      relatedIndustries,
      status = 'draft'
    } = req.body;
    // Check required fields
    // console.log(req.body)
    if (!title || !introduction || !conclusion || !mainSections) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing"
      });
    }

    // Parse mainSections if it's sent as a string
    let parsedMainSections;
    try {
      parsedMainSections = typeof mainSections === 'string'
        ? JSON.parse(mainSections)
        : mainSections;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid mainSections format"
      });
    }

    // Parse tags if they're sent as a string
    const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;

    const newArticle = new KnowledgeBase({
      title,
      introduction,
      mainSections: parsedMainSections,
      conclusion,
      tags: parsedTags || [],
      relatedServices: relatedService,
      relatedIndustries: relatedIndustries || [],
      status
    });

    await newArticle.save();
    // console.log(newArticle)

    return res.status(201).json({
      success: true,
      message: "Knowledge base article created successfully",
      KnowledgeBase: newArticle
    });

  } catch (error) {
    console.error("Error creating knowledge base article:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});


router.use("/knowledgebase/edit", express.json())
router.post("/knowledgebase/edit", async (req, res) => {
  try {
    const {
      articleId,
      title,
      introduction,
      mainSections,
      conclusion,
      tags,
      relatedServices,
      relatedIndustries,
      status
    } = req.body;

    // Check if article exists
    if (!articleId) {
      return res.status(400).json({
        success: false,
        message: "Article ID is required"
      });
    }

    const article = await KnowledgeBase.findById(articleId);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found"
      });
    }

    // Parse mainSections if it's sent as a string
    if (mainSections) {
      try {
        const parsedMainSections = typeof mainSections === 'string'
          ? JSON.parse(mainSections)
          : mainSections;
        article.mainSections = parsedMainSections;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid mainSections format"
        });
      }
    }

    // Parse tags if they're sent as a string
    if (tags) {
      const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      article.tags = parsedTags;
    }

    // Update other fields if provided
    if (title) article.title = title;
    if (introduction) article.introduction = introduction;
    if (conclusion) article.conclusion = conclusion;
    if (relatedServices) article.relatedServices = relatedServices;
    if (relatedIndustries) article.relatedIndustries = relatedIndustries;
    if (status) article.status = status;

    await article.save();

    return res.status(200).json({
      success: true,
      message: "Knowledge base article updated successfully",
      article
    });

  } catch (error) {
    console.error("Error updating knowledge base article:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});


router.use("/faq/create", express.json())
router.post("/faq/create", async (req, res) => {
  try {
    const {
      title,
      questions,
      relatedServices,
      relatedIndustries
    } = req.body;

    // Check required fields
    if (!title || !questions || !Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        message: "Title and questions array are required"
      });
    }

    // Validate questions format
    for (const qa of questions) {
      if (!qa.question || !qa.answer) {
        return res.status(400).json({
          success: false,
          message: "Each question must have both question and answer fields"
        });
      }
    }

    // Create new FAQ
    const newFaq = new Faq({
      title,
      questions,
      relatedServices: relatedServices || null,
      relatedIndustries: relatedIndustries || null
    });

    await newFaq.save();

    return res.status(201).json({
      success: true,
      message: "FAQ created successfully",
      faq: newFaq
    });

  } catch (error) {
    console.error("Error creating FAQ:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});



const nstorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/'); 
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExt = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + fileExt);
  }
});


const nupload = multer({ 
  storage: nstorage,
  fileFilter: function (req, file, cb) {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

router.post('/servicedetails/create', nupload.array('images'), async (req, res) => {
  try {
    const uploadedFiles = req.files.map(file =>
      `${process.env.CURRENT_URL}/public/${file.filename}`
    );

    const parsedSections = JSON.parse(req.body.sections);

    const sectionsWithImages = parsedSections.map((section, index) => {
      return {
        ...section,
        image: uploadedFiles[index] || section.image 
      };
    });

    const serviceDetails = new ServiceDetails({
      relatedServices: req.body.relatedServices,
      description: req.body.description,
      sections: sectionsWithImages
    });

    const savedServiceDetail = await serviceDetails.save();

    res.status(201).json({
      success: true,
      data: savedServiceDetail
    });
  } catch (error) {
    console.error('Error creating service details:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});



module.exports = router;
