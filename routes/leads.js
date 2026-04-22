const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const { auth, isAdmin } = require('../middleware/auth');

function normalizeLeadPayload(body) {
  const payload = {};

  Object.keys(body).forEach((key) => {
    payload[key] = body[key];
  });

  if (Object.prototype.hasOwnProperty.call(body, 'leadName')) {
    payload.leadName = typeof body.leadName === 'string' ? body.leadName.trim() : body.leadName;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'experience')) {
    payload.experience = body.experience === '' || body.experience === undefined ? body.experience : Number(body.experience);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'leadsConverted')) {
    payload.leadsConverted = body.leadsConverted === '' || body.leadsConverted === undefined ? body.leadsConverted : Number(body.leadsConverted);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'totalLeads')) {
    payload.totalLeads = body.totalLeads === '' || body.totalLeads === undefined ? body.totalLeads : Number(body.totalLeads);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'timeTakenDays')) {
    payload.timeTakenDays = body.timeTakenDays === '' || body.timeTakenDays === undefined ? body.timeTakenDays : Number(body.timeTakenDays);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
    payload.notes = typeof body.notes === 'string' ? body.notes.trim() : body.notes;
  }

  return payload;
}

function validateLeadPayload(payload) {
  if (!payload.leadName) return 'Lead name is required';
  if (!Number.isFinite(payload.experience) || payload.experience < 0) return 'Experience must be a valid non-negative number';
  if (!Number.isFinite(payload.totalLeads) || payload.totalLeads < 0) return 'Total leads must be a valid non-negative number';
  if (!Number.isFinite(payload.leadsConverted) || payload.leadsConverted < 0) return 'Leads converted must be a valid non-negative number';
  if (!Number.isFinite(payload.timeTakenDays) || payload.timeTakenDays < 0) return 'Time taken must be a valid non-negative number';
  if (payload.leadsConverted > payload.totalLeads) return 'Leads converted cannot be greater than total leads';
  return null;
}

// Get all leads (Admin sees all, User sees only assigned & unblocked)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const leads = await Lead.find().sort({ createdAt: -1 });
      res.json(leads);
    } else {
      // User/Client sees current leads they can work on or already own
      const leads = await Lead.find({ 
        isBlocked: false,
        status: { $in: ['Active', 'Pending'] },
        $or: [
          { assignedTo: null },
          { assignedTo: req.user.id }
        ]
      }).sort({ createdAt: -1 });
      res.json(leads);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Client: Select a lead to work on
router.post('/:id/select', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(400).json({ error: 'Admins cannot select client leads' });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (lead.isBlocked) return res.status(400).json({ error: 'This lead is blocked' });
    if (!['Active', 'Pending'].includes(lead.status)) {
      return res.status(400).json({ error: 'This lead is not currently available' });
    }

    const alreadySelectedByAnotherClient =
      lead.assignedTo && String(lead.assignedTo) !== String(req.user.id);

    if (alreadySelectedByAnotherClient) {
      return res.status(400).json({ error: 'This lead is already selected by another client' });
    }

    lead.assignedTo = req.user.id;
    lead.assignedToName = req.user.name || lead.assignedToName;

    const updated = await lead.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to select lead', details: err.message });
  }
});

// Admin: Assign lead to a client
router.post('/:id/assign', auth, isAdmin, async (req, res) => {
  try {
    const { assignedTo, assignedToName } = req.body;

    if (!assignedTo) {
      return res.status(400).json({ error: 'Client id is required' });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    lead.assignedTo = assignedTo;
    lead.assignedToName = assignedToName || null;

    const updated = await lead.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign lead', details: err.message });
  }
});

// Admin: Create Lead
router.post('/', auth, isAdmin, async (req, res) => {
  try {
    const payload = normalizeLeadPayload(req.body);
    const validationError = validateLeadPayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (payload.status === 'Blocked') {
      payload.isBlocked = true;
    }

    const lead = new Lead(payload);
    const saved = await lead.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create lead', details: err.message });
  }
});

// Admin: Update Lead
router.put('/:id', auth, isAdmin, async (req, res) => {
  try {
    // Lead save hook should run on update if using save(), but with findByIdAndUpdate it doesn't.
    // So we fetch, update fields, save, to trigger conversionRate recalc.
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const payload = normalizeLeadPayload(req.body);
    const mergedLead = { ...lead.toObject(), ...payload };
    const validationError = validateLeadPayload(mergedLead);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (payload.status === 'Blocked') {
      payload.isBlocked = true;
    }

    Object.assign(lead, payload);
    const updated = await lead.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lead', details: err.message });
  }
});

// Admin: Delete Lead
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    await Lead.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

module.exports = router;
