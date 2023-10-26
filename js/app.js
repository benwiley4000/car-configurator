import { AppConfig } from "./config.js";
import { CarConfiguratorActions } from "./actions.js";
import {
  LoadingOverlayView,
  TimeoutOverlayView,
  CarSelectionView,
  CarColorsView,
  CarMaterialsView,
  CarCubemapView,
  CarOptionsView,
} from "./views.js";
import {
  getCameraSettings,
  setCameraSettings,
  changeCameraPosition,
  showClientAvatars,
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
  /**
   * A 3dverse session can sometimes be closed after a page refresh, if you were
   * the only client connected to that session. We will retry joining a session
   * one more time if this happens to us.
   */
  let retriesLeft = 1;
  let startFailed = false;
  do {
    try {
      CarConfiguratorActions.setSceneLoadingState("Connecting to 3dverse...");

      // HACK: remove this when we're ready to go live
      SDK3DVerse.setApiVersion("v1");
      SDK3DVerse.setApiVersion = () => {};
      SDK3DVerse.webAPI.setURL("https://api.3dverse.dev/app/v1");
      SDK3DVerse.defaultEditorURL = "wss://editor-backend.3dverse.dev";
      // END HACK

      const sessionConnectionInfo = await SDK3DVerse.getSessionConnectionInfo({
        userToken: AppConfig.publicUserToken,
        sceneUUID: AppConfig.sceneUUID,
        joinExisting: true,
        isTransient: true,
      });

      CarConfiguratorActions.setSceneLoadingState("Starting streamer...");

      await SDK3DVerse.start({
        sessionConnectionInfo,
        canvas: document.getElementById("display-canvas"),
        connectToEditor: true,
        viewportProperties: {
          defaultControllerType: SDK3DVerse.controller_type.orbit,
        },
        maxDimension: 1920,
        onConnectingToEditor() {
          CarConfiguratorActions.setSceneLoadingState(
            "Connecting to editor...",
          );
        },
      });
    } catch (err) {
      if (retriesLeft) {
        startFailed = true;
        console.warn(err);
      } else {
        throw err;
      }
    }
  } while (startFailed && retriesLeft--);

  const mediaQuery = window.matchMedia("(max-width: 890px)");
  mediaQuery.addEventListener("change", repositionCameraOnResize);
  repositionCameraOnResize(mediaQuery);
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

  CarConfiguratorActions.setSceneLoadingState("Analyzing scene objects...");

  await CarConfiguratorActions.fetchSceneEntities();

  CarConfiguratorActions.setSceneLoadingState("Caching materials...");

  await CarConfiguratorActions.cacheMaterials();

  CarConfiguratorActions.setSceneLoadingState("Loading complete.");
  CarConfiguratorActions.setIsSceneLoaded(true);

  await showClientAvatars();

  // @ts-ignore
  SDK3DVerse.setInactivityCallback((resumeCallback) => {
    CarConfiguratorActions.setUserIsInactive(resumeCallback);
  });

  SDK3DVerse.notifier.on("onConnectionClosed", () => {
    CarConfiguratorActions.signalDisconnected();
  });

  // hide scene ref cache container (suspended 1000 meters in the air to avoid
  // being seen during page loading)
  const [sceneRefCache] = await SDK3DVerse.engineAPI.findEntitiesByNames(
    "SCENE_REF_CACHE",
  );
  SDK3DVerse.engineAPI.setEntityVisibility(sceneRefCache, false);
}

/** @param {MediaQueryList | MediaQueryListEvent} mediaQuery */
function repositionCameraOnResize(mediaQuery) {
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
  LoadingOverlayView,
  TimeoutOverlayView,
  CarSelectionView,
  CarColorsView,
  CarMaterialsView,
  CarCubemapView,
  CarOptionsView,
});

SDK3DVerse.engineAPI.editorAPI.on(
  "editor-error",
  (/** @type {{ httpCode?: number; message?: string }} */ error) => {
    if (error.httpCode === 429) {
      // This can happen if too many actions are submitted in a short period
      alert(
        `3dverse says: ${error.message}\n${JSON.stringify(error, null, 2)}`,
      );
    }
  },
);

initApp();
