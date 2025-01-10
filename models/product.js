const mongoose = require('mongoose');

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
    image: {
      type: String,
      required: [true, 'Image is required'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Service',
      required: [true, 'Category is required'],
    },
    subHeading1:{
      type: String,
      required: [true, 'SubHeading1 is required'],
      trim: true,
    },
    subHeading1edtails:{
      type: String,
      required: [true, 'SubHeading1 is required'],
      trim: true,
    },
    subHeading2:{
      type: String,
      required: [true, 'SubHeading1 is required'],
      trim: true,
    },
    subHeading2edtails:{
      type: String,
      required: [true, 'SubHeading1 is required'],
      trim: true,
    },
    subHeading3:{
      type: String,
      required: [true, 'SubHeading1 is required'],
      trim: true,
    },
    subHeading3edtails:{
      type: String,
      required: [true, 'SubHeading1 is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

module.exports = Product;
