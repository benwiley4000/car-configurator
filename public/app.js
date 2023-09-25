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

// The VISIBLE_CART_PARTS entity is where we put
// car parts to show
let gVisibleCarParts = null;
// We pre-instantiate car parts in HIDDEN_CAR_PARTS
// so we can show them later by moving them to
// VISIBLE_CAR_PARTS. HIDDEN_CAR_PARTS is technically
// visible but it is moved far away from the camera
// so we never see it.
let gHiddenCarParts = null;

//--------------------------------------------------------------------------------------------------
async function initApp() {
  SDK3DVerse.setApiVersion("v1");
  SDK3DVerse.webAPI.setUserToken(userToken);

  window.addEventListener("contextmenu", (e) => e.preventDefault());

  // -------------- Media Query
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
  setResolution();
  let debounceResizeTimeout = null;
  window.addEventListener("resize", () => {
    if (debounceResizeTimeout) {
      clearTimeout(debounceResizeTimeout);
    }
    debounceResizeTimeout = setTimeout(() => {
      setResolution(false);
      debounceResizeTimeout = null;
    }, 100);
  });

  const sessionCreated = await connect();

  // these are the right bloom settings to emphasize
  // the emission of the car headlights
  setCameraSettings({
    bloom: true,
    bloomStrength: 1,
    bloomThreshold: 50,
  });

  await CarConfiguratorActions.fetchSceneEntities();
  // SDK3DVerse.updateControllerSetting({ rotation: 10 });
  // SDK3DVerse.updateControllerSetting({ speed: 1, sensitivity: 0.4 }); //reduce scroll speed
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

//--------------------------------------------------------------------------------------------------
function setResolution(showInfo = true) {
  const container = document.getElementById("container");
  const canvasSize = container.getBoundingClientRect();

  const largestDim = Math.max(canvasSize.width, canvasSize.height);
  const MAX_DIM = 1920;
  const scale = largestDim > MAX_DIM ? MAX_DIM / largestDim : 1;

  let w = Math.floor(canvasSize.width);
  let h = Math.floor(canvasSize.height);
  const aspectRatio = w / h;

  if (w > h) {
    // landscape
    w = Math.floor(aspectRatio * h);
  } else {
    // portrait
    h = Math.floor(w / aspectRatio);
  }
  SDK3DVerse.setResolution(w, h, scale);

  if (showInfo) {
    CarConfiguratorActions.setSceneLoadingState(
      `Setting resolution to ${w} x ${h} (scale=${scale})`,
    );
  }
}

//--------------------------------------------------------------------------------------------------
async function connect() {
  CarConfiguratorActions.setSceneLoadingState("Connecting to 3dverse...");

  const connectionInfo = await SDK3DVerse.webAPI.createSession(
    AppConfig.sceneUUID,
  );
  connectionInfo.useSSL = true;
  SDK3DVerse.setupDisplay(document.getElementById("display_canvas"));
  SDK3DVerse.startStreamer(connectionInfo);
  await SDK3DVerse.connectToEditor();
  CarConfiguratorActions.setSceneLoadingState(
    "Connection to 3dverse established...",
  );
  return true; //connectionInfo.sessionCreated;
}

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

//---------------------------------------------------------------------------
function onMediaQueryChange(e) {
  if (e.matches) {
    console.log("< 768px");
    changeCameraPosition(
      [-4.595289707183838, 1.6792974472045898, 8.23273754119873],
      [
        -0.08518092334270477, -0.2508307993412018, -0.02216341346502304,
        0.9640212059020996,
      ],
    );
    SDK3DVerse.updateControllerSetting({ speed: 1, sensitivity: 0.8 });
  } else {
    console.log("> 768px");
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
    selectedColor: [0, 0, 0],
    selectedMaterial: AppConfig.materials[0],
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
                  gHiddenCarParts,
                );
              }
            },
            async () => {
              // make chosen part visible
              if (newPartEntity) {
                await reparentEntities([newPartEntity], gVisibleCarParts);
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
  async applySelectedMaterial() {
    const { selectedMaterial, selectedColor, selectedCarIndex } =
      CarConfiguratorStore.state;
    const desc = await getAssetDescription(
      "materials",
      selectedMaterial.matUUID,
    );
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
  async applyLightsSetting() {
    const { selectedCarIndex, lightsOn } = CarConfiguratorStore.state;
    const selectedCar = AppConfig.cars[selectedCarIndex];

    const intensity = lightsOn ? 100 : 0;

    const desc1 = await getAssetDescription(
      "materials",
      selectedCar.headLightsMatUUID,
    );
    desc1.dataJson.emissionIntensity = intensity;
    SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
      selectedCar.headLightsMatUUID,
      desc1,
    );

    const desc2 = await getAssetDescription(
      "materials",
      selectedCar.rearLightsMatUUID,
    );
    desc2.dataJson.emissionIntensity = intensity;
    SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
      selectedCar.rearLightsMatUUID,
      desc2,
    );
  }

  async fetchSceneEntities() {
    [gVisibleCarParts, gHiddenCarParts] =
      await SDK3DVerse.engineAPI.findEntitiesByNames(
        "VISIBLE_CAR_PARTS",
        "HIDDEN_CAR_PARTS",
      );
    /**
     * @param {object} entity
     */
    const isEntityVisible = (entity) =>
      entity.getParent().getID() === gVisibleCarParts.getID();
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

    this.setSceneLoadingState("Loading complete");
    setTimeout(() => this.setSceneLoadingState(null), 500);
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
      await reparentEntities([gradientPlatform], gVisibleCarParts);
    } else {
      await reparentEntities([gradientPlatform], gHiddenCarParts);
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
  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(["selectedCarIndex"], this.render);
  }

  /** @private */
  render = () => {
    const carName = document.getElementById("car_name");
    const carDescription = document.getElementById("car_description");
    const carMaximumSpeed = document.getElementById("maximum-speed-number");
    const carAcceleration = document.getElementById("acceleration-number");
    const carMaximumPower = document.getElementById("maximum-power-number");
    const carMaximumTorque = document.getElementById("maximum-torque-number");
    const carEngineCapacity = document.getElementById("engine-capacity-number");
    const startingPrice = document.getElementById("starting-price");
    const startingPriceMobile = document.getElementById(
      "starting-price-mobile",
    );
    const finalPrice = document.getElementById("final-price");

    const selectedCar =
      AppConfig.cars[CarConfiguratorStore.state.selectedCarIndex];
    var [firstWord, ...otherWords] = selectedCar.name.split(" ");

    carName.innerHTML =
      "<span class=highlighted-word>".concat(firstWord, "</span>") +
      "&#32;" +
      otherWords.join(" ");
    carDescription.innerHTML = selectedCar.description;
    carMaximumSpeed.innerHTML = selectedCar.maxSpeed;
    carAcceleration.innerHTML = selectedCar.acceleration;
    carMaximumPower.innerHTML = selectedCar.maximumPower;
    carMaximumTorque.innerHTML = selectedCar.maximumTorque;
    carEngineCapacity.innerHTML = selectedCar.engineCapacity;
    startingPrice.innerHTML = selectedCar.price;
    startingPriceMobile.innerHTML = selectedCar.price;
    finalPrice.innerHTML = selectedCar.price;
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
    CarConfiguratorStore.subscribe(
      [
        "selectedPartCategory",
        "selectedParts",
        "selectedCarIndex",
        "currentStep",
      ],
      this.render,
    );
  }

  /** @private */
  render = () => {
    const carPartsElement = document.querySelector(".car-parts");

    const {
      selectedPartCategory,
      selectedParts,
      selectedCarIndex,
      currentStep,
    } = CarConfiguratorStore.state;

    if (currentStep !== "customization") {
      carPartsElement.classList.add("hidden");
      return;
    }

    carPartsElement.classList.remove("hidden");

    const selectedPartIndex = selectedParts[selectedPartCategory];

    carPartsElement.innerHTML = this.template({
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
  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(["selectedColor"], this.render);
  }

  /**
   * @private
   * @param {Element} colorElement
   * @returns {[number, number, number]}
   */
  getRgbForColorElement(colorElement) {
    const [r, g, b] = colorElement
      .getAttribute("data-color")
      .split(",")
      .map(Number);
    return [r, g, b];
  }

  /** @private */
  render = () => {
    const colors = document.querySelectorAll(".color");
    colors.forEach((color) => {
      const rgb = this.getRgbForColorElement(color);
      if (
        CarConfiguratorStore.state.selectedColor.every((v, i) => rgb[i] === v)
      ) {
        color.classList.add("active-color");
      } else {
        color.classList.remove("active-color");
      }
    });
  };

  // UI EVENT HANDLERS:

  handleChangeSelectedColor(e) {
    CarConfiguratorActions.changeSelectedColor(
      this.getRgbForColorElement(e.target),
    );
  }
})();

const CarMaterialsView = new (class CarMaterialsView {
  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(["selectedMaterial"], this.render);
  }

  /** @private */
  render = () => {
    const materialIcons = document.querySelectorAll(".material-icon");

    materialIcons.forEach((icon) => {
      icon.addEventListener("click", () => {
        materialIcons.forEach((icon) =>
          icon.classList.remove("active-material"),
        );
        icon.classList.add("active-material");
      });
    });
  };

  // UI EVENT HANDLERS:

  handleChangeSelectedMaterial(e) {
    const materialIndex = Number(e.target.getAttribute("data-material-index"));
    CarConfiguratorActions.changeSelectedMaterial(materialIndex);
  }
})();

