const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const User = require('./models/User');
const Comment = require('./models/Comment');
const passport = require('passport');
const nodemailer = require('nodemailer');

const app = express();

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Limit to 5MB since we're storing in MongoDB
});


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Make user available to all templates
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.isLoggedIn = req.isAuthenticated();
    next();
});

mongoose.connect('mongodb+srv://smetchappy:Egd8lV7C8J5mcymM@backeddb.pmksk.mongodb.net/Mafube?retryWrites=true&w=majority&appName=BackedDB', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('Connected to MongoDB Mafube Database');
        // You can register the admin here if needed, or just keep the connection open
    })
    .catch(err => {
        console.error('Error connecting to MongoDB', err);
    });
// Create index for comments
mongoose.connection.once('open', () => {
    Comment.collection.createIndex({ createdAt: -1 }, (err) => {
        if (err) console.error('Error creating index:', err);
        else console.log('Created index on createdAt field');
    });
});

// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
};

// Ward validation middleware
const validateWard = (req, res, next) => {
    const userWard = req.session.wardNumber;
    const userTown = req.session.town;
    
    const wardMap = {
        'Frankfort': [2, 5, 6, 7],
        'Villiers': [3, 4, 9],
        'Cornelia': [1],
        'Tweeling': [8]
    };

    if (wardMap[userTown].includes(userWard)) {
        next();
    } else {
        res.render('error', { 
            message: 'You are not authorized to post in this ward',
            isLoggedIn: true 
        });
    }
};

// Routes
app.get('/', (req, res) => {
    res.render('home', { 
        isLoggedIn: !!req.session.userId 
    });
});

app.get('/signup', (req, res) => {
    res.render('signup', { 
        error: null,
        isLoggedIn: false 
    });
});

app.post('/signup', async (req, res) => {
    try {
        // Log the received data
        console.log('Signup attempt:', {
            name: req.body.name,
            surname: req.body.surname,
            idNumber: req.body.idNumber,
            wardNumber: req.body.wardNumber,
            town: req.body.town,
            suburb: req.body.suburb,
            postalCode: req.body.postalCode,
            state: req.body.state // Added state field
        });

        // Validate required fields
        if (!req.body.name || !req.body.surname || !req.body.idNumber || 
            !req.body.wardNumber || !req.body.town || !req.body.suburb || 
            !req.body.password || !req.body.postalCode || !req.body.state) {
            return res.render('signup', {
                error: 'All fields are required',
                isLoggedIn: false
            });
        }

        // Validate postal code (South African format)
        const postalCodeRegex = /^\d{4}$/;
        if (!postalCodeRegex.test(req.body.postalCode)) {
            return res.render('signup', {
                error: 'Invalid postal code format. Must be 4 digits',
                isLoggedIn: false
            });
        }

        // State validation (Free State for Mafube)
        if (req.body.state !== 'Free State') {
            return res.render('signup', {
                error: 'Municipality is located in Free State only',
                isLoggedIn: false
            });
        }

        // Validate ID Number format (assuming South African ID)
        const idNumberRegex = /^\d{13}$/;
        if (!idNumberRegex.test(req.body.idNumber)) {
            return res.render('signup', {
                error: 'Invalid ID Number format. Must be 13 digits',
                isLoggedIn: false
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ idNumber: req.body.idNumber });
        if (existingUser) {
            return res.render('signup', {
                error: 'A user with this ID number already exists',
                isLoggedIn: false
            });
        }

        // Validate ward number matches town
        const wardMap = {
            'Frankfort': [2, 5, 6, 7],
            'Villiers': [3, 4, 9],
            'Cornelia': [1],
            'Tweeling': [8]
        };

        const wardNumber = parseInt(req.body.wardNumber);
        const town = req.body.town;

        if (!wardMap[town] || !wardMap[town].includes(wardNumber)) {
            return res.render('signup', {
                error: 'Invalid ward number for selected town',
                isLoggedIn: false
            });
        }

        // Password validation
        if (req.body.password.length < 6) {
            return res.render('signup', {
                error: 'Password must be at least 6 characters long',
                isLoggedIn: false
            });
        }

        // Create new user with added fields
        const user = new User({
            name: req.body.name.trim(),
            surname: req.body.surname.trim(),
            idNumber: req.body.idNumber.trim(),
            wardNumber: parseInt(req.body.wardNumber),
            town: req.body.town,
            suburb: req.body.suburb.trim(),
            postalCode: req.body.postalCode.trim(),
            state: req.body.state.trim(),
            password: await bcrypt.hash(req.body.password, 10)
        });

        // Save user to database
        await user.save();

        // Log successful creation
        console.log('User created successfully:', user._id);

        // Create session
        req.session.userId = user._id;
        req.session.wardNumber = user.wardNumber;
        req.session.town = user.town;

        // Redirect to home page
        res.redirect('/');

    } catch (error) {
        console.error('Signup error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });

        if (error.name === 'MongoServerError' && error.code === 11000) {
            return res.render('signup', {
                error: 'This ID number is already registered',
                isLoggedIn: false
            });
        }

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.render('signup', {
                error: messages.join(', '),
                isLoggedIn: false
            });
        }

        res.render('signup', {
            error: 'An error occurred during signup. Please try again.',
            isLoggedIn: false
        });
    }
});
// Backend route implementation
app.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { 
        error: null,
        message: null,
        isLoggedIn: false 
    });
});

