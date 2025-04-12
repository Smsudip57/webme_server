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
  introduction: { type: String, required: true },
  mainSections: [SectionSchema],
  conclusion: { type: String, required: true },
  tags: [String],
  relatedServices: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  relatedIndustries: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Industry'
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  }
}, { timestamps: true });

const KnowledgeBase = mongoose.models.KnowledgeBase || mongoose.model("KnowledgeBase", ArticleSchema);

module.exports = KnowledgeBase;