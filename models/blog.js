const mongoose = require("mongoose");
const slugify = require("slugify");
const emojiRegex = require('emoji-regex');


const BlogSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    image: { type: String, required: true },
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
    description: { type: String, required: true },
    contents: { type: String, required: true },
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
      ref: 'Parentservice'
    }],
    relatedChikfdServices: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Childservices'
    }],
  },
  { timestamps: true }
);

// Function to generate unique slug
async function generateUniqueSlug(title, blogId = null) {
  // Remove all emojis using the emoji-regex library
  const regex = emojiRegex();
  const titleWithoutEmojis = title.replace(regex, '');

  const baseSlug = slugify(titleWithoutEmojis, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@#$%^&={}[\]|\\:";'<>?,./]/g
  });

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = { slug };
    if (blogId) {
      query._id = { $ne: blogId };
    }

    const existingBlog = await Blog.findOne(query);
    if (!existingBlog) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// Pre-save middleware to generate slug
BlogSchema.pre('save', async function (next) {
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
BlogSchema.pre(['findOneAndUpdate', 'updateOne'], async function (next) {
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

const Blog = mongoose.models.Blog || mongoose.model("Blog", BlogSchema);

module.exports = Blog;
