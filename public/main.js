var nickname;
var word;
var isCurrPlayer = false;
var  savedDrawing = [];
var brushSize;

$(function () {
    var socket = io();
    var canvas = document.getElementsByClassName('whiteboard')[0];
    var colors = document.getElementsByClassName('color');
    var context = canvas.getContext('2d');
    var slider = document.getElementById("slider");
    var colorpicker = document.getElementById("colorpicker");
    brushSize = slider.value;
    fitToContainer(canvas);

    var current = {
        startX: 0,
        startY: 0,
        color: 'black',
        size: slider.value
    };

    var shapeEnum = {
        line: 0,
        rect: 1,
        circle: 2,
        triangle: 3
    };

    var drawing = false;
    var drawingShape = 0;

    slider.oninput = function() {
        current.size = this.value;
        $('#mouse').css('height', current.size + 'px');
        $('#mouse').css('width', current.size + 'px');
    }

    colorpicker.oninput = function() {
        current.color = this.value;
        $('#mouse').css('background', current.color);
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
        socket.emit('client name', nickname);
    });
    // Read room, hide room modal, show main chat page
    $("#roomSelector").submit(function(e){
        e.preventDefault(); // prevents page reloading
        $('#mainPageContainer').show();
        $('#roomModalContainer').fadeOut(750);
        $("#m").focus();
        const room = $('#room').val();
        socket.emit('room', room);
    });
    // Send message to other connections
    $("#chatMessage").submit(function(e){
        e.preventDefault(); // prevents page reloading
        var text = $('#m').val();

        // Don't let current player write the word in chat
        if(text == word && isCurrPlayer)
            msg.message = "*".repeat(word.length);

        socket.emit('chat message', text);
        $('#m').val(''); // Clear the chat input field

        // Check if a client whose turn it isn't got the correct word
        if(text.toLowerCase() == word.toLowerCase() && !isCurrPlayer)
            socket.emit('round over', true);

        return false;
    });

    // Notify other connections that word was changed
    $("#wordButton").submit(function(e){
        e.preventDefault(); // prevents page reloading
        socket.emit('new word');
        return false;
    });

    // Notify other connections that turn was passed
    $("#passButton").submit(function(e){
        e.preventDefault(); // prevents page reloading
        socket.emit('pass turn');
        socket.emit('round over', false);
        return false;
    });

    // TODO: LOW Highlight correct answer
    // Show received message
    socket.on('chat message', function(msg){
        $('#messages').append($('<li>').text(msg));
        $('#messages').animate({ scrollTop: $('#messages').height() }, "slow");
    });

    // Show general messages in the center of the chat column
    socket.on('system message', function(msg){
        $('#messages').append($('<li>').text(msg));
        $('#messages').animate({ scrollTop: $('#messages').height() }, "slow");
        $("li").last().css("text-align", "center");
    });
    // TODO: MED Hide colors and size selector
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
        for(let i = 0; i < data.length; i ++)
            onDrawingEvent(data[i]);
    });

    socket.on('scores', function(data) {
        var nHTML = '';

        data.forEach(function(scoreObj) {
            nHTML += '<p>' + scoreObj.name + ': ' + scoreObj.score + '</p>';
        });

        document.getElementById("scores").innerHTML = nHTML;
    });

    // Show dot instead of cursor
    $("#whiteboard").mouseenter(function(){
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

    $("#whiteboard").mouseleave(function(){
        $('#mouse').hide();
        $('#whiteboard').css('cursor', 'default');
    });

    $( "#rect" ).click(function() {
        if(drawingShape == 0)
            drawingShape = shapeEnum.rect;
        else
            drawingShape = 0;
    });

    $( "#circle" ).click(function() {
        if(drawingShape == 0)
            drawingShape = shapeEnum.circle;
        else
            drawingShape = 0;
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
    // TODO: Show shape during drawing
    // TODO: Draw shape from any corner
    // TODO: Add other shapes
    function drawLine(x0, y0, x1, y1, color, size, shape, emit){
        const w = canvas.width;
        const h = canvas.height;
        const rect = canvas.getBoundingClientRect();
        const offsetX = rect.left;
        const offsetY = rect.top;
        const adjW = canvas.scrollWidth / w;
        const adjH = canvas.scrollHeight / h;
        let sX = (x0 - offsetX) / adjW;
        let sY = (y0 - offsetY) / adjH;
        let eX = (x1 - offsetX) / adjW;
        let eY = (y1 - offsetY) / adjH;

        context.beginPath();
        if(shape == shapeEnum.line)
        {
            context.moveTo(sX, sY);
            context.lineTo(eX, eY);
        }
        else if(shape == shapeEnum.rect)
            context.rect(sX, sY, eX - sX, eY - sY);
        else if(shape == shapeEnum.circle)
        {
            let a = eX - sX;
            let b = eY - sY;
            let delta = Math.sqrt( a*a + b*b );
            context.arc(sX, sY, delta, 0, 2 * Math.PI);
        }

        context.strokeStyle = color;
        context.lineWidth = size;
        context.stroke();
        context.closePath();

        if (!emit) { return; }

        var drawingInfo = {
            x0: x0 / w,
            y0: y0 / h,
            x1: x1 / w,
            y1: y1 / h,
            color: color,
            size: size,
            shape: shape
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
        current.startX = current.x;
        current.startY = current.y;
        console.log(drawingShape);
        if(drawingShape == shapeEnum.rect)
        {
            $('#tempRect').css('top', (current.y - current.size / 2) + 'px');
            $('#tempRect').css('left', (current.x - current.size / 2) + 'px');
        }
    }

    function onMouseUp(e){
        if (!drawing) { return; }
        drawing = false;
        if(drawingShape == shapeEnum.rect)
        {
            current.x = current.startX;
            current.y = current.startY;
            $('#tempRect').css('height', '0px');
            $('#tempRect').css('width', '0px');
            $('#tempRect').css('border-width', '0px');
        }
        drawLine(current.x, current.y, e.clientX||e.touches[0].clientX, e.clientY||e.touches[0].clientY, current.color, current.size, drawingShape, true);
    }

    function onMouseMove(e){
        if (!drawing) { return; }

        if(drawingShape == shapeEnum.rect)
        {
            var pos = $('#tempRect').position();
            var height = Math.abs(current.y - pos.top);
            $('#tempRect').css('height', height + 'px');
            var width = Math.abs(current.x - pos.left);
            $('#tempRect').css('width', width + 'px');

            $('#tempRect').css('border-width', current.size + 'px');
            $('#tempRect').css('border-color', current.color);

            if (current.y < current.startY) {
                $('#tempRect').css('top', (current.y - current.size / 2) + 'px');
                height = Math.abs(current.y - current.startY);
                $('#tempRect').css('height', height + 'px');
            }
            if (current.x < current.startX) {
                $('#tempRect').css('left', (current.x - current.size / 2) + 'px');
                width = Math.abs(current.x - current.startX);
                $('#tempRect').css('width', width + 'px');
            }
        }
        else
            drawLine(current.x, current.y, e.clientX||e.touches[0].clientX, e.clientY||e.touches[0].clientY, current.color, current.size, shapeEnum.line,  true);

        current.x = e.clientX||e.touches[0].clientX;
        current.y = e.clientY||e.touches[0].clientY;
    }

    function onColorUpdate(e){
        current.color = e.target.className.split(' ')[1];
        colorpicker.value = current.color;
        $('#mouse').css('background', current.color);
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
        drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, data.size, data.shape);
    }

    // make the canvas fill its parent
    function onResize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function getHint() {
        let hint = "";
        let split = word.split(" ");

        for(let i = 0; i < split.length; i ++)
        {
            hint += "_ ".repeat(split[i].length);
            if(i != split.length - 1)
                hint += '\u00A0 \u00A0';
        }

        return hint;
    }
});