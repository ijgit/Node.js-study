/*
mongo db example
*/

// road express modules
var express = require('express'), 
  http = require('http'), 
  path = require('path');

// road express middleware
var bodyParser = require('body-parser'),
  cookieParser = require('cookie-parser'),
  static = require('serve-static'),
  errorHandler = require('errorhandler');

var expressErrorHandler = require('express-error-handler');

var expressSession = require('express-session')

var MongoClient = require("mongodb").MongoClient;


// express object
var app = express(); // create express object  

app.set('port', process.env.PORT || 3000); // set port attribute to app object

app.use(bodyParser.urlencoded({ extended: false })); // parsing application/x-www-form-urlencoded
app.use(bodyParser.json()); // parsing application/json

app.use(static(path.join(__dirname, 'public')));  // open public dir as static

app.use(cookieParser());  // set cookie-parser

app.use(  // set session 
  expressSession({ secret: 'my key', resave: true, saveUninitialized: true })
);


//--------------database
var db;

function connectDB() {
  var databaseUrl = 'mongodb://localhost:27017/local';
  MongoClient.connect(databaseUrl, {useUnifiedTopology:true}, function(err, database) {
    // if (err) throw err;
    if (err) {
      console.log(`db connect err`);
      throw err;
    }

    // db = database; // (version < 3.0)
    console.log(`db connected: ${databaseUrl}`);
    db = database.db("local");  // db connection
  });
}


//-----------routing

var router = express.Router();

router.route('/process/login').post(function(req, res) {
  console.log('call /process/login');

  // request params
  var paramId = req.body.id || req.query.id;
  var paramPassword = req.body.password || req.query.password;

  console.log(`req params: ${paramId}, ${paramPassword}`);

  if (db) {
    authUser(db, paramId, paramPassword, function (err, docs) {
      if (err) {
        console.log('authUser: error!');
        res.writeHead(200, { 'Content-Type': 'text/html;charset=utf8' });
        res.write('<h1>authUser: error</h1>');
        res.end();
        
        throw err;
      }

      if (docs) {
        console.dir(docs);

        res.writeHead('200', { 'Content-Type': 'text/html; charset=utf8' });
        res.write('<h1>login: success</h1>');
        res.write('<h2>user list</h2>');
        for(var i =0; i<docs.length; i++)
          res.write(`<div><p>${i}: ${"\t"} id[${docs[i].id}]/ pwd[${docs[i].password}]/ name[${docs[i].name}] </p></div>`)
        res.write('<br><br>');
        
        res.write('<h2>your info</h1>');
        res.write(`<div><p>user id:   ${paramId} </p></div>`)
        res.write(`<div><p>user pwd:  ${paramPassword} </p></div>`)
        res.write(`<div><p>user pwd:  ${docs[0].name} </p></div>`)
        res.write(`<br><br><a href='/login.html'>-> login</a>`);
        res.end();
      } else {
        res.writeHead('200', { 'Content-Type': 'text/html; charset=utf8' });
        res.write('<h1>login: fail</h1>');
        res.write(`<div><p>check id, pwd</p></div>`)
        res.write(`<br><br><a href='/login.html'>-> login</a>`);
        res.end();
      }
    });
  } else {
    console.log('db not init');
    res.writeHead('200', { 'Content-Type': 'text/html; charset=utf8' });
    res.write('<h2>DB connection: fail</h1>');
    res.end();
  }
});

// add user function
router.route('/process/adduser').post(function (req, res) {
  console.log('call /process/adduser.');

  var paramId = req.body.id || req.query.id;
  var paramPassword = req.body.password || req.query.password;
  var paramName = req.body.name || req.query.name;

  console.log(`req params: ${paramId}, ${paramPassword}, ${paramName}`);

  if (db) {
    addUser(db, paramId, paramPassword, paramName, function (err, result) {
      if (err) { throw err; }

      if (result && result.insertedCount > 0) {
        console.dir(result);

        res.writeHead('200', { 'Content-Type': 'text/html;charset=utf8' });
        res.write('<h2>add user: success</h2>');
        res.write(`<br><br><a href='/login.html'>-> login</a>`);
        res.write(`<br><br><a href='/adduser.html'>-> add user</a>`);

        res.end();
      } else {
        res.writeHead('200', { 'Content-Type': 'text/html;charset=utf8' });
        res.write('<h2>add user: fail</h2>');
        res.end();
      }
    });
  } else {
    res.writeHead('200', { 'Content-Type': 'text/html;charset=utf8' });
    res.write('<h2>DB connection: fail</h2>');
    res.end();
  }
});


// register router object
app.use('/', router);



// user authorization function
var authUser = function (db, id, password, callback) {
  console.log(`call authUser: ${id}, ${password}`);

  var users = db.collection('users');
  console.log('authUser: next step');

  users.find({"id":id, "password":password}).toArray(function(err, docs) {
    if (err) {
      callback(err, null);
      return;
    }

    if (docs.length > 0) {
      console.log(`id [${id}] \tpwd[${password}] : find user`);
      callback(null, docs);
    } else {
      console.log('authUser: can not find user');
      callback(null, null);
    }
  });
}


// add user function
var addUser = function (database, id, password, name, callback) {
  console.log('call addUser : ' + id + ', ' + password + ', ' + name);

  var users = database.collection('users');

  users.insertMany([{"id":id, "password":password, "name":name}], function(err, result) {
    if (err) {
      console.log('adduser: error');
      callback(err, null);
      return;
    }
    if (result.insertedCount > 0) {
      console.log(`add user: ${result.insertedCount}`);
    } else {
      console.log(`add user: x`);
    }
    callback(null, result);
  });
}



//----------error
var errorHandler = expressErrorHandler({
  static: {
    '404': './public/404.html'
  }
});

app.use(expressErrorHandler.httpError(404));
app.use(errorHandler);




//---------------server start

// process finish -> db connection quit
process.on('SIGTERM', function () {
  console.log("process: quit");
  app.close();
});

app.on('close', function () {
  console.log("Express server object: quit");
  if (db) {
    db.close();
  }
});


// start express server
http.createServer(app).listen(app.get('port'), function(){
  console.log(`express server started at http://localhost:${app.get('port')}/${"index.html"}`);
  connectDB();
});
