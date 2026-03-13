GAME STRUCTURE
Game experience
- The point of the game is dominating the space by destroying the rivals fleats.
- Solo (human-AI) or multiplayer game.(local - 2players, remote - multiplayer - max: 4).
Movements:
The player can move forward, backward and rotate 360 degrees. 
The blaster shoot straight forward only. 
Controls:
1Player or Multiplayer (remote)
Forward: up arrow.
Backwards: down arrow.
Rotate clockwise: right arrow.
Rotate anti clockwise: left arrow.
Shoot: spacebar. 
2 players local multiplayer (playing on same keyboard): 
player blue: 4 arrows + spaceship.
player green: Forward: w. Backwards: s. Rotate clockwise: d. Rotate anti clockwise: a. Shoot: tab.

- Rules:
- Destroy the enemy fleat while avoiding getting hit by metheorites. 
- Each player plays with one ship at the time, once a ship is destroyed the next one appears until there are no more. Each Spaceship can resists 20 hits of damage (damage is shown in a bar on top screen).
- The Weapon is lasers and is infinite but needs to recharge. (an indicative bar, under the damage bar, shows weapon energy level which decrease by 1/50th part at each shot and rechearge at the pace of 1/50th part at each half second).
- Each fleat is composed by 4 ships.
The last fleat standing is the winner. 

- Global Game stats:
Global Ranking: the player who won most games is the best. Other stats are: 
Armored: the player who lost less spaceships.
Riddled: the player who lost most spaceships.
Sniper: the player with best shots fired / shots on target ratio.
Destroyer: the player who destroyed most spaceships.
Spender: the player with worst shots fired / shots on target ratio.

Graphics:

- Background: ./public/assets/Backgrounds/blue.png.
- Spaceships: path ./public/assets/PNG/...
playerShip1: first ship of the fleat.
playerShip2: second ship of the fleat.
playerShip3: third ship of the fleat.
playerShip4: fourth ship of the fleat.

Players (max 4 per game): blue, green, orange, red. 
Each spaceship name comes with a colour which identifies the player (Example: 1st ship of Player Blue-> playerShip1_blue).

- On the screen during game: on top left and top right the 2 damage bars, one for each player, which show the damage of the ship that is being used in that moment. Under each damage bar there is another bar (of the colour of the player) which indicates the blaster energy (the player sees in real time the energy going down when he blasts and up while the weapon recharges).


