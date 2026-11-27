<<<<<<< HEAD
const router = require('express').Router();
const authenticate = require('../middleware/authMiddleware');
const { getMe, updateMe, searchUsers, getUsers } = require('../controllers/userController');

router.use(authenticate);
router.get('/', getUsers);
=======
const express = require('express');
const router = express.Router();
const { getUsers, getMe, updateMe, searchUsers } = require('../controllers/userController');
const protect = require('../middleware/authMiddleware');

router.use(protect);

>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
router.get('/me', getMe);
router.patch('/me', updateMe);
router.put('/me', updateMe);
router.get('/search', searchUsers);
router.get('/', getUsers);

module.exports = router;
