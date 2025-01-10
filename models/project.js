const mongoose = require('mongoose');


const projectSchema = new mongoose.Schema(
  {
    Title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    detail: {
      type: String,
      required: [true, 'Detail is required'],
      trim: true,
    },
    image: {
      type: String,
      required: [true, 'Image is required'],
    },
    section: [{
      Heading: {
        type: String,
        required: [true, 'Heading is required'],
        trim: true,
      },
      image: {
        type: String,
        required: [true, 'Image1 is required'],
      },
      subHeading1: {
        type: String,
        required: [true, 'SubHeading1 is required'],
        trim: true,
      },
      subHeading2: {
        type: String,
        required: [true, 'SubHeading2 is required'],
        trim: true,
      },
      subHeading3: {
        type: String,
        required: [true, 'SubHeading3 is required'],
        trim: true,
      },
      subHeadingdetails1: {
        type: String,
        required: [true, 'SubHeadingdetails1 is required'],
        trim: true,
      },
      subHeadingdetails2: {
        type: String,
        required: [true, 'SubHeadingdetails2 is required'],
        trim: true,
      },
      subHeadingdetails3: {
        type: String,
        required: [true, 'SubHeadingdetails3 is required'],
        trim: true,
      },
    }]
  },
  {
    timestamps: true,
  }
);

const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);

module.exports = Project;
