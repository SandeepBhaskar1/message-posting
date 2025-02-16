const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const upload = require('./multer'); 
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

const BACKEND_URL = process.env.NODE_ENV === 'production'
    ? process.env.BACKEND_CLOUD_URL
    : process.env.BACKEND_LOCAL_URL;

const allowedOrigins = [
    process.env.FRONTEND_LOCAL_URL,
    process.env.FRONTEND_CLOUD_URL,
];

// Configure CORS 
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'))); 

// Add security headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// MongoDB connection with retry logic
const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        setTimeout(connectDB, 5000);
    }
};

connectDB();

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.auth_token;
    
    if (!token) {
        return res.status(401).json({ message: 'Please login to continue' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized', error: err.message });
    }
};

// User Schema
const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dateOfBirth: { type: String, required: true },
    gender: { type: String, required: true },
    emailID: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    password: { type: String, required: true },
    profilePic: {type: String, default: ''},
    posts: [{
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
        title: String,
        content: String,
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);

// Post Schema
const postsSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        firstName: String,
        lastName: String,
        emailID: String
    },
    createdAt: { type: Date, default: Date.now },
});

const Post = mongoose.model('Post', postsSchema);

// Routes
app.get('/checkAuth', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userID);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({
            isAuthenticated: true,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                profilePic: user.profilePic
            },
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/posts', async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('author', 'firstName lastName createdAt')
            .sort({ createdAt: -1 });
        res.json({ posts });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch posts', error: error.message });
    }
});

app.post('/post', authenticateToken, async (req, res) => {
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ message: 'Title and content are required' });
    }

    try {
        const user = await User.findById(req.user.userID);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const newPost = await Post.create({
            title,
            content,
            author: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                emailID: user.emailID
            }
        });

        user.posts.push({
            _id: newPost._id,
            title: newPost.title,
            content: newPost.content,
            createdAt: newPost.createdAt
        });

        await user.save();
        res.status(201).json({ message: 'Post added successfully', post: newPost });
    } catch (err) {
        res.status(500).json({ message: 'Error occurred while adding the post', error: err.message });
    }
});

app.post('/register', async (req, res) => {
    const { firstName, lastName, dateOfBirth, gender, emailID, phoneNumber, password } = req.body;

    if (!firstName || !lastName || !dateOfBirth || !emailID || !gender || !phoneNumber || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const existingUser = await User.findOne({ emailID });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = new User({
            firstName,
            lastName,
            dateOfBirth,
            gender,
            emailID,
            phoneNumber,
            password: hashedPassword,
        });

        await newUser.save();
        return res.status(201).json({ message: 'Registration successful!' });
    } catch (err) {
        return res.status(500).json({ message: 'Error occurred while registering', error: err.message });
    }
});

app.post('/login', async (req, res) => {
    const { emailID, password } = req.body;

    if (!emailID || !password) {
        return res.status(400).json({ message: 'Email and password required!' });
    }

    try {
        const user = await User.findOne({ emailID });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userID: user.id, emailID: user.emailID },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: true, 
            sameSite: 'none', 
            maxAge: 24 * 60 * 60 * 1000, 
            path: '/',
        });

        return res.status(200).json({
            message: 'Login successful',
            user: {
                firstName: user.firstName,
                emailID: user.emailID,
                profilePic: user.profilePic
            },
        });
    } catch (err) {
        return res.status(500).json({ message: 'Error occurred during login', error: err.message });
    }
});

app.post('/logout', authenticateToken, (req, res) => {
    res.cookie('auth_token', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        expires: new Date(0),
        path: '/',
    });

    return res.status(200).json({ message: 'Logout successful' });
});

// Fixed uploadProfilePic route
app.post('/uploadProfilePic', authenticateToken, upload.single('profilePic'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    try {
        const user = await User.findById(req.user.userID);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const profilePicUrl = `/uploads/${req.file.filename}`;    
        user.profilePic = profilePicUrl;
        await user.save();

        res.status(200).json({ message: 'Profile pic uploaded successfully.', profilePicUrl });
    } catch (error) {
        return res.status(500).json({ message: 'Error uploading the Profile picture.', error: error.message });
    }
});

app.get('/user', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userID);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ user });
    } catch (error) {
        console.error("Error fetching user:", error); 
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});