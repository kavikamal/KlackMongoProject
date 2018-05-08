const express = require('express')
const querystring = require('querystring');
const mongoose = require('mongoose');
var emoji = require('node-emoji');
const multer = require('multer');
const fs = require('fs');

const upload = multer({
    dest: "./public/uploads"
})

// object of names and their respective pic filenames
let profilePics = {
    "test": "test"
};

const app = express()
app.use(express.static("./public"))
app.use(express.static("./public/uploads"))
app.use(express.json())

const dbName = 'klack';
const DB_USER = 'admin';
const DB_PASSWORD = 'admin';
const DB_URI = 'ds113870.mlab.com:13870';
const PORT = process.env.PORT || 3000;


let lastMsgTimestamp = 0;
// Track last active times for each sender
let users = {}

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error: '));
// Define a schema
var Schema = mongoose.Schema;
var messageSchema = new Schema({
    sender: String,
    message: String,
    timestamp: Number,
});
// Compile a Message model from the schema
var Message = mongoose.model('Message', messageSchema);

function userSortFn(a, b) {
    var nameA = a.name.toUpperCase(); // ignore upper and lowercase
    var nameB = b.name.toUpperCase(); // ignore upper and lowercase
    if (nameA < nameB) {
        return -1;
    }
    if (nameA > nameB) {
        return 1;
    }
    // names must be equal
    return 0;
}

app.get("/messages", (request, response) => {
    let messages = []
    const now = Date.now();
    const requireActiveSince = now - (15 * 1000) // consider inactive after 15 seconds 
    users[request.query.for] = now;
    // Get message from database
    Message.find().sort({
        timestamp: 'asc'
    }).exec(function (err, msgs) {
        msgs.forEach(msg => {
            messages.push(msg);
            if (!users[msg.sender]) {
                users[msg.sender] = msg.timestamp
            } else if (users[msg.sender] < msg.timestamp) {
                users[msg.sender] = msg.timestamp
            }
        });

        let usersSimple = Object.keys(users).map((x) => {
            return ({
                name: x,
                active: (users[x] > requireActiveSince)
            })
        })

        usersSimple.sort(userSortFn);
        usersSimple.filter((a) => (a.name !== request.query.for))
        lastMsgTimestamp = messages[messages.length - 1];
        response.send({
            messages: messages.slice(-40),
            users: usersSimple,
            pics: profilePics
        })
    });
})

app.post("/messages", (request, response) => {
    // add a timestamp to each incoming message.
    request.body.timestamp = Date.now()
    users[request.body.sender] = request.body.timestamp;

    //Create an instance of Message model

    var message = new Message({
        sender: request.body.sender,
        message: request.body.message,
        timestamp: request.body.timestamp
    });
    // Save to database
    message.save()
        .then(data => {
            console.log('msg saved to the database:', data);
        })
        .catch(err => {
            console.log('Unable to save to database');
        });

    // create a new list of users with a flag indicating whether they have been active recently
    response.status(201)
    response.send({
        messages: request.body,
        pics: profilePics
    })
})

// handles pic uploading
app.post('/upload', upload.single('fileToUpload'), function (req, res) {
    profilePics[req.body.user_id] = req.file.filename;
    // console.log(req.body.user_id);
    // console.log(req.file.filename);
    // console.log(JSON.stringify(profilePics));
    res.redirect('/');
})

app.listen(PORT, () => {
    mongoose.connect(`mongodb://${DB_USER}:${DB_PASSWORD}@${DB_URI}/${dbName}`);
})