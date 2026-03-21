import { io } from "socket.io-client";

const SOCKET_URL = typeof window !== 'undefined'
  ? (window.__GAME_SOCKET_URL || window.location.origin)
  : 'http://localhost:4000';
const socket = io(SOCKET_URL, { path: '/game/socket.io/' });

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