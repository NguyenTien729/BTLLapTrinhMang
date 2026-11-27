const router = require('express').Router();
const authenticate = require('../middleware/authMiddleware');
const { getMe, updateMe, searchUsers, getUsers } = require('../controllers/userController');

router.use(authenticate);
router.get('/', getUsers);
router.get('/me', getMe);
router.put('/me', updateMe);
router.get('/search', searchUsers);
module.exports = router;
