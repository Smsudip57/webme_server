const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, "Please use a valid email address."],
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  role: {
    type: String,
    enum: ["vendor", "user", "admin", "freelancer"],
    default: "user",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  profile: {
    name: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    companyRole: {
      type: String,
      maxlength: 300,
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    companyImageUrl: {
      type: String,
      default: "",
    },
    companyName: {
      type: String,
      trim: true,
    },
  },
  isSuspended: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  isApproved: {
    type: String,
    enum: ["approved", "pending", "rejected"],
    default: "pending",
  },
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

module.exports = User;
