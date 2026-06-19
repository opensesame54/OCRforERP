const jwt = require('jsonwebtoken');
const User = require('../models/User');
const memoryStore = require('../config/memoryStore');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');

      if (global.isMockDB) {
        req.user = memoryStore.users.find(u => u._id === decoded.id);
      } else {
        req.user = await User.findById(decoded.id).select('-password');
      }

      if (!req.user) {
        return res.status(401).json({ message: 'User not found, unauthorized' });
      }
      return next();
    } catch (error) {
      console.error('JWT Auth Error:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  // Fallback for easy testing without tokens (use header or default first clerk user)
  if (process.env.NODE_ENV !== 'production' || global.isMockDB) {
    const mockRole = req.headers['x-mock-role'] || 'Admin';
    const mockUser = memoryStore.users.find(u => u.role === mockRole) || memoryStore.users[0];
    req.user = mockUser;
    return next();
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role (${req.user ? req.user.role : 'N/A'}) is not authorized to access this resource`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
