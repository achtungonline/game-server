var net = require("net")

var startMatchMessage = {
    type: "start_match",
    lobbyId: 3,
    matchConfig: {
        "players": [
        {
          "type": "human",
          "colorId": "blue",
          "name": "Gustav Vasa",
          "left": "A",
          "right": "S",
          "id": "player_0"
        },
        {
          "type": "bot",
          "colorId": "pink",
          "name": "My hat man gandi",
          "left": "DOWN",
          "right": "RIGHT",
          "id": "player_1"
        }
      ],
      "map": {
        "name": "Square 500",
        "shape": {
          "type": "rectangle",
          "boundingBox": {
            "width": 500,
            "height": 500
          },
          "area": 250000,
          "x": 10,
          "y": 10,
          "maxX": 510,
          "maxY": 510,
          "centerX": 260,
          "centerY": 260,
          "width": 500,
          "height": 500
        },
        "borderWidth": 10,
        "blockingShapes": [],
        "width": 520,
        "height": 520
      },
      "maxScore": 5
    }
}

var server = net.createServer((socket) => {
    console.log("Connected to socket");
    socket.write(JSON.stringify(startMatchMessage));
    var s = "";
    socket.on("data", (data) => {
        s = s + data.toString();
        var lines = s.split(/\r?\n/);
        for (var i = 0; i < lines.length - 1; i++) {
            var message = JSON.parse(lines[i]);
            console.log("Game message: " + message.type);
        }
        s = lines[lines.length - 1];
    });
}).on('error', (err) => {
    // handle errors here
    throw err;
});

// grab a random port.
server.listen(3000, () => {
  console.log('opened server on', server.address());
});
