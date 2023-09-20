import AppConfig from "./AppConfig.js";
import { userToken } from "./secrets.js";

// Include external library definitions to help with autocompletion
/// <reference path="./vendor/handlebars.d.ts" />

// TODO: get rid of this and use real types
/** @type {any} */
const SDK3DVerse = window.SDK3DVerse;

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
let gSelectedCar = AppConfig.cars[0];
let gIntensity = 0;
/**
 * @type {{
 *   body: object;
 *   frontBumpers: object[];
 *   rearBumpers: object[];
 *   spoilers: object[];
 * }[]}
 */
const allCarPartEntities = [];
/**
 * @type {{
 *   body: object | null;
 *   frontBumpers: object | null;
 *   rearBumpers: object | null;
 *   spoilers: object | null;
 * }}
 */
let selectedCarPartEntities = {
  body: null,
  frontBumpers: null,
  rearBumpers: null,
  spoilers: null,
};

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

  /** @type {HTMLElement} */
  const toolboxElement = document.querySelector(".car-parts");
  if (toolboxElement) {
    toolboxElement.style.display = "none";
  }

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

  await CarConfiguratorController.toggleGradientPlatform();
  await CarConfiguratorController.changeCubemap(0);
  await initCarAttachment();
  await CarConfiguratorController.changeCar({ value: 0 });
  // SDK3DVerse.updateControllerSetting({ rotation: 10 });

  setInformation("Loading complete");
  document.getElementById("loader").classList.add("opacity-0");
  setTimeout(function () {
    document.getElementById("loader").classList.add("hidden");
  }, 500);
  // SDK3DVerse.updateControllerSetting({ speed: 1, sensitivity: 0.4 }); //reduce scroll speed
}

//--------------------------------------------------------------------------------------------------
async function initCarAttachment() {
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
  for (const { name, frontBumpers, rearBumpers, spoilers } of AppConfig.cars) {
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
          selectedCarPartEntities.body = entitiesForCar.body;
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
            selectedCarPartEntities.frontBumpers = frontBumper;
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
            selectedCarPartEntities.rearBumpers = rearBumper;
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
            selectedCarPartEntities.spoilers = spoiler;
            break;
          }
        }
      })(),
    ]);

    allCarPartEntities.push(entitiesForCar);
  }
}

//--------------------------------------------------------------------------------------------------
const carName = document.getElementById("car_name");
const carDescription = document.getElementById("car_description");
const carMaximumSpeed = document.getElementById("maximum-speed-number");
const carAcceleration = document.getElementById("acceleration-number");
const carMaximumPower = document.getElementById("maximum-power-number");
const carMaximumTorque = document.getElementById("maximum-torque-number");
const carEngineCapacity = document.getElementById("engine-capacity-number");
const startingPrice = document.getElementById("starting-price");
const startingPriceMobile = document.getElementById("starting-price-mobile");

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

async function removeExistingCar() {
  const attachedParts = Object.values(selectedCarPartEntities).filter(Boolean);
  if (!attachedParts.length || !gHiddenCarParts) {
    return;
  }
  await reparentEntities(attachedParts, gHiddenCarParts);

  selectedCarPartEntities.body = null;
  selectedCarPartEntities.frontBumpers = null;
  selectedCarPartEntities.rearBumpers = null;
  selectedCarPartEntities.spoilers = null;
}

/**
 * @param {object | undefined} partEntity
 * @param {string} [category]
 */
async function changePart(partEntity, category) {
  // make chosen part visible
  if (partEntity) {
    await reparentEntities([partEntity], gVisibleCarParts);
  }

  // hide previous part for category
  if (category && selectedCarPartEntities[category]) {
    await reparentEntities(
      [selectedCarPartEntities[category]],
      gHiddenCarParts,
    );
  }

  if (category) {
    selectedCarPartEntities[category] = partEntity;
  }
}

//--------------------------------------------------------------------------------------------------
function setInformation(str) {
  const infoSpan = document.getElementById("info_span");
  infoSpan.innerHTML = str;
  console.debug(str);
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
    setInformation(`Setting resolution to ${w} x ${h} (scale=${scale})`);
  }
}

