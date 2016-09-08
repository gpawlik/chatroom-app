var socketio = require('socket.io');
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};

exports.listen = function (server) {
    io = socketio.listen(server);
    io.set('log level', 1);
    
    io.sockets.on('connection', function (socket) {
        // Assigns new name and returns guest number
        guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
        
        // Place the user in the lobby on connect
        joinRoom(socket, 'Lobby');
        
        // User actions handlers
        handleMessageBroadcasting(socket, nickNames);
        handleNameChangeAttempts(socket, nickNames, namesUsed);
        handleRoomJoining(socket);
        
        // Provide user with a list with occupied rooms on request
        socket.on('rooms', function () {
            socket.emit('rooms', io.sockets.manager.rooms);            
        });
        
        // Cleanup logic
        handleClientDisconnection(socket, nickNames, namesUsed);
    });
};

// Assigns new name and returns guest number
function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
    var name = 'Guest' + guestNumber;
    nicknames[socket.id] = name;
    socket.emit('nameResult', {
        success: true,
        name: name
    });
    namesUsed.push(name);
    return guestNumber + 1;
}

// Logic related to joining the rooms
function joinRoom(socket, room) {
    socket.join(room);
    currentRoom[socket.id] = room;
    socket.emit('joinResult', {
        room: room
    });
    // Let other users in room know that user has joined 
    socket.broadcast.to(room).emit('message', {
        text: nickNames[socket.id] + ' has joined ' + room
    });
    
    // Determines what other users are there in the room
    var usersInRoom = io.sockets.clients(room);
    
    // If there are more users in the room summarize who they are
    if (usersInRoom.length > 1) {
        var usersInRoomSummary = 'Users currently in room ' + room + ':';
        for (var index in usersInRoom) {
            var userSocketId = usersInRoom[index].id;  
            if (userSocketId !== socket.id) {
                if (index > 0) {
                    usersInRoomSummary += ', ';    
                }                
                usersInRoomSummary += nickNames[userSocketId];                
            }              
        }
        usersInRoomSummary += '.';
        socket.emit('message', {
            text: usersInRoomSummary
        });
    }
}

// Logic to handle name-request attempts
function handleNameChangeAttempts(socket, nickNames, namesUsed) {
    socket.on('nameAttempt', function (name) {
        if (name.indexOf('Guest') === 0) {
            socket.emit('nameResult', {
                success: false,
                message: 'Name cannot begin with "Guest"'
            });
        } else {
            if (namesUsed.indexOf(name) === -1) {
                var previousName = nickNames[socket.id];
                var previousNameIndex = namesUsed.indexOf(previousName);
                namesUsed.push(name);
                delete namesUsed[previousNameIndex];
                socket.emit('nameResult', {
                    success: true,
                    name: name
                });
                socket.broadcast.to(currentRoom[socket.id]).emit('message', {
                    text: previousName + ' is now known as ' + name + '.'
                });
            } else {
                socket.emit('nameResult', {
                    success: false,
                    message: 'That name is already in use.'
                });
            }
        }
    });
};