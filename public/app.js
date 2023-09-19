import AppConfig from "./AppConfig.js";
import { userToken } from "./secrets.js";

//--------------------------------------------------------------------------------------------------
window.addEventListener("load", initApp);

let gCarAttachment = null;
let gSelectedCar = null;
let gIntensity = 0;
let carParts = {
  body: null,
  frontBumper: null,
  rearBumper: null,
  spoiler: null,
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

  const toolboxElement = document.querySelector(".toolbox");
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
  [gCarAttachment] = await SDK3DVerse.engineAPI.findEntitiesByNames(
    "CAR_ATTACHMENT",
  );
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

//--------------------------------------------------------------------------------------------------
async function removeExistingCar() {
  const children = await SDK3DVerse.engineAPI.getEntityChildren(gCarAttachment);
  await SDK3DVerse.engineAPI.deleteEntities(children);

  carParts.body = null;
  carParts.frontBumper = null;
  carParts.rearBumper = null;
  carParts.spoiler = null;
}

//--------------------------------------------------------------------------------------------------
async function changePart(part, name, partUUID) {
  if (part !== null) {
    await SDK3DVerse.engineAPI.deleteEntities([part]);
  }

  return await selectPart(name, partUUID);
}

//--------------------------------------------------------------------------------------------------
async function selectPart(partName, partSceneUUID) {
  const part = { debug_name: { value: partName } };
  SDK3DVerse.utils.resolveComponentDependencies(part, "scene_ref");

  part.scene_ref.value = partSceneUUID;
  return await SDK3DVerse.engineAPI.spawnEntity(gCarAttachment, part);
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
      SDK3DVerse.updateControllerSetting({ speed: 1, sensitivity: 0.8 }),
    );
  } else {
    console.log("> 768px");
    changeCameraPosition(
      [-3.3017091751098633, 1.3626002073287964, 4.2906060218811035],
      [
        -0.12355230003595352, -0.3068566918373108, -0.04021146148443222,
        0.9428451061248779,
      ],
      SDK3DVerse.updateControllerSetting({ speed: 1, sensitivity: 0.4 }),
    );
  }
}

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

