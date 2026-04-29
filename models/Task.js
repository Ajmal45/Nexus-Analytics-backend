const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  leadOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leadOwnerName: { type: String, required: true },
  assignedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedUserName: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Completed'],
    default: 'Open'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  dueDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', taskSchema);
