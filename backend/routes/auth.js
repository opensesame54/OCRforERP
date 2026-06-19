const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const memoryStore = require('../config/memoryStore');
const { protect } = require('../middleware/auth');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '30d'
  });
};

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    let user;
    if (global.isMockDB) {
      user = memoryStore.users.find(u => u.email === email);
    } else {
      user = await User.findOne({ email });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

// @route   GET /api/auth/demo-accounts
// @desc    Get demo accounts with plain text passwords (development/demo use)
router.get('/demo-accounts', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const seededUsersPath = path.join(__dirname, '../config/seeded_users.json');
    if (fs.existsSync(seededUsersPath)) {
      const uData = JSON.parse(fs.readFileSync(seededUsersPath, 'utf8'));
      const demoUsers = uData.map(u => ({
        name: u.name,
        email: u.email,
        password: u.password,
        role: u.role
      }));
      return res.json(demoUsers);
    }
    // Fallback in case the file doesn't exist
    return res.json([
      { name: 'John AP Clerk', email: 'clerk@ap.com', password: 'clerk_fallback', role: 'AP Clerk' },
      { name: 'Sarah Reviewer', email: 'reviewer@ap.com', password: 'reviewer_fallback', role: 'Reviewer' },
      { name: 'Michael Manager', email: 'manager@ap.com', password: 'manager_fallback', role: 'Finance Manager' },
      { name: 'Admin User', email: 'admin@ap.com', password: 'admin_fallback', role: 'Admin' }
    ]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
