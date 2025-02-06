const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema(
  {
    Testimonial: {
      type: String,
      required: [true, 'Testimonial is required'],
      trim: true,
    },
    video:{
        type: String,
        required: [true, 'Video is required'],
    },
    image: {
      type: String,
      required: [true, 'Image is required'],
    },
    postedBy:{
        type:String,
        required: [true, 'Author name is required'],
    },
    role:{
        type:String,
        required: [true, 'Role of the author is required'],
    },
    relatedService:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
    },
    relatedIndustries:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Industry'
    },
    relatedUser:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}
);

const Testimonial = mongoose.models.Testimonial || mongoose.model('Testimonial', testimonialSchema);

module.exports = Testimonial;
