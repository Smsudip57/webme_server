const mongoose = require("mongoose");


const bulletsSchema = new mongoose.Schema({
  style: { 
    type: String, 
    enum: ["number", "dot", "roman"], 
    required: true,
    default: "dot"
  },
  content: { 
    type: String, 
    required: true,
    trim: true 
  },
});

const PointSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true 
  },
  explanationType: { 
    type: String,
    enum: ['article', 'bullets'], 
    required: true,
    default: 'article'
  }, 
  article: { 
    type: String,
    required: function() {
      return this.explanationType === 'article';
    },
    trim: true
  },
  bullets: { 
    type: [bulletsSchema],
    validate: {
      validator: function(v) {
        if (this.explanationType === 'bullets') {
          return Array.isArray(v) && v.length > 0;
        }
        return true;
      },
      message: 'At least one bullet point is required when explanation type is bullets'
    }
  }, 
  image: { 
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^(http|https):\/\/|^\/|^[^\/]/.test(v);
      },
      message: props => `${props.value} is not a valid image path or URL`
    }
  },
});

const ArticleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  Image: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^(http|https):\/\/|^\/|^[^\/]/.test(v);
      },
      message: props => `${props.value} is not a valid image path or URL`
    }
  },
  introduction: { type: String, required: true },
  mainSections: [PointSchema],
  conclusion: { type: String, required: true },
  tags: [String],
  relatedServices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  }],
  relatedIndustries: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Industry'
  }],
  relatedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  relatedChikfdServices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChildService'
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  }
}, { timestamps: true });

const KnowledgeBase = mongoose.models.KnowledgeBase || mongoose.model("KnowledgeBase", ArticleSchema);

module.exports = KnowledgeBase;