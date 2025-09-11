const mongoose = require("mongoose");

const bookingAvailabilitySchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
      required: function () {
        return this.isRecurring;
      },
      validate: {
        validator: function (value) {
          // dayOfWeek is required only if isRecurring is true
          if (this.isRecurring && (value === null || value === undefined)) {
            return false;
          }
          return true;
        },
        message: "dayOfWeek is required when isRecurring is true",
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
    slotDuration: {
      type: Number,
      required: true,
      min: 1,
      max: 480, // 8 hours max
      default: 30,
    },
    isRecurring: {
      type: Boolean,
      required: true,
      default: false,
    },
    specificDate: {
      type: Date,
      required: function () {
        return !this.isRecurring;
      },
      validate: {
        validator: function (value) {
          // specificDate is required only if isRecurring is false
          if (!this.isRecurring && !value) {
            return false;
          }
          return true;
        },
        message: "specificDate is required when isRecurring is false",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for better query performance
bookingAvailabilitySchema.index({ adminId: 1, dayOfWeek: 1 });
bookingAvailabilitySchema.index({ adminId: 1, specificDate: 1 });
bookingAvailabilitySchema.index({ adminId: 1, isRecurring: 1 });

// Virtual for getting day name
bookingAvailabilitySchema.virtual("dayName").get(function () {
  if (this.dayOfWeek !== null && this.dayOfWeek !== undefined) {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return days[this.dayOfWeek];
  }
  return null;
});

// Virtual for calculating total slots
bookingAvailabilitySchema.virtual("totalSlots").get(function () {
  const start = this.startTime.split(":").map(Number);
  const end = this.endTime.split(":").map(Number);

  const startMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];

  const totalMinutes = endMinutes - startMinutes;
  return Math.floor(totalMinutes / this.slotDuration);
});

// Pre-save validation
bookingAvailabilitySchema.pre("save", function (next) {
  // Validate that endTime is after startTime
  const start = this.startTime.split(":").map(Number);
  const end = this.endTime.split(":").map(Number);

  const startMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];

  if (endMinutes <= startMinutes) {
    return next(new Error("endTime must be after startTime"));
  }

  // Validate that there's enough time for at least one slot
  const totalMinutes = endMinutes - startMinutes;
  if (totalMinutes < this.slotDuration) {
    return next(
      new Error("Time duration must be at least as long as slot duration")
    );
  }

  next();
});

// Static methods
bookingAvailabilitySchema.statics.findByAdmin = function (adminId) {
  return this.find({ adminId, isActive: true });
};

bookingAvailabilitySchema.statics.findRecurringByAdmin = function (adminId) {
  return this.find({ adminId, isRecurring: true, isActive: true });
};

bookingAvailabilitySchema.statics.findSpecificDateByAdmin = function (
  adminId,
  date
) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    adminId,
    isRecurring: false,
    specificDate: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
    isActive: true,
  });
};

// Instance methods
bookingAvailabilitySchema.methods.generateTimeSlots = function () {
  const slots = [];
  const start = this.startTime.split(":").map(Number);
  const end = this.endTime.split(":").map(Number);

  let currentMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];

  while (currentMinutes + this.slotDuration <= endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const minutes = currentMinutes % 60;

    const timeString = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
    slots.push(timeString);

    currentMinutes += this.slotDuration;
  }

  return slots;
};

const BookingAvailability = mongoose.model(
  "BookingAvailability",
  bookingAvailabilitySchema
);

module.exports = BookingAvailability;
