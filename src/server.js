var io = require('socket.io')({ serveClient: false });

var forEach = require("core/src/core/util/for-each");

var Lobby = require("./lobby.js");

var lobbies = [];
var socketData = {};

var sendFunctions = {
    lobbyEnter:     (socketId,data) =>  io.to(socketId).emit("lobby_enter", data),
    lobbyUpdate:    (lobbyId,data)  =>  io.to(lobbyId).emit("lobby_update", data),
    gameCountdown:  (lobbyId,data)  =>  io.to(lobbyId).emit("game_countdown", data),
    gameStart:      (lobbyId,data)  =>  io.to(lobbyId).emit("game_start", data),
    gameUpdate:     (lobbyId,data)  =>  io.to(lobbyId).emit("game_update", data),
    gameOver:       (lobbyId)       =>  io.to(lobbyId).emit("game_over"),
    matchStart:     (lobbyId,data)  =>  io.to(lobbyId).emit("match_start", data),
    matchOver:      (lobbyId)       =>  io.to(lobbyId).emit("match_over")
};

var receiveFunctions = {
    "ready": playerReady,
    "player_steering": playerSteering,
    "disconnect": playerDisconnect,
    "enter": playerEnter,
    "leave": playerLeave,
    "color_change": playerColorChange
};

function assignPlayerToLobby(socketId) {
    var lobby = getVacantLobby();
    if (!lobby) {
        lobby = createLobby();
    }
    lobby.addPlayer(socketId, socketData[socketId].name);
    socketData[socketId].lobbyId = lobby.id;
    io.sockets.connected[socketId].join(lobby.id);
}

function createLobby() {
    var lobby = Lobby(sendFunctions);
    lobbies.push(lobby);
    return lobby;
}

function getPlayerLobby(socketId) {
    return lobbies.find(lobby => lobby.id === socketData[socketId].lobbyId);
}

function getVacantLobby() {
    return lobbies.find(lobby => !lobby.hasMatchStarted() && !lobby.isFull());
}

function playerColorChange(socketId, newColorId) {
    var lobby = getPlayerLobby(socketId);
    lobby.colorChange(socketId, newColorId);
}

function playerDisconnect(socketId) {
    playerLeave(socketId);
}

function playerEnter(socketId, data) {
    if (data && typeof data.name === "string") {
        socketData[socketId].name = data.name;
        assignPlayerToLobby(socketId);
    } else {
        // Send message to client about bad name
    }
}

function playerLeave(socketId) {
    var lobby = getPlayerLobby(socketId);
    if (lobby) {
        var socket = io.sockets.connected[socketId];
        if (socket) {
            socket.leave(lobby.id);
        }
        lobby.playerLeave(socketId);
        socketData[socketId].lobbyId = undefined;
    }
}

function playerReady(socketId) {
    var lobby = getPlayerLobby(socketId);
    if (lobby) {
        lobby.playerReady(socketId);
    }
}

function playerSteering(socketId, steering) {
    var lobby = getPlayerLobby(socketId);
    if (lobby) {
        lobby.setPlayerSteering(socketId, steering);
    }
}

io.on('connection', function(socket){
    socketData[socket.id] = {
        lobbyId: undefined
    };
    forEach(receiveFunctions, (f,name) => socket.on(name, f.bind(this, socket.id)));
});
io.listen(3000);
console.log("Server started");