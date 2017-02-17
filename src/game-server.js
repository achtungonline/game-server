import Match from "core/src/core/match.js";
import forEach from "core/src/core/util/for-each.js";
import * as compression from "core/src/core/util/compression.js";
import * as random from "core/src/core/util/random.js";
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
var socket = net.connect(3000);

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

socket.on("data", (data) => {
    var message = JSON.parse(data)
    console.log("Message type: ", message.type)
    if (messageFunctions[message.type]) {
        messageFunctions[message.type](message)
    } else {
        console.log("Unsupported message type: ", message.type)
    }
});

function startMatch(lobbyId, matchConfig) {
    console.log("Start match: ", lobbyId);
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
            lobbyId
        });
        activeMatch.previousUpdateTime = Date.now()
        activeMatch.previousClientUpdateTime = activeMatch.previousUpdateTime - 2*CLIENT_UPDATE_TICK;
        activeMatch.nextUpdateTime = activeMatch.previousUpdateTime + UPDATE_TICK;
        activeMatch.wormPathSegmentIndex = {};
        activeMatch.gameEventCount = 0;
        activeMatch.powerUpEventCount = 0;
        activeMatch.effectEventCount = 0;
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
            if (updateStartTime - activeMatch.previousClientUpdateTime >= CLIENT_UPDATE_TICK || !game.isActive()) {
                sendMessage({
                    type: "game_update",
                    lobbyId,
                    data: extractGameChanges(lobbyId)
                });
                activeMatch.previousClientUpdateTime = updateStartTime
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

function extractGameChanges(lobbyId) {
    var activeMatch = matchData[lobbyId];
    if (activeMatch) {
        var gameState = activeMatch.game.gameState;
        var wormPathSegments = {};
        forEach(gameState.wormPathSegments, function(segments, id) {
            if (activeMatch.wormPathSegmentIndex[id] === undefined) {
                activeMatch.wormPathSegmentIndex[id] = 0;
            }
            if (segments.length > 0) {
                wormPathSegments[id] = [];
                var pathSegment;
                while (true) {
                    pathSegment = segments[activeMatch.wormPathSegmentIndex[id]];
                    pathSegment.index = activeMatch.wormPathSegmentIndex[id];
                    wormPathSegments[id].push(compression.compressWormSegment(pathSegment));
                    if (activeMatch.wormPathSegmentIndex[id] < segments.length - 1) {
                        activeMatch.wormPathSegmentIndex[id]++;
                    } else {
                        break;
                    }
                }
            }
        });
        var gameEvents = [];
        while (activeMatch.gameEventCount < gameState.gameEvents.length) {
            gameEvents.push(gameState.gameEvents[activeMatch.gameEventCount]);
            activeMatch.gameEventCount++;
        }
        var powerUpEvents = [];
        while (activeMatch.powerUpEventCount < gameState.powerUpEvents.length) {
            powerUpEvents.push(gameState.powerUpEvents[activeMatch.powerUpEventCount]);
            activeMatch.powerUpEventCount++;
        }
        var effectEvents = [];
        while (activeMatch.effectEventCount < gameState.effectEvents.length) {
            effectEvents.push(gameState.effectEvents[activeMatch.effectEventCount]);
            activeMatch.effectEventCount++;
        }
        return {
            gameTime: gameState.gameTime,
            wormPathSegments,
            gameEvents,
            powerUpEvents,
            effectEvents
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
                type: "game_count_down",
                lobbyId,
                duration: TIME_BETWEEN_GAMES
            })
            setTimeout(startGame.bind(null, lobbyId), TIME_BETWEEN_GAMES);
        }
    }
}

function sendMessage(message) {
    console.log("Sending: " + JSON.stringify(message));
    socket.write(JSON.stringify(message) + "\n");
}