/** @global */
const CarBackgroundView = new (class CarBackgroundView {
  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(["selectedCubemap"], this.render);
  }

  /** @private */
  render = () => {
    // this currently sets up cubemap state independent of the state
    // in code. we might want to change that.
    /** @type {NodeListOf<HTMLElement>} */
    const cubemaps = document.querySelectorAll(".cubemap");
    cubemaps.forEach((cubemap, i) => {
      cubemap.onclick = () => {
        this.handleChangeCubemap(i);
        cubemaps.forEach((cubemap) =>
          cubemap.classList.remove("active-cubemap"),
        );
        cubemap.classList.add("active-cubemap");
      };
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
  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(["currentStep"], this.render);
  }

  /** @private */
  render = () => {
    const { currentStep } = CarConfiguratorStore.state;
    document.querySelectorAll(".first-section-element").forEach((element) => {
      if (currentStep === "modelSelection") {
        element.classList.remove("hidden");
      } else {
        element.classList.add("hidden");
      }
    });
    document.querySelectorAll(".second-section-element").forEach((element) => {
      if (currentStep === "customization") {
        element.classList.remove("hidden");
      } else {
        element.classList.add("hidden");
      }
    });
    document.querySelectorAll(".third-section-element").forEach((element) => {
      if (currentStep === "review") {
        element.classList.remove("hidden");
      } else {
        element.classList.add("hidden");
      }
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
    window.addEventListener(
      "click",
      (e) => {
        const settingsOnIcon = document.getElementById("settings-on");
        const settingsOffIcon = document.getElementById("settings-off");
        const settingsPanel = document.getElementById("settings-panel");
        if (
          !settingsOnIcon.contains(/** @type {Node} */ (e.target)) &&
          !settingsOffIcon.contains(/** @type {Node} */ (e.target)) &&
          !settingsPanel.contains(/** @type {Node} */ (e.target))
        ) {
          this.isSettingsPanelOpen = false;
          this.render();
        }
        // listen on capture to use .contains() before elements are re-rendered
      },
      { capture: true },
    );
  }

  /** @private */
  render = () => {
    const lightOnIcon = document.getElementById("light-on");
    const lightOffIcon = document.getElementById("light-off");
    if (CarConfiguratorStore.state.lightsOn) {
      lightOnIcon.classList.remove("hidden");
      lightOffIcon.classList.add("hidden");
    } else {
      lightOnIcon.classList.add("hidden");
      lightOffIcon.classList.remove("hidden");
    }

    const rotateOnIcon = document.getElementById("rotate-on");
    const rotateOffIcon = document.getElementById("rotate-off");
    if (CarConfiguratorStore.state.rotationOn) {
      rotateOnIcon.classList.remove("hidden");
      rotateOffIcon.classList.add("hidden");
    } else {
      rotateOnIcon.classList.add("hidden");
      rotateOffIcon.classList.remove("hidden");
    }

    const settingsOnIcon = document.getElementById("settings-on");
    const settingsOffIcon = document.getElementById("settings-off");
    const settingsPanel = document.getElementById("settings-panel");
    if (this.isSettingsPanelOpen) {
      settingsOnIcon.classList.remove("hidden");
      settingsOffIcon.classList.add("hidden");
      settingsPanel.classList.remove("hidden");
    } else {
      settingsOnIcon.classList.add("hidden");
      settingsOffIcon.classList.remove("hidden");
      settingsPanel.classList.add("hidden");
    }

    const rgbGradientCheckbox = /** @type {HTMLInputElement} */ (
      document.getElementById("rgb-gradient")
    );
    rgbGradientCheckbox.checked = CarConfiguratorStore.state.rgbGradientOn;

    const luminositySlider = document.getElementById("luminosity-slider");
    luminositySlider.oninput = (e) =>
      this.handleChangeUserCameraLuminosity(
        /** @type {Event & { target: HTMLInputElement }} */ (e),
      );
    const luminosityValue = document.getElementById("luminosity-value");
    luminosityValue.innerHTML =
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
    const loader = document.getElementById("loader");
    const infoSpan = document.getElementById("info_span");

    const { sceneLoadingState } = CarConfiguratorStore.state;
    if (!sceneLoadingState) {
      loader.classList.add("hidden");
      return;
    }
    loader.classList.remove("hidden");

    if (sceneLoadingState === "Loading complete") {
      loader.classList.add("opacity-0");
    } else {
      loader.classList.remove("opacity-0");
    }

    infoSpan.innerHTML = sceneLoadingState;
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
