const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Lead = require('../models/Lead');
const { auth } = require('../middleware/auth');

async function getAssignableUsersForLeadUser(leadUserId) {
  const ownedLeads = await Lead.find(
    {
      ownerUserId: leadUserId,
      assignedTo: { $ne: null }
    },
    'assignedTo assignedToName'
  );

  const uniqueUsers = new Map();

  ownedLeads.forEach((lead) => {
    if (lead.assignedTo) {
      uniqueUsers.set(String(lead.assignedTo), {
        _id: lead.assignedTo,
        name: lead.assignedToName || 'Assigned User'
      });
    }
  });

  return Array.from(uniqueUsers.values());
}

function normalizeTaskPayload(body) {
  return {
    title: typeof body.title === 'string' ? body.title.trim() : '',
    description: typeof body.description === 'string' ? body.description.trim() : '',
    status: typeof body.status === 'string' ? body.status : 'Open',
    priority: typeof body.priority === 'string' ? body.priority : 'Medium',
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
    assignedUserId: typeof body.assignedUserId === 'string' ? body.assignedUserId : ''
  };
}

function validateTaskPayload(payload) {
  if (!payload.title) return 'Task title is required';
  if (!payload.description) return 'Task description is required';
  if (!payload.assignedUserId) return 'Please choose a user for this task';
  if (!['Open', 'In Progress', 'Completed'].includes(payload.status)) return 'Invalid task status';
  if (!['Low', 'Medium', 'High'].includes(payload.priority)) return 'Invalid task priority';
  if (payload.dueDate && Number.isNaN(payload.dueDate.getTime())) return 'Due date is invalid';
  return null;
}

router.get('/', auth, async (req, res) => {
  try {
    let tasks = [];

    if (req.user.role === 'lead') {
      tasks = await Task.find({ leadOwnerId: req.user.id }).sort({ createdAt: -1 });
    } else if (req.user.role === 'user') {
      tasks = await Task.find({ assignedUserId: req.user.id }).sort({ createdAt: -1 });
    } else {
      tasks = await Task.find().sort({ createdAt: -1 });
    }

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.get('/assignable-users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'lead') {
      return res.status(403).json({ error: 'Only lead accounts can view assignable users' });
    }

    const users = await getAssignableUsersForLeadUser(req.user.id);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignable users' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'lead') {
      return res.status(403).json({ error: 'Only lead accounts can create tasks' });
    }

    const payload = normalizeTaskPayload(req.body);
    const validationError = validateTaskPayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const assignableUsers = await getAssignableUsersForLeadUser(req.user.id);
    const matchedUser = assignableUsers.find((user) => String(user._id) === payload.assignedUserId);

    if (!matchedUser) {
      return res.status(403).json({ error: 'You can assign tasks only to users connected to your leads' });
    }

    const task = new Task({
      leadOwnerId: req.user.id,
      leadOwnerName: req.user.name,
      assignedUserId: matchedUser._id,
      assignedUserName: matchedUser.name,
      title: payload.title,
      description: payload.description,
      status: payload.status,
      priority: payload.priority,
      dueDate: payload.dueDate
    });

    const saved = await task.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task', details: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'lead') {
      return res.status(403).json({ error: 'Only lead accounts can update tasks' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (String(task.leadOwnerId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'You can only update your own tasks' });
    }

    const payload = normalizeTaskPayload(req.body);
    const validationError = validateTaskPayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const assignableUsers = await getAssignableUsersForLeadUser(req.user.id);
    const matchedUser = assignableUsers.find((user) => String(user._id) === payload.assignedUserId);

    if (!matchedUser) {
      return res.status(403).json({ error: 'You can assign tasks only to users connected to your leads' });
    }

    task.assignedUserId = matchedUser._id;
    task.assignedUserName = matchedUser.name;
    task.title = payload.title;
    task.description = payload.description;
    task.status = payload.status;
    task.priority = payload.priority;
    task.dueDate = payload.dueDate;

    const updated = await task.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task', details: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'lead') {
      return res.status(403).json({ error: 'Only lead accounts can delete tasks' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (String(task.leadOwnerId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'You can only delete your own tasks' });
    }

    await Task.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