const CarConfiguratorModel = new (class CarConfiguratorModel {
  /**
   * @typedef {{
   *   color: [Number, Number, number];
   *   selectedMaterial: (typeof AppConfig)['materials'][number]
   * }} CarConfiguratorState
   */

  /** @private @type {CarConfiguratorState} */
  internalState = {
    color: [0, 0, 0],
    selectedMaterial: AppConfig.materials[0],
  };
  /** @private */
  subscribers = [];

  constructor() {
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

  /**
   * @param {[number, number, number]} color
   */
  async changeColor(color) {
    this.setState({ color });
    this.applySelectedMaterial();
  }

  /**
   * @param {number} matIndex
   */
  async changeMaterial(matIndex) {
    this.setState({ selectedMaterial: AppConfig.materials[matIndex] });
    this.applySelectedMaterial();
  }
})();

/** @global */
const CarSelectionController = new (class CarSelectionController {})();

/** @global */
const CarPartsController = new (class CarPartsController {})();

/** @global */
const CarColorsController = new (class CarColorsController {
  constructor() {
    this.render();
    CarConfiguratorModel.subscribe(["color"], this.render);
  }

  /**
   * @private
   * @param {HTMLElement} colorElement
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
      if (CarConfiguratorModel.state.color.every((v, i) => rgb[i] === v)) {
        color.classList.add("active-color");
      } else {
        color.classList.remove("active-color");
      }
    });
  };

  // UI EVENT HANDLERS:

  handleColorSelection = (e) => {
    CarConfiguratorModel.changeColor(this.getRgbForColorElement(e.target));
  };
})();

const CarMaterialsController = new (class CarMaterialsController {
  constructor() {
    this.render();
    CarConfiguratorModel.subscribe(["selectedMaterial"], this.render);
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
    CarConfiguratorModel.changeMaterial(materialIndex);
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
  /** @private */
  toolboxRoot = ReactDOM.createRoot(document.querySelector(".toolbox"));

  constructor() {
    this.renderToolbox();
  }

  // PRIVATE METHODS

  renderToolbox() {
    this.toolboxRoot.render(
      <Toolbox viewModel={this} selectedCarIndex={this.selectedCarIndex} />,
    );
  }

  async applySelectedCar() {
    carParts.body = await changePart(
      carParts.body,
      gSelectedCar.name,
      gSelectedCar.sceneUUID,
    );
    await this.changeFrontBumper(0);
    await this.changeRearBumper(0);
    await this.changeSpoiler(0);
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
    this.renderToolbox();
    await this.applySelectedCar();
    // TODO: replace with internal call once in model
    await CarConfiguratorModel.applySelectedMaterial();
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

  async changeSpoiler(i) {
    if (i >= gSelectedCar.spoilers.length) {
      return;
    }

    carParts.spoiler = await changePart(
      carParts.spoiler,
      gSelectedCar.name + " SPOILER " + i,
      gSelectedCar.spoilers[i],
    );
  }

  async changeFrontBumper(i) {
    if (i >= gSelectedCar.frontBumpers.length) {
      return;
    }

    carParts.frontBumper = await changePart(
      carParts.frontBumper,
      gSelectedCar.name + " FRONT BUMPER " + i,
      gSelectedCar.frontBumpers[i],
    );
  }

  async changeRearBumper(i) {
    if (i >= gSelectedCar.rearBumpers.length) {
      return;
    }

    carParts.rearBumper = await changePart(
      carParts.rearBumper,
      gSelectedCar.name + " REAR BUMPER " + i,
      gSelectedCar.rearBumpers[i],
    );
  }

  launchModelSelection() {
    firstSectionElements.forEach((element) => {
      element.classList.remove("hidden");
    });
    secondSectionElements.forEach((element) => {
      element.classList.add("hidden");
    });

    const toolboxElement = document.querySelector(".toolbox");
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

    const toolboxElement = document.querySelector(".toolbox");
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

    const toolboxElement = document.querySelector(".toolbox");
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
  CarColorsController,
  CarMaterialsController,
  CarConfiguratorController,
});

// Separate mapping object for new category and part names
const categoryMapping = {
  frontBumpers: "Front Bumper",
  rearBumpers: "Rear Bumper",
  spoilers: "Spoiler",
};

const partNameMapping = {
  frontBumpers: "Front Bumper",
  rearBumpers: "Rear Bumper",
  spoilers: "Spoiler",
  // Add more mappings for other categories if needed
};

function Toolbox({ viewModel, selectedCarIndex }) {
  // Extract data from AppConfig.js
  const { cars } = AppConfig;

  // State variables to keep track of the selected category, and part
  const [selectedCategory, setSelectedCategory] =
    React.useState("frontBumpers");
  const [selectedPartIndex, setSelectedPartIndex] = React.useState({});

  // Function to call the specific function for a given category and element index
  const callSpecificFunction = (category, elementIndex) => {
    // Check the category and index and call the corresponding function
    if (category === "spoilers") {
      viewModel.changeSpoiler(elementIndex);
    } else if (category === "frontBumpers") {
      viewModel.changeFrontBumper(elementIndex);
    } else if (category === "rearBumpers") {
      viewModel.changeRearBumper(elementIndex);
    }
    // ... Add other conditions for other categories and functions here
  };

  React.useEffect(
    function resetToolbox() {
      setSelectedCategory("frontBumpers"); // Set the first category as active
      setSelectedPartIndex({}); // Clear the active part indices
    },
    [selectedCarIndex],
  );

  // Function to switch between categories
  const switchCategory = (category) => {
    setSelectedCategory(category);
  };

  if (selectedCarIndex >= cars.length) {
    // If the selected car index is out of bounds, show a message
    return <div>No data found for the selected car.</div>;
  }

  // Get the selected car based on the index
  const selectedCar = cars[selectedCarIndex];

  // Filter out categories that are empty for the selected car
  const availableCategories = Object.keys(selectedCar).filter(
    (category) =>
      Array.isArray(selectedCar[category]) && selectedCar[category].length > 0,
  );

  // Get the data for the selected category
  const selectedCategoryData = selectedCar[selectedCategory];

  // Function to set the selected part index within the category
  const switchPart = (index) => {
    setSelectedPartIndex((prevSelectedParts) => ({
      ...prevSelectedParts,
      [selectedCategory]: index,
    }));
  };

  // Get the selected part index within the category
  const currentSelectedPartIndex = selectedPartIndex[selectedCategory] || 0;

  // Function to get the updated category name
  const getUpdatedCategoryName = (category) => {
    return categoryMapping[category] || category;
  };

  // Function to get the updated part name
  const getUpdatedPartName = (category, index) => {
    const partName = partNameMapping[category] || category;
    return `${partName} ${index + 1}`;
  };

  return (
    <>
      <div className="toolbox absolute top-[7vh] left-[5vw] second-section-element text-base font-semibold w-[450px]">
        {/* Switch between categories */}
        <div className="flex">
          {availableCategories.map((category, index) => (
            <button
              key={category}
              onClick={() => {
                switchCategory(category);
              }}
              className={
                selectedCategory === category
                  ? "active-tab rounded-xl bg-[#22242A] text-[#6D6D6D] hover:bg-[#2E2F31] transition cursor-pointer py-[12px] px-[20px] w-full"
                  : "rounded-xl bg-[#22242A] text-[#6D6D6D] hover:bg-[#2E2F31] transition cursor-pointer py-[12px] px-[20px] w-full"
              }
            >
              {getUpdatedCategoryName(category)}
            </button>
          ))}
        </div>

        {/* Display the data for the selected category */}
        {selectedCategoryData.length > 0 ? (
          <div className="toolbox-panel w-full bg-[#272727] rounded-xl text-white w-full p-4 transition font-medium space-y-2">
            {selectedCategoryData.map((item, index) => (
              <div
                key={index}
                className={
                  currentSelectedPartIndex === index
                    ? "active-part part-item first-panel-item w-full rounded-xl p-[16px] flex items-center hover:bg-[#454642] cursor-pointer transition py-[20px]"
                    : "part-item first-panel-item w-full rounded-xl p-[16px] flex items-center hover:bg-[#454642] cursor-pointer transition py-[20px]"
                }
                onClick={() => {
                  switchPart(index);
                  callSpecificFunction(selectedCategory, index);
                }}
              >
                <div>{getUpdatedPartName(selectedCategory, index)}</div>
                <div
                  id="check-circle"
                  className="check-circle flex items-center justify-center bg-[#1E1E1E] rounded-full h-[24px] w-[24px]"
                  key={index + 1}
                >
                  <img
                    src="./img/white-check.png"
                    className={
                      currentSelectedPartIndex === index
                        ? "w-1/2 h-1/2"
                        : "hidden"
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
