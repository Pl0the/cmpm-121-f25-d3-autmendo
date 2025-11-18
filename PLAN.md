# D3: {game title goes here}

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

### Steps

- [x] copy main.ts to reference.ts for future reference
- [x] delete everything in main.ts
- [x] put a basic leaflet map on the screen
- [x] draw the player's location on the map
- [x] draw a rectangle representing one cell on the map
- [x] use loops to draw a whole grid of cells on the map
- [x] find luck value of token
- [x] visibly show luck value of each token on the map
- [ ] make only nearby cells interactable
- [ ] allow player to pick up tokens
- [ ] display player tokens
- [ ] implement crafting tokens
- [ ] cleanup and finish with D3.a
