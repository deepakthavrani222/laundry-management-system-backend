const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// Multer upload configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

/**
 * Validate image file
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Object>} - Image metadata
 */
const validateImage = async (buffer) => {
  try {
    const metadata = await sharp(buffer).metadata();
    
    // Check dimensions
    if (metadata.width > 4000 || metadata.height > 4000) {
      throw new Error('Image dimensions too large. Maximum 4000x4000 pixels');
    }
    
    if (metadata.width < 100 || metadata.height < 100) {
      throw new Error('Image dimensions too small. Minimum 100x100 pixels');
    }
    
    return metadata;
  } catch (error) {
    throw new Error(`Image validation failed: ${error.message}`);
  }
};

/**
 * Optimize image
 * @param {Buffer} buffer - Original image buffer
 * @param {Object} options - Optimization options
 * @returns {Promise<Buffer>} - Optimized image buffer
 */
const optimizeImage = async (buffer, options = {}) => {
  const {
    width = 1200,
    height = null,
    quality = 80,
    format = 'webp'
  } = options;

  try {
    let image = sharp(buffer);
    
    // Resize if needed
    if (width || height) {
      image = image.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // Convert to specified format with quality
    switch (format) {
      case 'jpeg':
      case 'jpg':
        image = image.jpeg({ quality });
        break;
      case 'png':
        image = image.png({ quality });
        break;
      case 'webp':
        image = image.webp({ quality });
        break;
      default:
        image = image.webp({ quality });
    }
    
    return await image.toBuffer();
  } catch (error) {
    throw new Error(`Image optimization failed: ${error.message}`);
  }
};

/**
 * Save image to local storage
 * @param {Buffer} buffer - Image buffer
 * @param {String} filename - Filename
 * @param {String} folder - Folder path
 * @returns {Promise<String>} - File path
 */
const saveToLocal = async (buffer, filename, folder = 'uploads/banners') => {
  try {
    const uploadDir = path.join(process.cwd(), 'public', folder);
    
    // Create directory if it doesn't exist
    await fs.mkdir(uploadDir, { recursive: true });
    
    const filepath = path.join(uploadDir, filename);
    await fs.writeFile(filepath, buffer);
    
    // Return relative URL path
    return `/${folder}/${filename}`;
  } catch (error) {
    throw new Error(`Failed to save image: ${error.message}`);
  }
};

/**
 * Delete image from local storage
 * @param {String} filepath - File path
 * @returns {Promise<Boolean>}
 */
const deleteFromLocal = async (filepath) => {
  try {
    const fullPath = path.join(process.cwd(), 'public', filepath);
    await fs.unlink(fullPath);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

/**
 * Upload image (main function)
 * @param {Buffer} buffer - Image buffer
 * @param {String} originalname - Original filename
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Upload result
 */
const uploadImage = async (buffer, originalname, options = {}) => {
  try {
    // Validate image
    const metadata = await validateImage(buffer);
    
    // Optimize image
    const optimizedBuffer = await optimizeImage(buffer, options);
    
    // Generate unique filename
    const timestamp = Date.now();
    const ext = options.format || 'webp';
    const filename = `banner-${timestamp}-${Math.random().toString(36).substring(7)}.${ext}`;
    
    // Save to local storage (or upload to cloud storage like Cloudinary/S3)
    const url = await saveToLocal(optimizedBuffer, filename, options.folder);
    
    return {
      success: true,
      url,
      filename,
      size: optimizedBuffer.length,
      width: metadata.width,
      height: metadata.height,
      format: ext
    };
  } catch (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

/**
 * Delete image
 * @param {String} url - Image URL
 * @returns {Promise<Boolean>}
 */
const deleteImage = async (url) => {
  try {
    // Extract filepath from URL
    const filepath = url.replace(/^\//, '');
    return await deleteFromLocal(filepath);
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
};

/**
 * Generate thumbnail
 * @param {Buffer} buffer - Original image buffer
 * @param {Number} size - Thumbnail size
 * @returns {Promise<Buffer>}
 */
const generateThumbnail = async (buffer, size = 200) => {
  try {
    return await sharp(buffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 70 })
      .toBuffer();
  } catch (error) {
    throw new Error(`Thumbnail generation failed: ${error.message}`);
  }
};

module.exports = {
  upload,
  validateImage,
  optimizeImage,
  uploadImage,
  deleteImage,
  saveToLocal,
  deleteFromLocal,
  generateThumbnail
};
