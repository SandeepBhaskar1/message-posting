const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadsDir = path.join(__dirname, '/tmp', 'uploads');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const profilePicStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, uniqueSuffix + fileExtension);
    }
});

const fileFilter = (req, file, cb) => {
    console.log(`File MIME type: ${file.mimetype}`);
    console.log(`File name: ${file.originalname}`);
    
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];

    if (allowedTypes.includes(file.mimetype)) {
        const fileExtension = path.extname(file.originalname).toLowerCase();
        if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid File Type: Only .png, .jpg, and .jpeg are allowed'), false);
        }
    } else {
        cb(new Error('Invalid File Type: Only images are allowed'), false);
    }
};

const upload = multer({
    storage: profilePicStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: fileFilter
});

module.exports = upload;
