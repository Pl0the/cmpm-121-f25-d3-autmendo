// src/main.ts
// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";

import "./_leafletWorkaround.ts";

import luck from "./_luck.ts";

// Game constants

const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

const GAMEPLAY_ZOOM_LEVEL = 19;

const TILE_DEGREES = 0.0001;

const INTERACTION_RADIUS = 3;

let heldToken: number | null = null;

const playerGrid = latLngToCell(CLASSROOM_LATLNG.lat, CLASSROOM_LATLNG.lng);

// Grid cell Setup

interface GridCellID {
  i: number;
  j: number;
}

function latLngToCell(lat: number, lng: number): GridCellID {
  return {
    i: Math.floor(lat / TILE_DEGREES),
    j: Math.floor(lng / TILE_DEGREES),
  };
}

function cellToBounds(cell: GridCellID): leaflet.LatLngBounds {
  const lat1 = cell.i * TILE_DEGREES;
  const lng1 = cell.j * TILE_DEGREES;
  const lat2 = (cell.i + 1) * TILE_DEGREES;
  const lng2 = (cell.j + 1) * TILE_DEGREES;

  return leaflet.latLngBounds([lat1, lng1], [lat2, lng2]);
}

function cellToCenter(cell: GridCellID): leaflet.LatLng {
  return leaflet.latLng(
    (cell.i + 0.5) * TILE_DEGREES,
    (cell.j + 0.5) * TILE_DEGREES,
  );
}

const visibleCells = new Map<string, TokenCell>();

function cellKey(c: GridCellID): string {
  return `${c.i},${c.j}`;
}

// UI elements

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
controlPanelDiv.textContent = "UCSC Token Crafter";
document.body.append(controlPanelDiv);

/// Movement control

const movementDiv = document.createElement("div");
movementDiv.id = "movementControls";
movementDiv.innerHTML = `
  <button id="moveN">↓</button>
  <button id="moveW">←</button>
  <button id="moveE">→</button>
  <button id="moveS">↑</button>
`;
controlPanelDiv.append(movementDiv);

function movePlayer(di: number, dj: number) {
  playerGrid.i += di;
  playerGrid.j += dj;

  updatePlayerMarker();
  updateStatusUI();
  renderVisibleCells();
}

document.getElementById("moveN")!.addEventListener(
  "click",
  () => movePlayer(-1, 0),
);
document.getElementById("moveS")!.addEventListener(
  "click",
  () => movePlayer(1, 0),
);
document.getElementById("moveW")!.addEventListener(
  "click",
  () => movePlayer(0, -1),
);
document.getElementById("moveE")!.addEventListener(
  "click",
  () => movePlayer(0, 1),
);

// UI elements continued

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

const messageDiv = document.createElement("div");
messageDiv.id = "messagePanel";
document.body.append(messageDiv);

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

function updatePlayerMarker() {
  const pos = leaflet.latLng(
    playerGrid.i * TILE_DEGREES,
    playerGrid.j * TILE_DEGREES,
  );

  playerMarker.setLatLng(pos);
}

updatePlayerMarker();

// grid and tokens

function tokenValue(i: number, j: number): number {
  const r = luck(`${i},${j}`);

  if (r < 0.7) return 0;
  if (r < 0.775) return 1;
  if (r < 0.85) return 2;
  if (r < 0.925) return 4;
  return 8;
}

function cellDistanceFromPlayer(cell: GridCellID): number {
  return Math.max(
    Math.abs(cell.i - playerGrid.i),
    Math.abs(cell.j - playerGrid.j),
  );
}

function updateStatusUI() {
  const heldText = heldToken === null ? "(none)" : heldToken.toString();
  statusPanelDiv.textContent =
    `Held token: ${heldText} | Position: (${playerGrid.i}, ${playerGrid.j})`;
}

interface TokenCell extends leaflet.Rectangle {
  tokenValue: number;
  labelMarker: leaflet.Marker | null;
  isInteractable: boolean;
}

