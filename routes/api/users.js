var express = require('express')
var router = express.Router()
var User = require('../../models/user')
var Trip = require('../../models/trip')

var apiController = require('../../controllers/apiController')
var mailer = require('express-mailer')
var app = require('../../app.js')
var randomstring = require('randomstring')
var jwt = require('jsonwebtoken')

var printError = apiController.printError
var ensureAuthenticatedApi = apiController.ensureAuthenticatedApi
var validateErrors = apiController.validateErrors
var removeDuplicates = apiController.removeDuplicates

function ensureUniqueUsername (req, res, next) {
  var username = req.newUser.username
  User.getUserbyUsername(username, function (err, findRes) {
    if (findRes != null) {
      res.status(400).json({
        msg: 'Duplicate username',
        errors: [
          {
            msg: 'Duplicate username!\nUse different username.'
          }
        ]
      })
    } else {
      next()
    }
  })
}

function ensureUniqueEmail (req, res, next) {
  var email = req.newUser.email
  User.findOne(
    {
      email: email
    },
    function (err, findRes) {
      if (findRes != null) {
        res.status(400).json({
          msg: 'Duplicate email',
          errors: [
            {
              msg: 'Duplicate Email!\nUse different email.'
            }
          ]
        })
      } else {
        next()
      }
    }
  )
}

function getUser (req, res, next) {
  var username = req.body.user.username
  User.getUserbyUsername(username, function (err, user) {
    if (!printError(err, req, res)) {
      if (user == null || !user) {
        res.status(404).json({
          msg: 'User not found',
          errors: [
            {
              msg: 'User not found. wrong username.'
            }
          ]
        })
      } else {
        req.user = user
        next()
      }
    }
  })
}

function validateUser (req, res, next) {
  var password = req.body.user.password
  User.validatePassword(password, req.user.password, function (err, result) {
    if (!printError(err, req, res)) {
      if (result == true) {
        req.user.password = ''
        next()
      } else {
        res.status(401).json({
          msg: 'Unauthentizated',
          errors: [
            {
              msg: 'Wrong password.'
            }
          ]
        })
      }
    }
  })
}

function validateLoginInputs (req, res, next) {
  req.checkBody('user.username', 'Username is empty!').notEmpty()
  req.checkBody('user.password', 'Password is empty!').notEmpty()
  next()
}

router.post(
  '/login',
//   validateLoginInputs,
//   validateErrors,
  getUser,
  validateUser,
  function (req, res) {
    var token = jwt.sign(
      {
        user: req.user
      },
      'ghostrider',
      {
        expiresIn: '1000h'
      }
    )
    return res.status(200).json({
      token: token,
      msg: 'Signed in successfully!'
    })
  }
)

router.post('/currentUser', ensureAuthenticatedApi, function (req, res) {
  res.json(req.decoded)
})

function validateRegisterErrors (req, res, next) {
  req.checkBody('user.email', 'Email is empty!').notEmpty()
  req.checkBody('user.password', 'Password is empty!').notEmpty()
  req.checkBody('user.username', 'Username is empty!').notEmpty()
  req
    .checkBody('user.confirmpassword', 'Passwords do not match!')
    .equals(req.body.user.password)
  next()
}

function appendNewUserObj (req, res, next) {
  req.body = req.body.user
  var username = req.body.username
  var password = req.body.password
  var email = req.body.email
  var name = req.body.name
  var birthdate = req.body.birthdate
  var rand = randomstring.generate()
  req.rand = rand
  var newUser = new User({
    name: name,
    email: email,
    username: username,
    password: password,
    usertype: 'normal',
    birthdate: birthdate,
    bio: 'No bio',
    phone: 'No phone',
    profilephoto:
      'http://s3-api.us-geo.objectstorage.softlayer.net/users-images/default-photo.jpeg',
    verificationCode: rand,
    stickers: []
  })
  req.newUser = newUser
  next()
}

function createNewUser (req, res, next) {
  var newUser = req.newUser
  var rand = req.rand
  User.createUser(newUser, function (err, user) {
    if (!printError(err, req, res)) {
      var link =
        'http://' + req.get('host') + '/users/verify/' + newUser.id + '/' + rand
      app.mailer.send(
        'email',
        {
          to: newUser.email,
          subject: "Community <DON'T REPLY> Email Verification",
          link: link,
          name: newUser.username
        },
        function (errEmail) {
          if (errEmail) {
            printError(errEmail, req, res)
          } else {
            req.newUser = user
            next()
          }
        }
      )
    }
  })
}

