const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const ejs = require('ejs');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors()); // Now this will work
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));
app.use(cors());

// MongoDB Connection
mongoose.connect('mongodb+srv://smetchappy:Egd8lV7C8J5mcymM@backeddb.pmksk.mongodb.net/Mafube?retryWrites=true&w=majority&appName=BackedDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB Mafube Database');
}).catch(err => {
    console.error('Error connecting to MongoDB', err);
});

// User Schema
const userSchema = new mongoose.Schema({
    names: {
        type: String,
        required: true
    },
    surname: {
        type: String,
        required: true
    },
    idNumber: {
        type: String,
        required: true,
        unique: true
    },
    wardNumber: {
        type: String,
        required: true
    },
    suburb: {
        type: String,
        required: true
    },
    town: {
        type: String,
        required: true
    },
    postalCode: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// JWT Middleware
const verifyToken = (req, res, next) => {
    const token = req.session.token || req.headers['authorization'];
    if (!token) {
        return res.status(403).json({ message: "No token provided" });
    }
    try {
        const decoded = jwt.verify(token, 'your-jwt-secret');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Unauthorized" });
    }
};

app.get('/', (req, res) => {
    res.render('home');
});
app.get('/aboutus', (req, res) => {
    res.render('about');
});
app.get('/contactus', (req, res) => {
    res.render('contactus');
});
// GET route for signup page
app.get('/signup', (req, res) => {
    res.render('signup');  
});

// POST route for login
app.post('/login', async (req, res) => {
    try {
        const { idNumber, password } = req.body;
        console.log('Login attempt for ID:', idNumber); // Debug log

        // Find user
        const user = await User.findOne({ idNumber });
        if (!user) {
            console.log('User not found'); // Debug log
            return res.render('login', { 
                error: "Invalid ID Number or password",
                isLoggedIn: false
            });
        }

        // Check password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            console.log('Invalid password'); // Debug log
            return res.render('login', { 
                error: "Invalid ID Number or password",
                isLoggedIn: false
            });
        }

        // Create token
        const token = jwt.sign(
            { 
                userId: user._id, 
                idNumber: user.idNumber,
                wardNumber: user.wardNumber 
            },
            'your-jwt-secret',
            { expiresIn: '24h' }
        );

        // Store in session
        req.session.token = token;
        req.session.user = {
            _id: user._id,
            idNumber: user.idNumber,
            wardNumber: user.wardNumber,
            names: user.names,
            surname: user.surname
        };

        console.log('User ward number:', user.wardNumber); // Debug log

        // Redirect based on ward
        const wardNumber = parseInt(user.wardNumber);
        let redirectUrl;

        if ([2, 5, 6, 7].includes(wardNumber)) {
            redirectUrl = '/frankfort';
        } else if (wardNumber === 3) {
            redirectUrl = '/villiers';
        } else if (wardNumber === 1) {
            redirectUrl = '/cornelia';
        } else if (wardNumber === 8) {
            redirectUrl = '/tweeling';
        } else {
            console.log('Invalid ward number:', wardNumber); // Debug log
            req.session.destroy();
            return res.render('login', { 
                error: "Invalid ward number",
                isLoggedIn: false
            });
        }

        console.log('Redirecting to:', redirectUrl); // Debug log
        return res.redirect(redirectUrl);

    } catch (err) {
        console.error('Login error:', err);
        res.render('login', { 
            error: "An error occurred during login",
            isLoggedIn: false
        });
    }
});

// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.token) {
        try {
            const decoded = jwt.verify(req.session.token, 'your-jwt-secret');
            req.user = req.session.user; // Use stored user data
            return next();
        } catch (err) {
            console.error('Auth error:', err);
        }
    }
    res.redirect('/login');
};

// Town routes with authentication
app.get('/frankfort', isAuthenticated, async (req, res) => {
    if (![2, 5, 6, 7].includes(parseInt(req.user.wardNumber))) {
        return res.redirect('/login');
    }
    // ... rest of the route handler
});

app.get('/villiers', isAuthenticated, async (req, res) => {
    if (req.user.wardNumber !== 3) {
        return res.redirect('/login');
    }
    // ... rest of the route handler
});

app.get('/cornelia', isAuthenticated, async (req, res) => {
    if (req.user.wardNumber !== 1) {
        return res.redirect('/login');
    }
    // ... rest of the route handler
});

app.get('/tweeling', isAuthenticated, async (req, res) => {
    if (req.user.wardNumber !== 8) {
        return res.redirect('/login');
    }
    // ... rest of the route handler
});

