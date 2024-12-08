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

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 50* 1024 * 1024 } // 10MB limit
});

// Middleware
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

// MongoDB Connection
mongoose.connect('mongodb+srv://smetchappy:Egd8lV7C8J5mcymM@backeddb.pmksk.mongodb.net/Mafube?retryWrites=true&w=majority&appName=BackedDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB Mafube Database');
}).catch(err => {
    console.error('Error connecting to MongoDB', err);
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
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const user = new User({
            name: req.body.name,
            surname: req.body.surname,
            idNumber: req.body.idNumber,
            wardNumber: parseInt(req.body.wardNumber),
            suburb: req.body.suburb,
            town: req.body.town,
            state: req.body.state,
            postalCode: req.body.postalCode,
            password: hashedPassword
        });
        await user.save();
        res.redirect('/login');
    } catch (error) {
        res.render('signup', { 
            error: 'Error creating account',
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

app.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const comments = await Comment.find({ wardNumber: user.wardNumber })
            .populate('user', 'name surname')
            .sort('-createdAt');
        
        res.render('dashboard', {
            user,
            comments,
            isLoggedIn: true
        });
    } catch (error) {
        res.render('error', { 
            message: 'Error loading dashboard',
            isLoggedIn: true 
        });
    }
});

app.post('/comment', isAuthenticated, validateWard, upload.single('image'), async (req, res) => {
    try {
        const comment = new Comment({
            user: req.session.userId,
            content: req.body.content,
            image: req.file ? `/uploads/${req.file.filename}` : null,
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
        const comment = new Comment({
            user: req.session.userId,
            content: req.body.content,
            image: req.file ? `/uploads/${req.file.filename}` : null,
            town: town,
            wardNumber: req.session.wardNumber
        });
        await comment.save();
        res.redirect(`/${req.params.town}`);
    } catch (error) {
        res.render('error', { 
            message: 'Error posting comment',
            isLoggedIn: true 
        });
    }
});
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
