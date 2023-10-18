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
  camera.setComponent("camera", settings);
  SDK3DVerse.engineAPI.commitChanges();
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
  const clientAvatarContent = await fetch("img/client-avatar.svg").then((res) =>
    res.text(),
  );
  clientDisplayEX.showClientAvatars({
    // depending on the size of your scene you might want to adjust the radius
    radius: 80,
    getClientAvatarSrc({ color }) {
      const svgContent = clientAvatarContent
        .replace(/FG_COLOR/g, color)
        .replace(/BG_COLOR/g, "#ffffff");
      const url = `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
      return url;
    },
    getClientDisplayName({ clientUUID }) {
      // Convert the UUID to something that looks sort of like a word
      const name = [...clientUUID]
        .filter((s) => /[a-zA-Z]/.test(s))
        .slice(0, 5)
        .join("");
      const nameCapitalized = `${name[0].toUpperCase()}${name.slice(1)}`;
      return `User ${nameCapitalized}`;
    },
  });
}
