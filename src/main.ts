// src/main.ts
// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";

import "./_leafletWorkaround.ts";

import luck from "./_luck.ts";

// movement interface

interface MovementController {
  start(onMove: (di: number, dj: number) => void): void;
  stop(): void;
}

// button controller

class ButtonMovementController implements MovementController {
  start(onMove: (di: number, dj: number) => void): void {
    (document.getElementById("moveN") as HTMLButtonElement).onclick = () =>
      onMove(-1, 0);
    (document.getElementById("moveS") as HTMLButtonElement).onclick = () =>
      onMove(1, 0);
    (document.getElementById("moveW") as HTMLButtonElement).onclick = () =>
      onMove(0, -1);
    (document.getElementById("moveE") as HTMLButtonElement).onclick = () =>
      onMove(0, 1);
  }

  stop(): void {
    (document.getElementById("moveN") as HTMLButtonElement).onclick = null;
    (document.getElementById("moveS") as HTMLButtonElement).onclick = null;
    (document.getElementById("moveW") as HTMLButtonElement).onclick = null;
    (document.getElementById("moveE") as HTMLButtonElement).onclick = null;
  }
}

// geolocation controller

class GeolocationMovementController implements MovementController {
  private watchId: number | null = null;
  private lastLat: number | null = null;
  private lastLng: number | null = null;

  start(onMove: (di: number, dj: number) => void): void {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported; using no-op controller.");
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        if (this.lastLat === null || this.lastLng === null) {
          this.lastLat = latitude;
          this.lastLng = longitude;
          return;
        }

        const dLat = latitude - this.lastLat;
        const dLng = longitude - this.lastLng;

        let di = 0;
        let dj = 0;

        if (Math.abs(dLat) >= TILE_DEGREES) di = dLat > 0 ? 1 : -1;
        if (Math.abs(dLng) >= TILE_DEGREES) dj = dLng > 0 ? 1 : -1;

        if (di !== 0 || dj !== 0) {
          this.lastLat = latitude;
          this.lastLng = longitude;
          onMove(di, dj);
        }
      },
      (err) => console.warn("Geo error:", err),
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 5000,
      },
    );
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}

// movement facade

class MovementFacade {
  private controller: MovementController | null = null;

  constructor(
    private onMove: (di: number, dj: number) => void,
  ) {}

  useButtons() {
    this.swapController(new ButtonMovementController());
  }

  useGeo() {
    this.swapController(new GeolocationMovementController());
  }

  private swapController(newController: MovementController) {
    if (this.controller) this.controller.stop();
    this.controller = newController;
    this.controller.start(this.onMove);
  }
}

// game constants

const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 0.0001;
const INTERACTION_RADIUS = 3;

const params = new URLSearchParams(globalThis.location.search);
const USE_GEO_PARAM = params.get("movement") === "geo";

let heldToken: number | null = null;

const playerGrid = latLngToCell(CLASSROOM_LATLNG.lat, CLASSROOM_LATLNG.lng);

// flyweight styles

const flyweightCellStyleActive = {
  color: "#1326cdff",
  weight: 1,
  opacity: 1,
  fillOpacity: 0.15,
};

const flyweightCellStyleInactive = {
  color: "#555555",
  opacity: 0.4,
  fillOpacity: 0.05,
};

// memento

interface CellMemento {
  token: number;
}

const mementoMap = new Map<string, CellMemento>();

function createMemento(cell: GridCellID, token: number) {
  mementoMap.set(cellKey(cell), { token });
}

function restoreMemento(cell: GridCellID): number | null {
  const m = mementoMap.get(cellKey(cell));
  return m ? m.token : null;
}

// grid functions

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

function cellKey(c: GridCellID): string {
  return `${c.i},${c.j}`;
}

function tokenValueDefault(i: number, j: number): number {
  const r = luck(`${i},${j}`);
  if (r < 0.7) return 0;
  if (r < 0.775) return 1;
  if (r < 0.85) return 2;
  if (r < 0.925) return 4;
  return 8;
}

function getTokenValue(cell: GridCellID): number {
  const restored = restoreMemento(cell);
  if (restored !== null) return restored;
  return tokenValueDefault(cell.i, cell.j);
}

function setTokenValue(cell: GridCellID, value: number) {
  createMemento(cell, value);
}

const visibleCells = new Map<string, TokenCell>();

// ui setup

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
controlPanelDiv.textContent = "UCSC Token Crafter";
document.body.append(controlPanelDiv);

const movementDiv = document.createElement("div");
movementDiv.id = "movementControls";
movementDiv.innerHTML = `
  <button id="moveN">↓</button>
  <button id="moveW">←</button>
  <button id="moveE">→</button>
  <button id="moveS">↑</button>
`;
controlPanelDiv.append(movementDiv);

