const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  address: { type: String, required: true },
  pincode: { type: String, required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
