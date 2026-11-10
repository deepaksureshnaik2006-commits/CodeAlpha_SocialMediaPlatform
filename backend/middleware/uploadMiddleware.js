const multer = require('multer');

// Configure multer memory storage
const storage = multer.memoryStorage();

// File filter to allow image and video (reels) files
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg',
    'video/mp4', 'video/webm', 'video/quicktime'
  ];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Supported formats: JPEG, PNG, WEBP, GIF images and MP4, WEBM, MOV video reels.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB maximum file size to support video reels
  },
  fileFilter: fileFilter
});

module.exports = upload;

