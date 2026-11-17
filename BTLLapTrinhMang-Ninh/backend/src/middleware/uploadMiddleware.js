const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique name: timestamp-random-sanitizedName
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    const basename = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  }
});

// Allowed MIME types & extensions
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/octet-stream'
];

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.zip', '.rar', '.7z'
];

// File filter function
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext);
  const isMimeAllowed = ALLOWED_FILE_TYPES.includes(file.mimetype);

  if (isExtAllowed || isMimeAllowed) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Định dạng tệp không được hỗ trợ (${ext}). Chỉ cho phép ảnh (.jpg, .png, .gif, .webp) và tài liệu (.pdf, .doc, .docx, .xls, .xlsx, .zip, v.v.)`
      ),
      false
    );
  }
};

// Multer upload instances
// Max file size: 25MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter
});

const uploadSingle = upload.single('file');
const uploadMultiple = upload.array('files', 10);

/**
 * Helper to determine category: image vs file
 */
const getFileCategory = (mimetype, originalname) => {
  if (
    mimetype.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(originalname)
  ) {
    return 'image';
  }
  return 'file';
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadDir,
  MAX_FILE_SIZE,
  getFileCategory
};