// info required: username, email, password, confirmpassowrd
router.post(
  '/register',
  validateRegisterErrors,
  validateErrors,
  appendNewUserObj,
  ensureUniqueUsername,
  ensureUniqueEmail,
  createNewUser,
  function (req, res) {
    res.status(200).json({
      msg: 'You signed up successfully! Please, check and verify your email.'
    })
  }
)

router.get('/getStatus', function (req, res) {
  if (req.isAuthenticated())
    res.json({
      status: true
    })
  else
    res.json({
      status: false
    })
})

function validateUserBody (req, res, next) {
  req.checkBody('user', 'No user data provided!').notEmpty()
  next()
}

// use the new token!
router.put(
  '/me',
  ensureAuthenticatedApi,
  validateUserBody,
  validateErrors,
  function (req, res) {
    User.findById(req.decoded.user._id, function (err, user) {
      User.findOneAndUpdate(
        {
          _id: req.decoded.user._id
        },
        {
          $set: req.body.user
        },
        {
          new: true
        },
        function (err, updatedUser) {
          if (!printError(err, req, res)) {
            if (!updatedUser) {
              res.status(400).json({
                msg: 'User was not updated'
              })
            } else {
              var token = jwt.sign(
                {
                  user: updatedUser
                },
                'ghostrider',
                {
                  expiresIn: '1000h'
                }
              )
              res.status(200).json({
                msg: 'Updated user',
                user: updatedUser,
                token: token
              })
            }
          }
        }
      )
    })
  }
)

function modifyUserStickers (req, res, next) {
  req.user.stickers = req.user.stickers.concat(req.body.add)
  req.user.stickers = req.user.stickers.filter(
    x => !req.body.remove.includes(x)
  )
  req.user.stickers = removeDuplicates(req.user.stickers)
  req.user.save(function (err, updatedUser) {
    req.user = updatedUser
    if (!printError(err, req, res)) {
      next()
    }
  })
}

function validateStickersArray (req, res, next) {
  req.checkBody('add', 'No stickers to add provided!').isArray()
  req.checkBody('remove', 'No stickers to remove provided!').isArray()
  next()
}

function fetchUser (req, res, next) {
  User.findById(req.decoded.user._id, function (err, user) {
    if (!printError(err, req, res)) {
      if (!user) {
        res.status(404).json({
          msg: 'User not found'
        })
      } else {
        req.user = user
        next()
      }
    }
  })
}

router.put(
  '/me/stickers',
  ensureAuthenticatedApi,
  fetchUser,
  validateStickersArray,
  validateErrors,
  modifyUserStickers,
  function (req, res) {
    res.status(200).json({
      user: req.user
    })
  }
)

function fetchUserProfile (req, res, next) {
  User.findOne(
    {
      username: req.params.username
    },
    {
      password: 0,
      verificationCode: 0
    }
  )
    .populate({
      path: 'stickers'
    })
    .exec(function (err, resuser) {
      if (!resuser) {
        res.status(404).json({
          msg: 'User not found',
          errors: [
            {
              msg: "User doesn't exist."
            }
          ]
        })
        return
      }
      var Bdate = resuser.birthdate
      var Bday = +new Date(Bdate)
      var Q4A = ~~((Date.now() - Bday) / 31557600000)
      var dude = resuser
      dude.age = Q4A
      if (resuser.public == true) {
        req.user = dude
        next()
      } else {
        res.status(403).json({
          msg: 'Unauthorized',
          errors: [
            {
              msg: 'Private profile.'
            }
          ]
        })
      }
    })
}

function fetchUserTrips (req, res, next) {
  Trip.find({ user: req.user._id })
    .populate({ path: 'posts', populate: { path: 'stickers' } })
    .exec(function (err, trips) {
      if (!printError(err, req, res)) {
        req.trips = trips
        next()
      }
    })
}

// authenticated?
router.get(
  '/profile/:username',
  ensureAuthenticatedApi,
  fetchUserProfile,
  fetchUserTrips,
  function (req, res) {
    res.status(200).json({
      user: req.user,
      trips: req.trips
    })
  }
)

router.get('/search/:username', ensureAuthenticatedApi, function (req, res) {
  User.find(
    {
      $or: [
        {
          username: {
            $regex: '.*' + req.params.username + '.*'
          }
        },
        {
          email: {
            $regex: '.*' + req.params.username + '.*'
          }
        }
      ]
    },
    function (err, results) {
      if (!printError(err, req, res)) {
        res.status(200).json(results)
      }
    }
  )
})

module.exports = router
