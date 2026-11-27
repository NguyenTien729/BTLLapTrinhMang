<<<<<<< HEAD
const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const { register, login, getMe } = require('../controllers/authController');
=======
const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const protect = require('../middleware/authMiddleware');
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034

router.post('/register', register);
router.post('/login', login);
<<<<<<< HEAD
router.get('/me', require('../middleware/authMiddleware'), getMe);
=======
router.get('/me', protect, getMe);

>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
module.exports = router;
