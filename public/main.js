var nickname;
var room;
var word;
var isCurrPlayer = false;

$(function () {
    var socket = io();
    var canvas = document.getElementsByClassName('whiteboard')[0];
    var colors = document.getElementsByClassName('color');
    var context = canvas.getContext('2d');
    fitToContainer(canvas);

    var current = {
        color: 'black'
    };
    var drawing = false;
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
        $('#mainPageContainer').show();
        $('#roomModalContainer').fadeOut(750);
        $("#m").focus();
        room = $('#room').val();
        socket.emit('room', room);
    });

    // TODO: Hide/ use header for players whose turn it isn't
    canvas.addEventListener('mousedown', onMouseDown, false);
    canvas.addEventListener('mouseup', onMouseUp, false);
    canvas.addEventListener('mouseout', onMouseUp, false);
    canvas.addEventListener('mousemove', throttle(onMouseMove, 10), false);

    //Touch support for mobile devices
    canvas.addEventListener('touchstart', onMouseDown, false);
    canvas.addEventListener('touchend', onMouseUp, false);
    canvas.addEventListener('touchcancel', onMouseUp, false);
    canvas.addEventListener('touchmove', throttle(onMouseMove, 10), false);

    for (var i = 0; i < colors.length; i++){
        colors[i].addEventListener('click', onColorUpdate, false);
    }

    socket.on('drawing', onDrawingEvent);

    window.addEventListener('resize', onResize, false);
    onResize();

    function fitToContainer(canvas){
        canvas.style.width='100%';
        canvas.style.height='100%';
        canvas.width  = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }

    // TODO: Adjust drawing for clients too?
    function drawLine(x0, y0, x1, y1, color, emit){
        var w = canvas.width;
        var h = canvas.height;
        var rect = canvas.getBoundingClientRect();
        var offsetX = rect.left;
        var offsetY = rect.top;
        var adjW = canvas.scrollWidth / w;
        var adjH = canvas.scrollHeight / h;

        context.beginPath();
        context.moveTo((x0 - offsetX) / adjW, (y0 - offsetY) / adjH);
        context.lineTo((x1 - offsetX) / adjW, (y1 - offsetY) / adjH);
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.stroke();
        context.closePath();

        if (!emit) { return; }


        socket.emit('drawing', {
            roomName: room,
            x0: x0 / w,
            y0: y0 / h,
            x1: x1 / w,
            y1: y1 / h,
            color: color
        });
    }

    function onMouseDown(e){
        if(!isCurrPlayer)
            drawing = false;
        else
            drawing = true;
        current.x = e.clientX||e.touches[0].clientX;
        current.y = e.clientY||e.touches[0].clientY;
    }

    function onMouseUp(e){
        if (!drawing) { return; }
        drawing = false;
        drawLine(current.x, current.y, e.clientX||e.touches[0].clientX, e.clientY||e.touches[0].clientY, current.color, true);
    }

    function onMouseMove(e){
        if (!drawing) { return; }
        drawLine(current.x, current.y, e.clientX||e.touches[0].clientX, e.clientY||e.touches[0].clientY, current.color, true);
        current.x = e.clientX||e.touches[0].clientX;
        current.y = e.clientY||e.touches[0].clientY;
    }

    function onColorUpdate(e){
        current.color = e.target.className.split(' ')[1];
    }

    // limit the number of events per second
    function throttle(callback, delay) {
        var previousCall = new Date().getTime();
        return function() {
            var time = new Date().getTime();

            if ((time - previousCall) >= delay) {
                previousCall = time;
                callback.apply(null, arguments);
            }
        };
    }

    function onDrawingEvent(data){
        var w = canvas.width;
        var h = canvas.height;
        drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color);
    }

    // make the canvas fill its parent
    function onResize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    // Send message to other connections
    $("#chatMessage").submit(function(e){
        e.preventDefault(); // prevents page reloading
        var text = $('#m').val();
        // Package client's room and nickname with message
        var msg = {roomName:room, message:nickname + ": " + text};
        // Don't let current player write the word in chat
        if(text == word && isCurrPlayer)
            msg.message = nickname + ": " + "*".repeat(word.length);

        socket.emit('chat message', msg);
        $('#m').val(''); // Clear the chat input field

        // TODO: Keep score
        // TODO: Highlight correct answer
        // Check if a client whose turn it isn't got the correct word
        if(text == word && !isCurrPlayer)
            socket.emit('round over', room);

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
    // Either hide or show the word for the round and the option to change it
    socket.on('word', function(msg){
        word = msg.data;
        context.clearRect(0, 0, canvas.width, canvas.height);
        if(socket.id == msg.playerID)
        {
            isCurrPlayer = true;
            $("#wordButton").show();
            $("#word").text(word);
        }
        else
        {
            $("#wordButton").hide();
            $("#word").text("_ ".repeat(word.length));
            isCurrPlayer = false;
        }
    });
});