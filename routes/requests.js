const express = require('express');
const router = express.Router();
const ClientRequest = require('../models/ClientRequest');
const User = require('../models/User');
const { auth, isAdmin } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { clientId: req.user.id };
    const requests = await ClientRequest.find(query).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch client requests' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(400).json({ error: 'Admins cannot create client requests' });
    }

    const { title, requirement, taskDetails, preferredLeadSource, priority } = req.body;

    if (!title || !requirement || !taskDetails) {
      return res.status(400).json({ error: 'Title, requirement, and task details are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const request = new ClientRequest({
      clientId: user._id,
      clientName: user.name,
      clientEmail: user.email,
      title: title.trim(),
      requirement: requirement.trim(),
      taskDetails: taskDetails.trim(),
      preferredLeadSource: preferredLeadSource || 'Any',
      priority: priority || 'Medium'
    });

    const saved = await request.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create client request', details: err.message });
  }
});

router.patch('/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['New', 'Reviewed', 'Assigned', 'Completed'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid request status' });
    }

    const request = await ClientRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Client request not found' });
    }

    request.status = status;
    const updated = await request.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update request status', details: err.message });
  }
});

module.exports = router;
