var nickname;
var room;
var word;
var isCurrPlayer = false;
var  savedDrawing = [];
var brushSize;

$(function () {
    var socket = io();
    var canvas = document.getElementsByClassName('whiteboard')[0];
    var colors = document.getElementsByClassName('color');
    var sizes = document.getElementsByClassName('size');
    var context = canvas.getContext('2d');
    var slider = document.getElementById("slider");
    brushSize = slider.value;
    fitToContainer(canvas);

    var current = {
        color: 'black',
        size: slider.value
    };
    var drawing = false;
    slider.oninput = function() {
        current.size = this.value;
        $('#mouse').css('height', current.size + 'px');
        $('#mouse').css('width', current.size + 'px');
    }
    $('#mouse').hide();
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
        socket.emit('room', {name: nickname, roomName: room});
    });
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
    // Notify other connections that turn was passed
    $("#passButton").submit(function(e){
        e.preventDefault(); // prevents page reloading
        socket.emit('pass turn', {name: nickname, roomName: room});
        socket.emit('round over', room);
        return false;
    });

    // TODO: Highlight correct answer
    // Don't combine nickname when sending, combine when displaying so that msg == word will work
    // Show received message
    socket.on('chat message', function(msg){
        $('#messages').append($('<li>').text(msg));
        $('#messages').animate({ scrollTop: $('#messages').height() }, "slow");
        // Colors correct message green if user with name 't' wrote it, need to make generic
        if(msg.includes('joined the room!') || msg.includes(' passed. New round!'))
            $("li").last().css("text-align", "center");

        if(msg.includes(word))
        {
            $('#messages').append($('<li>').text("The word was " + word + ". New round!"));
            $("li").last().css("text-align", "center");
        }

    });
    // TODO: Hide colors and size selector
    // Either hide or show the word for the round and the option to change it
    socket.on('word', function(msg){
        word = msg.data;
        // Clear screen and reset saved data when round is over
        if(msg.roundOver) {
            savedDrawing = [];
            context.clearRect(0, 0, canvas.width, canvas.height);
        }

        if(socket.id == msg.playerID)
        {
            isCurrPlayer = true;
            $("#buttonWrapper").show();
            $("#word").text(word);
        }
        else
        {
            $("#buttonWrapper").hide();
            var hintText = getHint();
            $("#word").text(hintText);
            isCurrPlayer = false;
        }
    });

    // Emit room and drawing array
    socket.on('request drawing', function(){
        socket.emit('send drawing', savedDrawing);
    });

    // Draw the saved data to be up-to-date on the drawing for the round
    socket.on('drawing info', function(data) {
        for(var i = 0; i < data.length; i ++)
            onDrawingEvent(data[i]);
    });

    // TODO: Hide/ show dot when you enter/ leave
    // TODO: Hide dot when not your turn
    // Show dot instead of cursor
    $("#whiteboard").mouseenter(function(event){
        if(isCurrPlayer)
        {
            $('#mouse').show();
            $('#whiteboard').css('cursor', 'none');
        }
    });

    $("#whiteboard").mousemove(function(event){
        $('#mouse').css('top', (event.pageY - current.size / 2) + 'px');
        $('#mouse').css('left', (event.pageX - current.size / 2) + 'px');
    });

    $("#whiteboard").mouseleave(function(event){
        $('#mouse').hide();
        $('#whiteboard').css('cursor', 'default');
    });

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

    // for (var i = 0; i < sizes.length; i++){
    //     sizes[i].addEventListener('click', onSizeUpdate, false);
    // }

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
    function drawLine(x0, y0, x1, y1, color, size, emit){
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
        context.lineWidth = size;
        context.stroke();
        context.closePath();

        if (!emit) { return; }

        var drawingInfo = {
            roomName: room,
            x0: x0 / w,
            y0: y0 / h,
            x1: x1 / w,
            y1: y1 / h,
            color: color,
            size: size
        };

        // Save drawing so that it can be emitted to clients who join in the middle of a round
        if(isCurrPlayer)
            savedDrawing.push(drawingInfo);

        socket.emit('drawing', drawingInfo);
    }

    function onMouseDown(e){
        drawing = isCurrPlayer;
        current.x = e.clientX||e.touches[0].clientX;
        current.y = e.clientY||e.touches[0].clientY;
    }

    function onMouseUp(e){
        if (!drawing) { return; }
        drawing = false;
        drawLine(current.x, current.y, e.clientX||e.touches[0].clientX, e.clientY||e.touches[0].clientY, current.color, current.size, true);
    }

    function onMouseMove(e){
        if (!drawing) { return; }
        drawLine(current.x, current.y, e.clientX||e.touches[0].clientX, e.clientY||e.touches[0].clientY, current.color, current.size, true);
        current.x = e.clientX||e.touches[0].clientX;
        current.y = e.clientY||e.touches[0].clientY;
    }

    function onColorUpdate(e){
        current.color = e.target.className.split(' ')[1];
        $('#mouse').css('background', current.color);
    }

    // function onSizeUpdate(e){
    //     var sizeName = e.target.className.split(' ')[1];
    //
    //     if(sizeName == 'small')
    //         current.size = 3;
    //     else if(sizeName == 'medium')
    //         current.size = 6;
    //     else if(sizeName == 'large')
    //         current.size = 9;
    // }

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
        drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, data.size);
    }

    // make the canvas fill its parent
    function onResize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function getHint() {
        var hint = "";
        var split = word.split(" ");
        for(var i = 0; i < split.length; i ++)
        {
            hint += "_ ".repeat(split[i].length);
            if(i != split.length - 1)
                hint += '\u00A0 \u00A0';
        }

        return hint;
    }
});