function updateCellStyle(cell: TokenCell, cellID: GridCellID) {
  const dist = cellDistanceFromPlayer(cellID);
  const isInteractableNow = dist <= INTERACTION_RADIUS;

  if (cell.isInteractable && !isInteractableNow) {
    cell.tokenValue = tokenValue(cellID.i, cellID.j);
    if (cell.labelMarker) {
      map.removeLayer(cell.labelMarker);
      cell.labelMarker = null;
    }
  }

  cell.isInteractable = isInteractableNow;

  if (!isInteractableNow) {
    cell.setStyle({
      color: "#555555",
      opacity: 0.4,
      fillOpacity: 0.05,
    });

    if (cell.labelMarker) {
      map.removeLayer(cell.labelMarker);
      cell.labelMarker = null;
    }
  } else {
    cell.setStyle({
      color: "#1326cdff",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.15,
    });

    if (cell.tokenValue !== 0 && !cell.labelMarker) {
      const icon = leaflet.divIcon({
        className: "token-label",
        html: `<span>${cell.tokenValue}</span>`,
        iconSize: [0, 0],
      });
      cell.labelMarker = leaflet
        .marker(cellToCenter(cellID), { icon })
        .addTo(map);
    }
  }
}

function renderVisibleCells() {
  const bounds = map.getBounds();

  const cellNorthWest = latLngToCell(bounds.getNorth(), bounds.getWest());
  const cellSouthEast = latLngToCell(bounds.getSouth(), bounds.getEast());

  const minI = Math.min(cellNorthWest.i, cellSouthEast.i);
  const maxI = Math.max(cellNorthWest.i, cellSouthEast.i);
  const minJ = Math.min(cellNorthWest.j, cellSouthEast.j);
  const maxJ = Math.max(cellNorthWest.j, cellSouthEast.j);

  const newVisible = new Set<string>();

  for (let i = minI - 1; i <= maxI + 1; i++) {
    for (let j = minJ - 1; j <= maxJ + 1; j++) {
      const cellID: GridCellID = { i, j };
      const key = cellKey(cellID);
      newVisible.add(key);

      let cell = visibleCells.get(key);
      if (!cell) {
        cell = spawnCell(cellID);
      }
      updateCellStyle(cell, cellID);
    }
  }

  for (const key of visibleCells.keys()) {
    if (!newVisible.has(key)) {
      const cell = visibleCells.get(key)!;
      map.removeLayer(cell);
      if (cell.labelMarker) map.removeLayer(cell.labelMarker);
      visibleCells.delete(key);
    }
  }
}

function handleCellClick(cell: TokenCell, cellID: GridCellID) {
  if (!cell.isInteractable) return;

  if (heldToken === null) {
    if (cell.tokenValue === 0) return;

    heldToken = cell.tokenValue;
    cell.tokenValue = 0;

    if (cell.labelMarker) {
      map.removeLayer(cell.labelMarker);
      cell.labelMarker = null;
    }

    updateStatusUI();
    return;
  }

  if (cell.tokenValue === 0) {
    cell.tokenValue = heldToken;

    const iconDrop = leaflet.divIcon({
      className: "token-label",
      html: `<span>${cell.tokenValue}</span>`,
      iconSize: [0, 0],
    });

    if (cell.labelMarker) {
      map.removeLayer(cell.labelMarker);
    }
    cell.labelMarker = leaflet
      .marker(cellToCenter(cellID), { icon: iconDrop })
      .addTo(map);

    heldToken = null;
    updateStatusUI();
    return;
  }

  if (heldToken !== cell.tokenValue) return;

  const newValue = heldToken * 2;

  cell.tokenValue = newValue;

  if (cell.labelMarker) map.removeLayer(cell.labelMarker);

  const icon = leaflet.divIcon({
    className: "token-label",
    html: `<span>${newValue}</span>`,
    iconSize: [0, 0],
  });

  cell.labelMarker = leaflet.marker(cellToCenter(cellID), { icon }).addTo(map);

  heldToken = null;
  updateStatusUI();

  if (newValue >= 16) {
    messageDiv.textContent = `You crafted a ${newValue} token!`;
  }
}

function spawnCell(cellID: GridCellID): TokenCell {
  const val = tokenValue(cellID.i, cellID.j);

  const cell = leaflet.rectangle(cellToBounds(cellID), {
    color: "#1326cdff",
    weight: 1,
  }) as TokenCell;

  cell.tokenValue = val;
  cell.labelMarker = null;
  cell.isInteractable = false;

  visibleCells.set(cellKey(cellID), cell);
  cell.addTo(map);

  cell.on("click", () => handleCellClick(cell, cellID));

  return cell;
}

renderVisibleCells();
map.on("moveend", renderVisibleCells);
