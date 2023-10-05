import { AppConfig } from "./config.js";
import { CarConfiguratorActions } from "./actions.js";
import {
  CarLoadingOverlayView,
  CarSelectionView,
  CarPartsView,
  CarColorsView,
  CarMaterialsView,
  CarCubemapView,
  CarOptionsView,
  CarConfigStepperView,
} from "./views.js";
import {
  getUserToken,
  getCameraSettings,
  setCameraSettings,
  changeCameraPosition,
  reconfigureResolution,
} from "./utils-3dverse.js";

/** @typedef {import('./store.js').CarConfiguratorState} CarConfiguratorState */

// TODO: get rid of this and use real types
const SDK3DVerse = /** @type {typeof window & { SDK3DVerse: any }} */ (window)
  .SDK3DVerse;

/**
 * This sets up the canvas display, gets connected with 3dverse,
 * initializes some camera settings for the user, and fetches
 * some enitities and asset descriptions that will be needed
 * by the app.
 *
 * It updates the loading overlay with info about
 * each async operation, and hides the loading overlay once
 * it's finished.
 */
async function initApp() {
  if (window.location.hostname.includes("localhost")) {
    // set 3dverse-api-token in local storage
    await import("./secrets.js");
  }

  SDK3DVerse.setApiVersion("v1");
  SDK3DVerse.webAPI.setUserToken(getUserToken());

  const mediaQuery = window.matchMedia("(max-width: 768px)");
  mediaQuery.addEventListener("change", onMediaQueryChange);

  const viewports = [
    {
      id: 0,
      left: 0,
      top: 0,
      width: 1,
      height: 1,
      defaultControllerType: 1,
      onCameraCreation: () => {
        onMediaQueryChange(mediaQuery);
        // these are the right bloom settings to emphasize
        // the emission of the car headlights
        setCameraSettings({
          bloom: true,
          bloomStrength: 1,
          bloomThreshold: 50,
        });
        CarConfiguratorActions.changeUserCameraLuminosity(
          getCameraSettings().brightness,
        );
      },
    },
  ];

  SDK3DVerse.setViewports(viewports);
  reconfigureResolution();
  /** @type {number | null} */
  let debounceResizeTimeout = null;
  window.addEventListener("resize", () => {
    if (debounceResizeTimeout) {
      clearTimeout(debounceResizeTimeout);
    }
    debounceResizeTimeout = setTimeout(() => {
      reconfigureResolution();
      debounceResizeTimeout = null;
    }, 100);
  });

  CarConfiguratorActions.setSceneLoadingState("Connecting to 3dverse...");
  const connectionInfo = await SDK3DVerse.webAPI.createOrJoinSession(
    AppConfig.sceneUUID,
  );

  const displayCanvas = /** @type {HTMLElement} */ (
    document.getElementById("display-canvas")
  );
  SDK3DVerse.setupDisplay(displayCanvas);
  // right click is used to zoom in and out so prevent default action
  displayCanvas.addEventListener("contextmenu", (e) => e.preventDefault());

  CarConfiguratorActions.setSceneLoadingState("Starting streamer...");
  await SDK3DVerse.startStreamer(connectionInfo);

  CarConfiguratorActions.setSceneLoadingState("Connecting to editor API...");
  await SDK3DVerse.connectToEditor();

  CarConfiguratorActions.setSceneLoadingState("Analyzing scene objects...");
  await CarConfiguratorActions.fetchSceneEntities();

  CarConfiguratorActions.setSceneLoadingState("Caching materials...");
  await CarConfiguratorActions.cacheMaterials();

  CarConfiguratorActions.setSceneLoadingState("Loading complete.");
  CarConfiguratorActions.setIsSceneLoaded(true);
}

/** @param {MediaQueryList | MediaQueryListEvent} mediaQuery */
function onMediaQueryChange(mediaQuery) {
  if (mediaQuery.matches) {
    changeCameraPosition(
      [-4.595289707183838, 1.6792974472045898, 8.23273754119873],
      [
        -0.08518092334270477, -0.2508307993412018, -0.02216341346502304,
        0.9640212059020996,
      ],
    );
    SDK3DVerse.updateControllerSetting({ speed: 1, sensitivity: 0.8 });
  } else {
    changeCameraPosition(
      [-3.3017091751098633, 1.3626002073287964, 4.2906060218811035],
      [
        -0.12355230003595352, -0.3068566918373108, -0.04021146148443222,
        0.9428451061248779,
      ],
    );
    SDK3DVerse.updateControllerSetting({ speed: 1, sensitivity: 0.4 });
  }
}

// Expose views as globals so their public
// methods can be used as UI event handlers
Object.assign(window, {
  CarLoadingOverlayView,
  CarSelectionView,
  CarPartsView,
  CarColorsView,
  CarMaterialsView,
  CarCubemapView,
  CarOptionsView,
  CarConfigStepperView,
});

SDK3DVerse.engineAPI.editorAPI.on(
  "editor-error",
  (/** @type {{ httpCode?: number; message?: string }} */ error) => {
    if (error.httpCode === 429) {
      // Tell user to stop spamming
      alert(
        `3dverse says: ${error.message}\n${JSON.stringify(error, null, 2)}`,
      );
    }
  },
);

initApp();
