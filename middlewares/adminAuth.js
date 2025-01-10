const jwt = require('jsonwebtoken');
const User = require('../models/user');

const auth = async (req, res, next) => {
  try {
    const protectedPaths = ['service', 'project', 'industry', 'testimonial', 'product'];
    const actions = ['create', 'edit', 'delete'];

    if (protectedPaths.some(path => req.originalUrl.includes(path)) && 
        actions.some(action => req.originalUrl.includes(action))) {
          console.log('Protected route');
    } else {
      next(); // Proceed if not matched
      return;
    }

    // Authenticate user using the token
    const cookie = req.cookies.user;
    if (!cookie) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(cookie, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    const { userId } = decoded;

    // Verify user exists
    const user = await User.findById(userId).select('-password');
    if (!user || user.role !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // If user is authenticated, pass the user data to the next middleware/route handler
    req.user = user;  // Optional: You can pass the user object for later use in routes

    next();  // Proceed to the next middleware/route handler
  } catch (error) {
    console.error('Error authenticating user:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while authenticating the user',
    });
  }
};

module.exports = auth;
