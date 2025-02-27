const mongoose = require("mongoose");

const PointSchema = new mongoose.Schema({
  title: { type: String, required: true },
  explanation: { type: String, required: true }, // Fixed "Explaination" typo
});

const BlogSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    image: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    points: [PointSchema], // Array of points
    relatedService:{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Service'
        },
        relatedIndustries:{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Industry'
        },
  },
  { timestamps: true }
);

const Blog = mongoose.models.Blog || mongoose.model("Blog", BlogSchema);

module.exports = Blog;
