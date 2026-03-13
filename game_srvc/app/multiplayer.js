import { io } from "socket.io-client";

const socket = io("http://localhost:4000");

export function connectMultiplayer(game) {

  socket.on("connect", () => {
    console.log("connected", socket.id);
  });

  socket.on("state", (state) => {
    applyRemoteState(game, state);
  });

  game.onLocalInput = (input) => {
    socket.emit("input", input);
  };
}

function applyRemoteState(game, state) {

  state.players.forEach((remotePlayer, i) => {

    const player = game.players[i];
    if (!player) return;

    const ship = player.currentShip;
    if (!ship) return;

    ship.x = remotePlayer.x;
    ship.y = remotePlayer.y;
    ship.angle = remotePlayer.angle;

  });

}