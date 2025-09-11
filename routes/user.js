const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Service = require("../models/service");
const ChildService = require("../models/childService");
const BookingAvailability = require("../models/bookingAvailability");
const Booking = require("../models/bookings");
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const multer = require("multer");
const path = require("path");
const UPLOAD_DIR = path.join(process.cwd(), "public");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({ storage, fileFilter });

const auth = async (req, res, next) => {
  try {
    const token = req.cookies.user;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Error during authentication:", error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    user.password = undefined;

    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.cookie("user", token, {
      httpOnly: process.env.NODE_ENV === "production",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      domain:
        process.env.NODE_ENV === "production" ? ".webmedigital.com" : undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user: user,
    });
  } catch (error) {
    console.error("Error during login:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while logging in." });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and name are required.",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered.",
      });
    }

    if (role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Not allowed.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "user",
      profile: { name },
      isApproved: role === "user" ? "approved" : "pending",
    });

    const token = jwt.sign({ userId: newUser._id }, JWT_SECRET);
    newUser.password = undefined;

    res.cookie("user", token, {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      path: "/",
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      user: newUser,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred during registration.",
    });
  }
});

router.get("/getuserinfo", async (req, res) => {
  try {
    const token = req.cookies.user;
    if (!token) {
      return res.status(401).json({
        error: "Authentication token is missing.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        error: "Invalid or expired token.",
      });
    }

    const { userId } = decoded;

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully.",
      user: user,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({
      error: "An error occurred while fetching the user.",
    });
  }
});

router.get("/user/logout", (req, res) => {
  try {
    // Clear the 'user' cookie by setting its value to an empty string
    res.cookie("user", "", {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      path: "/",
      expires: new Date(0), // Set the cookie expiration date to the past to remove it
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful.",
    });
  } catch (error) {
    console.error("Error during logout:", error);
    return res.status(500).json({ error: "An error occurred during logout." });
  }
});

