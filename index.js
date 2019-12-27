const express = require("express");
const app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

app.use(express.static("public"));

io.on('connection', function(socket){
    console.log('a user connected');
    socket.on('chat message', function(msg){
        io.in(msg.roomName).emit('chat message', msg.message);
    });
    socket.on('room', function(room) {
        socket.join(room);
    });
    socket.on('disconnect', function(){
        console.log('user disconnected');
    });
});

http.listen(3000, function(){
    console.log('listening on *:3000');
});