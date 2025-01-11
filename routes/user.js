const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

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
        error: 'Invalid email or password.',
      });
    }
    
    user.password = undefined;
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.cookie('user', token, {
      httpOnly: true,
      secure: true,
      sameSite: '',
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




module.exports = router;
