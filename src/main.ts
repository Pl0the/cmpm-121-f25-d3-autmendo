// src/main.ts
// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";

import "./_leafletWorkaround.ts";

import luck from "./_luck.ts";

// UI elements

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
controlPanelDiv.textContent = "UCSC Token Crafter";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
statusPanelDiv.textContent = "Held token: (none)";
document.body.append(statusPanelDiv);

// Game constants

const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

const GAMEPLAY_ZOOM_LEVEL = 19;

const TILE_DEGREES = 0.0001;

const GRID_RADIUS = 24;

const INTERACTION_RADIUS = 3;

let heldToken: number | null = null;

// Map creation

const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Player marker

const playerMarker = leaflet.marker(CLASSROOM_LATLNG, {
  title: "You are here",
});

playerMarker.bindTooltip("You are here!");
playerMarker.addTo(map);

function Bounds(i: number, j: number): leaflet.LatLngBounds {
  const origin = CLASSROOM_LATLNG;
  return leaflet.latLngBounds(
    [
      origin.lat + i * TILE_DEGREES,
      origin.lng + j * TILE_DEGREES,
    ],
    [
      origin.lat + (i + 1) * TILE_DEGREES,
      origin.lng + (j + 1) * TILE_DEGREES,
    ],
  );
}

// grid and tokens

function tokenValue(i: number, j: number): number {
  const r = luck(`${i},${j}`);

  if (r < 0.7) return 0;
  if (r < 0.775) return 1;
  if (r < 0.85) return 2;
  if (r < 0.925) return 4;
  return 8;
}

function cellCenter(i: number, j: number): leaflet.LatLng {
  const origin = CLASSROOM_LATLNG;
  return leaflet.latLng(
    origin.lat + (i + 0.5) * TILE_DEGREES,
    origin.lng + (j + 0.5) * TILE_DEGREES,
  );
}

function cellDistanceFromPlayer(i: number, j: number): number {
  return Math.max(Math.abs(i), Math.abs(j));
}

function updateHeldTokenUI() {
  if (heldToken === null) {
    statusPanelDiv.textContent = "Held token: (none)";
  } else {
    statusPanelDiv.textContent = `Held token: ${heldToken}`;
  }
}

interface TokenCell extends leaflet.Rectangle {
  tokenValue: number;
  labelMarker: leaflet.Marker | null;
}

for (let i = -GRID_RADIUS; i <= GRID_RADIUS; i++) {
  for (let j = -GRID_RADIUS; j <= GRID_RADIUS; j++) {
    const val = tokenValue(i, j);

    const cell = leaflet.rectangle(Bounds(i, j), {
      color: "#1326cdff",
      weight: 1,
    }) as TokenCell;

    cell.tokenValue = val;
    cell.labelMarker = null;
    cell.addTo(map);

    const dist = cellDistanceFromPlayer(i, j);
    const isInteractable = dist <= INTERACTION_RADIUS;

    if (!isInteractable) {
      cell.setStyle({
        color: "#555555",
        opacity: 0.4,
        fillOpacity: 0.05,
      });
    } else {
      cell.on("click", () => {
        // PICKUP MODE
        if (heldToken === null) {
          if (cell.tokenValue === 0) return;

          heldToken = cell.tokenValue;
          updateHeldTokenUI();

          cell.tokenValue = 0;
          cell.setStyle({ fillOpacity: 0 });

          if (cell.labelMarker !== null) {
            map.removeLayer(cell.labelMarker);
            cell.labelMarker = null;
          }
          return;
        }

        // CRAFTING MODE
        if (heldToken !== cell.tokenValue) return;

        const newValue = heldToken * 2;
        cell.tokenValue = newValue;

        if (cell.labelMarker !== null) {
          map.removeLayer(cell.labelMarker);
        }

        const icon = leaflet.divIcon({
          className: "token-label",
          html: `<span>${newValue}</span>`,
          iconSize: [0, 0],
        });

        const marker = leaflet.marker(cellCenter(i, j), { icon }).addTo(map);
        cell.labelMarker = marker;

        heldToken = null;
        updateHeldTokenUI();

        if (newValue >= 16) {
          statusPanelDiv.textContent = `You crafted a ${newValue}!`;
        }
      });
    }

    if (val !== 0) {
      const icon = leaflet.divIcon({
        className: "token-label",
        html: `<span>${val}</span>`,
        iconSize: [0, 0],
      });

      const marker = leaflet.marker(cellCenter(i, j), { icon }).addTo(map);
      cell.labelMarker = marker;
    }
  }
}
