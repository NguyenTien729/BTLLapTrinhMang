const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
  upload,
  getFileCategory,
  MAX_FILE_SIZE
} = require('../middleware/uploadMiddleware');

// All upload routes require JWT authentication
router.use(protect);

/**
 * @route   POST /api/uploads
 * @desc    Upload file(s) or image(s) using Multer
 *          Accepts field names 'file', 'files', 'attachment', etc.
 * @access  Private
 */
router.post('/', (req, res) => {
  upload.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `Kích thước tệp vượt quá giới hạn tối đa (${MAX_FILE_SIZE / (1024 * 1024)}MB)`
        });
      }
      return res.status(400).json({
        success: false,
        message: `Lỗi tải tệp: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất một tệp để tải lên (field: file hoặc files)'
      });
    }

    const uploadedData = req.files.map((file) => {
      const category = getFileCategory(file.mimetype, file.originalname);
      return {
        url: `/uploads/${file.filename}`,
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        type: category
      };
    });

    res.status(201).json({
      success: true,
      message: 'Tải tệp lên thành công',
      data: uploadedData.length === 1 ? uploadedData[0] : uploadedData
    });
  });
});

module.exports = router;