app.post('/forgot-password', async (req, res) => {
    try {
        const user = await User.findOne({ idNumber: req.body.idNumber });
        
        if (!user) {
            return res.render('forgot-password', { 
                error: 'ID Number not found',
                message: null,
                isLoggedIn: false 
            });
        }

        // Generate a new random password
        const newPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password
        await User.updateOne(
            { idNumber: req.body.idNumber },
            { $set: { password: hashedPassword } }
        );

        // You might want to send this password to the user's email here
        // For now, we'll just show it in the response
        res.render('forgot-password', { 
            error: null,
            message: `New password: ${newPassword}`,
            isLoggedIn: false 
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.render('forgot-password', { 
            error: 'An error occurred. Please try again.',
            message: null,
            isLoggedIn: false 
        });
    }
});

app.get('/login', (req, res) => {
    res.render('login', { 
        error: null,
        isLoggedIn: false 
    });
});

app.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ idNumber: req.body.idNumber });
        if (!user) {
            return res.render('login', { 
                error: 'Invalid ID Number or password',
                isLoggedIn: false 
            });
        }

        const validPassword = await bcrypt.compare(req.body.password, user.password);
        if (!validPassword) {
            return res.render('login', { 
                error: 'Invalid ID Number or password',
                isLoggedIn: false 
            });
        }

        req.session.userId = user._id;
        req.session.wardNumber = user.wardNumber;
        req.session.town = user.town;
        res.redirect('/dashboard');
    } catch (error) {
        res.render('login', { 
            error: 'Error logging in',
            isLoggedIn: false 
        });
    }
});

// Modify dashboard route
app.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const comments = await Comment.aggregate([
            { $match: { wardNumber: user.wardNumber } },
            { $sort: { createdAt: -1 } },
            { $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userInfo'
            } },
            { $unwind: '$userInfo' },
            { $project: {
                content: 1,
                createdAt: 1,
                image: 1,
                'userInfo.name': 1,
                'userInfo.surname': 1
            }}
        ]).allowDiskUse(true);

        res.render('dashboard', { user, comments, isLoggedIn: true });
    } catch (error) {
        // Handle error
    }
});

app.post('/comment', isAuthenticated, validateWard, upload.single('image'), async (req, res) => {
    try {
        const comment = new Comment({
            user: req.session.userId,
            content: req.body.content,
            image: req.file ? {
                data: req.file.buffer,
                contentType: req.file.mimetype
            } : null,
            town: req.session.town,
            wardNumber: req.session.wardNumber
        });
        await comment.save();
        res.redirect('/dashboard');
    } catch (error) {
        res.render('error', { 
            message: 'Error posting comment',
            isLoggedIn: true 
        });
    }
});
// ... existing imports and setup ...
// About page route
app.get('/about', (req, res) => {
    res.render('about', {
        user: req.user || null,
        isLoggedIn: !!req.user,
        title: 'About Us - Mafube Local Municipality'
    });
});
// Projects page route
app.get('/projects', (req, res) => {
    res.render('projects', {
        user: req.user || null,
        isLoggedIn: !!req.user,
        title: 'Projects - Mafube Local Municipality'
    });
});
// Services page route
app.get('/services', (req, res) => {
    res.render('services', {
        user: req.user || null,
        isLoggedIn: !!req.user,
        title: 'Services - Mafube Local Municipality'
    });
});
// Home page route