//--------------------------------------------------------------------------------------------------
async function connect() {
  setInformation("Connecting to 3dverse...");

  const connectionInfo = await SDK3DVerse.webAPI.createSession(
    AppConfig.sceneUUID,
  );
  connectionInfo.useSSL = true;
  SDK3DVerse.setupDisplay(document.getElementById("display_canvas"));
  SDK3DVerse.startStreamer(connectionInfo);
  await SDK3DVerse.connectToEditor();
  setInformation("Connection to 3dverse established...");
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

//-----------------------------------------------------------------------------------
function firstWordFromId(selectId, addClass) {
  var jsIntro = document.getElementById(selectId);
  var originalString = jsIntro.innerHTML;
  var splitWords = originalString.split(" ");

  jsIntro.innerHTML =
    "<span class=" +
    addClass +
    ">".concat(splitWords[0], "</span>") +
    "&#32;" +
    originalString.substr(originalString.indexOf(" ") + 1);
}

//---------------------------------------------------------------------------
async function changeLightIntensity(newIntensity) {
  const cameraAPI = SDK3DVerse.engineAPI.cameraAPI;
  const viewport =
    cameraAPI.currentViewportEnabled || cameraAPI.getActiveViewports()[0];
  const camera = viewport.getCamera();
  let cameraComponent = await camera.getComponent("camera");
  // cameraComponent = SDK3DVerse.utils.clone(cameraComponent); //clone du component camera
  cameraComponent.dataJSON.brightness = newIntensity;
  await camera.setComponent("camera", cameraComponent);
  SDK3DVerse.engineAPI.propagateChanges();
}

//---------------------------------------------------------------------------
const luminositySlider = document.getElementById("luminosity-slider");
const luminosityValue = document.getElementById("luminosity-value");
luminosityValue.innerHTML = luminositySlider.value;

luminositySlider.oninput = function () {
  luminosityValue.innerHTML = this.value;
  changeLightIntensity(Number(this.value));
};

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

const firstSectionElements = document.querySelectorAll(
  ".first-section-element",
);
const secondSectionElements = document.querySelectorAll(
  ".second-section-element",
);
const thirdSectionElements = document.querySelectorAll(
  ".third-section-element",
);

const lightOnIcon = document.getElementById("light-on");
const lightOffIcon = document.getElementById("light-off");

let rotationState = false;
const rotateOnIcon = document.getElementById("rotate-on");
const rotateOffIcon = document.getElementById("rotate-off");

const settingsOnIcon = document.getElementById("settings-on");
const settingsOffIcon = document.getElementById("settings-off");
const settingsPanel = document.getElementById("settings-panel");

// this currently sets up cubemap state independent of the state
// in code. we might want to change that.
const cubemaps = document.querySelectorAll(".cubemap");
cubemaps.forEach((cubemap) => {
  cubemap.addEventListener("click", () => {
    cubemaps.forEach((cubemap) => cubemap.classList.remove("active-cubemap"));
    cubemap.classList.add("active-cubemap");
  });
});

const CarConfiguratorStore = new (class CarConfiguratorStore {
  /**
   * @typedef {{
   *   selectedPartCategory: keyof (typeof PARTS_CATEGORY_MAPPING);
   *   selectedParts: Record<keyof (typeof PARTS_CATEGORY_MAPPING), number>;
   *   color: [Number, Number, number];
   *   selectedMaterial: (typeof AppConfig)['materials'][number];
   * }} CarConfiguratorState
   */

  /** @private @type {CarConfiguratorState} */
  internalState = {
    selectedPartCategory: Object.keys(PARTS_CATEGORY_MAPPING)[0],
    selectedParts: {
      frontBumpers: 0,
      rearBumpers: 0,
      spoilers: 0,
    },
    color: [0, 0, 0],
    selectedMaterial: AppConfig.materials[0],
  };
  /** @private */
  subscribers = [];

  constructor() {
    // TODO: find way to initialize scene graph based on default settings
    // (or just hardcode those default settings in scene graph). For example
    // there is no color by default.
    // TODO: asynchronously initialize state from current scene graph
    // TODO: update state when receiving scene graph updates from 3dverse
  }

  /**
   * @private
   * @param {Partial<CarConfiguratorState>} value
   */
  setState(value) {
    const oldState = this.internalState;
    this.internalState = {
      ...oldState,
      ...value,
    };
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

  /** @private */
  async applySelectedMaterial() {
    const desc = await getAssetDescription(
      "materials",
      this.state.selectedMaterial.matUUID,
    );
    desc.dataJson.albedo = this.state.color;
    SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
      gSelectedCar.paintMaterialUUID,
      desc,
    );
  }

  /** @private */
  async applySelectedPart() {
    const { selectedPartCategory, selectedParts } = this.state;
    const selectedPartIndex = selectedParts[selectedPartCategory];
    const partEntity =
      allCarPartEntities[CarConfiguratorController.selectedCarIndex][
        selectedPartCategory
      ][selectedPartIndex];
    await changePart(partEntity, selectedPartCategory);
  }

  /**
   * @param {(keyof CarConfiguratorState)[]} watchedKeys
   * @param {() => void} handler
   */
  subscribe(watchedKeys, handler) {
    this.subscribers.push([watchedKeys, handler]);
  }

  /**
   * @param {[number, number, number]} color
   */
  changeColor(color) {
    this.setState({ color });
    this.applySelectedMaterial();
  }

  /**
   * @param {number} matIndex
   */
  changeSelectedMaterial(matIndex) {
    this.setState({ selectedMaterial: AppConfig.materials[matIndex] });
    this.applySelectedMaterial();
  }

  /**
   * @param {CarConfiguratorState['selectedPartCategory']} selectedPartCategory
   */
  changeSelectedPartCategory(selectedPartCategory) {
    this.setState({ selectedPartCategory });
  }

  /**
   * @param {number} partIndex
   */
  changeSelectedPart(partIndex) {
    if (partIndex > gSelectedCar[this.state.selectedPartCategory].length) {
      throw new Error("Invalid part index");
    }
    this.setState({
      selectedParts: {
        ...this.state.selectedParts,
        [this.state.selectedPartCategory]: partIndex,
      },
    });
    this.applySelectedPart();
  }
})();

/** @global */
const CarSelectionController = new (class CarSelectionController {})();

/** @global */
const CarPartsController = new (class CarPartsController {
  template = Handlebars.compile(
    document.getElementById("car-parts-template").innerHTML,
  );

  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(
      ["selectedPartCategory", "selectedParts"],
      this.render,
    );
  }

  /** @private */
  render = () => {
    const carPartsElement = document.querySelector(".car-parts");

    const { selectedPartCategory, selectedParts } = CarConfiguratorStore.state;
    const selectedPartIndex = selectedParts[selectedPartCategory];

    carPartsElement.innerHTML = this.template({
      availableCategories: Object.keys(PARTS_CATEGORY_MAPPING).map((name) => ({
        name,
        displayName: PARTS_CATEGORY_MAPPING[name],
        isSelected: selectedPartCategory === name,
      })),
      selectedCategoryData: gSelectedCar[selectedPartCategory].map((_, i) => ({
        displayName: `${PARTS_CATEGORY_MAPPING[selectedPartCategory]} ${i + 1}`,
        isSelected: selectedPartIndex === i,
      })),
    });
  };

  /**
   *
   * @param {CarConfiguratorState['selectedPartCategory']} category
   */
  switchCategory = (category) => {
    CarConfiguratorStore.changeSelectedPartCategory(category);
  };

  /**
   * @param {number} index
   */
  switchPartIndex = (index) => {
    CarConfiguratorStore.changeSelectedPart(index);
  };
})();

