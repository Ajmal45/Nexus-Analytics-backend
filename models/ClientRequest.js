const mongoose = require('mongoose');

const clientRequestSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientName: { type: String, required: true },
  clientEmail: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  requirement: { type: String, required: true, trim: true },
  taskDetails: { type: String, required: true, trim: true },
  preferredLeadSource: {
    type: String,
    enum: ['Any', 'Referral', 'Cold Call', 'Online', 'Walk-in', 'Other'],
    default: 'Any'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['New', 'Reviewed', 'Assigned', 'Completed'],
    default: 'New'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ClientRequest', clientRequestSchema);
