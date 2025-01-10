const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    Title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    deltail:{
      type: String,
      required: [true, 'Deltail is required'],
      trim: true,
    },
    moreDetail: {
        type: String,
        required: [true, 'More details is required'],
        trim: true,
    },
    image: {
      type: String,
      required: [true, 'Image is required'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'Branding',
        'Workfrom Anywhere',
        'Modern Workplace',
        'Digital',
        'Endless Support'
      ],
    }
  },
  {
    timestamps: true,
  }
);


const Service = mongoose.models.Service || mongoose.model('Service', serviceSchema);

module.exports = Service;