/** @global */
const CarColorsController = new (class CarColorsController {
  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(["color"], this.render);
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
      if (CarConfiguratorStore.state.color.every((v, i) => rgb[i] === v)) {
        color.classList.add("active-color");
      } else {
        color.classList.remove("active-color");
      }
    });
  };

  // UI EVENT HANDLERS:

  handleColorSelection = (e) => {
    CarConfiguratorStore.changeColor(this.getRgbForColorElement(e.target));
  };
})();

const CarMaterialsController = new (class CarMaterialsController {
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

  handleMaterialSelection = (e) => {
    const materialIndex = Number(e.target.getAttribute("data-material-index"));
    CarConfiguratorStore.changeSelectedMaterial(materialIndex);
  };
})();

/** @global */
const CarBackgroundController = new (class CarBackgroundController {})();

/** @global */
const CarConfigStepperController = new (class CarConfigStepperController {})();

/** @global */
const CarOptionsBarController = new (class CarOptionsBarController {})();

/** @global */
const CarConfiguratorController = new (class CarConfiguratorController {
  /** @private */
  isCarSwitchEnabled = true;
  /** @private */
  carSwitchDelay = 3000; // delay to avoid car model switch spam
  /** @private */
  selectedCarIndex = 0;

  // PRIVATE METHODS

  async applySelectedCar() {
    await changePart(allCarPartEntities[this.selectedCarIndex].body);
    // TODO: integrate into store
    CarConfiguratorStore.changeSelectedPartCategory("frontBumpers");
    CarConfiguratorStore.changeSelectedPart(0);
    CarConfiguratorStore.changeSelectedPartCategory("rearBumpers");
    CarConfiguratorStore.changeSelectedPart(0);
    CarConfiguratorStore.changeSelectedPartCategory("spoilers");
    CarConfiguratorStore.changeSelectedPart(0);
    CarConfiguratorStore.changeSelectedPartCategory("frontBumpers");
  }

  async changeCar({ value: selectedCarIndex }) {
    gSelectedCar = AppConfig.cars[selectedCarIndex];
    await removeExistingCar();
    carName.innerHTML = gSelectedCar.name;
    firstWordFromId("car_name", "highlighted-word");
    carDescription.innerHTML = gSelectedCar.description;
    carMaximumSpeed.innerHTML = gSelectedCar.maxSpeed;
    carAcceleration.innerHTML = gSelectedCar.acceleration;
    carMaximumPower.innerHTML = gSelectedCar.maximumPower;
    carMaximumTorque.innerHTML = gSelectedCar.maximumTorque;
    carEngineCapacity.innerHTML = gSelectedCar.engineCapacity;
    startingPrice.innerHTML = gSelectedCar.price;
    startingPriceMobile.innerHTML = gSelectedCar.price;
    await this.applySelectedCar();
    // TODO: replace with internal call once in model
    CarConfiguratorStore.applySelectedMaterial();
  }

  // PUBLIC METHODS

  async nextCar() {
    if (this.isCarSwitchEnabled) {
      this.isCarSwitchEnabled = false;
      this.selectedCarIndex =
        (this.selectedCarIndex + 1) % AppConfig.cars.length;
      await this.changeCar({ value: this.selectedCarIndex });
    }
    setTimeout(function () {
      this.isCarSwitchEnabled = true;
    }, this.carSwitchDelay);
  }

  async previousCar() {
    if (this.isCarSwitchEnabled) {
      this.isCarSwitchEnabled = false;
      this.selectedCarIndex =
        this.selectedCarIndex === 0
          ? AppConfig.cars.length - 1
          : this.selectedCarIndex - 1;
      await this.changeCar({ value: this.selectedCarIndex });
    }
    setTimeout(function () {
      this.isCarSwitchEnabled = true;
    }, this.carSwitchDelay);
  }

  launchModelSelection() {
    firstSectionElements.forEach((element) => {
      element.classList.remove("hidden");
    });
    secondSectionElements.forEach((element) => {
      element.classList.add("hidden");
    });

    /** @type {HTMLElement} */
    const toolboxElement = document.querySelector(".car-parts");
    if (toolboxElement) {
      toolboxElement.style.display = "none";
    }

    document.getElementById("starting-price").innerHTML = gSelectedCar.price;
  }

  launchCustomization() {
    firstSectionElements.forEach((element) => {
      element.classList.add("hidden");
    });
    secondSectionElements.forEach((element) => {
      element.classList.remove("hidden");
    });
    thirdSectionElements.forEach((element) => {
      element.classList.add("hidden");
    });

    /** @type {HTMLElement} */
    const toolboxElement = document.querySelector(".car-parts");
    if (toolboxElement) {
      toolboxElement.style.display = "block";
    }

    const hiddenButtons = document.querySelectorAll(".hidden-button");
    hiddenButtons.forEach((button) => button.classList.remove("hidden-button"));

    document.getElementById("final-price").innerHTML = gSelectedCar.price;
  }

  launchReview() {
    secondSectionElements.forEach((element) => {
      element.classList.add("hidden");
    });
    thirdSectionElements.forEach((element) => {
      element.classList.remove("hidden");
    });

    /** @type {HTMLElement} */
    const toolboxElement = document.querySelector(".car-parts");
    if (toolboxElement) {
      toolboxElement.style.display = "none";
    }
  }

  async changeCubemap(cubemapIndex) {
    const cubemap = AppConfig.cubemaps[cubemapIndex];
    const environmentEntities = await SDK3DVerse.engineAPI.findEntitiesByNames(
      "Env",
    );
    const environmentEntity = environmentEntities[0];
    let envComponent = await environmentEntity.getComponent("environment");
    envComponent.skyboxUUID = cubemap.skyboxUUID;
    envComponent.radianceUUID = cubemap.radianceUUID;
    envComponent.irradianceUUID = cubemap.irradianceUUID;
    await environmentEntity.setComponent("environment", envComponent);
    SDK3DVerse.engineAPI.propagateChanges();
  }

  async toggleLights() {
    lightOnIcon.classList.toggle("hidden");
    lightOffIcon.classList.toggle("hidden");

    const desc1 = await getAssetDescription(
      "materials",
      gSelectedCar.headLightsMatUUID,
    );
    desc1.dataJson.emissionIntensity = gIntensity;
    SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
      gSelectedCar.headLightsMatUUID,
      desc1,
    );

    const desc2 = await getAssetDescription(
      "materials",
      gSelectedCar.rearLightsMatUUID,
    );
    desc2.dataJson.emissionIntensity = gIntensity;
    SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
      gSelectedCar.rearLightsMatUUID,
      desc2,
    );

    gIntensity = gIntensity === 0 ? 100 : 0;
  }

  toggleRotation() {
    const event = rotationState ? "pause_simulation" : "start_simulation";
    rotationState = !rotationState;

    SDK3DVerse.engineAPI.fireEvent(SDK3DVerse.utils.invalidUUID, event);

    rotateOnIcon.classList.toggle("hidden");
    rotateOffIcon.classList.toggle("hidden");
  }

  toggleSettingsPanel() {
    settingsOnIcon.classList.toggle("hidden");
    settingsOffIcon.classList.toggle("hidden");
    settingsPanel.classList.toggle("hidden");
  }

  async toggleGradientPlatform() {
    const [gradientPlatform] = await SDK3DVerse.engineAPI.findEntitiesByNames(
      "SM_StaticPlatform",
    );
    if (gradientPlatform.isVisible()) {
      await SDK3DVerse.engineAPI.setEntityVisibility(gradientPlatform, false);
    } else {
      await SDK3DVerse.engineAPI.setEntityVisibility(gradientPlatform, true);
    }
  }

  toggleDisplayBackground() {
    const { cameraAPI } = SDK3DVerse.engineAPI;
    const viewport =
      cameraAPI.currentViewportEnabled || cameraAPI.getActiveViewports()[0];
    const camera = viewport.getCamera();
    const cameraComponent = camera.getComponent("camera");
    cameraComponent.dataJSON.displayBackground =
      !cameraComponent.dataJSON.displayBackground;
    camera.setComponent("camera", cameraComponent);
    SDK3DVerse.engineAPI.propagateChanges();
  }
})();

Object.assign(window, {
  CarSelectionController,
  CarPartsController,
  CarColorsController,
  CarMaterialsController,
  CarBackgroundController,
  CarConfigStepperController,
  CarOptionsBarController,
  CarConfiguratorController,
});
