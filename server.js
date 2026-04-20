const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;
const MONGO_URI = 'mongodb://localhost:27017/userdetails';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB:', err));

// Admin Login Route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // Hardcoded for demonstration purposes. Use hashed passwords for production!
  if (username === 'admin' && password === 'password') {
    res.json({ success: true, token: 'fake-admin-token-123' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Routes
app.post('/api/users', async (req, res) => {
  try {
    const { name, phoneNumber, address, pincode } = req.body;
    const newUser = new User({ name, phoneNumber, address, pincode });
    const savedUser = await newUser.save();
    res.status(201).json(savedUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'name phoneNumber address pincode createdAt').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
