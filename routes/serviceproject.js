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
    const form = new formidable.IncomingForm();
    form.uploadDir = UPLOAD_DIR; // Temporary upload directory
    form.keepExtensions = true;

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Formidable error:', err);
        return res.status(500).json({ success: false, message: 'Error parsing form data.' });
      }

      console.log('Fields:', fields);
      console.log('Files:', files);

      // Extracting plain string values from the arrays
      const Title = Array.isArray(fields.Title) ? fields.Title[0] : fields.Title;
      const detail = Array.isArray(fields.detail) ? fields.detail[0] : fields.detail;

      // Validate required fields
      if (!Title || !detail || !files.image || !files.image[0]) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
      }

      // Save the main project image
      const imageFile = files.image[0]; // Access the first element of the array
      if (!imageFile.filepath) {
        return res.status(400).json({ success: false, message: 'Main image upload failed.' });
      }

      const imageFilename = `${Date.now()}-${imageFile.originalFilename}`;
      const imagePath = path.join(form.uploadDir, imageFilename);

      try {
        fs.renameSync(imageFile.filepath, imagePath);
      } catch (error) {
        console.error('Error moving main image:', error);
        return res.status(500).json({ success: false, message: 'Error saving main image.' });
      }

      const imageUrl = getImageUrl(imageFilename);

      // Extract sections
      const sections = [];
      let sectionIndex = 0;

      while (fields[`section[${sectionIndex}][Heading]`]) {
        const section = {
          Heading: Array.isArray(fields[`section[${sectionIndex}][Heading]`]) ? fields[`section[${sectionIndex}][Heading]`][0] : fields[`section[${sectionIndex}][Heading]`],
          subHeading1: Array.isArray(fields[`section[${sectionIndex}][subHeading1]`]) ? fields[`section[${sectionIndex}][subHeading1]`][0] : fields[`section[${sectionIndex}][subHeading1]`],
          subHeadingdetails1: Array.isArray(fields[`section[${sectionIndex}][subHeadingdetails1]`]) ? fields[`section[${sectionIndex}][subHeadingdetails1]`][0] : fields[`section[${sectionIndex}][subHeadingdetails1]`],
          subHeading2: Array.isArray(fields[`section[${sectionIndex}][subHeading2]`]) ? fields[`section[${sectionIndex}][subHeading2]`][0] : fields[`section[${sectionIndex}][subHeading2]`],
          subHeadingdetails2: Array.isArray(fields[`section[${sectionIndex}][subHeadingdetails2]`]) ? fields[`section[${sectionIndex}][subHeadingdetails2]`][0] : fields[`section[${sectionIndex}][subHeadingdetails2]`],
          subHeading3: Array.isArray(fields[`section[${sectionIndex}][subHeading3]`]) ? fields[`section[${sectionIndex}][subHeading3]`][0] : fields[`section[${sectionIndex}][subHeading3]`],
          subHeadingdetails3: Array.isArray(fields[`section[${sectionIndex}][subHeadingdetails3]`]) ? fields[`section[${sectionIndex}][subHeadingdetails3]`][0] : fields[`section[${sectionIndex}][subHeadingdetails3]`],
        };

        const sectionImageFiles = files[`section[${sectionIndex}][image]`];
        if (sectionImageFiles && sectionImageFiles[0]) {
          const sectionImageFile = sectionImageFiles[0];
          const sectionImageFilename = `${Date.now()}-${sectionImageFile.originalFilename}`;
          const sectionImagePath = path.join(form.uploadDir, sectionImageFilename);

          if (sectionImageFile.filepath) {
            try {
              fs.renameSync(sectionImageFile.filepath, sectionImagePath);
              section.image = getImageUrl(sectionImageFilename);
            } catch (error) {
              console.error(`Error moving section ${sectionIndex} image:`, error);
              return res.status(500).json({
                success: false,
                message: `Error saving image for section ${sectionIndex}.`,
              });
            }
          }
        }

        sections.push(section);
        sectionIndex++;
      }

      // Save project to database
      const newProject = new Project({
        Title,
        detail,
        image: imageUrl,
        section: sections,
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
    const form = new formidable.IncomingForm();
    form.uploadDir = UPLOAD_DIR;  // Temporary upload directory
    form.keepExtensions = true;

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Formidable error:', err);
        return res.status(500).json({ success: false, message: 'Error parsing form data.' });
      }

      const { _id, Title, detail } = fields;
      if (!_id || !Title || !detail) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
      }

      // Find the existing project
      const project = await Project.findById(_id);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found.' });
      }

      // Handle main image
      let imageUrl = project.image;
      if (files.image && files.image[0]) {
        const imageFile = files.image[0];
        const imageFilename = `${Date.now()}-${imageFile.originalFilename}`;
        const imagePath = path.join(form.uploadDir, imageFilename);

        if (project.image && project.image !== 'null') {
          const oldImagePath = path.join(UPLOAD_DIR, project.image.split('/').pop());
          if (fs.existsSync(oldImagePath)) {
            try {
              fs.unlinkSync(oldImagePath); // Delete the old image if exists
            } catch (error) {
              console.error('Error deleting old image:', error);
            }
          }
        }

        try {
          fs.renameSync(imageFile.filepath, imagePath); // Move new image to the correct folder
        } catch (error) {
          console.error('Error moving main image:', error);
          return res.status(500).json({ success: false, message: 'Error saving main image.' });
        }

        const newImagePath = getImageUrl(imageFilename);
        imageUrl = newImagePath; // Update with the new image URL
      }

      // Handle sections and their images
      const sections = [];
      let sectionIndex = 0;

      while (fields[`section[${sectionIndex}][Heading]`]) {
        const Heading = fields[`section[${sectionIndex}][Heading]`][0];
        const subHeading1 = fields[`section[${sectionIndex}][subHeading1]`][0];
        const subHeadingdetails1 = fields[`section[${sectionIndex}][subHeadingdetails1]`][0];
        const subHeading2 = fields[`section[${sectionIndex}][subHeading2]`][0];
        const subHeadingdetails2 = fields[`section[${sectionIndex}][subHeadingdetails2]`][0];
        const subHeading3 = fields[`section[${sectionIndex}][subHeading3]`][0];
        const subHeadingdetails3 = fields[`section[${sectionIndex}][subHeadingdetails3]`][0];

        // Default to the existing section image if not provided
        let sectionImageUrl = project.section[sectionIndex]?.image || 'null';

        // Check for a new section image
        // console.log(files[`section[${sectionIndex}][image]`][0]);
        const sectionImageFile = files[`section[${sectionIndex}][image]`]?.[0];
        if (sectionImageFile) {
          console.log('present')
          const imageFilename = `${Date.now()}-${sectionImageFile.originalFilename}`;
          const newSectionImagePath = path.join(form.uploadDir, imageFilename);
          // const newSectionImagePath = getImageUrl(sectionImageFile.originalFilename);

          // Delete the old section image if it exists
          if (sectionImageUrl !== 'null') {
            const oldSectionImagePath = path.join(UPLOAD_DIR, sectionImageUrl.split('/').pop());
            if (fs.existsSync(oldSectionImagePath)) {
              try {
                fs.unlinkSync(oldSectionImagePath); // Delete the old section image
              } catch (error) {
                console.error('Error deleting old section image:', error);
              }
            }
          }
          try {
            fs.renameSync(sectionImageFile.filepath, newSectionImagePath); // Move new image to the correct folder
          } catch (error) {
            console.error('Error moving main image:', error);
            return res.status(500).json({ success: false, message: 'Error saving main image.' });
          }

          sectionImageUrl = getImageUrl(imageFilename); // Update with the new section image URL
        }

        sections.push({
          Heading,
          image: sectionImageUrl, // Save the section image URL (or 'null' if not provided)
          subHeading1,
          subHeadingdetails1,
          subHeading2,
          subHeadingdetails2,
          subHeading3,
          subHeadingdetails3,
        });

        sectionIndex++;
      }

      // Update the project fields
      project.Title = Title[0];
      project.detail = detail[0];
      project.image = imageUrl;
      project.section = sections;

      // Save the updated project
      await project.save();

      return res.status(200).json({ success: true, message: 'Project updated successfully.' });
    });
  } catch (error) {
    console.error('Error updating project:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});





router.use('/project/delete', express.json());

router.post('/project/delete', async (req, res) => {
  try {
    // Extract the project ID from the request body
    const { _id } = req.body;

    if (!_id) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required.',
      });
    }

    // Find and delete the project
    const project = await Project.findById(_id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found.',
      });
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
