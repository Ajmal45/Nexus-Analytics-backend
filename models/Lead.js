const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  leadName: { type: String, required: true },
  experience: { type: Number, required: true },
  leadsConverted: { type: Number, required: true },
  totalLeads: { type: Number, required: true },
  conversionRate: { type: Number },
  timeTakenDays: { type: Number, required: true },
  leadSource: { 
    type: String, 
    enum: ['Referral', 'Cold Call', 'Online', 'Walk-in', 'Other'], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['Active', 'Blocked', 'Closed', 'Pending'], 
    required: true 
  },
  isBlocked: { type: Boolean, default: false },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedToName: { type: String, default: null },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  ownerUserName: { type: String, default: null },
  description: { type: String, default: '' },
  skills: [{ type: String }],
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Auto-calculate conversion rate before saving
leadSchema.pre('save', function() {
  if (this.totalLeads && this.totalLeads > 0) {
    this.conversionRate = (this.leadsConverted / this.totalLeads) * 100;
  } else {
    this.conversionRate = 0;
  }
});

module.exports = mongoose.model('Lead', leadSchema);
