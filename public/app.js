import AppConfig from "./AppConfig.js";
import { userToken } from "./secrets.js";

// Include external library definitions to help with autocompletion
/// <reference path="./vendor/handlebars.d.ts" />

// TODO: get rid of this and use real types
const SDK3DVerse = /** @type {typeof window & { SDK3DVerse: any }} */ (window)
  .SDK3DVerse;

//--------------------------------------------------------------------------------------------------
window.addEventListener("load", initApp);

const PARTS_CATEGORY_MAPPING = {
  frontBumpers: "Front Bumper",
  rearBumpers: "Rear Bumper",
  spoilers: "Spoiler",
};

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
  SDK3DVerse.setApiVersion("v1");
  SDK3DVerse.webAPI.setUserToken(userToken);

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
      onCameraCreation: () => onMediaQueryChange(mediaQuery),
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
  const connectionInfo = await SDK3DVerse.webAPI.createSession(
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

  // these are the right bloom settings to emphasize
  // the emission of the car headlights
  setCameraSettings({
    bloom: true,
    bloomStrength: 1,
    bloomThreshold: 50,
  });

  CarConfiguratorActions.setSceneLoadingState("Analyzing scene objects...");
  await CarConfiguratorActions.fetchSceneEntities();

  CarConfiguratorActions.setSceneLoadingState("Caching materials...");
  await CarConfiguratorActions.cacheMaterials();

  CarConfiguratorActions.setSceneLoadingState("Loading complete.");
  setTimeout(() => CarConfiguratorActions.setSceneLoadingState(null), 500);
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
 * @param {Record<string, any>} settings
 */
function setCameraSettings(settings) {
  const cameraAPI = SDK3DVerse.engineAPI.cameraAPI;
  const viewport =
    cameraAPI.currentViewportEnabled || cameraAPI.getActiveViewports()[0];
  const camera = viewport.getCamera();
  const cameraComponent = camera.getComponent("camera");
  Object.assign(cameraComponent.dataJSON, settings);
  camera.setComponent("camera", cameraComponent);
  SDK3DVerse.engineAPI.propagateChanges();
}

/**
 * @param {string} assetType
 * @param {string} assetUUID
 * @returns
 */
async function getAssetDescription(assetType, assetUUID) {
  const res = await fetch(
    `https://api.3dverse.com/app/v1/assets/${assetType}/${assetUUID}/description`,
    {
      headers: {
        User_token: userToken,
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

const CarConfiguratorStore = new (class CarConfiguratorStore {
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

  constructor() {
    // TODO: find way to initialize scene graph based on default settings
    // (or just hardcode those default settings in scene graph). For example
    // there is no color by default.
    // TODO: asynchronously initialize state from current scene graph
    // TODO: update state when receiving scene graph updates from 3dverse
  }

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

const CarConfiguratorActions = new (class CarConfiguratorActions {
  /**
   * The VISIBLE_ENTITIES container entity is where we put
   * car parts and other entities to show
   * @type {object | null}
   */
  visibleEntitiesContainer = null;
  /**
   * We pre-instantiate entities in HIDDEN_ENTITIES
   * so we can show them later by moving them to
   * VISIBLE_ENTITIES. HIDDEN_ENTITIES is technically
   * visible but it is moved far away from the camera
   * so we never see it.
   * @type {object | null}
   */
  hiddenEntitiesContainer = null;
  /**
   * @private
   * @type {{
   *   body: object;
   *   frontBumpers: object[];
   *   rearBumpers: object[];
   *   spoilers: object[];
   * }[]}
   */
  allCarPartEntities = [];
  /**
   * @private
   * @type {{
   *   body: object | null;
   *   frontBumpers: object | null;
   *   rearBumpers: object | null;
   *   spoilers: object | null;
   * }}
   */
  selectedCarPartEntities = {
    body: null,
    frontBumpers: null,
    rearBumpers: null,
    spoilers: null,
  };
  /** @private @type {object | null} */
  environmentEntity = null;
  /** @type {Record<string, object>} */
  cachedMaterialAssetDescriptions = {};

  constructor() {
    // TODO: find way to initialize scene graph based on default settings
    // (or just hardcode those default settings in scene graph). For example
    // there is no color by default.
    // TODO: asynchronously initialize state from current scene graph
    // TODO: update state when receiving scene graph updates from 3dverse
  }

  /**
   * @private
   * @param {Partial<typeof this.selectedCarPartEntities>} parts
   */
  async changeParts(parts) {
    const partsEntries = Object.entries(parts);

    // we will move multiple entities and we want this to
    // happen all at once in the renderer.
    await SDK3DVerse.engineAPI.batchOperations(
      "swap-entities",
      partsEntries
        .map(([category, newPartEntity]) => {
          return [
            async () => {
              // hide previous part for category
              if (this.selectedCarPartEntities[category]) {
                await reparentEntities(
                  [this.selectedCarPartEntities[category]],
                  this.hiddenEntitiesContainer,
                );
              }
            },
            async () => {
              // make chosen part visible
              if (newPartEntity) {
                await reparentEntities(
                  [newPartEntity],
                  this.visibleEntitiesContainer,
                );
              }
            },
          ];
        })
        .flat(),
    );

    for (const [category, newPartEntity] of partsEntries) {
      this.selectedCarPartEntities[category] = newPartEntity || null;
    }
  }

  /** @private */
  async applySelectedCar() {
    const allPartsForSelectedCar =
      this.allCarPartEntities[CarConfiguratorStore.state.selectedCarIndex];

    await this.changeParts({
      body: allPartsForSelectedCar.body,
      frontBumpers: allPartsForSelectedCar.frontBumpers[0] || null,
      rearBumpers: allPartsForSelectedCar.rearBumpers[0] || null,
      spoilers: allPartsForSelectedCar.spoilers[0] || null,
    });
  }

  /** @private */
  applySelectedMaterial() {
    const { selectedMaterial, selectedColor, selectedCarIndex } =
      CarConfiguratorStore.state;
    const desc = this.cachedMaterialAssetDescriptions[selectedMaterial.matUUID];
    desc.dataJson.albedo = selectedColor;
    SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
      AppConfig.cars[selectedCarIndex].paintMaterialUUID,
      desc,
    );
  }

  /** @private */
  async applySelectedPart() {
    const { selectedPartCategory, selectedParts, selectedCarIndex } =
      CarConfiguratorStore.state;
    const selectedPartIndex = selectedParts[selectedPartCategory];
    const partEntity =
      this.allCarPartEntities[selectedCarIndex][selectedPartCategory][
        selectedPartIndex
      ];
    await this.changeParts({ [selectedPartCategory]: partEntity });
  }

  /** @private */
  applyLightsSetting() {
    const { selectedCarIndex, lightsOn } = CarConfiguratorStore.state;
    const selectedCar = AppConfig.cars[selectedCarIndex];

    const intensity = lightsOn ? 100 : 0;

    const desc1 =
      this.cachedMaterialAssetDescriptions[selectedCar.headLightsMatUUID];
    desc1.dataJson.emissionIntensity = intensity;
    SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
      selectedCar.headLightsMatUUID,
      desc1,
    );

    const desc2 =
      this.cachedMaterialAssetDescriptions[selectedCar.rearLightsMatUUID];
    desc2.dataJson.emissionIntensity = intensity;
    SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
      selectedCar.rearLightsMatUUID,
      desc2,
    );
  }

  async fetchSceneEntities() {
    const [visibleEntitiesContainer, hiddenEntitiesContainer] =
      await SDK3DVerse.engineAPI.findEntitiesByNames(
        "VISIBLE_ENTITIES",
        "HIDDEN_ENTITIES",
      );
    Object.assign(this, {
      visibleEntitiesContainer,
      hiddenEntitiesContainer,
    });
    /**
     * @param {object} entity
     */
    const isEntityVisible = (entity) =>
      entity.getParent().getID() === this.visibleEntitiesContainer.getID();
    for (const {
      name,
      frontBumpers,
      rearBumpers,
      spoilers,
    } of AppConfig.cars) {
      const entitiesForCar = {
        body: null,
        frontBumpers: [],
        rearBumpers: [],
        spoilers: [],
      };

      await Promise.all([
        (async () => {
          const [body] = await SDK3DVerse.engineAPI.findEntitiesByNames(name);
          entitiesForCar.body = body;
          if (isEntityVisible(entitiesForCar.body)) {
            this.selectedCarPartEntities.body = entitiesForCar.body;
          }
        })(),
        (async () => {
          if (!frontBumpers.length) {
            return;
          }
          entitiesForCar.frontBumpers =
            await SDK3DVerse.engineAPI.findEntitiesByNames(...frontBumpers);
          for (const frontBumper of entitiesForCar.frontBumpers) {
            if (isEntityVisible(frontBumper)) {
              this.selectedCarPartEntities.frontBumpers = frontBumper;
              break;
            }
          }
        })(),
        (async () => {
          if (!rearBumpers.length) {
            return;
          }
          entitiesForCar.rearBumpers =
            await SDK3DVerse.engineAPI.findEntitiesByNames(...rearBumpers);
          for (const rearBumper of entitiesForCar.rearBumpers) {
            if (isEntityVisible(rearBumper)) {
              this.selectedCarPartEntities.rearBumpers = rearBumper;
              break;
            }
          }
        })(),
        (async () => {
          if (!spoilers.length) {
            return;
          }
          entitiesForCar.spoilers =
            await SDK3DVerse.engineAPI.findEntitiesByNames(...spoilers);
          for (const spoiler of entitiesForCar.spoilers) {
            if (isEntityVisible(spoiler)) {
              this.selectedCarPartEntities.spoilers = spoiler;
              break;
            }
          }
        })(),
      ]);

      this.allCarPartEntities.push(entitiesForCar);
    }

    this.environmentEntity = await SDK3DVerse.engineAPI
      .findEntitiesByNames("Env")
      .then(([entity]) => entity);

    // TODO: after fetching I need to initialize state from entities
  }

  async cacheMaterials() {
    await Promise.all(
      [
        ...AppConfig.cars
          .map(({ headLightsMatUUID, rearLightsMatUUID }) => {
            return [headLightsMatUUID, rearLightsMatUUID];
          })
          .flat(),
        ...AppConfig.materials.map(({ matUUID }) => matUUID),
      ].map(async (materialUUID) => {
        const desc = await getAssetDescription("materials", materialUUID);
        this.cachedMaterialAssetDescriptions[materialUUID] = desc;
      }),
    );
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
    SDK3DVerse.engineAPI.fireEvent(SDK3DVerse.utils.invalidUUID, event);
  }

  async toggleRgbGradientOn() {
    CarConfiguratorStore.setState({
      rgbGradientOn: !CarConfiguratorStore.state.rgbGradientOn,
    });
    const [gradientPlatform] = await SDK3DVerse.engineAPI.findEntitiesByNames(
      "SM_StaticPlatform",
    );
    if (CarConfiguratorStore.state.rgbGradientOn) {
      await reparentEntities([gradientPlatform], this.visibleEntitiesContainer);
    } else {
      await reparentEntities([gradientPlatform], this.hiddenEntitiesContainer);
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
      arrows: [
        { direction: "left", path: "M25 2L4 23.5L25 45" },
        { direction: "right", path: "M2 2L23 23.5L2 45" },
      ],
      selectedCar,
      firstWord,
      afterFirstWord: otherWords.join(" "),
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
    document.getElementById("luminosity-value").innerHTML =
      CarConfiguratorStore.state.userCameraLuminosity.toString();
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

SDK3DVerse.engineAPI.editorAPI.on("editor-error", (error) => {
  if (error.httpCode === 429) {
    // Tell user to stop spamming
    alert(`3dverse says: ${error.message}\n${JSON.stringify(error, null, 2)}`);
  }
});
