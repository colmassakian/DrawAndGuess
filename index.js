const express = require("express");
const app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var fs = require("fs");
const port = process.env.PORT || 3000;
var text = fs.readFileSync("nounlist.txt", "utf-8");
var textByLine = text.split("\n");

app.use(express.static("public"));
var roomInfo =[];

io.on('connection', function(socket){
    console.log('a user connected');

    // Send message to clients in msg.roomName
    socket.on('chat message', function(msg){
        io.to(msg.roomName).emit('chat message', msg.message);
    });

    // TODO: Display list of rooms
    socket.on('room', function(data){
        var room = data.roomName;
        socket.join(room);

        var currentWord;
        var playerID;
        var msg;
        var roomIndex = contains(roomInfo, room);
        var clients = io.sockets.adapter.rooms[room].sockets;

        if(roomIndex == -1) // New room
        {
            var random = Math.floor(Math.random() * textByLine.length);
            currentWord = textByLine[random];
            playerID = getID(clients, 0);
            // Store current game state for the room in an array
            roomInfo.push({roomName: room, currPlayer: 0, currWord: currentWord});
        }
        else // Room already exists
        {
            currentWord = roomInfo[roomIndex].currWord;
            playerID = getID(clients, roomInfo[roomIndex].currPlayer);
        }

        msg = {playerID: playerID, data: currentWord, roundOver: false};
        socket.to(room).emit('chat message', data.name + " joined the room!");
        if(socket.id != playerID)
            io.to(playerID).emit('request drawing', "requested");
        io.to(room).emit('word', msg);
    });
    // Emit drawing information to clients in room
    socket.on('drawing', (data) => socket.to(data.roomName).emit('drawing', data));

    socket.on('pass turn', (data) => socket.to(data.roomName).emit('chat message', data.name + " passed. New round!"));

    // Send saved drawing info to last player to join the room
    socket.on('send drawing', function(data){
        if(data.length == 0)
            return;

        var room = data[0].roomName;

        var numClients = io.sockets.adapter.rooms[room].length;
        var clients = io.sockets.adapter.rooms[room].sockets;

        lastClientID = getID(clients, numClients - 1);
        io.to(lastClientID).emit('drawing info', data);
    });
    // Emit the next word to the next player
    socket.on('round over', function(room){
        var numClients = io.sockets.adapter.rooms[room].length;
        var clients = io.sockets.adapter.rooms[room].sockets;
        var roomIndex = contains(roomInfo, room);

        // Get next player's index
        var current = roomInfo[roomIndex].currPlayer;
        current ++;
        if(current >= numClients)
            current = current % numClients;

        var random = Math.floor(Math.random() * textByLine.length);
        var id = getID(clients, current);
        var msg = {playerID: id, data: textByLine[random], roundOver: true};
        roomInfo[roomIndex].currPlayer = current;
        io.to(room).emit('word', msg);
    });
    // Emit the user's new word to other clients
    socket.on('new word', function(room){
        var clients = io.sockets.adapter.rooms[room].sockets;
        var roomIndex = contains(roomInfo, room);

        var random = Math.floor(Math.random() * textByLine.length);
        var id = getID(clients, roomInfo[roomIndex].currPlayer);
        var newWord = textByLine[random]
        roomInfo[roomIndex].currWord = newWord;
        var msg = {playerID: id, data: newWord, roundOver: false};
        io.to(room).emit('word', msg);
    });
    socket.on('disconnect', function(){
        console.log('user disconnected');
    });
});

http.listen(port, () => console.log('listening on port ' + port));

// Return index of element whose 'roomName' field matches the targetName
function contains(arr, targetName) {
    for(var i = 0; i < arr.length; i++) {
        if (arr[i].roomName == targetName)
            return i;
    }

    return -1;
}

// Return id from clients array at desired index
function getID(clients, index) {
    var i = 0;
    for (var clientId in clients ) {
        if(i == index)
            return clientId;

        i ++;
    }

    return -1;
}