router.get("/user/availablebookingtimes", async (req, res) => {
  try {
    const { date } = req.query;

    // Validate required parameters
    if (!date) {
      return res.status(400).json({
        success: false,
        message: "date is required (YYYY-MM-DD format)",
      });
    }

    // Validate and parse the date
    const requestedDate = new Date(date);
    if (isNaN(requestedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    // Check if the date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    requestedDate.setHours(0, 0, 0, 0);

    if (requestedDate < today) {
      return res.status(400).json({
        success: false,
        message: "Cannot get availability for past dates",
      });
    }

    // Get day of week (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = requestedDate.getDay();

    // Step 1: Get all admin availability for the requested date
    let availabilitySlots = [];

    // Check for specific date availability first (all admins)
    const specificDateAvailability = await BookingAvailability.find({
      isRecurring: false,
      specificDate: {
        $gte: new Date(
          requestedDate.getFullYear(),
          requestedDate.getMonth(),
          requestedDate.getDate(),
          0,
          0,
          0
        ),
        $lte: new Date(
          requestedDate.getFullYear(),
          requestedDate.getMonth(),
          requestedDate.getDate(),
          23,
          59,
          59
        ),
      },
      isActive: true,
    }).populate({
      path: "adminId",
      select: "profile.name email isApproved",
      match: { isApproved: "approved" }, // Only approved admins
    });

    if (specificDateAvailability.length > 0) {
      // Use specific date availability
      for (const availability of specificDateAvailability) {
        const slots = availability.generateTimeSlots();
        availabilitySlots.push(
          ...slots.map((time) => ({
            startTime: time,
            endTime: addMinutesToTime(time, availability.slotDuration),
            slotDuration: availability.slotDuration,
            adminId: availability.adminId._id,
            adminName: availability.adminId.profile?.name || "Admin",
            adminEmail: availability.adminId.email,
          }))
        );
      }
    } else {
      // Check for recurring availability (all admins)
      const recurringAvailability = await BookingAvailability.find({
        dayOfWeek,
        isRecurring: true,
        isActive: true,
      }).populate("adminId", "profile.name email");

      if (recurringAvailability.length > 0) {
        for (const availability of recurringAvailability) {
          const slots = availability.generateTimeSlots();
          availabilitySlots.push(
            ...slots.map((time) => ({
              startTime: time,
              endTime: addMinutesToTime(time, availability.slotDuration),
              slotDuration: availability.slotDuration,
              adminId: availability.adminId._id,
              adminName: availability.adminId.profile?.name || "Admin",
              adminEmail: availability.adminId.email,
            }))
          );
        }
      }
    }

    // If no availability found
    if (availabilitySlots.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No availability found for the requested date",
        availableSlots: [],
        date: date,
        dayOfWeek: dayOfWeek,
      });
    }

    // Step 2: Get existing bookings for the date that are confirmed/approved
    const existingBookings = await Booking.findByDate(requestedDate);

    // Filter to only include confirmed bookings (approved by admin)
    const confirmedBookings = existingBookings.filter(
      (booking) => booking.status === "confirmed"
    );

    // Step 3: Filter out overlapping time slots with confirmed bookings only
    const availableSlots = availabilitySlots.filter((slot) => {
      return !confirmedBookings.some((booking) => {
        return isTimeOverlapping(
          slot.startTime,
          slot.endTime,
          booking.startTime,
          booking.endTime
        );
      });
    });

    // Step 4: Sort available slots by time, then by admin name
    availableSlots.sort((a, b) => {
      const timeA = a.startTime.split(":").map(Number);
      const timeB = b.startTime.split(":").map(Number);
      const minutesA = timeA[0] * 60 + timeA[1];
      const minutesB = timeB[0] * 60 + timeB[1];

      // First sort by time
      if (minutesA !== minutesB) {
        return minutesA - minutesB;
      }

      // If same time, sort by admin name
      return a.adminName.localeCompare(b.adminName);
    });

    // Step 5: Group slots by time for better frontend handling
    const groupedSlots = {};
    availableSlots.forEach((slot) => {
      const timeKey = `${slot.startTime}-${slot.endTime}`;
      if (!groupedSlots[timeKey]) {
        groupedSlots[timeKey] = {
          startTime: slot.startTime,
          endTime: slot.endTime,
          slotDuration: slot.slotDuration,
          availableAdmins: [],
        };
      }
      groupedSlots[timeKey].availableAdmins.push({
        adminId: slot.adminId,
        adminName: slot.adminName,
        adminEmail: slot.adminEmail,
      });
    });

    // Convert grouped slots back to array
    const finalSlots = Object.values(groupedSlots);

    // Step 6: Return response with additional info
    return res.status(200).json({
      success: true,
      message: "Available booking times retrieved successfully",
      availableSlots: finalSlots,
      individualSlots: availableSlots, // Also provide individual slots if needed
      date: date,
      dayOfWeek: dayOfWeek,
      totalAvailableSlots: finalSlots.length,
      totalConfirmedBookings: confirmedBookings.length,
      totalPendingBookings: existingBookings.filter(
        (b) => b.status === "pending"
      ).length,
      pendingBookingTimes: existingBookings
        .filter((b) => b.status === "pending")
        .map((booking) => ({
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
          name: booking.name,
        })),
    });
  } catch (error) {
    console.error("Error fetching available booking times:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching available booking times",
      error: error.message,
    });
  }
});

