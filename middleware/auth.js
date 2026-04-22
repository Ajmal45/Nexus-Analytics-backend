const jwt = require('jsonwebtoken');

const JWT_SECRET = 'super-secret-key-for-lead-analytics-dev'; // In production, use env

const auth = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch (ex) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Admin only.' });
  }
};

module.exports = { auth, isAdmin, JWT_SECRET };
