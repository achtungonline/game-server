import Match from "core/src/core/match.js";
import forEach from "core/src/core/util/for-each.js";
import * as compression from "core/src/core/util/compression.js";
import * as random from "core/src/core/util/random.js";
import * as gsf from "core/src/core/game-state-functions.js";
import net from "net"

var TIME_BETWEEN_GAMES = 5000; // milliseconds
var UPDATE_TICK = 15;
var CLIENT_UPDATE_TICK = 45;

var messageFunctions = {
    start_match: (message) => {
        startMatch(message.lobbyId, message.matchConfig);
    }
}

var matchData = {}
var socket = net.connect({ host: "Mathiass-MBP", port: 3002 });

socket.on("connect", () => {
    console.log("Connected to lobby server")
});

socket.on("error", (error) => {
    console.log(error)
});

socket.on("close", () => {
    console.log("Connection to lobby server closed")
    matchData = {};
});

var s = "";
socket.on("data", (data) => {
    s = s + data.toString();
    var lines = s.split(/\r?\n/);
    for (var i = 0; i < lines.length - 1; i++) {
        var message = JSON.parse(lines[i]);
        console.log("Receiving: ", message.type)
        if (messageFunctions[message.type]) {
            messageFunctions[message.type](message)
        } else {
            console.log("Unsupported message type: ", message.type)
        }
    }
    s = lines[lines.length - 1];
});

function startMatch(lobbyId, matchConfig) {
    matchConfig.map = gsf.createMapRectangle(matchConfig.map);
    var match = Match({matchConfig});
    matchData[lobbyId] = {
        match,
        game: null
    }
    startGame(lobbyId)
}

function startGame(lobbyId) {
    var seed = random.generateSeed();
    var activeMatch = matchData[lobbyId]
    if (activeMatch) {
        activeMatch.game = activeMatch.match.prepareNextGame(seed);
        sendMessage({
            type: "game_start",
            gameState: activeMatch.game.gameState,
            lobbyId
        });
        activeMatch.previousUpdateTime = Date.now()
        activeMatch.previousClientSendTime = activeMatch.previousUpdateTime - 2*CLIENT_UPDATE_TICK;
        activeMatch.previousClientGameTime = 0;
        activeMatch.nextUpdateTime = activeMatch.previousUpdateTime + UPDATE_TICK;
        activeMatch.game.start();
        setTimeout(updateGame.bind(null, lobbyId), UPDATE_TICK);
    }
}

function updateGame(lobbyId) {
    var activeMatch = matchData[lobbyId]
    if (activeMatch) {
        var game = activeMatch.game
        var updateStartTime = Date.now();
        if (game.isActive()) {
            var deltaTime = (updateStartTime - activeMatch.previousUpdateTime) / 1000;
            game.update(deltaTime);
            if (updateStartTime - activeMatch.previousClientSendTime >= CLIENT_UPDATE_TICK || !game.isActive()) {
                sendMessage({
                    type: "game_update",
                    lobbyId,
                    data: gsf.getGameStateChanges(game.gameState, activeMatch.previousClientGameTime)
                });
                activeMatch.previousClientUpdateTime = updateStartTime;
                activeMatch.previousClientGameTime = game.gameState.gameTime;
            }
        }
        activeMatch.previousUpdateTime = updateStartTime;

        if (game.isActive()) {
            activeMatch.nextUpdateTime += UPDATE_TICK;
            var currentTime = Date.now();
            while (currentTime >= activeMatch.nextUpdateTime) {
                activeMatch.nextUpdateTime += UPDATE_TICK;
            }
            var sleepTime = activeMatch.nextUpdateTime - currentTime;
            setTimeout(updateGame.bind(null, lobbyId), sleepTime);
        } else {
            gameOver(lobbyId);
        }
    }
}

function gameOver(lobbyId) {
    var activeMatch = matchData[lobbyId];
    if (activeMatch) { 
        var match = activeMatch.match;
        match.addFinishedGameState(activeMatch.game.gameState);
        sendMessage({
            type: "game_over",
            lobbyId
        });
        if (match.isMatchOver()) {
            delete matchData[lobbyId];
            sendMessage({
                type: "match_over",
                lobbyId
            });
        } else {
            sendMessage({
                type: "game_countdown",
                lobbyId,
                duration: TIME_BETWEEN_GAMES
            })
            setTimeout(startGame.bind(null, lobbyId), TIME_BETWEEN_GAMES);
        }
    }
}

function sendMessage(message) {
    console.log("Sending: " + message.type);
    console.log(socket.write(JSON.stringify(message) + "\n"));
}
