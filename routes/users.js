const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, isAdmin } = require('../middleware/auth');

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.patch('/me', auth, async (req, res) => {
  try {
    const updates = {
      name: typeof req.body.name === 'string' ? req.body.name.trim() : undefined,
      phone: typeof req.body.phone === 'string' ? req.body.phone.trim() : undefined,
      company: typeof req.body.company === 'string' ? req.body.company.trim() : undefined,
      bio: typeof req.body.bio === 'string' ? req.body.bio.trim() : undefined,
      profileImage: typeof req.body.profileImage === 'string' ? req.body.profileImage : undefined
    };

    Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);

    if (updates.name === '') {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (
      typeof updates.profileImage === 'string' &&
      updates.profileImage &&
      !updates.profileImage.startsWith('data:image/')
    ) {
      return res.status(400).json({ error: 'Profile image must be a valid image file' });
    }

    if (typeof updates.profileImage === 'string' && updates.profileImage.length > 4.5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Profile image is too large. Please choose a smaller photo.' });
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true
    }).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
});

// Admin: Get all clients/users to assign leads to (or view them)
router.get('/', auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ['user', 'lead'] } }, 'name email role phone company createdAt').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