// Make sure session middleware is configured properly
app.use(session({
    secret: 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Add this before your routes
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// POST route for signup
app.post('/signup', async (req, res) => {
    try {
        const {
            names,
            surname,
            idNumber,
            wardNumber,
            suburb,
            town,
            postalCode,
            password
        } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ idNumber });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = new User({
            names,
            surname,
            idNumber,
            wardNumber,
            suburb,
            town,
            postalCode,
            password: hashedPassword
        });

        await newUser.save();

        // Create JWT token
        const token = jwt.sign(
            { userId: newUser._id, idNumber: newUser.idNumber },
            'your-jwt-secret',
            { expiresIn: '24h' }
        );

        // Store token in session
        req.session.token = token;

        res.status(201).json({
            message: "User created successfully",
            token
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error creating user", error: err.message });
    }
});
// Middleware for authentication check


// Middleware to check ward access
const checkWardAccess = (req, res, next) => {
    const townWards = {
        'frankfort': [2, 5, 6, 7],
        'villiers': [3],
        'cornelia': [1],
        'tweeling': [8]
    };

    const town = req.params.town.toLowerCase();
    const userWard = parseInt(req.user.wardNumber);

    if (!townWards[town]) {
        return res.status(404).render('error', { 
            message: 'Town not found',
            isLoggedIn: !!req.user 
        });
    }

    if (!townWards[town].includes(userWard)) {
        return res.status(403).render('error', { 
            message: 'You do not have access to post in this town',
            isLoggedIn: !!req.user 
        });
    }

    next();
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Make sure this directory exists
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const fileFilter = (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)) {
        req.fileValidationError = 'Only image files are allowed!';
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max file size
    },
    fileFilter: fileFilter
});


app.get('/:town', async (req, res) => {
    try {
        const town = req.params.town.charAt(0).toUpperCase() + req.params.town.slice(1);
        const comments = await Comment.find({ town })
            .populate('user', 'names surname')
            .sort('-createdAt');

        res.render('town.ejs', {  // Explicitly add .ejs extension
            town,
            comments,
            isLoggedIn: !!req.user,
            user: req.user
        });
    } catch (err) {
        console.error('Error fetching comments:', err);
        res.render('error.ejs', {  // Explicitly add .ejs extension
            message: 'Error loading town page',
            isLoggedIn: !!req.user 
        });
    }
});



// Post comment route
app.post('/:town/comment', isAuthenticated, checkWardAccess, upload.single('image'), async (req, res) => {
    try {
        const { content } = req.body;
        const town = req.params.town.charAt(0).toUpperCase() + req.params.town.slice(1);
        
        const newComment = new Comment({
            user: req.user._id,
            town,
            ward: req.user.wardNumber,
            content,
            image: req.file ? `/uploads/${req.file.filename}` : null
        });

        await newComment.save();
        res.redirect(`/${req.params.town}`);

    } catch (err) {
        console.error('Error posting comment:', err);
        res.status(500).render('error', { 
            message: 'Error posting comment',
            isLoggedIn: !!req.user 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).render('error', { 
                message: 'File is too large. Maximum size is 5MB',
                isLoggedIn: !!req.user 
            });
        }
    }
    console.error(err);
    res.status(500).render('error', { 
        message: 'An error occurred',
        isLoggedIn: !!req.user 
    });
});


// Create an error view
// views/error.ejs
// Protected route example
app.get('/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: "Error fetching profile" });
    }
});
//Get Route for home page
app.get('/home', (req, res) => {
    res.render('home');
});
// GET route for login page
app.get('/login', (req, res) => {
    // If user is already logged in, redirect to their town
    if (req.session && req.session.token) {
        try {
            const decoded = jwt.verify(req.session.token, 'your-jwt-secret');
            User.findById(decoded.userId)
                .then(user => {
                    if (user) {
                        const wardNumber = parseInt(user.wardNumber);
                        let redirectTown;

                        if ([2, 5, 6, 7].includes(wardNumber)) {
                            redirectTown = 'frankfort';
                        } else if (wardNumber === 3) {
                            redirectTown = 'villiers';
                        } else if (wardNumber === 1) {
                            redirectTown = 'cornelia';
                        } else if (wardNumber === 8) {
                            redirectTown = 'tweeling';
                        }

                        if (redirectTown) {
                            return res.redirect(`/${redirectTown}`);
                        }
                    }
                    req.session.destroy();
                    res.render('login', { error: null, isLoggedIn: false });
                })
                .catch(err => {
                    console.error('User lookup error:', err);
                    req.session.destroy();
                    res.render('login', { error: null, isLoggedIn: false });
                });
        } catch (err) {
            // If token is invalid, clear it
            req.session.destroy();
            res.render('login', { error: null, isLoggedIn: false });
        }
    } else {
        // Show login page if not logged in
        res.render('login', { error: null, isLoggedIn: false });
    }
});







