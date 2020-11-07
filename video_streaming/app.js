// streaming server + movius server post request

/*
  NPM Module dependencies.
*/
const express = require('express');
const router = express.Router();
const multer = require('multer');
var request = require("request");
const mongodb = require('mongodb');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const bodyParser = require('body-parser');
/*
  NodeJS Module dependencies.
*/
const { Readable } = require('stream');

/*
  Create Express server && Express Router configuration.
*/
const app = express();
app.use(bodyParser.json());
app.use('/videos', router);
/*
  Connect Mongo Driver to MongoDB.
*/
let db;

MongoClient.connect('mongodb://localhost:27017', (_err, client) => {
  db = client.db('test');
});

/* 
2.0 버전
MongoClient.connect('mongodb://localhost/test', (err, database) => {
  if (err) {
    console.log('MongoDB Connection Error. Please make sure that MongoDB is running.');
    process.exit(1);
  }
  db = database;
});
*/

/*
  GET /videos/:videoID
*/
router.get('/:videoID', (req, res) => {
  try {
    var videoID = new ObjectID(req.params.videoID);
    var get_para = req.query;
  } catch (err) {
    return res.status(400).json({ message: "Invalid videoID in URL parameter. Must be a single String of 12 bytes or a string of 24 hex characters" });
  }
  res.set('content-type', 'video/mp4');
  res.set('accept-ranges', 'bytes'); 

  console.log(get_para['user']);
  let userName = get_para['user'];
  let bucket = new mongodb.GridFSBucket(db, {
    bucketName: userName  // videos -> user
  });

  let downloadStream = bucket.openDownloadStream(videoID);

  downloadStream.on('data', (chunk) => {
    res.write(chunk);
  });

  downloadStream.on('error', () => {
    res.sendStatus(404);
  });

  downloadStream.on('end', () => {
    res.end();
  });
});


/*
  POST /videos
*/
router.post('/', (req, res) => {
  const storage = multer.memoryStorage()
  const upload = multer({ storage: storage});//, limits: { fields: 2, files: 1, parts: 3 }
  upload.single('video')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: "Upload Request Validation Failed" });
    } else if (!req.body.user) {
      return res.status(400).json({ message: "No video name in request body" });
    }
    let userName = req.body.user;
    console.log(userName);
    
    // Covert buffer to Readable Stream
    const readableTrackStream = new Readable();
    readableTrackStream.push(req.file.buffer);
    readableTrackStream.push(null);

    let bucket = new mongodb.GridFSBucket(db, {
      bucketName: userName + '_vid'  // change to req.body.user
    });

    let uploadStream = bucket.openUploadStream(userName + '_vid');
    let id = uploadStream.id;

    // sch_jis
    // for post mobius server
    // cur user idx = rick, morty, ironman, deadpool
    var vid_rsc = id + '?user=' + userName + '_vid'; 
    var options = {
      method: 'POST',
      url: 'http://203.253.128.161:7579/Mobius/IoTP3/' + userName + '_vid',
      headers:
      {
        'Postman-Token': 'ca169f84-44ea-4d33-a5ac-f4c5d8be1c01',
        'cache-control': 'no-cache',
        'Content-Type': 'application/vnd.onem2m-res+json; ty=4',
        'X-M2M-Origin': '{{aei}}',
        'X-M2M-RI': '12345',
        Accept: 'application/json'
      },
      body: '{\n    "m2m:cin": {\n        "con": "' + 'http://192.168.1.2:3005/videos/' + vid_rsc + '"\n    }\n}'
    };

    readableTrackStream.pipe(uploadStream);
    uploadStream.on('error', () => {
      return res.status(500).json({ message: "Error uploading file" });
    });

    uploadStream.on('finish', () => {
      console.log(id);
      
      // post to mobius
      request(options, function (error, _response, body) {
        if (error) throw new Error(error);
        console.log(body);
      });
      
      return res.status(201).json({ message: "File uploaded successfully, stored under Mongo ObjectID: " + id });
    });
  });
});

app.listen(3005, () => {
  console.log("App listening on port 3005!");
});