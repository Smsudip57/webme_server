const mongoose = require('mongoose');


const pointsSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Point title is required'],
        trim: true,
    },
    detail: {
        type: String,
        required: [true, 'Point detail is required'],
        trim: true,
    },
});

const sectionsSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Section title is required'],
        trim: true,
    },
    image: {
        type: String,
        required: [true, 'Section image is required'],
        trim: true,
        validate: {
            validator: function (v) {
                // Basic URL validation for image path
                return /^(http|https):\/\/|^\/|^[^\/]/.test(v);
            },
            message: props => `${props.value} is not a valid image path or URL`
        }
    },
    points: {
        type: [pointsSchema],
        validate: {
            validator: function (v) {
                return v.length > 0;
            },
            message: 'At least one point is required in a section',
        },
    },
});

const productSchema = new mongoose.Schema(
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
     slug:{
          type: String,
          required: [true, 'Slug is required'],
          unique: true,
          trim: true,
          lowercase: true,
          validate: {
            validator: function (v) {
              return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
            },
            message: props => `${props.value} is not a valid slug format`
          }
        },
    moreDetail: {
      type: String,
      required: [true, 'Detail is required'],
      trim: true,
    },
    image: {
      type: String,
      required: [true, 'Image is required'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Service is required'],
    },
    sections: {
      type: [sectionsSchema],
      validate: {
        validator: function (v) {
          return v.length > 0;
        },
        message: 'At least one section is required',
      },
    },
  },
  {
    timestamps: true,
  }
);

const Pro= mongoose.models.ChildService || mongoose.model('ChildService', productSchema);

module.exports = Pro;
