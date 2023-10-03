import { AppConfig } from "./config.js";
import AssetEditorAPI from "./AssetEditorAPI.js";

// Include external library definitions to help with autocompletion
/// <reference path="./vendor/handlebars.d.ts" />

// TODO: get rid of this and use real types
const SDK3DVerse = /** @type {typeof window & { SDK3DVerse: any }} */ (window)
  .SDK3DVerse;

const PARTS_CATEGORY_MAPPING = {
  frontBumpers: "Front Bumper",
  rearBumpers: "Rear Bumper",
  spoilers: "Spoiler",
};

const INVALID_UUID = SDK3DVerse.utils.invalidUUID;

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

  const displayCanvas = document.getElementById("display_canvas");
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

  setTimeout(() => CarConfiguratorActions.setSceneLoadingState(null), 500);
}

function getUserToken() {
  return localStorage.getItem("3dverse-api-token");
}

/**
 *
 * @param {MediaQueryList | MediaQueryListEvent} mediaQuery
 */
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

/**
 * @param {[number, number, number]} destinationPosition
 * @param {[number, number, number, number]} destinationOrientation
 */
async function changeCameraPosition(
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

function getCameraSettings() {
  const camera = getCamera();
  return camera.getComponent("camera").dataJSON;
}

/**
 * @param {Record<string, any>} settings
 */
function setCameraSettings(settings) {
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
function reconfigureResolution() {
  const { width, height } = document
    .getElementById("canvas_container")
    .getBoundingClientRect();

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
 * @param {object[]} entities
 * @param {object} parentEntity
 */
async function reparentEntities(entities, parentEntity) {
  const shouldKeepGlobalTransform = false;
  const shouldCommit = false;
  await SDK3DVerse.engineAPI.reparentEntities(
    entities.map((entity) => entity.getID()),
    parentEntity.getID(),
    shouldKeepGlobalTransform,
    shouldCommit,
  );
}

/**
 * @param {string} assetType
 * @param {string} assetUUID
 * @returns
 */
async function getAssetDescription(assetType, assetUUID) {
  const apiUrl = "https://api.3dverse.com/app/v1";
  const res = await fetch(
    `${apiUrl}/assets/${assetType}/${assetUUID}/description`,
    {
      headers: {
        User_token: getUserToken(),
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
 * https://stackoverflow.com/q/41343535
 * @template T
 * @param {T} obj
 * @returns {T}
 */
function deepFreezeObject(obj) {
  if (obj && typeof obj === "object") {
    for (const key of Reflect.ownKeys(obj)) {
      deepFreezeObject(obj[key]);
    }
  }
  return Object.freeze(obj);
}

/**
 * @typedef {{
 *   selectedCarIndex: number;
 *   selectedPartCategory: keyof (typeof PARTS_CATEGORY_MAPPING);
 *   selectedParts: Record<keyof (typeof PARTS_CATEGORY_MAPPING), number>;
 *   selectedColor: [Number, Number, number];
 *   selectedMaterial: (typeof AppConfig)['materials'][number];
 *   selectedCubemap: (typeof AppConfig)['cubemaps'][number];
 *   lightsOn: boolean;
 *   rotationOn: boolean;
 *   rgbGradientOn: boolean;
 *   userCameraLuminosity: number;
 *   currentStep: 'modelSelection' | 'customization' | 'review';
 *   sceneLoadingState: string | null;
 * }} CarConfiguratorState
 */

const CarConfiguratorStore = new (class CarConfiguratorStore {
  /** @private @type {CarConfiguratorState} */
  internalState = deepFreezeObject({
    selectedCarIndex: 0,
    selectedPartCategory:
      /** @type {CarConfiguratorState['selectedPartCategory']} */ (
        Object.keys(PARTS_CATEGORY_MAPPING)[0]
      ),
    selectedParts: {
      frontBumpers: 0,
      rearBumpers: 0,
      spoilers: 0,
    },
    selectedColor: AppConfig.colorChoices[0],
    selectedMaterial: AppConfig.materials.find(
      ({ name }) => name === "Metallic",
    ),
    selectedCubemap: AppConfig.cubemaps[0],
    lightsOn: true,
    rotationOn: false,
    rgbGradientOn: false,
    userCameraLuminosity: 1.5,
    currentStep: "modelSelection",
    sceneLoadingState: "Loading...",
  });
  /** @private @type {[string[], () => void][]} */
  subscribers = [];

  /**
   * Should only be called from CarConfiguratorActions, not any of the Views!
   * @param {Partial<CarConfiguratorState>} value
   */
  setState(value) {
    const oldState = this.internalState;
    this.internalState = deepFreezeObject({
      ...oldState,
      ...value,
    });
    const changedKeys = Object.keys(this.internalState).filter(
      (key) => this.internalState[key] !== oldState[key],
    );

    // notify subscribers
    for (const [watchedKeys, handler] of this.subscribers) {
      if (changedKeys.some((key) => watchedKeys.includes(key))) {
        handler();
      }
    }
  }

  get state() {
    return this.internalState;
  }

  set state(value) {
    throw new Error("Cannot write state directly.");
  }

  /**
   * @param {(keyof CarConfiguratorState)[]} watchedKeys
   * @param {() => void} handler
   */
  subscribe(watchedKeys, handler) {
    this.subscribers.push([watchedKeys, handler]);
  }
})();

function getAssetEditorAPIForMaterial(materialUUID, callback) {
  const api = new AssetEditorAPI(getUserToken(), callback);
  api
    .connect("material", materialUUID)
    .then(({ description }) => callback("assetUpdated", description));
  return api;
}

const CarConfiguratorActions = new (class CarConfiguratorActions {
  /**
   * The visible entities container entity is where we put
   * car parts and other entities to show
   * @type {object | null}
   */
  visibleEntitiesContainer = null;
  /**
   * We pre-instantiate entities in hidden entities
   * so we can show them later by moving them to
   * visible entities. hidden entities is technically
   * visible but it is moved far away from the camera
   * so we never see it.
   * @type {object | null}
   */
  hiddenEntitiesContainer = null;
  /** @private @type {object | null} */
  bodyEntity = null;
  /**
   * @private
   * @type {{
   *   frontBumpers: object | null;
   *   rearBumpers: object | null;
   *   spoilers: object | null;
   * }}
   */
  carPartEntities = {
    frontBumpers: null,
    rearBumpers: null,
    spoilers: null,
  };
  /** @private @type {object | null} */
  environmentEntity = null;
  /** @private @type {object | null} */
  gradientPlatformEntity = null;
  /** @private @type {object | null} */
  isAnimationActiveTokenEntity = null;
  /** @type {Record<string, object>} */
  cachedMaterialAssetDescriptions = {};
  /** @type {AssetEditorAPI[]} */
  headlightAssetEditors = [];
  /** @type {AssetEditorAPI[]} */
  rearlightAssetEditors = [];
  /** @type {AssetEditorAPI[]} */
  paintAssetEditors = [];

  /**
   * @private
   * @param {object} entity
   */
  isEntityVisible(entity) {
    return entity.getParent().getID() === this.visibleEntitiesContainer.getID();
  }

  /**
   * @private
   * @param  {...object} updatedEntities
   */
  updateStateFromEntities = (...updatedEntities) => {
    /**
     * @typedef {Pick<
     *   CarConfiguratorState,
     *   | 'selectedCarIndex'
     *   | 'selectedParts'
     *   | 'selectedCubemap'
     *   | 'rgbGradientOn'
     *   | 'rotationOn'
     * >} StateSyncableFromEntities
     */

    // We might receive several entity updates in series,
    // so in order to not undo optimistic UI updates,
    // we should only update UI based on the entities
    // passed into the function.

    /** @type {(keyof StateSyncableFromEntities)[]} */
    let updatedKeys = [];
    if (updatedEntities.length === 0) {
      // In this case we're doing the initial sync so we update everything.
      updatedKeys = /** @type {typeof updatedKeys} */ (
        Object.keys(CarConfiguratorStore.state)
      );
    } else {
      const carPartEntitiesList = Object.values(this.carPartEntities);
      for (const entity of updatedEntities) {
        if (entity === this.bodyEntity) {
          updatedKeys.push("selectedCarIndex");
        }
        if (carPartEntitiesList.includes(entity)) {
          updatedKeys.push("selectedParts");
        }
        if (entity === this.environmentEntity) {
          updatedKeys.push("selectedCubemap");
        }
        if (entity === this.isAnimationActiveTokenEntity) {
          updatedKeys.push("rotationOn");
        }
        if (entity === this.gradientPlatformEntity) {
          updatedKeys.push("rgbGradientOn");
        }
      }
    }

    /** @type {Partial<StateSyncableFromEntities>} */
    const newState = {};

    if (updatedKeys.includes("selectedCarIndex")) {
      newState.selectedCarIndex = AppConfig.cars.findIndex(({ sceneUUID }) => {
        return this.bodyEntity.getComponent("scene_ref").value === sceneUUID;
      });
    }
    if (updatedKeys.includes("selectedParts")) {
      // if visibility on a car part is updated before its respective car body,
      // we will go ahead and update the index respective to the correct car.
      const selectedParts = /** @type {CarConfiguratorState['selectedParts']} */ ({});
      for (const [key, entity] of Object.entries(this.carPartEntities)) {
        const partSceneUUID = entity.getComponent("scene_ref").value;
        selectedParts[key] = Math.max(
          ...AppConfig.cars.map(({ frontBumpers }) =>
            frontBumpers.findIndex((id) => partSceneUUID === id),
          ),
          0,
        );
      }
      // only update object in state if the values are different (to avoid
      // triggering unnecessary re-render).
      /** @type {CarConfiguratorState['selectedParts']} */
      if (
        Object.entries(CarConfiguratorStore.state.selectedParts).some(
          ([key, index]) => selectedParts[key] !== index,
        )
      ) {
        newState.selectedParts = selectedParts;
      }
    }
    if (updatedKeys.includes("selectedCubemap")) {
      newState.selectedCubemap = AppConfig.cubemaps.find(({ skyboxUUID }) => {
        return (
          this.environmentEntity.getComponent("environment").skyboxUUID ===
          skyboxUUID
        );
      });
    }
    if (updatedKeys.includes("rotationOn")) {
      newState.rotationOn = this.isEntityVisible(
        this.isAnimationActiveTokenEntity,
      );
    }
    if (updatedKeys.includes("rgbGradientOn")) {
      newState.rgbGradientOn = this.isEntityVisible(
        this.gradientPlatformEntity,
      );
    }

    CarConfiguratorStore.setState(newState);
  };

  /**
   * @private
   * @param {string} [changedMaterialUUID]
   */
  updateStateFromMaterials = (changedMaterialUUID) => {
    const { selectedCarIndex } = CarConfiguratorStore.state;
    const selectedCar = AppConfig.cars[selectedCarIndex];

    /**
     * @typedef {Pick<
     *   CarConfiguratorState,
     *   | 'selectedColor'
     *   | 'selectedMaterial'
     *   | 'lightsOn'
     * >} StateSyncableFromMaterials
     */

    /** @type {Partial<StateSyncableFromMaterials>} */
    const newState = {};

    if (
      !changedMaterialUUID ||
      changedMaterialUUID === selectedCar.paintMaterialUUID
    ) {
      const carPaintDataJson =
        this.cachedMaterialAssetDescriptions[selectedCar.paintMaterialUUID]
          .dataJson;
      newState.selectedColor =
        AppConfig.colorChoices.find((color) => {
          return (
            // albedo might be empty, defaults to 1,1,1,
            // although if our scene is properly configured
            // this should never happen.
            (carPaintDataJson.albedo || [1, 1, 1]).every(
              (v, i) => color[i] === v,
            )
          );
        }) ||
        // we shouldn't need to fall back but in case we changed the color
        // in the scene to something we don't recognize, we want to store it
        // so that this color is used when we switch cars or parts.
        carPaintDataJson.albedo;
      newState.selectedMaterial = AppConfig.materials.find(({ matUUID }) => {
        const sourceMaterialDataJson =
          this.cachedMaterialAssetDescriptions[matUUID].dataJson;
        const { clearCoatRoughness, clearCoatStrength } = carPaintDataJson;
        return (
          sourceMaterialDataJson.clearCoatRoughness === clearCoatRoughness &&
          sourceMaterialDataJson.clearCoatStrength === clearCoatStrength
        );
      });
    }

    if (
      !changedMaterialUUID ||
      changedMaterialUUID === selectedCar.headLightsMatUUID
    ) {
      newState.lightsOn =
        this.cachedMaterialAssetDescriptions[selectedCar.headLightsMatUUID]
          .dataJson.emissionIntensity > 0;
    }

    CarConfiguratorStore.setState(newState);
  };

  /** @private */
  applySelectedCar() {
    const selectedCar =
      AppConfig.cars[CarConfiguratorStore.state.selectedCarIndex];
    this.applySelectedMaterial();
    this.bodyEntity.setComponent("scene_ref", { value: selectedCar.sceneUUID });
    for (const [key, entity] of Object.entries(this.carPartEntities)) {
      entity.setComponent("scene_ref", {
        value: selectedCar[key][0] || INVALID_UUID,
      });
    }
    SDK3DVerse.engineAPI.propagateChanges();
  }

  /** @private */
  applySelectedMaterial() {
    const { selectedMaterial, selectedColor } = CarConfiguratorStore.state;
    const desc = this.cachedMaterialAssetDescriptions[selectedMaterial.matUUID];
    desc.dataJson.albedo = selectedColor;
    AppConfig.cars.forEach((_, i) => {
      this.paintAssetEditors[i].updateAsset(desc);
    });
  }

  /** @private */
  applySelectedPart() {
    const { selectedPartCategory, selectedParts, selectedCarIndex } =
      CarConfiguratorStore.state;
    const selectedPartIndex = selectedParts[selectedPartCategory];
    this.carPartEntities[selectedPartCategory].setComponent("scene_ref", {
      value:
        AppConfig.cars[selectedCarIndex][selectedPartCategory][
          selectedPartIndex
        ] || INVALID_UUID,
    });
    SDK3DVerse.engineAPI.propagateChanges();
  }

  /** @private */
  applyLightsSetting() {
    const { lightsOn } = CarConfiguratorStore.state;

    const intensity = lightsOn ? 100 : 0;

    AppConfig.cars.forEach(({ headLightsMatUUID, rearLightsMatUUID }, i) => {
      const desc1 = this.cachedMaterialAssetDescriptions[headLightsMatUUID];
      desc1.dataJson.emissionIntensity = intensity;
      this.headlightAssetEditors[i].updateAsset(desc1);

      const desc2 = this.cachedMaterialAssetDescriptions[rearLightsMatUUID];
      desc2.dataJson.emissionIntensity = intensity;
      this.rearlightAssetEditors[i].updateAsset(desc2);
    });
  }

  async fetchSceneEntities() {
    const [
      visibleEntitiesContainer,
      hiddenEntitiesContainer,
      bodyEntity,
      frontBumperEntity,
      rearBumperEntity,
      spoilerEntity,
    ] = await SDK3DVerse.engineAPI.findEntitiesByNames(
      AppConfig.visibleEntitiesContainerName,
      AppConfig.hiddenEntitiesContainerName,
      AppConfig.sceneRefEntityNames.body,
      AppConfig.sceneRefEntityNames.frontBumpers,
      AppConfig.sceneRefEntityNames.rearBumpers,
      AppConfig.sceneRefEntityNames.spoilers,
    );
    Object.assign(this, {
      visibleEntitiesContainer,
      hiddenEntitiesContainer,
      bodyEntity,
    });
    this.carPartEntities.frontBumpers = frontBumperEntity;
    this.carPartEntities.rearBumpers = rearBumperEntity;
    this.carPartEntities.spoilers = spoilerEntity;

    this.environmentEntity = await SDK3DVerse.engineAPI
      .findEntitiesByNames("Env")
      .then(([entity]) => entity);

    this.gradientPlatformEntity = await SDK3DVerse.engineAPI
      .findEntitiesByNames("SM_StaticPlatform")
      .then(([entity]) => entity);

    this.isAnimationActiveTokenEntity = await SDK3DVerse.engineAPI
      .findEntitiesByNames("isAnimationActiveToken")
      .then(([entity]) => entity);

    this.updateStateFromEntities();
    SDK3DVerse.notifier.on("onEntitiesUpdated", this.updateStateFromEntities);
    SDK3DVerse.notifier.on(
      "onEntityVisibilityChanged",
      this.updateStateFromEntities,
    );
    SDK3DVerse.notifier.on("onEntityReparent", this.updateStateFromEntities);
  }

  async cacheMaterials() {
    await Promise.all(
      [
        ...AppConfig.cars
          .map(
            ({ headLightsMatUUID, rearLightsMatUUID, paintMaterialUUID }) => {
              return [headLightsMatUUID, rearLightsMatUUID, paintMaterialUUID];
            },
          )
          .flat(),
        ...AppConfig.materials.map(({ matUUID }) => matUUID),
      ].map(async (materialUUID) => {
        const desc = await getAssetDescription("materials", materialUUID);
        this.cachedMaterialAssetDescriptions[materialUUID] = desc;
      }),
    );

    this.headlightAssetEditors = AppConfig.cars.map(({ headLightsMatUUID }) => {
      return getAssetEditorAPIForMaterial(headLightsMatUUID, (event, desc) => {
        if (event !== "assetUpdated") return;
        this.cachedMaterialAssetDescriptions[headLightsMatUUID] = desc;
        this.updateStateFromMaterials(headLightsMatUUID);
      });
    });
    this.rearlightAssetEditors = AppConfig.cars.map(({ rearLightsMatUUID }) => {
      return getAssetEditorAPIForMaterial(rearLightsMatUUID, (event, desc) => {
        if (event !== "assetUpdated") return;
        this.cachedMaterialAssetDescriptions[rearLightsMatUUID] = desc;
        this.updateStateFromMaterials(rearLightsMatUUID);
      });
    });
    this.paintAssetEditors = AppConfig.cars.map(({ paintMaterialUUID }) => {
      return getAssetEditorAPIForMaterial(paintMaterialUUID, (event, desc) => {
        if (event !== "assetUpdated") return;
        this.cachedMaterialAssetDescriptions[paintMaterialUUID] = desc;
        this.updateStateFromMaterials(paintMaterialUUID);
      });
    });
  }

  /**
   * @param {number} selectedCarIndex
   */
  changeCar(selectedCarIndex) {
    CarConfiguratorStore.setState({
      selectedCarIndex,
      selectedParts: { frontBumpers: 0, rearBumpers: 0, spoilers: 0 },
      selectedPartCategory: "frontBumpers",
    });
    this.applySelectedCar();
  }

  /**
   * @param {[number, number, number]} selectedColor
   */
  changeSelectedColor(selectedColor) {
    CarConfiguratorStore.setState({ selectedColor });
    this.applySelectedMaterial();
  }

  /**
   * @param {number} matIndex
   */
  changeSelectedMaterial(matIndex) {
    CarConfiguratorStore.setState({
      selectedMaterial: AppConfig.materials[matIndex],
    });
    this.applySelectedMaterial();
  }

  /**
   * @param {CarConfiguratorState['selectedPartCategory']} selectedPartCategory
   */
  changeSelectedPartCategory(selectedPartCategory) {
    CarConfiguratorStore.setState({ selectedPartCategory });
  }

  /**
   * @param {number} partIndex
   */
  changeSelectedPart(partIndex) {
    const { selectedParts, selectedPartCategory } = CarConfiguratorStore.state;
    CarConfiguratorStore.setState({
      selectedParts: {
        ...selectedParts,
        [selectedPartCategory]: partIndex,
      },
    });
    this.applySelectedPart();
  }

  /**
   * @param {number} cubemapIndex
   */
  changeCubemap(cubemapIndex) {
    CarConfiguratorStore.setState({
      selectedCubemap: AppConfig.cubemaps[cubemapIndex],
    });
    const { skyboxUUID, radianceUUID, irradianceUUID } =
      CarConfiguratorStore.state.selectedCubemap;
    this.environmentEntity.setComponent("environment", {
      skyboxUUID,
      radianceUUID,
      irradianceUUID,
    });
    SDK3DVerse.engineAPI.propagateChanges();
  }

  toggleLightsOn() {
    CarConfiguratorStore.setState({
      lightsOn: !CarConfiguratorStore.state.lightsOn,
    });
    this.applyLightsSetting();
  }

  toggleRotationOn() {
    CarConfiguratorStore.setState({
      rotationOn: !CarConfiguratorStore.state.rotationOn,
    });
    const event = CarConfiguratorStore.state.rotationOn
      ? "start_simulation"
      : "pause_simulation";
    SDK3DVerse.engineAPI.fireEvent(INVALID_UUID, event);

    // We are going to use a blank entity in the scene to track the
    // rotation state until we have a way to query animation state
    reparentEntities(
      [this.isAnimationActiveTokenEntity],
      CarConfiguratorStore.state.rotationOn
        ? this.visibleEntitiesContainer
        : this.hiddenEntitiesContainer,
    );
  }

  async toggleRgbGradientOn() {
    CarConfiguratorStore.setState({
      rgbGradientOn: !CarConfiguratorStore.state.rgbGradientOn,
    });
    if (CarConfiguratorStore.state.rgbGradientOn) {
      await reparentEntities(
        [this.gradientPlatformEntity],
        this.visibleEntitiesContainer,
      );
    } else {
      await reparentEntities(
        [this.gradientPlatformEntity],
        this.hiddenEntitiesContainer,
      );
    }
  }

  /**
   * @param {number} userCameraLuminosity
   */
  changeUserCameraLuminosity(userCameraLuminosity) {
    CarConfiguratorStore.setState({ userCameraLuminosity });
    setCameraSettings({
      brightness: CarConfiguratorStore.state.userCameraLuminosity,
    });
  }

  /**
   * @param {CarConfiguratorState['currentStep']} currentStep
   */
  changeCurrentStep(currentStep) {
    CarConfiguratorStore.setState({ currentStep });
    setCameraSettings({
      displayBackground: CarConfiguratorStore.state.currentStep === "review",
    });
  }

  /**
   * @param {string | null} sceneLoadingState
   */
  setSceneLoadingState(sceneLoadingState) {
    CarConfiguratorStore.setState({ sceneLoadingState });
  }
})();

/** @global */
const CarSelectionView = new (class CarSelectionView {
  template = Handlebars.compile(
    document.getElementById("model-selection-template").innerHTML,
  );

  constructor() {
    this.render();
    this.updateVisibility();
    CarConfiguratorStore.subscribe(["selectedCarIndex"], this.render);
    CarConfiguratorStore.subscribe(["currentStep"], this.updateVisibility);
  }

  /** @private */
  updateVisibility = () => {
    document
      .getElementById("model-selection")
      .classList.toggle(
        "hidden",
        CarConfiguratorStore.state.currentStep !== "modelSelection",
      );
  };

  /** @private */
  render = () => {
    const selectedCar =
      AppConfig.cars[CarConfiguratorStore.state.selectedCarIndex];
    var [firstWord, ...otherWords] = selectedCar.name.split(" ");
    document.getElementById("model-selection").innerHTML = this.template({
      arrows: [{ direction: "left" }, { direction: "right" }],
      firstWord,
      afterFirstWord: otherWords.join(" "),
      description: selectedCar.description,
      stats: [
        { label: "Maximum Speed", unit: "KPH", value: selectedCar.maxSpeed },
        { label: "0-100kph", unit: "S", value: selectedCar.acceleration },
        { label: "Maximum Power", unit: "PS", value: selectedCar.maximumPower },
        {
          label: "Maximum Torque",
          unit: "NM",
          value: selectedCar.maximumTorque,
        },
        {
          label: "Engine Capacity",
          unit: "CC",
          value: selectedCar.engineCapacity,
        },
      ],
    });
  };

  // UI EVENT HANDLERS:

  handleNextCar() {
    const { selectedCarIndex } = CarConfiguratorStore.state;
    CarConfiguratorActions.changeCar(
      (selectedCarIndex + 1) % AppConfig.cars.length,
    );
  }

  handlePreviousCar() {
    const { selectedCarIndex } = CarConfiguratorStore.state;
    CarConfiguratorActions.changeCar(
      selectedCarIndex === 0 ? AppConfig.cars.length - 1 : selectedCarIndex - 1,
    );
  }
})();

/** @global */
const CarPartsView = new (class CarPartsView {
  /** @private */
  template = Handlebars.compile(
    document.getElementById("car-parts-template").innerHTML,
  );

  constructor() {
    this.render();
    this.updateVisibility();
    CarConfiguratorStore.subscribe(
      ["selectedPartCategory", "selectedParts", "selectedCarIndex"],
      this.render,
    );
    CarConfiguratorStore.subscribe(["currentStep"], this.updateVisibility);
  }

  /** @private */
  updateVisibility = () => {
    document
      .getElementById("car-parts")
      .classList.toggle(
        "hidden",
        CarConfiguratorStore.state.currentStep !== "customization",
      );
  };

  /** @private */
  render = () => {
    const { selectedPartCategory, selectedParts, selectedCarIndex } =
      CarConfiguratorStore.state;

    const selectedPartIndex = selectedParts[selectedPartCategory];

    document.getElementById("car-parts").innerHTML = this.template({
      availableCategories: Object.keys(PARTS_CATEGORY_MAPPING)
        .filter((category) => AppConfig.cars[selectedCarIndex][category].length)
        .map((name) => ({
          name,
          displayName: PARTS_CATEGORY_MAPPING[name],
          isSelected: selectedPartCategory === name,
        })),
      selectedCategoryData: AppConfig.cars[selectedCarIndex][
        selectedPartCategory
      ].map((_, i) => ({
        displayName: `${PARTS_CATEGORY_MAPPING[selectedPartCategory]} ${i + 1}`,
        isSelected: selectedPartIndex === i,
      })),
    });
  };

  // UI EVENT HANDLERS:

  /**
   *
   * @param {CarConfiguratorState['selectedPartCategory']} category
   */
  handleChangeSelectedPartCategory = (category) => {
    CarConfiguratorActions.changeSelectedPartCategory(category);
  };

  /**
   * @param {number} index
   */
  handleChangeSelectedPart = (index) => {
    CarConfiguratorActions.changeSelectedPart(index);
  };
})();

/** @global */
const CarColorsView = new (class CarColorsView {
  template = Handlebars.compile(
    document.getElementById("color-selection-template").innerHTML,
  );
  cssToSdkColorChoicesMap = AppConfig.colorChoices.reduce(
    (colorsMap, sdkColor) => {
      const cssColorString = `rgb(${sdkColor
        .map((value) => Math.round(value * 255))
        .join(",")})`;
      return colorsMap.set(cssColorString, sdkColor);
    },
    /** @type {Map<string, [number, number, number]>} */ (new Map()),
  );

  constructor() {
    this.render();
    this.updateVisibility();
    CarConfiguratorStore.subscribe(["selectedColor"], this.render);
    CarConfiguratorStore.subscribe(["currentStep"], this.updateVisibility);
  }

  /** @private */
  updateVisibility = () => {
    document
      .getElementById("color-selection")
      .classList.toggle(
        "hidden",
        CarConfiguratorStore.state.currentStep !== "customization",
      );
  };

  /** @private */
  render = () => {
    const { selectedColor } = CarConfiguratorStore.state;
    document.getElementById("color-selection").innerHTML = this.template({
      colors: [...this.cssToSdkColorChoicesMap.entries()].map(
        ([cssColor, sdkColor]) => ({
          cssColor,
          isActive: sdkColor === selectedColor,
        }),
      ),
    });
  };

  // UI EVENT HANDLERS:

  /**
   * @param {string} cssColor
   */
  handleChangeSelectedColor(cssColor) {
    CarConfiguratorActions.changeSelectedColor(
      this.cssToSdkColorChoicesMap.get(cssColor),
    );
  }
})();

const CarMaterialsView = new (class CarMaterialsView {
  constructor() {
    this.render();
    this.updateVisibility();
    CarConfiguratorStore.subscribe(["selectedMaterial"], this.render);
    CarConfiguratorStore.subscribe(["currentStep"], this.updateVisibility);
  }

  /** @private */
  updateVisibility = () => {
    document
      .getElementById("materials-selection")
      .classList.toggle(
        "hidden",
        CarConfiguratorStore.state.currentStep !== "customization",
      );
  };

  /** @private */
  render = () => {
    const { selectedMaterial } = CarConfiguratorStore.state;
    document.querySelectorAll(".material-icon").forEach((icon, i) => {
      icon.classList.toggle(
        "active-material",
        AppConfig.materials.indexOf(selectedMaterial) === i,
      );
    });
  };

  // UI EVENT HANDLERS:

  /**
   * @param {number} materialIndex
   */
  handleChangeSelectedMaterial(materialIndex) {
    CarConfiguratorActions.changeSelectedMaterial(materialIndex);
  }
})();

/** @global */
const CarBackgroundView = new (class CarBackgroundView {
  template = Handlebars.compile(
    document.getElementById("cubemap-selection-template").innerHTML,
  );

  constructor() {
    this.initialRender();
    this.updateVisibility();
    CarConfiguratorStore.subscribe(["selectedCubemap"], this.updateRender);
    CarConfiguratorStore.subscribe(["currentStep"], this.updateVisibility);
  }

  /** @private */
  initialRender() {
    document.getElementById("cubemap-selection").innerHTML = this.template({
      cubemaps: AppConfig.cubemaps.map((cubemap) => ({
        displayName: cubemap.name,
        previewSrc: cubemap.previewSrc,
      })),
    });
    this.updateRender();
  }

  /** @private */
  updateVisibility = () => {
    document
      .getElementById("cubemap-selection")
      .classList.toggle(
        "hidden",
        CarConfiguratorStore.state.currentStep !== "review",
      );
  };

  /** @private */
  updateRender = () => {
    const { selectedCubemap } = CarConfiguratorStore.state;
    document.querySelectorAll(".cubemap").forEach((cubemap, i) => {
      cubemap.classList.toggle(
        "active-cubemap",
        AppConfig.cubemaps.indexOf(selectedCubemap) === i,
      );
    });
  };

  // UI EVENT HANDLERS:

  /**
   * @param {number} cubemapIndex
   */
  handleChangeCubemap(cubemapIndex) {
    CarConfiguratorActions.changeCubemap(cubemapIndex);
  }
})();

/** @global */
const CarConfigStepperView = new (class CarConfigStepperView {
  template = Handlebars.compile(
    document.getElementById("stepper-buttons-template").innerHTML,
  );

  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(
      ["currentStep", "selectedCarIndex"],
      this.render,
    );
  }

  /** @private */
  render = () => {
    const { currentStep, selectedCarIndex } = CarConfiguratorStore.state;
    const selectedCar = AppConfig.cars[selectedCarIndex];

    /** @type {typeof currentStep} */
    const prevStep =
      currentStep === "modelSelection"
        ? null
        : currentStep === "customization"
        ? "modelSelection"
        : "customization";
    /** @type {typeof currentStep} */
    const nextStep =
      currentStep === "modelSelection"
        ? "customization"
        : currentStep === "customization"
        ? "review"
        : null;
    const nextStepName =
      nextStep === "customization"
        ? "Customize"
        : nextStep === "review"
        ? "Confirm & Review"
        : null;
    const carPrice = selectedCar.price;

    document.getElementById("stepper-buttons").innerHTML = this.template({
      prevStep,
      nextStep,
      nextStepName,
      carPrice,
    });
  };

  /**
   * @param {CarConfiguratorState['currentStep']} currentStep
   */
  handleChangeCurrentStep(currentStep) {
    CarConfiguratorActions.changeCurrentStep(currentStep);
  }
})();

/** @global */
const CarOptionsBarView = new (class CarOptionsBarView {
  isSettingsPanelOpen = false;

  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(
      ["lightsOn", "rotationOn", "rgbGradientOn", "userCameraLuminosity"],
      this.render,
    );
    window.addEventListener("click", (e) => {
      const settingsToggle = document.getElementById("settings-toggle");
      const settingsPanel = document.getElementById("settings-panel");
      if (
        !settingsToggle.contains(/** @type {Node} */ (e.target)) &&
        !settingsPanel.contains(/** @type {Node} */ (e.target))
      ) {
        this.isSettingsPanelOpen = false;
        this.render();
      }
    });
  }

  /** @private */
  render = () => {
    document
      .getElementById("light-toggle")
      .classList.toggle("active", CarConfiguratorStore.state.lightsOn);

    document
      .getElementById("rotate-toggle")
      .classList.toggle("active", CarConfiguratorStore.state.rotationOn);

    document
      .getElementById("settings-toggle")
      .classList.toggle("active", this.isSettingsPanelOpen);

    document
      .getElementById("settings-panel")
      .classList.toggle("hidden", !this.isSettingsPanelOpen);

    /** @type {HTMLInputElement} */ (
      document.getElementById("rgb-gradient")
    ).checked = CarConfiguratorStore.state.rgbGradientOn;

    const luminosityValue =
      CarConfiguratorStore.state.userCameraLuminosity.toString();
    document.getElementById("luminosity-value").innerHTML = luminosityValue;
    /** @type {HTMLInputElement} */ (
      document.getElementById("luminosity-slider")
    ).value = luminosityValue;
  };

  // UI EVENT HANDLERS:

  handleToggleSettingsPanel() {
    this.isSettingsPanelOpen = !this.isSettingsPanelOpen;
    this.render();
  }

  handleToggleLightsOn() {
    CarConfiguratorActions.toggleLightsOn();
  }

  handleToggleRotationOn() {
    CarConfiguratorActions.toggleRotationOn();
  }

  handleToggleRgbGradientOn() {
    CarConfiguratorActions.toggleRgbGradientOn();
  }

  /**
   * @param {{ target: HTMLInputElement }} e
   */
  handleChangeUserCameraLuminosity(e) {
    const luminosity = Number(e.target.value);
    CarConfiguratorActions.changeUserCameraLuminosity(luminosity);
  }
})();

/** @global */
const CarSceneLoadingView = new (class CarSceneLoadingView {
  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(["sceneLoadingState"], this.render);
  }

  /** @private */
  render = () => {
    const { sceneLoadingState } = CarConfiguratorStore.state;

    const loader = document.getElementById("loader");
    loader.classList.toggle("hidden", !sceneLoadingState);
    loader.classList.toggle(
      "opacity-0",
      sceneLoadingState === "Loading complete.",
    );

    document.getElementById("info_span").innerHTML = sceneLoadingState || "";
  };
})();

// Expose views as globals so their public
// methods can be used as UI event handlers
Object.assign(window, {
  CarSelectionView,
  CarPartsView,
  CarColorsView,
  CarMaterialsView,
  CarBackgroundView,
  CarConfigStepperView,
  CarOptionsBarView,
  CarSceneLoadingView,
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
