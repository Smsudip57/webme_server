const mongoose = require("mongoose");
const slugify = require("slugify");

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
    required: function () {
      return this.explanationType === 'article';
    },
    trim: true
  },
  bullets: {
    type: [bulletsSchema],
    validate: {
      validator: function (v) {
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
      validator: function (v) {
        if (!v) return true;
        return /^(http|https):\/\/|^\/|^[^\/]/.test(v);
      },
      message: props => `${props.value} is not a valid image path or URL`
    }
  },
});

const ArticleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function (v) {
        return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
      },
      message: 'Slug must contain only lowercase letters, numbers, and hyphens'
    }
  },
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

// Function to generate unique slug
async function generateUniqueSlug(title, articleId = null) {
  const baseSlug = slugify(title, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = { slug };
    if (articleId) {
      query._id = { $ne: articleId };
    }

    const existingArticle = await KnowledgeBase.findOne(query);
    if (!existingArticle) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// Pre-save middleware to generate slug
ArticleSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('title')) {
    try {
      this.slug = await generateUniqueSlug(this.title, this._id);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Pre-update middleware for findOneAndUpdate
ArticleSchema.pre(['findOneAndUpdate', 'updateOne'], async function (next) {
  const update = this.getUpdate();

  if (update.title || update.$set?.title) {
    try {
      const title = update.title || update.$set?.title;
      const docId = this.getQuery()._id;
      const slug = await generateUniqueSlug(title, docId);

      if (update.$set) {
        update.$set.slug = slug;
      } else {
        update.slug = slug;
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

const KnowledgeBase = mongoose.models.KnowledgeBase || mongoose.model("KnowledgeBase", ArticleSchema);

module.exports = KnowledgeBase;