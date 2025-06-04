const mongoose = require("mongoose");

const SubPointSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true }
});

const SectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  points: [SubPointSchema]
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
  mainSections: [SectionSchema],
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