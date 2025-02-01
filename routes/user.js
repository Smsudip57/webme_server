const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Service = require('../models/service');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const multer = require("multer");
const path = require('path');
const UPLOAD_DIR = path.join(process.cwd(), 'public');

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
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error during authentication:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }
    
    user.password = undefined;
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.cookie('user', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: user,
    });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'An error occurred while logging in.' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and name are required.',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered.',
      });
    }

    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not allowed.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'user',
      profile: { name },
    });

    const token = jwt.sign({ userId: newUser._id }, JWT_SECRET);
    newUser.password = undefined;

    res.cookie('user', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      user: newUser,
    });
  } catch (error) {
    console.error('Error during registration:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during registration.',
    });
  }
});

router.get('/getuserinfo', async (req, res) => {
  try {
    const token = req.cookies.user;
    if (!token) {
      return res.status(401).json({
        error: 'Authentication token is missing.',
      });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        error: 'Invalid or expired token.',
      });
    }

    const { userId } = decoded;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        error: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User retrieved successfully.',
      user: user,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({
      error: 'An error occurred while fetching the user.',
    });
  }
});


router.get('/user/logout', (req, res) => {
    try {
      // Clear the 'user' cookie by setting its value to an empty string
      res.cookie('user', '', {
        httpOnly: true, // Prevents client-side JS access
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        sameSite: 'strict', // Protects against CSRF
        path: '/', // Cookie available to all routes
        expires: new Date(0), // Set the cookie expiration date to the past to remove it
      });
  
      return res.status(200).json({
        success: true,
        message: 'Logout successful.',
      });
    } catch (error) {
      console.error('Error during logout:', error);
      return res.status(500).json({ error: 'An error occurred during logout.' });
    }
  });



  router.post('/user/book', async (req, res) => {
    try {
      const { serviceId, userId, time } = req.body;
  
      // Validate required fields
      if (!serviceId || !userId || !time) {
        return res.status(400).json({ error: 'Service ID, User ID, and Time are required.' });
      }
  
      // Validate the time format
      const bookingTime = new Date(time);
      if (isNaN(bookingTime.getTime())) {
        return res.status(400).json({ error: 'Invalid time format.' });
      }
  
      // Find the user and service
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
  
      const service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({ error: 'Service not found.' });
      }
  
      // Check if the user already has a booking for the same service and time
      const existingBooking = user.booking.find(
        (booking) =>
          booking.service.toString() === service._id.toString()
      );
  
      if (existingBooking) {
        return res.status(400).json({ error: 'User already has a booking for this service at the selected time.' });
      }
  
      // Add the new booking
      user.booking.push({ service: service._id, time: bookingTime });
      await user.save();
  
      return res.status(200).json({ message: 'Booking successful.' });
    } catch (error) {
      console.error('Error during booking:', error);
      return res.status(500).json({ error: 'An error occurred during booking.' });
    }
  });
  
  
  
  router.post('/user/cancelbook', async (req, res) => {
    try {
      const { serviceId, userId } = req.body;
  
      // Validate required fields
      if (!serviceId || !userId) {
        return res.status(400).json({ error: 'Service ID, User ID, and Time are required.' });
      }
  
  
      // Find the user and service
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
  
      // Check if the user already has a booking for the same service and time
      const updatedBooking = user.booking.filter(
        (booking) =>
          booking.service.toString() !== serviceId.toString()
      );
  
      // Add the new booking
      user.booking = updatedBooking
      await user.save();
      return res.status(200).json({ message: 'Booking Canceled!' });
    } catch (error) {
      console.error('Error during booking:', error);
      return res.status(500).json({ error: 'An error occurred during booking.' });
    }
  });



  router.put("/user/update",auth, upload.fields([{ name: "profilePhoto" }, { name: "companyLogo" }]), async (req, res) => {
    try {
      const {_id: userId} = req.user
      const {  name, phoneNumber, address, companyRole, companyName, newPassword, oldPassword } = req.body;
  
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
  
      if (!oldPassword) {
        return res.status(400).json({ success: false, message: "Password is required" });
      }
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: "Incorrect password" });
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
      return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
  });






module.exports = router;
