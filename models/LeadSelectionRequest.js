const mongoose = require('mongoose');

const leadSelectionRequestSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  leadName: { type: String, required: true },
  leadSource: {
    type: String,
    enum: ['Referral', 'Cold Call', 'Online', 'Walk-in', 'Other'],
    default: 'Other'
  },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientName: { type: String, required: true },
  clientEmail: { type: String, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  adminNote: { type: String, default: '' },
  decidedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LeadSelectionRequest', leadSelectionRequestSchema);
