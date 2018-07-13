var express = require("express");
var path = require("path");
var ejs = require("ejs");
var publicPath = path.resolve(__dirname, "public");
var cookieParser = require('cookie-parser');
var morgan = require('morgan')
var bodyParser = require('body-parser');
var expressValidator = require('express-validator');
var session = require('express-session');
var userUploadsPath = path.resolve(__dirname, "user_uploads");
var publicPath = path.join(__dirname, 'public');
var mongo = require('mongodb');
var mongoose = require('mongoose');
mongoose.connect('mongodb://mohabamroo:ghostrider1@ds139262.mlab.com:39262/reis-monrach');
// mongoose.connect('mongodb://localhost/reis');
var db = mongoose.connection;
global.mongoose = mongoose;

var mailer = require('express-mailer');
var app = express();

var cfenv = require('cfenv');
var mailer = require('express-mailer');
var session = require('express-session');

var morganInstance = morgan(function (tokens, req, res) {
  return [
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    tokens.res(req, res, 'content-length'), '-',
    tokens['response-time'](req, res), 'ms'
  ].join(' ')
});

app.use(morganInstance);

mailer.extend(app, {
  from: 'communityguc@gmail.com',
  host: 'smtp.gmail.com', // hostname 
  secureConnection: true, // use SSL 
  port: 465, // port for secure SMTP 
  transportMethod: 'SMTP', // default is SMTP. Accepts anything that nodemailer accepts 
  auth: {
    user: 'mohab@deemalab.com',
    pass: 'mohab.abdelmeguid'
  }
});

module.exports = app;

// json api routes
var usersApi = require('./routes/api/users');
var postApi = require('./routes/api/posts');
var albumApi = require('./routes/api/albums');
// OLD controller
// var tripApi = require('./routes/api/trips/albums');
var tripPostsApi = require('./routes/api/trips_posts');
var stickersApi = require('./routes/api/stickers');
var timelineApi = require('./routes/api/timeline');

app.set("views", path.resolve(__dirname, "views"));
app.set("view engine", "ejs");
app.engine("html", ejs.renderFile);
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(bodyParser.json());
app.use(bodyParser.json({
  limit: '5000mb'
}));
app.use(bodyParser.urlencoded({
  limit: '5000mb',
  extended: true
}));
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

// Express Validator
app.use(expressValidator({
  errorFormatter: function (param, msg, value) {
    var namespace = param.split('.'),
      root = namespace.shift(),
      formParam = root;

    while (namespace.length) {
      formParam += '[' + namespace.shift() + ']';
    }
    return {
      param: formParam,
      msg: msg,
      value: value
    };
  },
  customValidators: {
    isArray: function (value) {
      return Array.isArray(value);
    },
    gte: function (param, num) {
      return param >= num;
    }
  }
}));


// enable CROS
app.all("/*", function (req, res, next) {
  res.header('Access-Control-Allow-Credentials', true);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Cache-Control, Pragma, Origin, Authorization, Content-Type, X-Requested-With, X-HTTP-Method-Override, Accept, X-Access-Token");
  return next();
});

// json api routes
app.use('/api/users', usersApi);
app.use('/api/posts', postApi);
app.use('/api/albums', albumApi);
app.use('/api/trips', tripPostsApi);
app.use('/api/stickers', stickersApi);
app.use('/api/timeline', timelineApi);

var port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log("Reis app started on port:", port);
});

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// start server on the specified port and binding host
// app.listen(appEnv.port, appEnv.bind, function() {
//   console.log("server starting on " + appEnv.url);
// });