const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Childservices",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (value) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        message: "Please provide a valid email address",
      },
    },
    date: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          // Ensure booking date is not in the past
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return value >= today;
        },
        message: "Booking date cannot be in the past",
      },
    },
    startTime: {
      type: String,
      required: true,
      validate: {
        validator: function (value) {
          // Validate time format HH:MM (24-hour format)
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
        },
        message: "startTime must be in HH:MM format (24-hour)",
      },
    },
    endTime: {
      type: String,
      required: true,
      validate: {
        validator: function (value) {
          // Validate time format HH:MM (24-hour format)
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
        },
        message: "endTime must be in HH:MM format (24-hour)",
      },
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "ended", "canceled"],
      default: "pending",
      required: true,
    },
    // Additional useful fields
    phoneNumber: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    cancelReason: {
      type: String,
      maxlength: 200,
    },
    confirmedAt: {
      type: Date,
    },
    canceledAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for better query performance
bookingSchema.index({ date: 1, startTime: 1 });
bookingSchema.index({ email: 1, date: 1 });
bookingSchema.index({ status: 1, date: 1 });
bookingSchema.index({ userId: 1, status: 1 });

// Virtual for full date-time start
bookingSchema.virtual("startDateTime").get(function () {
  if (this.date && this.startTime) {
    const [hours, minutes] = this.startTime.split(":").map(Number);
    const dateTime = new Date(this.date);
    dateTime.setHours(hours, minutes, 0, 0);
    return dateTime;
  }
  return null;
});

// Virtual for full date-time end
bookingSchema.virtual("endDateTime").get(function () {
  if (this.date && this.endTime) {
    const [hours, minutes] = this.endTime.split(":").map(Number);
    const dateTime = new Date(this.date);
    dateTime.setHours(hours, minutes, 0, 0);
    return dateTime;
  }
  return null;
});

// Virtual for duration in minutes
bookingSchema.virtual("durationMinutes").get(function () {
  if (this.startTime && this.endTime) {
    const start = this.startTime.split(":").map(Number);
    const end = this.endTime.split(":").map(Number);

    const startMinutes = start[0] * 60 + start[1];
    const endMinutes = end[0] * 60 + end[1];

    return endMinutes - startMinutes;
  }
  return 0;
});

// Virtual to check if booking is for a guest
bookingSchema.virtual("isGuestBooking").get(function () {
  return !this.userId;
});

// Pre-save validation
bookingSchema.pre("save", function (next) {
  // Validate that endTime is after startTime
  const start = this.startTime.split(":").map(Number);
  const end = this.endTime.split(":").map(Number);

  const startMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];

  if (endMinutes <= startMinutes) {
    return next(new Error("endTime must be after startTime"));
  }

  // Set timestamp fields based on status changes
  if (this.isModified("status")) {
    const now = new Date();

    switch (this.status) {
      case "confirmed":
        if (!this.confirmedAt) {
          this.confirmedAt = now;
        }
        break;
      case "canceled":
        if (!this.canceledAt) {
          this.canceledAt = now;
        }
        break;
      case "ended":
        if (!this.endedAt) {
          this.endedAt = now;
        }
        break;
    }
  }

  next();
});

// Static methods
bookingSchema.statics.findByUser = function (userId) {
  return this.find({ userId }).sort({ date: 1, startTime: 1 });
};

bookingSchema.statics.findByEmail = function (email) {
  return this.find({ email: email.toLowerCase() }).sort({
    date: 1,
    startTime: 1,
  });
};

bookingSchema.statics.findByDate = function (date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  }).sort({ startTime: 1 });
};

bookingSchema.statics.findByStatus = function (status) {
  return this.find({ status }).sort({ date: 1, startTime: 1 });
};

bookingSchema.statics.findUpcoming = function () {
  const now = new Date();
  return this.find({
    date: { $gte: now },
    status: { $in: ["pending", "confirmed"] },
  }).sort({ date: 1, startTime: 1 });
};

// Instance methods
bookingSchema.methods.confirm = function () {
  this.status = "confirmed";
  this.confirmedAt = new Date();
  return this.save();
};

bookingSchema.methods.cancel = function (reason = null) {
  this.status = "canceled";
  this.canceledAt = new Date();
  if (reason) {
    this.cancelReason = reason;
  }
  return this.save();
};

bookingSchema.methods.end = function () {
  this.status = "ended";
  this.endedAt = new Date();
  return this.save();
};

bookingSchema.methods.isOverlapping = async function (
  date,
  startTime,
  endTime
) {
  const start1 = startTime.split(":").map(Number);
  const end1 = endTime.split(":").map(Number);
  const start2 = this.startTime.split(":").map(Number);
  const end2 = this.endTime.split(":").map(Number);

  const start1Minutes = start1[0] * 60 + start1[1];
  const end1Minutes = end1[0] * 60 + end1[1];
  const start2Minutes = start2[0] * 60 + start2[1];
  const end2Minutes = end2[0] * 60 + end2[1];

  // Check if dates are the same and times overlap
  return (
    this.date.toDateString() === date.toDateString() &&
    start1Minutes < end2Minutes &&
    end1Minutes > start2Minutes
  );
};

const Booking = mongoose.model("Booking", bookingSchema);

module.exports = Booking;
