var express = require("express");
var path = require("path");
var http = require("http");
var https = require('https');
var fs = require('fs');
var ejs = require("ejs");
var publicPath = path.resolve(__dirname, "public");
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var exphbs = require('express-handlebars');
var expressValidator = require('express-validator');
var flash = require('connect-flash');
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var userUploadsPath = path.resolve(__dirname, "user_uploads");
var publicPath = path.join(__dirname, 'public');
var mongo = require('mongodb');
var mongoose = require('mongoose');
mongoose.connect('mongodb://mohabamroo:ghostrider1@ds139262.mlab.com:39262/reis-monrach');
// mongoose.connect('mongodb://localhost/communitydb');
var db = mongoose.connection;
var mailer = require('express-mailer');
var app = express();

var cfenv = require('cfenv');
var mailer = require('express-mailer');
var session = require('express-session');

mailer.extend(app, {
  from: 'communityguc@gmail.com',
  host: 'smtp.gmail.com', // hostname 
  secureConnection: true, // use SSL 
  port: 465, // port for secure SMTP 
  transportMethod: 'SMTP', // default is SMTP. Accepts anything that nodemailer accepts 
  auth: {
    user: 'communityguc@gmail.com',
    pass: 'community1234567890'
  }
});

module.exports = app;

// json api routes
var usersApi = require('./routes/api/users');
var postApi = require('./routes/api/posts');
var albumApi = require('./routes/api/albums');

app.set("views", path.resolve(__dirname, "views"));
app.set("view engine", "ejs"); 
app.engine("html", ejs.renderFile);
app.use(bodyParser.urlencoded({ extended: true }));

app.use(bodyParser.json());
app.use(bodyParser.json({limit: '5000mb'}));
app.use(bodyParser.urlencoded({limit: '5000mb', extended: true}));
app.use(cookieParser());

app.use(express.static(publicPath));
app.use(express.static(userUploadsPath));
app.use(express.static(path.resolve(__dirname, './public/frontend')));

// sessions
app.use(session({
    secret: 'secret',
    saveUninitialized: true,
    resave: true
}));

app.use(passport.initialize());
app.use(passport.session());

// Express Validator
app.use(expressValidator({
  errorFormatter: function(param, msg, value) {
      var namespace = param.split('.')
      , root    = namespace.shift()
      , formParam = root;

    while(namespace.length) {
      formParam += '[' + namespace.shift() + ']';
    }
    return {
      param : formParam,
      msg   : msg,
      value : value
    };
  }
}));

app.use(flash());

// Global Vars
app.use(function (req, res, next) {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  res.locals.pagetitle = 'Home Page';
  next();
});

// enable CROS
app.all("/*", function (req, res, next) {
    res.header('Access-Control-Allow-Credentials', true);
    res.header("Access-Control-Allow-Origin", "http://localhost:3000");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST");
    res.header("Access-Control-Allow-Headers", "Cache-Control, Pragma, Origin, Authorization, Content-Type, X-Requested-With, X-HTTP-Method-Override, Accept, X-Access-Token");
    return next();
});

// json api routes
app.use('/api/users', usersApi);
app.use('/api/posts', postApi);
app.use('/api/albums', albumApi);


// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// start server on the specified port and binding host
app.listen(appEnv.port, appEnv.bind, function() {
  console.log("server starting on " + appEnv.url);
});
