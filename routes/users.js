const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, isAdmin } = require('../middleware/auth');

// Admin: Get all clients/users to assign leads to (or view them)
router.get('/', auth, isAdmin, async (req, res) => {
  try {
    // Optionally filter out 'admin' if admin shouldn't assign leads to other admins
    // But we'll just return everyone for now, or filter by role='user'
    const users = await User.find({ role: 'user' }, 'name email role createdAt').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
