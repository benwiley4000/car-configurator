import AssetEditorAPI from "./AssetEditorAPI.js";

// TODO: get rid of this and use real types
const SDK3DVerse = /** @type {typeof window & { SDK3DVerse: any }} */ (window)
  .SDK3DVerse;

export function getUserToken() {
  return localStorage.getItem("3dverse-api-token");
}

/**
 * @param {[number, number, number]} destinationPosition
 * @param {[number, number, number, number]} destinationOrientation
 */
export function changeCameraPosition(
  destinationPosition,
  destinationOrientation,
) {
  const { cameraAPI } = SDK3DVerse.engineAPI;
  const viewport =
    cameraAPI.currentViewportEnabled || cameraAPI.getActiveViewports()[0];

  SDK3DVerse.engineAPI.cameraAPI.travel(
    viewport,
    destinationPosition,
    destinationOrientation,
    10,
  );
}

function getCamera() {
  const cameraAPI = SDK3DVerse.engineAPI.cameraAPI;
  const viewport =
    cameraAPI.currentViewportEnabled || cameraAPI.getActiveViewports()[0];
  return viewport.getCamera();
}

export function getCameraSettings() {
  const camera = getCamera();
  return camera.getComponent("camera").dataJSON;
}

/** @param {Record<string, any>} settings */
export function setCameraSettings(settings) {
  const camera = getCamera();
  const cameraComponent = camera.getComponent("camera");
  Object.assign(cameraComponent.dataJSON, settings);
  camera.setComponent("camera", cameraComponent);
  SDK3DVerse.engineAPI.propagateChanges();
}

/**
 * This function sets the resolution with a max rendering resolution of
 * 1920px then adapts the scale appropriately for the canvas size.
 */
export function reconfigureResolution() {
  const { width, height } = /** @type {HTMLElement} */ (
    document.getElementById("canvas-container")
  ).getBoundingClientRect();

  const largestDim = Math.max(width, height);
  const MAX_DIM = 1920;
  const scale = largestDim > MAX_DIM ? MAX_DIM / largestDim : 1;

  let w = Math.floor(width);
  let h = Math.floor(height);
  const aspectRatio = w / h;

  if (w > h) {
    // landscape
    w = Math.floor(aspectRatio * h);
  } else {
    // portrait
    h = Math.floor(w / aspectRatio);
  }
  SDK3DVerse.setResolution(w, h, scale);
}

/**
 * @param {string} assetType
 * @param {string} assetUUID
 * @returns
 */
export async function getAssetDescription(assetType, assetUUID) {
  const apiUrl = "https://api.3dverse.com/app/v1";
  const res = await fetch(
    `${apiUrl}/assets/${assetType}/${assetUUID}/description`,
    {
      headers: {
        User_token: getUserToken() || "",
      },
    },
  );
  const data = await res.json();
  if (res.status >= 400) {
    throw data;
  }
  return data;
}

/**
 * @typedef {{
 *   dataJson: {
 *     albedo?: [number, number, number];
 *     clearCoatRoughness?: number;
 *     clearCoatStrength?: number;
 *     emissionIntensity?: number;
 *   };
 * }} AssetDescription
 */

/**
 * @param {string} materialUUID
 * @param {(event: string, desc: AssetDescription) => void} callback
 * @returns
 */
export function getAssetEditorAPIForMaterial(materialUUID, callback) {
  const api = new AssetEditorAPI(getUserToken(), callback);
  api
    .connect("material", materialUUID)
    .then(({ description }) => callback("assetUpdated", description));
  return api;
}

export async function showClientAvatars() {
  const clientDisplayEX = await SDK3DVerse.installExtension(
    SDK3DVerse_ClientDisplay_Ext,
  );
  clientDisplayEX.setClientsRadius(80);

  const clientAvatarContent = await fetch("img/client-avatar.svg").then((res) =>
    res.text(),
  );

  const getClientAvatarSvgUrl = (id, colorCss) => {
    const svgContent = clientAvatarContent
      .replaceAll("FG_COLOR", colorCss)
      .replaceAll("BG_COLOR", "#ffffff");
    const url = `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
    return url;
  };

  const updateColorForClient = (client, color) => {
    const colorCss = `#${color}`;
    client.color = colorCss;
    client.image = getClientAvatarSvgUrl(client.clientUUID, colorCss);
    if (client.avatar) {
      client.avatar.src = client.image;
    }
  };

  const knownClients = new Map();

  const registerUser = (user) => {
    if (knownClients.has(user.clientUUID)) return;
    const displayName = `User ${Number(Math.random().toString().slice(2))
      .toString(16)
      .slice(0, 5)}`;
    const client = { ...user, displayName };
    updateColorForClient(
      client,
      SDK3DVerse.engineAPI.editorAPI.clientColors[user.clientUUID],
    );
    clientDisplayEX.registerClient(client);
    knownClients.set(user.clientUUID, client);
  };

  const sessionKey = SDK3DVerse.streamer.config.connectionInfo.sessionKey;

  const socket = new WebSocket(
    `wss://api.3dverse.com/legacy/session/notifyWs?sessionKey=${sessionKey}&token=${getUserToken()}`,
  );

  socket.onerror = console.error;

  socket.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    const user = message.data;
    switch (message.eventType) {
      case "all-users":
        user
          .filter((u) => u.clientUUID !== SDK3DVerse.streamer.clientUUID)
          .forEach(registerUser);
        break;
      case "user-joined":
        if (message.data.clientUUID !== SDK3DVerse.streamer.clientUUID) {
          registerUser(message.data);
        }
        break;
    }
  };

  SDK3DVerse.engineAPI.editorAPI.on("client-color", (client) => {
    const knownClient = knownClients.get(client.clientUUID);
    if (knownClient) {
      updateColorForClient(knownClient, client.color);
    }
  });
}