// movement toggle button (step 5)

const movementToggleButton = document.createElement("button");
movementToggleButton.id = "movementToggle";
controlPanelDiv.append(movementToggleButton);

// player movement

function movePlayer(di: number, dj: number) {
  playerGrid.i += di;
  playerGrid.j += dj;
  updatePlayerMarker();
  updateStatusUI();
  renderVisibleCells();
}

// map ui

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

const messageDiv = document.createElement("div");
messageDiv.id = "messagePanel";
document.body.append(messageDiv);

const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const playerMarker = leaflet.marker(CLASSROOM_LATLNG, {
  title: "You are here",
});

playerMarker.bindTooltip("You are here!");
playerMarker.addTo(map);

function updatePlayerMarker() {
  playerMarker.setLatLng(
    leaflet.latLng(playerGrid.i * TILE_DEGREES, playerGrid.j * TILE_DEGREES),
  );
}

updatePlayerMarker();

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

// movement facade + toggle wiring (step 5)

const facade = new MovementFacade((di, dj) => movePlayer(di, dj));
let usingGeo = USE_GEO_PARAM;

function setMovementMode(useGeo: boolean) {
  usingGeo = useGeo;

  if (usingGeo) {
    facade.useGeo();
  } else {
    facade.useButtons();
  }

  movementToggleButton.textContent = usingGeo
    ? "Switch to buttons"
    : "Switch to GPS";

  const n = document.getElementById("moveN") as HTMLButtonElement;
  const s = document.getElementById("moveS") as HTMLButtonElement;
  const w = document.getElementById("moveW") as HTMLButtonElement;
  const e = document.getElementById("moveE") as HTMLButtonElement;

  if (n && s && w && e) {
    n.disabled = usingGeo;
    s.disabled = usingGeo;
    w.disabled = usingGeo;
    e.disabled = usingGeo;
  }
}

movementToggleButton.onclick = () => {
  setMovementMode(!usingGeo);
};

setMovementMode(usingGeo);

// token cell

interface TokenCell extends leaflet.Rectangle {
  tokenValue: number;
  labelMarker: leaflet.Marker | null;
  isInteractable: boolean;
}

function updateCellStyle(cell: TokenCell, cellID: GridCellID) {
  const dist = cellDistanceFromPlayer(cellID);
  const isInteractable = dist <= INTERACTION_RADIUS;
  cell.isInteractable = isInteractable;

  if (!isInteractable) {
    cell.setStyle(flyweightCellStyleInactive);
    if (cell.labelMarker) {
      map.removeLayer(cell.labelMarker);
      cell.labelMarker = null;
    }
  } else {
    cell.setStyle(flyweightCellStyleActive);

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

// visible rendering

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
      if (!cell) cell = spawnCell(cellID);

      cell.tokenValue = getTokenValue(cellID);
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

// cell click handlers

function handleCellClick(cell: TokenCell, cellID: GridCellID) {
  if (!cell.isInteractable) return;

  if (heldToken === null) {
    if (cell.tokenValue === 0) return;
    heldToken = cell.tokenValue;
    setTokenValue(cellID, 0);
    cell.tokenValue = 0;
    if (cell.labelMarker) {
      map.removeLayer(cell.labelMarker);
      cell.labelMarker = null;
    }
    updateStatusUI();
    return;
  }

  if (cell.tokenValue === 0) {
    setTokenValue(cellID, heldToken);
    cell.tokenValue = heldToken!;
    const icon = leaflet.divIcon({
      className: "token-label",
      html: `<span>${heldToken}</span>`,
      iconSize: [0, 0],
    });
    if (cell.labelMarker) map.removeLayer(cell.labelMarker);
    cell.labelMarker = leaflet
      .marker(cellToCenter(cellID), { icon })
      .addTo(map);
    heldToken = null;
    updateStatusUI();
    return;
  }

  if (heldToken !== cell.tokenValue) return;

  const newValue = heldToken * 2;
  setTokenValue(cellID, newValue);
  cell.tokenValue = newValue;

  if (cell.labelMarker) map.removeLayer(cell.labelMarker);

  const icon = leaflet.divIcon({
    className: "token-label",
    html: `<span>${newValue}</span>`,
    iconSize: [0, 0],
  });

  cell.labelMarker = leaflet
    .marker(cellToCenter(cellID), { icon })
    .addTo(map);

  heldToken = null;
  updateStatusUI();

  if (newValue >= 32) {
    messageDiv.textContent = `You win! You crafted a ${newValue} token!`;
  }
}

// spawning cells

function spawnCell(cellID: GridCellID): TokenCell {
  const val = getTokenValue(cellID);

  const cell = leaflet.rectangle(
    cellToBounds(cellID),
    flyweightCellStyleActive,
  ) as TokenCell;

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
