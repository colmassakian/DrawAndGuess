const express = require("express");
const app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var fs = require("fs");
var text = fs.readFileSync("nounlist.txt", "utf-8");
var textByLine = text.split("\n");

app.use(express.static("public"));
var clients =[];
var currPlayer = 0;

io.on('connection', function(socket){
    console.log('a user connected');
    clients.push(socket.id);

    // Send message to clients in msg.roomName
    socket.on('chat message', function(msg){
        // Use for rooms
        // io.to(msg.roomName).emit('chat message', msg.message);
        io.emit('chat message', msg.message);
    });
    // TODO: Don't assign a new word everytime someones joins a room, just boadcast the current word
    socket.on('room', function(room){
        socket.join(room);
        var random = Math.floor(Math.random() * textByLine.length);
        var msg = {playerID:clients[currPlayer], data:textByLine[random]};
        console.log("Curr Player: " + msg.playerID);
        io.emit('word', msg);
    });
    // Emit drawing information to clients
    socket.on('drawing', (data) => socket.broadcast.emit('drawing', data));

    // Emit the next word to the next player
    socket.on('round over', function(bool){
        console.log("New Round");
        currPlayer ++;
        if(currPlayer >= clients.length)
            currPlayer = currPlayer % clients.length;
        var random = Math.floor(Math.random() * textByLine.length);
        var msg = {playerID:clients[currPlayer], data:textByLine[random]};
        io.emit('word', msg);
    });
    // Emit the user's new word to other clients
    socket.on('new word', function(room){
        var random = Math.floor(Math.random() * textByLine.length);
        var msg = {playerID:clients[currPlayer], data:textByLine[random]};
        io.emit('word', msg);
    });
    socket.on('disconnect', function(){
        console.log('user disconnected');
        for( var i=0; i < clients.length; ++ i ){

            if(clients[i] == socket.id){
                // TODO: Iterate through clients to assign new word
                clients.splice(i,1);
                console.log("removed user");
                break;
            }
        }
    });
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});