const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const { register, login, getMe } = require('../controllers/authController');

router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { message: 'Bạn thử quá nhiều lần. Vui lòng thử lại sau 15 phút.' } }));
router.post('/register', register);
router.post('/login', login);
router.get('/me', require('../middleware/authMiddleware'), getMe);
module.exports = router;
