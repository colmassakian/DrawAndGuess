var nickname;
var room;
var word;

$(function () {
    var socket = io();
    $('#nickname').focus();
    // Read nickname, hide name modal, show room modal
    $("#nameSelector").submit(function(e){
        e.preventDefault(); // prevents page reloading
        $('#roomModalContainer').show();
        $('#nameModalContainer').fadeOut(750);
        $("#room").focus();
        nickname = $('#nickname').val();
    });
    // Read room, hide room modal, show main chat page
    $("#roomSelector").submit(function(e){
        e.preventDefault(); // prevents page reloading
        $('#messageContainer').show();
        $('#roomModalContainer').fadeOut(750);
        $("#m").focus();
        room = $('#room').val();
        socket.emit('room', room);
    });
    // Send message to other connections
    $("#chatMessage").submit(function(e){
        e.preventDefault(); // prevents page reloading
        var text = $('#m').val();
        var msg = {roomName:room, message:nickname + ": " + text};
        socket.emit('chat message', msg);
        $('#m').val('');
        console.log(text);
        if(text == word)
        {
            socket.emit('round over', true);
            // $("#word").text('');
        }
        return false;
    });
    // Notify other connections that word was changed
    $("#wordButton").submit(function(e){
        e.preventDefault(); // prevents page reloading
        socket.emit('new word', room);
        return false;
    });
    // Show received message
    socket.on('chat message', function(msg){
        $('#messages').append($('<li>').text(msg));
    });
    socket.on('word', function(msg){
        word = msg.data;
        if(socket.id == msg.playerID)
        {
            $("#word-wrapper").show();
            $("#word").text(word);
            // console.log("Matches");
        }
        else
            $("#word-wrapper").hide();
    });
});