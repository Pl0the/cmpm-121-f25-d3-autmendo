# D3: {Grid crafter}

## Game Design Vision

The player can collect tokens and use them based on their value to combine them with other tokens to craft a new token which has double the value.

## Technologies

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

## Assignments

## D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Can you assemble a map-based user interface using the Leaflet mapping framework?
Key gameplay challenge: Can players collect and craft tokens from nearby locations to finally make one of sufficiently high value?

### D3.a Steps

- [x] copy main.ts to reference.ts for future reference
- [x] delete everything in main.ts
- [x] put a basic leaflet map on the screen
- [x] draw the player's location on the map
- [x] draw a rectangle representing one cell on the map
- [x] use loops to draw a whole grid of cells on the map
- [x] find luck value of token
- [x] visibly show luck value of each token on the map
- [x] make only nearby cells interactable
- [x] allow player to pick up tokens and display them
- [x] implement crafting tokens
- [x] cleanup and finish with D3.a

## D3.b Globe-spanning Gameplay

### D3.b Steps

- [x] Add player movement and update UI accordingly
- [x] Create new data type then anchor grid to center
- [x] Spawn only nearby cells, and make them visible to the end of the map
- [x] add memoryless cells for the tokens value
- [x] make an end game state for the game
- [x] final polish and cleanup with D3.b

## D3.c Object Persistence

### D3.c Steps

-[x] add a map datatype for the tokens
-[x] apply flyweight pattern to cells
-[x] apply momento pattern for the cells that we crafted in
-[x] final polish and cleanup with D3.c

## D3.d Gameplay Across Real-world Space and Time

### D3.d Steps

-[x] add movement inferace so that the game works no matter how they move
-[x] Create new buttons for movement using the interface
-[x] implement Geolocation API based movement using the interface
-[x] apply the facade pattern to the interface
-[x] add a toggle to switch between the two movement types
-[x] implement localstorage API for the game state
-[ ] add ability to load last game state and resume gameplay
-[ ] implement new game button to start a new game
-[ ] final polish and cleanup with D3.d
