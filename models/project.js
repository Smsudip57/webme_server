const mongoose = require("mongoose");




const pointsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Point title is required"],
    trim: true,
  },
  detail: {
    type: String,
    required: [true, "Point detail is required"],
    trim: true,
  },
});

const sectionsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Section title is required"],
    trim: true,
  },
  image: {
    type: [String],
    required: [true, "Section image is required"],
    trim: true,
    validate: {
      validator: function (v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: "At least one image is required for each section"
    },
  },
  points: {
    type: [pointsSchema],
    validate: {
      validator: function (v) {
        return v.length > 0;
      },
      message: "At least one point is required in a section",
    },
  },
});

const projectSchema = new mongoose.Schema(
  {
    Title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v) {
          return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
        },
        message: (props) => `${props.value} is not a valid slug format`,
      },
    },
    relatedServices: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service'
    }],
    relatedProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Parentservice'
    }],
    relatedChikfdServices: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Childservices'
    }],
    detail: {
      type: String,
      required: [true, "Detail is required"],
      trim: true,
    },
    media: {
      url: {
        type: String,
        required: [true, "Media URL is required"],
      },
      type: {
        type: String,
        enum: ["image", "video"],
        required: [true, "Media type is required"],
        default: "image",
      },
    },
    section: {
      type: [sectionsSchema],
      validate: {
        validator: function (v) {
          return v.length > 0;
        },
        message: "At least one section is required in a project",
      },
    },
  },
  {
    timestamps: true,
  }
);

const Project =
  mongoose.models.Project || mongoose.model("Project", projectSchema);

module.exports = Project;
