const express = require("express");
const app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

app.use(express.static("public"));
var clients =[];
var currPlayer = 0;
var word = "secret";
var word2 = "newsecret";
io.on('connection', function(socket){
    console.log('a user connected');
    clients.push(socket.id);
    // console.log(clients);
    // if(clients.length == 1)
    // {
    //     console.log("Sent");
    //     socket.broadcast.to(clients[0]).emit('word', 'word to play');
    // }
    // Send message to clients in msg.roomName
    socket.on('chat message', function(msg){
        // Use for rooms
        // io.to(msg.roomName).emit('chat message', msg.message);
        io.emit('chat message', msg.message);
    });
    socket.on('room', function(room){
        socket.join(room);
        var msg = {playerID:clients[currPlayer], data:word};
        console.log("Curr Player: " + msg.playerID);
        io.emit('word', msg);
        // io.of('/').in(room).clients((error, client) => {
        //     if (error) throw error;
        //     console.log(client);
        // });
    });
    socket.on('round over', function(bool){
        console.log("New Round");
        currPlayer ++;
        if(currPlayer >= clients.length)
            currPlayer = currPlayer % clients.length;
        var msg = {playerID:clients[currPlayer], data:word2};
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