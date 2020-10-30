'use strict';

const express     = require('express');
const session     = require('express-session');
const bodyParser  = require('body-parser');
const fccTesting  = require('./freeCodeCamp/fcctesting.js');
const auth        = require('./app/auth.js');
const routes      = require('./app/routes.js');
const mongo       = require('mongodb').MongoClient;
const passport    = require('passport');
const passportSocketIo = require("passport.socketio");
const cookieParser= require('cookie-parser');
const MongoStore = require("connect-mongo")(session);
const app         = express();
const cors = require('cors');
const http        = require('http').Server(app);
const sessionStore= new session.MemoryStore();
const io = require('socket.io')(http);

app.use(cors());

const URI = process.env.DATABASE;
const store = new MongoStore({ url: URI });

fccTesting(app); //For FCC testing purposes

function onAuthorizeSuccess(data, accept){
  console.log("Successful connection to socket.io");
}

function onAuthorizeFail(data, message, error, accept){
  if(error) throw new Error(message);
  console.log("failed connection to socket.io", message);
  accept(null, false);
}

app.use('/public', express.static(process.cwd() + '/public'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'pug')

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  key: 'express.sid',
  store: sessionStore,
}));

io.use(
  passportSocketIo.authorize({
    cookieParser: cookieParser,
    key: "express.sid",
    secret: process.env.SESSION_SECRET,
    store: store,
    success: onAuthorizeSuccess,
    fail: onAuthorizeFail
  })
);


mongo.connect(process.env.DATABASE, (err, dbo) => {
    const db = dbo.db("socketio");
    if(err) console.log('Database error: ' + err);
  
    auth(app, db);
    routes(app, db);
      
    http.listen(process.env.PORT || 3000);

    let currentUsers = 0;
    //start socket.io code  
    io.on("connection", socket => {
      ++currentUsers;
      io.emit("user", {
        name: socket.request.user.name,
        currentUsers,
        connected: true
      });
      console.log('A user has connected');

      socket.on("chat message", function(message){
        io.emit("chat message", {
          name: socket.request.user.name,
          message
        })
      });

      socket.on("disconnect", function(data){
        console.log("A user has disconnected");
        --currentUsers;
        io.emit("user", {
          name: socket.request.user.name,
          currentUsers,
          connected: false
        });
      });
    });
  

    //end socket.io code
  
  
});