function addMinutesToTime(timeStr, minutes) {
  const [hours, mins] = timeStr.split(":").map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60);
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, "0")}:${newMins
    .toString()
    .padStart(2, "0")}`;
}

function isTimeOverlapping(start1, end1, start2, end2) {
  const start1Minutes = timeToMinutes(start1);
  const end1Minutes = timeToMinutes(end1);
  const start2Minutes = timeToMinutes(start2);
  const end2Minutes = timeToMinutes(end2);

  return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
}

function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

router.post("/user/book", async (req, res) => {
  try {
    const {
      productId,
      userId, // Optional - for registered users
      name,
      email,
      phoneNumber,
      date,
      startTime,
      endTime,
      notes,
    } = req.body;

    // Validate required fields
    if (!productId || !name || !email || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message:
          "productId, name, email, date, startTime, and endTime are required.",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    // Validate and parse the date
    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    // Check if the date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    bookingDate.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
      return res.status(400).json({
        success: false,
        message: "Cannot book for past dates",
      });
    }

    // Validate time format (HH:MM)
    const timeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeFormat.test(startTime) || !timeFormat.test(endTime)) {
      return res.status(400).json({
        success: false,
        message: "Invalid time format. Use HH:MM (24-hour format)",
      });
    }

    // Validate that endTime is after startTime
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (endMinutes <= startMinutes) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
    }

    // Step 1: Find available admins for the requested time slot
    const dayOfWeek = bookingDate.getDay();
    let availableAdmins = [];

    // Check for specific date availability first (all admins)
    const specificDateAvailability = await BookingAvailability.find({
      isRecurring: false,
      specificDate: {
        $gte: new Date(
          bookingDate.getFullYear(),
          bookingDate.getMonth(),
          bookingDate.getDate(),
          0,
          0,
          0
        ),
        $lte: new Date(
          bookingDate.getFullYear(),
          bookingDate.getMonth(),
          bookingDate.getDate(),
          23,
          59,
          59
        ),
      },
      isActive: true,
    }).populate({
      path: "adminId",
      select: "profile.name email isApproved",
      match: { isApproved: "approved" }, // Only approved admins
    });

    if (specificDateAvailability.length > 0) {
      // Use specific date availability
      for (const availability of specificDateAvailability) {
        if (availability.adminId) {
          // Make sure admin is populated and approved
          const slots = availability.generateTimeSlots();
          const isTimeSlotValid = slots.some((slot) => {
            const slotEndTime = addMinutesToTime(
              slot,
              availability.slotDuration
            );
            return slot === startTime && slotEndTime === endTime;
          });

          if (isTimeSlotValid) {
            availableAdmins.push({
              adminId: availability.adminId._id,
              adminName: availability.adminId.profile?.name || "Admin",
              adminEmail: availability.adminId.email,
              availability: availability,
            });
          }
        }
      }
    } else {
      // Check for recurring availability (all admins)
      const recurringAvailability = await BookingAvailability.find({
        dayOfWeek: dayOfWeek,
        isRecurring: true,
        isActive: true,
      }).populate({
        path: "adminId",
        select: "profile.name email isApproved",
        match: { isApproved: "approved" },
      });

      if (recurringAvailability.length > 0) {
        for (const availability of recurringAvailability) {
          if (availability.adminId) {
            // Make sure admin is populated and approved
            const slots = availability.generateTimeSlots();
            const isTimeSlotValid = slots.some((slot) => {
              const slotEndTime = addMinutesToTime(
                slot,
                availability.slotDuration
              );
              return slot === startTime && slotEndTime === endTime;
            });

            if (isTimeSlotValid) {
              availableAdmins.push({
                adminId: availability.adminId._id,
                adminName: availability.adminId.profile?.name || "Admin",
                adminEmail: availability.adminId.email,
                availability: availability,
              });
            }
          }
        }
      }
    }

    // Check if any admin is available for the requested time slot
    if (availableAdmins.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No admin is available for the requested time slot",
      });
    }

    // Step 2: Check for existing confirmed bookings that would conflict
    const existingBookings = await Booking.findByDate(bookingDate);
    const confirmedBookings = existingBookings.filter(
      (booking) => booking.status === "confirmed"
    );

    // Filter out admins who already have confirmed bookings at this time
    const availableAdminsWithoutConflict = availableAdmins.filter((admin) => {
      return !confirmedBookings.some((booking) =>
        isTimeOverlapping(
          startTime,
          endTime,
          booking.startTime,
          booking.endTime
        )
      );
    });

    if (availableAdminsWithoutConflict.length === 0) {
      return res.status(409).json({
        success: false,
        message:
          "This time slot is already booked. Please select another time.",
      });
    }

    // Step 3: Select the first available admin (you can implement more sophisticated selection logic here)
    const selectedAdmin = availableAdminsWithoutConflict[0];

    // Step 4: Check if user already has a booking for the same time (prevent double booking)
    if (userId || email) {
      const userQuery = userId ? { userId } : { email: email.toLowerCase() };
      const existingUserBooking = await Booking.findOne({
        ...userQuery,
        date: bookingDate,
        $or: [{ status: "pending" }, { status: "confirmed" }],
        $and: [
          {
            $or: [
              {
                $and: [
                  { startTime: { $lte: startTime } },
                  { endTime: { $gt: startTime } },
                ],
              },
              {
                $and: [
                  { startTime: { $lt: endTime } },
                  { endTime: { $gte: endTime } },
                ],
              },
              {
                $and: [
                  { startTime: { $gte: startTime } },
                  { endTime: { $lte: endTime } },
                ],
              },
            ],
          },
        ],
      });

      if (existingUserBooking) {
        return res.status(409).json({
          success: false,
          message:
            "You already have a booking that overlaps with this time slot.",
        });
      }
    }

    // Step 5: Create the booking
    const bookingData = {
      productId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      date: bookingDate,
      startTime,
      endTime,
      status: "pending", // All bookings start as pending for admin approval
      phoneNumber: phoneNumber ? phoneNumber.trim() : undefined,
      notes: notes ? notes.trim() : undefined,
    };

    // Add userId if provided (for registered users)
    if (userId) {
      // Verify user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      bookingData.userId = userId;
    }

    const newBooking = new Booking(bookingData);
    await newBooking.save();

    // Populate the booking with product details for response
    await newBooking.populate("productId", "name description");

    return res.status(201).json({
      success: true,
      message: "Booking created successfully! Waiting for admin approval.",
      booking: {
        id: newBooking._id,
        productName: newBooking.productId?.name,
        name: newBooking.name,
        email: newBooking.email,
        phoneNumber: newBooking.phoneNumber,
        date: newBooking.date,
        startTime: newBooking.startTime,
        endTime: newBooking.endTime,
        status: newBooking.status,
        notes: newBooking.notes,
        duration: newBooking.durationMinutes,
        isGuestBooking: newBooking.isGuestBooking,
        createdAt: newBooking.createdAt,
      },
      adminInfo: {
        adminId: selectedAdmin.adminId,
        adminName: selectedAdmin.adminName,
        adminEmail: selectedAdmin.adminEmail,
      },
    });
  } catch (error) {
    console.error("Error during booking:", error);

    // Handle specific MongoDB errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        details: Object.values(error.errors).map((err) => err.message),
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A booking with similar details already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "An error occurred during booking.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

router.post("/user/cancelbook", async (req, res) => {
  try {
    const { serviceId, userId } = req.body;

    // Validate required fields
    if (!serviceId || !userId) {
      return res
        .status(400)
        .json({ error: "Service ID, User ID, and Time are required." });
    }

    // Find the user and service
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Check if the user already has a booking for the same service and time
    const updatedBooking = user.booking.filter(
      (booking) => booking.service.toString() !== serviceId.toString()
    );

    // Add the new booking
    user.booking = updatedBooking;
    await user.save();
    return res.status(200).json({ message: "Booking Canceled!" });
  } catch (error) {
    console.error("Error during booking:", error);
    return res.status(500).json({ error: "An error occurred during booking." });
  }
});

router.put(
  "/user/update",
  auth,
  upload.fields([{ name: "profilePhoto" }, { name: "companyLogo" }]),
  async (req, res) => {
    try {
      const { _id: userId } = req.user;
      const {
        name,
        phoneNumber,
        address,
        companyRole,
        companyName,
        newPassword,
        oldPassword,
      } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      if (!oldPassword) {
        return res
          .status(400)
          .json({ success: false, message: "Password is required" });
      }
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res
          .status(400)
          .json({ success: false, message: "Incorrect password" });
      }

      if (newPassword) {
        user.password = await bcrypt.hash(newPassword, 10);
      }

      user.profile.name = name || user.profile.name;
      user.profile.phoneNumber = phoneNumber || user.profile.phoneNumber;
      user.profile.address = address || user.profile.address;
      user.profile.companyRole = companyRole || user.profile.companyRole;
      user.profile.companyName = companyName || user.profile.companyName;

      if (req.files["profilePhoto"]) {
        user.profile.avatarUrl = `${process.env.Current_Url}/${req.files["profilePhoto"][0].filename}`;
      }
      if (req.files["companyLogo"]) {
        user.profile.companyImageUrl = `${process.env.Current_Url}/${req.files["companyLogo"][0].filename}`;
      }

      await user.save();

      return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
);

router.get("/admin/users", auth, async (req, res) => {
  try {
    if (req?.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Extract query parameters
    const { status, filterby, search, page = 1, limit = 10 } = req.query;

    // Build filter object
    let filter = {};

    // Filter by approval status
    if (status && ["approved", "pending", "rejected"].includes(status)) {
      filter.isApproved = status;
    }

    // Filter by role
    if (
      filterby &&
      ["vendor", "user", "admin", "freelancer"].includes(filterby)
    ) {
      filter.role = filterby;
    }

    // Search functionality
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i"); // Case-insensitive search
      filter.$or = [
        { email: searchRegex },
        { "profile.name": searchRegex },
        { "profile.companyName": searchRegex },
        { "profile.phoneNumber": searchRegex },
      ];
    }

    // Pagination setup
    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const skip = (pageNumber - 1) * pageSize;

    // Validate pagination parameters
    if (pageNumber < 1 || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid pagination parameters. Page must be >= 1 and limit must be between 1-100",
      });
    }

    // Get total count for pagination
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / pageSize);

    // Fetch users with filters, pagination, and exclude password
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        total: totalUsers,
        limit: pageSize,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
      filters: {
        status: status || null,
        filterby: filterby || null,
        search: search || null,
      },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
});

// Approve user endpoint
router.post("/admin/users/:userId/approve", auth, async (req, res) => {
  try {
    if (req?.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { isApproved: "approved" },
      { new: true }
    ).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "User approved successfully",
      user,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
});

// Reject user endpoint
router.post("/admin/users/:userId/reject", auth, async (req, res) => {
  try {
    if (req?.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { isApproved: "rejected" },
      { new: true }
    ).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "User rejected successfully",
      user,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
});

// Get single user details (admin only)
router.get("/admin/users/:userId", auth, async (req, res) => {
  try {
    if (req?.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { userId } = req.params;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
});

// Toggle user suspension (ban/unban)
router.post(
  "/admin/users/:userId/toggle-suspension",
  auth,
  async (req, res) => {
    try {
      if (req?.user?.role !== "admin") {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      const { userId } = req.params;
      const user = await User.findById(userId);

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Toggle suspension status
      user.isSuspended = !user.isSuspended;
      await user.save();

      return res.status(200).json({
        success: true,
        message: `User ${
          user.isSuspended ? "suspended" : "unsuspended"
        } successfully`,
        user: {
          _id: user._id,
          email: user.email,
          isSuspended: user.isSuspended,
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// Reset user password (admin only)
router.post("/admin/users/:userId/reset-password", auth, async (req, res) => {
  try {
    if (req?.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
});

// Get all bookings for admin
router.get("/admin/bookings", auth, async (req, res) => {
  try {
    if (req?.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { status, page = 1, limit = 10, search } = req.query;

    // Build query
    let query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Booking.countDocuments(query);
    const totalPages = Math.ceil(total / parseInt(limit));

    // Fetch bookings with population
    const bookings = await Booking.find(query)
      .populate("productId", "Title description")
      .populate("userId", "profile.name email profile.phoneNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return res.status(200).json({
      success: true,
      message: "Bookings retrieved successfully",
      bookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching bookings",
      error: error.message,
    });
  }
});

// Get single booking details for admin
router.get("/admin/bookings/:bookingId", auth, async (req, res) => {
  try {
    if (req?.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
      .populate("productId", "Title description")
      .populate("userId", "profile email isApproved role createdAt");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking details retrieved successfully",
      booking,
    });
  } catch (error) {
    console.error("Error fetching booking details:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching booking details",
      error: error.message,
    });
  }
});

// Confirm booking
router.post("/admin/bookings/:bookingId/confirm", auth, async (req, res) => {
  try {
    if (req?.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending bookings can be confirmed",
      });
    }

    await booking.confirm();

    return res.status(200).json({
      success: true,
      message: "Booking confirmed successfully",
      booking,
    });
  } catch (error) {
    console.error("Error confirming booking:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while confirming the booking",
      error: error.message,
    });
  }
});

// Cancel booking
router.post("/admin/bookings/:bookingId/cancel", auth, async (req, res) => {
  try {
    if (req?.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.status === "canceled" || booking.status === "ended") {
      return res.status(400).json({
        success: false,
        message: "Booking cannot be cancelled",
      });
    }

    await booking.cancel(reason);

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while cancelling the booking",
      error: error.message,
    });
  }
});

// Mark booking as completed
router.post("/admin/bookings/:bookingId/end", auth, async (req, res) => {
  try {
    if (req?.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: "Only confirmed bookings can be marked as completed",
      });
    }

    await booking.end();

    return res.status(200).json({
      success: true,
      message: "Booking marked as completed successfully",
      booking,
    });
  } catch (error) {
    console.error("Error completing booking:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while completing the booking",
      error: error.message,
    });
  }
});

// ======================= ADMIN AVAILABILITY MANAGEMENT ENDPOINTS =======================

// Get admin's availability
router.get("/admin/availability", auth, async (req, res) => {
  try {
    if (req?.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const availability = await BookingAvailability.findByAdmin(req.user._id);

    return res.status(200).json({
      success: true,
      message: "Availability retrieved successfully",
      availability,
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching availability",
      error: error.message,
    });
  }
});

// Create new availability slot
router.post("/admin/availability", auth, async (req, res) => {
  try {
    if (req?.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const {
      isRecurring,
      dayOfWeek,
      specificDate,
      startTime,
      endTime,
      slotDuration,
      isActive,
    } = req.body;

    // Validate required fields
    if (!startTime || !endTime || !slotDuration) {
      return res.status(400).json({
        success: false,
        message: "Start time, end time, and slot duration are required",
      });
    }

    // Create availability data
    const availabilityData = {
      adminId: req.user._id,
      isRecurring,
      startTime,
      endTime,
      slotDuration,
      isActive: isActive !== undefined ? isActive : true,
    };

    if (isRecurring) {
      if (dayOfWeek === undefined || dayOfWeek === null) {
        return res.status(400).json({
          success: false,
          message: "Day of week is required for recurring availability",
        });
      }
      availabilityData.dayOfWeek = dayOfWeek;
    } else {
      if (!specificDate) {
        return res.status(400).json({
          success: false,
          message: "Specific date is required for non-recurring availability",
        });
      }
      availabilityData.specificDate = new Date(specificDate);
    }

    const newAvailability = new BookingAvailability(availabilityData);
    await newAvailability.save();

    return res.status(201).json({
      success: true,
      message: "Availability created successfully",
      availability: newAvailability,
    });
  } catch (error) {
    console.error("Error creating availability:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        details: Object.values(error.errors).map((err) => err.message),
      });
    }

    return res.status(500).json({
      success: false,
      message: "An error occurred while creating availability",
      error: error.message,
    });
  }
});

// Update availability slot
router.put("/admin/availability/:availabilityId", auth, async (req, res) => {
  try {
    if (req?.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { availabilityId } = req.params;
    const {
      isRecurring,
      dayOfWeek,
      specificDate,
      startTime,
      endTime,
      slotDuration,
      isActive,
    } = req.body;

    const availability = await BookingAvailability.findOne({
      _id: availabilityId,
      adminId: req.user._id,
    });

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: "Availability slot not found",
      });
    }

    // Update fields
    availability.isRecurring =
      isRecurring !== undefined ? isRecurring : availability.isRecurring;
    availability.startTime = startTime || availability.startTime;
    availability.endTime = endTime || availability.endTime;
    availability.slotDuration = slotDuration || availability.slotDuration;
    availability.isActive =
      isActive !== undefined ? isActive : availability.isActive;

    if (isRecurring !== undefined) {
      if (isRecurring) {
        availability.dayOfWeek =
          dayOfWeek !== undefined ? dayOfWeek : availability.dayOfWeek;
        availability.specificDate = undefined;
      } else {
        availability.specificDate = specificDate
          ? new Date(specificDate)
          : availability.specificDate;
        availability.dayOfWeek = undefined;
      }
    }

    await availability.save();

    return res.status(200).json({
      success: true,
      message: "Availability updated successfully",
      availability,
    });
  } catch (error) {
    console.error("Error updating availability:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        details: Object.values(error.errors).map((err) => err.message),
      });
    }

    return res.status(500).json({
      success: false,
      message: "An error occurred while updating availability",
      error: error.message,
    });
  }
});

// Delete availability slot
router.delete("/admin/availability/:availabilityId", auth, async (req, res) => {
  try {
    if (req?.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { availabilityId } = req.params;

    const availability = await BookingAvailability.findOneAndDelete({
      _id: availabilityId,
      adminId: req.user._id,
    });

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: "Availability slot not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Availability deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting availability:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while deleting availability",
      error: error.message,
    });
  }
});

module.exports = router;
