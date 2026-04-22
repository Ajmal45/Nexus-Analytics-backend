const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const MONGO_URI = 'mongodb://localhost:27017/lead_analytics';

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB');

    await User.deleteMany({}); // clear existing
    console.log('Cleared Users');

    const adminHash = await bcrypt.hash('admin123', 10);
    const user1Hash = await bcrypt.hash('user123', 10);
    const user2Hash = await bcrypt.hash('user123', 10);

    const admin = new User({
      name: 'Admin User',
      email: 'admin@admin.com',
      password: adminHash,
      role: 'admin'
    });

    const user1 = new User({
      name: 'John Client',
      email: 'john@client.com',
      password: user1Hash,
      role: 'user'
    });

    const user2 = new User({
      name: 'Jane Client',
      email: 'jane@client.com',
      password: user2Hash,
      role: 'user'
    });

    await admin.save();
    await user1.save();
    await user2.save();

    console.log('Seeded Users:');
    console.log('Admin: admin@admin.com / admin123');
    console.log('Client 1: john@client.com / user123');
    console.log('Client 2: jane@client.com / user123');
    process.exit();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

seed();
