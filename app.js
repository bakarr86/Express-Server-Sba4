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