// POST route for login
app.post('/login', async (req, res) => {
    try {
        const { idNumber, password } = req.body;

        // Find user by ID Number
        const user = await User.findOne({ idNumber });
        if (!user) {
            return res.render('login', { 
                error: "Invalid ID Number or password",
                isLoggedIn: false 
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.render('login', { 
                error: "Invalid ID Number or password",
                isLoggedIn: false 
            });
        }

        // Create JWT token
        const token = jwt.sign(
            { userId: user._id, idNumber: user.idNumber },
            'your-jwt-secret',
            { expiresIn: '24h' }
        );

        // Store token in session
        req.session.token = token;
        const wardNumber = parseInt(user.wardNumber);
        let redirectTown;

        switch(true) {
            case [2, 5, 6, 7].includes(wardNumber):
                redirectTown = 'frankfort';
                break;
            case wardNumber === 3:
                redirectTown = 'villiers';
                break;
            case wardNumber === 1:
                redirectTown = 'cornelia';
                break;
            case wardNumber === 8:
                redirectTown = 'tweeling';
                break;
            default:
                // If ward number doesn't match any town
                return res.status(400).render('login', {
                    error: "Invalid ward number",
                    isLoggedIn: false
                });
        }

        // Redirect to appropriate town page
        res.redirect(`/${redirectTown}`);

    }
    catch (err) {
        console.error('Login error:', err);
        res.status(500).render('login', {
            error: "An error occurred during login",
            isLoggedIn: false
        });
    }
});

        // Store token in session
    
const commentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    town: {
        type: String,
        required: true,
        enum: ['Frankfort', 'Villiers', 'Cornelia', 'Tweeling']
    },
    ward: {
        type: Number,
        required: true,
        validate: {
            validator: function(ward) {
                const validWards = {
                    'Frankfort': [2, 5, 6, 7],
                    'Villiers': [3],
                    'Cornelia': [1],
                    'Tweeling': [8]
                };
                return validWards[this.town].includes(ward);
            },
            message: 'Invalid ward number for selected town'
        }
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String, // URL to stored image
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});
const validateWard = (req, res, next) => {
    const userWard = req.session.wardNumber;
    const userTown = req.session.town;
    
    const wardMap = {
        'Frankfort': [2, 5, 6, 7],
        'Villiers': [3, 4, 9],
        'Cornelia': [1],
        'Tweeling': [8]
    };

    if (!wardMap[userTown] || !wardMap[userTown].includes(userWard)) {
        return res.render('error', { 
            message: 'You are not authorized to post in this ward',
            isLoggedIn: true 
        });
    }
    next();
};




// Post a comment
app.post('/:town/comment', isAuthenticated, validateWard, upload.single('image'), async (req, res) => {
    try {
        const town = req.params.town.charAt(0).toUpperCase() + req.params.town.slice(1);
        
        // Additional validation to ensure the ward matches the user's assigned ward
        if (parseInt(req.body.wardNumber) !== req.session.wardNumber) {
            throw new Error('Invalid ward number');
        }

        const comment = new Comment({
            user: req.session.userId,
            content: req.body.content,
            image: req.file ? `/uploads/${req.file.filename}` : null,
            town: town,
            wardNumber: req.session.wardNumber
        });
        
        await comment.save();
        res.redirect(`/${req.params.town.toLowerCase()}`);
    } catch (error) {
        res.render('error', { 
            message: 'Error posting comment: ' + error.message,
            isLoggedIn: true 
        });
    }
});

// Town-specific routes with ward restrictions
app.get('/frankfort', async (req, res) => {
    try {
        const comments = await Comment.find({ town: 'Frankfort' })
            .populate('user', 'names surname')
            .sort('-createdAt');

        res.render('town', {
            town: 'Frankfort',
            comments,
            isLoggedIn: !!req.user,
            user: req.user,
            allowedWards: [2, 5, 6, 7] // Frankfort allowed wards
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Server error' });
    }
});

app.get('/villiers', async (req, res) => {
    try {
        const comments = await Comment.find({ town: 'Villiers' })
            .populate('user', 'names surname')
            .sort('-createdAt');

        res.render('town', {
            town: 'Villiers',
            comments,
            isLoggedIn: !!req.user,
            user: req.user,
            allowedWards: [3] // Villiers allowed ward
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Server error' });
    }
});

app.get('/cornelia', async (req, res) => {
    try {
        const comments = await Comment.find({ town: 'Cornelia' })
            .populate('user', 'names surname')
            .sort('-createdAt');

        res.render('town', {
            town: 'Cornelia',
            comments,
            isLoggedIn: !!req.user,
            user: req.user,
            allowedWards: [1] // Cornelia allowed ward
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Server error' });
    }
});

app.get('/tweeling', async (req, res) => {
    try {
        const comments = await Comment.find({ town: 'Tweeling' })
            .populate('user', 'names surname')
            .sort('-createdAt');

        res.render('town', {
            town: 'Tweeling',
            comments,
            isLoggedIn: !!req.user,
            user: req.user,
            allowedWards: [8] // Tweeling allowed ward
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Server error' });
    }
});



// Main towns page
app.get('/towns', async (req, res) => {
    try {
        res.render('towns', {
            title: 'Towns - Mafube Municipality',
            isLoggedIn: !!req.user,
            user: req.user
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Server error' });
    }
});

// Frankfort routes
app.get('/frankfort', async (req, res) => {
    try {
        const comments = await Comment.find({ town: 'Frankfort' })
            .populate('user', 'names surname wardNumber')
            .sort('-createdAt');

        res.render('town', {
            title: 'Frankfort - Mafube Municipality',
            town: 'Frankfort',
            comments,
            allowedWards: [2, 5, 6, 7],
            isLoggedIn: !!req.user,
            user: req.user
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading Frankfort page' });
    }
});

app.post('/frankfort/comment', isAuthenticated, async (req, res) => {
    try {
        if (![2, 5, 6, 7].includes(parseInt(req.user.wardNumber))) {
            return res.status(403).send('You are not authorized to post in Frankfort');
        }

        const newComment = new Comment({
            user: req.user._id,
            town: 'Frankfort',
            ward: req.user.wardNumber,
            content: req.body.content,
            image: req.file ? `/uploads/${req.file.filename}` : null
        });

        await newComment.save();
        res.redirect('/frankfort');
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error posting comment' });
    }
});

// Villiers routes
app.get('/villiers', async (req, res) => {
    try {
        const comments = await Comment.find({ town: 'Villiers' })
            .populate('user', 'names surname wardNumber')
            .sort('-createdAt');

        res.render('town', {
            title: 'Villiers - Mafube Municipality',
            town: 'Villiers',
            comments,
            allowedWards: [3],
            isLoggedIn: !!req.user,
            user: req.user
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading Villiers page' });
    }
});

app.post('/villiers/comment', isAuthenticated, async (req, res) => {
    try {
        if (req.user.wardNumber !== 3) {
            return res.status(403).send('You are not authorized to post in Villiers');
        }

        const newComment = new Comment({
            user: req.user._id,
            town: 'Villiers',
            ward: req.user.wardNumber,
            content: req.body.content,
            image: req.file ? `/uploads/${req.file.filename}` : null
        });

        await newComment.save();
        res.redirect('/villiers');
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error posting comment' });
    }
});

// Cornelia routes
app.get('/cornelia', async (req, res) => {
    try {
        const comments = await Comment.find({ town: 'Cornelia' })
            .populate('user', 'names surname wardNumber')
            .sort('-createdAt');

        res.render('town', {
            title: 'Cornelia - Mafube Municipality',
            town: 'Cornelia',
            comments,
            allowedWards: [1],
            isLoggedIn: !!req.user,
            user: req.user
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading Cornelia page' });
    }
});

app.post('/cornelia/comment', isAuthenticated, async (req, res) => {
    try {
        if (req.user.wardNumber !== 1) {
            return res.status(403).send('You are not authorized to post in Cornelia');
        }

        const newComment = new Comment({
            user: req.user._id,
            town: 'Cornelia',
            ward: req.user.wardNumber,
            content: req.body.content,
            image: req.file ? `/uploads/${req.file.filename}` : null
        });

        await newComment.save();
        res.redirect('/cornelia');
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error posting comment' });
    }
});

// Tweeling routes
app.get('/tweeling', async (req, res) => {
    try {
        const comments = await Comment.find({ town: 'Tweeling' })
            .populate('user', 'names surname wardNumber')
            .sort('-createdAt');

        res.render('town', {
            title: 'Tweeling - Mafube Municipality',
            town: 'Tweeling',
            comments,
            allowedWards: [8],
            isLoggedIn: !!req.user,
            user: req.user
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading Tweeling page' });
    }
});

app.post('/tweeling/comment', isAuthenticated, async (req, res) => {
    try {
        if (req.user.wardNumber !== 8) {
            return res.status(403).send('You are not authorized to post in Tweeling');
        }

        const newComment = new Comment({
            user: req.user._id,
            town: 'Tweeling',
            ward: req.user.wardNumber,
            content: req.body.content,
            image: req.file ? `/uploads/${req.file.filename}` : null
        });

        await newComment.save();
        res.redirect('/tweeling');
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error posting comment' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).render('error', { 
            message: 'File upload error: ' + err.message,
            isLoggedIn: !!req.user
        });
    }
    console.error(err);
    res.status(500).render('error', { 
        message: 'An error occurred',
        isLoggedIn: !!req.user
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});