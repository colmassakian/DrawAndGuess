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
        io.to(getVal(socket.rooms, 1)).emit('chat message', socket.nickname + ": " + msg);
    });

    // Save client's nickname
    socket.on('client name', function(name){
        socket.nickname = name;
    });

    // TODO: Display list of rooms
    socket.on('room', function(room){
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
            playerID = getVal(clients, 0);
            var score = [{id: socket.id, score: 0}];
            // Store current game state for the room in an array
            roomInfo.push({roomName: room, currPlayer: 0, currWord: currentWord, scores: score});
        }
        else // Room already exists
        {
            currentWord = roomInfo[roomIndex].currWord;
            roomInfo[roomIndex].scores.push({id: socket.id, score: 0});
            playerID = getVal(clients, roomInfo[roomIndex].currPlayer);
        }

        msg = {playerID: playerID, data: currentWord, roundOver: false};
        socket.to(room).emit('chat message', socket.nickname + " joined the room!");
        if(socket.id != playerID)
            io.to(playerID).emit('request drawing');
        io.to(room).emit('word', msg);
    });
    // Emit drawing information to clients in room
    socket.on('drawing', (data) => socket.to(getVal(socket.rooms, 1)).emit('drawing', data));

    socket.on('pass turn', () => socket.to(getVal(socket.rooms, 1)).emit('chat message', socket.nickname + " passed. New round!"));

    // Send saved drawing info to last player to join the room
    socket.on('send drawing', function(data){
        if(data.length == 0)
            return;

        var room = getVal(socket.rooms, 1);

        var numClients = io.sockets.adapter.rooms[room].length;
        var clients = io.sockets.adapter.rooms[room].sockets;

        var lastClientID = getVal(clients, numClients - 1);
        io.to(lastClientID).emit('drawing info', data);
    });
    // Emit the next word to the next player
    socket.on('round over', function(){
        var room = getVal(socket.rooms, 1);
        var numClients = io.sockets.adapter.rooms[room].length;
        var clients = io.sockets.adapter.rooms[room].sockets;
        var roomIndex = contains(roomInfo, room);

        var currIndex = findIndex(clients, socket.id);
        // Increment score of players who sent round over message
        roomInfo[roomIndex].scores[currIndex].score ++;
        console.log(roomInfo[roomIndex].scores);
        // Get next player's index
        var current = roomInfo[roomIndex].currPlayer;
        current ++;
        if(current >= numClients)
            current = current % numClients;

        var random = Math.floor(Math.random() * textByLine.length);
        var id = getVal(clients, current);
        var newWord = textByLine[random];
        roomInfo[roomIndex].currWord = newWord;
        var msg = {playerID: id, data: newWord, roundOver: true};
        roomInfo[roomIndex].currPlayer = current;
        io.to(room).emit('word', msg);
    });
    // Emit the user's new word to other clients
    socket.on('new word', function(){
        var room = getVal(socket.rooms, 1);
        var clients = io.sockets.adapter.rooms[room].sockets;
        var roomIndex = contains(roomInfo, room);

        var random = Math.floor(Math.random() * textByLine.length);
        var id = getVal(clients, roomInfo[roomIndex].currPlayer);
        var newWord = textByLine[random]
        roomInfo[roomIndex].currWord = newWord;
        var msg = {playerID: id, data: newWord, roundOver: false};
        io.to(room).emit('word', msg);
    });

    socket.on('disconnect', function(){
        removeScore(socket.id);

        // roomInfo[roomIndex].scores.splice(index, 1);
        console.log('user ' + socket.id + ' disconnected');
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
function getVal(clients, index) {
    var i = 0;
    for (var clientId in clients ) {
        if(i == index)
            return clientId;

        i ++;
    }

    return -1;
}

// Return index in array with id that matches
function findIndex(clients, id) {
    var index = 0;
    for (var clientId in clients) {
        if(clientId == id)
            return index;

        index ++;
    }

    return -1;
}

// Remove element in score array that matches disconnected id
function removeScore(id) {
    var currRoom;
    // Have to search all rooms since id leaves the room before disconnect is emitted
    for(let i = 0; i < roomInfo.length; i ++)
    {
        currRoom = roomInfo[i];
        for (let j = 0; j < currRoom.scores.length; j ++) {
            if(currRoom.scores[j].id == id)
                currRoom.scores.splice(j, 1);
        }
    }
}