// Contact page route
app.get('/contact', (req, res) => {
    res.render('contact', {
        user: req.user || null,
        isLoggedIn: !!req.user,
        title: 'Contact Us - Mafube Local Municipality'
    });
});

// Handle contact form submission
app.post('/contact', async (req, res) => {
    try {

        res.render('contact', {
            success: 'Thank you for your message. We will get back to you soon.',
            user: req.user || null,
            isLoggedIn: !!req.user,
            title: 'Contact Us - Mafube Local Municipality'
        });
    } catch (error) {
        res.render('contact', {
            error: 'There was an error sending your message. Please try again.',
            user: req.user || null,
            isLoggedIn: !!req.user,
            title: 'Contact Us - Mafube Local Municipality'
        });
    }
});

app.get('/', async (req, res) => {
    try {
        // Get the latest 3 comments/news items to display on the home page
        let news = [];
        try {
            news = await Comment.find()
                .sort({ createdAt: -1 })
                .limit(3)
                .populate('user', 'name surname')
                .lean(); // Convert to plain JavaScript objects
        } catch (dbError) {
            console.error('Error fetching news:', dbError);
            // Continue with empty news array if there's an error
        }

        res.render('home', {
            user: req.user || null,
            news: news, // Always pass the news array, even if empty
            title: 'Mafube Local Municipality',
            isLoggedIn: !!req.user
        });

    } catch (error) {
        console.error('Error loading home page:', error);
        // If there's an error, render with empty data
        res.render('home', {
            user: null,
            news: [],
            title: 'Mafube Local Municipality',
            isLoggedIn: false,
            error: 'Failed to load some content'
        });
    }
});
// ... existing routes and setup ...
// Town-specific routes - accessible to all users
app.get('/:town', async (req, res) => {
    try {
        const town = req.params.town.charAt(0).toUpperCase() + req.params.town.slice(1);
        const comments = await Comment.find({ town: town })
            .populate('user')
            .sort({ createdAt: -1 });

        res.render('town', { 
            town: town, 
            comments: comments,
            user: req.session.user || null,  // Pass user if logged in, null if not
            isLoggedIn: !!req.session.user
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});
app.post('/:town/comment', isAuthenticated, validateWard, upload.single('image'), async (req, res) => {
    try {
        const town = req.params.town.charAt(0).toUpperCase() + req.params.town.slice(1);
        const commentData = {
            user: req.session.userId,
            content: req.body.content,
            town: town,
            wardNumber: req.session.wardNumber
        };

        if (req.file) {
            commentData.image = {
                data: req.file.buffer,
                contentType: req.file.mimetype
            };
        }

        const comment = new Comment(commentData);
        await comment.save();
        res.redirect(`/${req.params.town}`);
    } catch (error) {
        console.error('Error posting comment:', error);
        res.render('error', { 
            message: 'Error posting comment. Please try again.',
            isLoggedIn: true 
        });
    }
});
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Add a route to serve the images
app.get('/image/:commentId', async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.commentId);
        if (comment && comment.image && comment.image.data) {
            res.contentType(comment.image.contentType);
            res.send(comment.image.data);
        } else {
            res.status(404).send('Image not found');
        }
    } catch (error) {
        console.error('Error serving image:', error);
        res.status(500).send('Error loading image');
    }
});

app.get('/users-details', async (req, res) => {
    try {
        const users = await User.find().select('-password').lean();
        res.render('users-details', { 
            users,
            title: 'User Management - Mafube Local Municipality',
            isLoggedIn: true
        });
    } catch (err) {
        console.error('Error in /users-details route:', err);
        res.status(500).render('error', { 
            message: 'Error retrieving users',
            isLoggedIn: true 
        });
    }
});

app.post('/users-details/delete/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.redirect('/users-details');
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).render('error', { 
            message: 'Error deleting user',
            isLoggedIn: true 
        });
    }
});

app.get('/frankfort', isAuthenticated, async (req, res) => {
    try {
        const comments = await Comment.find({ town: 'Frankfort' })
            .populate('user')
            .sort({ createdAt: -1 });

        res.render('town', { 
            town: 'Frankfort', 
            comments: comments,
            user: req.session.user || null,  // Pass user if logged in, null if not
            isLoggedIn: !!req.session.user
        });
    } catch (error) {
        console.error('Error occurred while accessing /frankfort:', error);
        res.status(500).render('error', { message: 'Internal Server Error' });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
