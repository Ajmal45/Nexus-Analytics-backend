const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const User = require('../models/User');
const LeadSelectionRequest = require('../models/LeadSelectionRequest');
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

  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    payload.description = typeof body.description === 'string' ? body.description.trim() : body.description;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'skills')) {
    payload.skills = Array.isArray(body.skills)
      ? body.skills.map((skill) => String(skill).trim()).filter(Boolean)
      : String(body.skills || '')
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean);
  }

  return payload;
}

function validateLeadPayload(payload) {
  if ('leadName' in payload && !payload.leadName) return 'Lead name is required';
  if ('experience' in payload && (!Number.isFinite(payload.experience) || payload.experience < 0)) return 'Experience must be a valid non-negative number';
  if ('totalLeads' in payload && (!Number.isFinite(payload.totalLeads) || payload.totalLeads < 0)) return 'Total leads must be a valid non-negative number';
  if ('leadsConverted' in payload && (!Number.isFinite(payload.leadsConverted) || payload.leadsConverted < 0)) return 'Leads converted must be a valid non-negative number';
  if ('timeTakenDays' in payload && (!Number.isFinite(payload.timeTakenDays) || payload.timeTakenDays < 0)) return 'Time taken must be a valid non-negative number';
  if (
    Number.isFinite(payload.leadsConverted) &&
    Number.isFinite(payload.totalLeads) &&
    payload.leadsConverted > payload.totalLeads
  ) return 'Leads converted cannot be greater than total leads';
  return null;
}

// Get all leads (Admin sees all, User sees only assigned & unblocked)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const leads = await Lead.find().sort({ createdAt: -1 });
      res.json(leads);
    } else if (req.user.role === 'lead') {
      const leads = await Lead.find({ ownerUserId: req.user.id }).sort({ createdAt: -1 });
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
    if (req.user.role !== 'user') {
      return res.status(400).json({ error: 'Only client accounts can send lead selection requests' });
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

    if (String(lead.assignedTo) === String(req.user.id)) {
      return res.status(400).json({ error: 'This lead is already assigned to you' });
    }

    const existingPendingRequest = await LeadSelectionRequest.findOne({
      leadId: lead._id,
      clientId: req.user.id,
      status: 'Pending'
    });

    if (existingPendingRequest) {
      return res.status(400).json({ error: 'Your request for this lead is already pending admin approval' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const selectionRequest = new LeadSelectionRequest({
      leadId: lead._id,
      leadName: lead.leadName,
      leadSource: lead.leadSource,
      clientId: user._id,
      clientName: user.name,
      clientEmail: user.email
    });

    const saved = await selectionRequest.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send lead request', details: err.message });
  }
});

router.get('/selection-requests/all', auth, async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'user') {
      query = { clientId: req.user.id };
    } else if (req.user.role !== 'admin') {
      query = { _id: null };
    }

    const requests = await LeadSelectionRequest.find(query).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lead selection requests' });
  }
});

router.patch('/selection-requests/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { status, adminNote } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Approved or Rejected' });
    }

    const selectionRequest = await LeadSelectionRequest.findById(req.params.id);
    if (!selectionRequest) {
      return res.status(404).json({ error: 'Lead selection request not found' });
    }

    if (selectionRequest.status !== 'Pending') {
      return res.status(400).json({ error: `This request has already been ${selectionRequest.status.toLowerCase()}` });
    }

    const lead = await Lead.findById(selectionRequest.leadId);
    if (!lead) {
      return res.status(404).json({ error: 'The requested lead no longer exists' });
    }

    if (status === 'Approved') {
      if (lead.isBlocked || !['Active', 'Pending'].includes(lead.status)) {
        return res.status(400).json({ error: 'This lead is not currently available for approval' });
      }

      const assignedToAnotherClient =
        lead.assignedTo && String(lead.assignedTo) !== String(selectionRequest.clientId);

      if (assignedToAnotherClient) {
        return res.status(400).json({ error: 'This lead has already been assigned to another client' });
      }

      lead.assignedTo = selectionRequest.clientId;
      lead.assignedToName = selectionRequest.clientName;
      await lead.save();

      await LeadSelectionRequest.updateMany(
        {
          leadId: lead._id,
          _id: { $ne: selectionRequest._id },
          status: 'Pending'
        },
        {
          $set: {
            status: 'Rejected',
            adminNote: 'Another client was approved for this lead.',
            decidedAt: new Date()
          }
        }
      );
    }

    selectionRequest.status = status;
    selectionRequest.adminNote = typeof adminNote === 'string' ? adminNote.trim() : '';
    selectionRequest.decidedAt = new Date();

    const updated = await selectionRequest.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lead request status', details: err.message });
  }
});

router.patch('/:id/client-details', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(400).json({ error: 'Admins cannot edit client lead details here' });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    if (String(lead.assignedTo) !== String(req.user.id)) {
      return res.status(403).json({ error: 'You can only edit leads assigned to you' });
    }

    const payload = normalizeLeadPayload(req.body);
    const allowedPayload = {
      description: payload.description ?? lead.description,
      skills: payload.skills ?? lead.skills
    };

    Object.assign(lead, allowedPayload);
    const updated = await lead.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lead details', details: err.message });
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

    await LeadSelectionRequest.updateMany(
      {
        leadId: lead._id,
        status: 'Pending'
      },
      {
        $set: {
          status: 'Rejected',
          adminNote: 'This lead was assigned directly by admin.',
          decidedAt: new Date()
        }
      }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign lead', details: err.message });
  }
});

// Admin: Create Lead
router.post('/', auth, async (req, res) => {
  try {
    if (!['admin', 'lead'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admins and lead accounts can create leads' });
    }

    const payload = normalizeLeadPayload(req.body);
    const validationError = validateLeadPayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (payload.status === 'Blocked') {
      payload.isBlocked = true;
    }

    if (req.user.role === 'lead') {
      payload.ownerUserId = req.user.id;
      payload.ownerUserName = req.user.name;
    }

    const lead = new Lead(payload);
    const saved = await lead.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create lead', details: err.message });
  }
});

// Admin: Update Lead
router.put('/:id', auth, async (req, res) => {
  try {
    // Lead save hook should run on update if using save(), but with findByIdAndUpdate it doesn't.
    // So we fetch, update fields, save, to trigger conversionRate recalc.
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const canEdit =
      req.user.role === 'admin' ||
      (req.user.role === 'lead' && String(lead.ownerUserId) === String(req.user.id));

    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to update this lead' });
    }

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
router.delete('/:id', auth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const canDelete =
      req.user.role === 'admin' ||
      (req.user.role === 'lead' && String(lead.ownerUserId) === String(req.user.id));

    if (!canDelete) {
      return res.status(403).json({ error: 'You do not have permission to delete this lead' });
    }

    await Lead.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

module.exports = router;
