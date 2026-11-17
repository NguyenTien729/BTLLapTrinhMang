const express = require('express');
const router = express.Router();
const { getUsers, getMe, updateMe, searchUsers } = require('../controllers/userController');
const protect = require('../middleware/authMiddleware');

router.use(protect);

router.get('/me', getMe);
router.patch('/me', updateMe);
router.put('/me', updateMe);
router.get('/search', searchUsers);
router.get('/', getUsers);

module.exports = router;
