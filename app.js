const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const LocalStorage = require('node-localstorage').LocalStorage;
const localStorage = new LocalStorage('./scratch');
const app = express();
const port = 3000;



//middleware section
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Custom middleware: Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});
// Custom Error class
class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true;
  
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  // Custom middleware: Authentication
  const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('No token provided', 401));
    }
  
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, 'your_jwt_secret');
      req.userData = decoded;
      next();
    } catch (error) {
      return next(new AppError('Authentication failed', 401));
    }
  };

  // Helper functions for localStorage
const getFromLocalStorage = (key) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const setToLocalStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// log in section
app.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    let users = getFromLocalStorage('users');

    // Default user credentials
    const defaultUsername = 'admin';
    const defaultPassword = 'password123';

    // If no users are stored, create a default user
    if (users.length === 0) {
      const hashedDefaultPassword = await bcrypt.hash(defaultPassword, 10);
      users = [{ id: 1, username: defaultUsername, password: hashedDefaultPassword }];
      setToLocalStorage('users', users);
    }

    // Find the user by username
    let user = users.find(u => u.username === username);
    // If user doesn't exist, create a new one
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = { id: users.length + 1, username, password: hashedPassword };
      users.push(user);
      setToLocalStorage('users', users);
    } else {
      const isPasswordCorrect = await bcrypt.compare(password, user.password);
      if (!isPasswordCorrect) {
        return next(new AppError('Incorrect password', 401));
      }
    }

    // Generate JWT token (optional, for other uses)
    const token = jwt.sign({ id: user.id }, 'your_jwt_secret', { expiresIn: '1h' });

    // Redirect to comment page and pass username to the template
    res.locals.username = user.username;

    return res.redirect('/CreatePost');
  } catch (error) {
    next(new AppError('Error logging in', 400));
  }
});


// Posts-------------------------------------------------------------------------------------------
app.get('/posts', (req, res) => {
  let posts = getFromLocalStorage('posts');

  // Ensure every post has a comments array
  posts = posts.map(post => ({
    ...post,
    comments: post.comments || []
  }));

  if (req.query.title) {
    posts = posts.filter(post =>
      post.title.toLowerCase().includes(req.query.title.toLowerCase())
    );
  }

  if (req.query.author) {
    posts = posts.filter(post =>
      post.author.toLowerCase() === req.query.author.toLowerCase())
  }

  res.render('post', { posts });
});


//--------------------ADD COMMENT TO POST----------------------------------------------
app.post('/posts/:id/comment', (req, res) => {
  const postId = parseInt(req.params.id); // Convert postId to a number
  const comment = req.body.comment; // Assuming the form sends the comment data with this key

  // Log the incoming data
  console.log(req.body, postId);

  // Fetch the posts from local storage
  let posts = getFromLocalStorage('posts');

  // Check if posts are retrieved correctly
  if (!posts || !Array.isArray(posts)) {
    return res.status(500).send('No posts found');
  }

  // Find the specific post by its ID (since postId is now a number)
  const postIndex = posts.findIndex(post => post.id === postId);

  if (postIndex !== -1) {
    // Ensure the post has a comments array
    if (!posts[postIndex].comments) {
      posts[postIndex].comments = [];
    }

    // Add the new comment
    posts[postIndex].comments.push({
      id: new Date().getTime(), // Unique ID for the comment
      content: comment
    });

    // Save the updated posts back to local storage
    setToLocalStorage('posts', posts);

    // Redirect back to the post page or send a response
    res.redirect('/posts');
  } else {
    res.status(404).send('Post not found');
  }
});

//-----------------------------------------------------------------------------------------------



//--------------------------------------------------------------------------------------------------------------
app.post('/posts/:id', (req, res) => { /// this is to delete a post
  const posts = getFromLocalStorage('posts');
  const postIndex = posts.findIndex(post => post.id === parseInt(req.params.id));
  
  if (postIndex !== -1) {
    posts.splice(postIndex, 1);
    setToLocalStorage('posts', posts);
    res.redirect('/comments'); // Redirect back to the comments page
  } else {
    res.status(404).send('Post not found');
  }
});


//---------------Creatin a post-----------------------------------------------------------------------------------------------
app.get('/CreatePost', (req, res) => {
  // Fetch posts from local storage
  let posts = getFromLocalStorage('posts', []);

  // Pass both the username and the posts array to the template
  res.render('index', { posts });
});


app.post('/CreatePost', (req, res) => {
  const { title, content, author } = req.body; // Get post data from the form

  // Fetch the current posts from local storage
  let posts = getFromLocalStorage('posts');

  // Ensure posts is an array
  if (!posts || !Array.isArray(posts)) {
    posts = [];
  }

  // Create a new post object
  const newPost = {
    id: new Date().getTime(), // Unique ID based on timestamp
    title: title,
    content: content,
    author: author,
    comments: [] // Initialize an empty comments array
  };

  // Add the new post to the posts array
  posts.push(newPost);

  // Save the updated posts back to local storage
  setToLocalStorage('posts', posts);

  // Redirect to the posts page or send a success response
  res.redirect('/posts'); // Redirect back to the posts page
});


//---------------------------------------------------------------------------

app.get('/', (req, res) => {
  const posts = getFromLocalStorage('posts');
  res.render('index', { posts });
});

app.get('/login', (req, res) => {
  res.render('login');
});