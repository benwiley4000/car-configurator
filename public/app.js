import AppConfig from "./AppConfig.js";
import { userToken } from "./secrets.js";

//--------------------------------------------------------------------------------------------------
window.addEventListener("load", InitApp);

let gCarAttachment = null;
let gSelectedCar = null;
let gSelectedMaterial = null;
let gColor = null;
let gIntensity = 0;
let carParts = {
  body: null,
  frontBumper: null,
  rearBumper: null,
  spoiler: null,
};
let gCarIndex = 0;

//--------------------------------------------------------------------------------------------------
async function InitApp() {
  SDK3DVerse.setApiVersion("v1");
  SDK3DVerse.webAPI.setUserToken(userToken);

  ReactDOM.render(<Toolbox />, document.querySelector(".toolbox"));

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
  SetResolution();
  let debounceResizeTimeout = null;
  window.addEventListener("resize", () => {
    if (debounceResizeTimeout) {
      clearTimeout(debounceResizeTimeout);
    }
    debounceResizeTimeout = setTimeout(() => {
      SetResolution(false);
      debounceResizeTimeout = null;
    }, 100);
  });

  const sessionCreated = await Connect();

  await toggleGradientPlatform();
  await changeCubemap(0);
  await InitCarAttachment();
  gSelectedMaterial = AppConfig.materials[0];
  await ChangeCar({ value: 0 });
  // SDK3DVerse.updateControllerSetting({ rotation: 10 });

  SetInformation("Loading complete");
  document.getElementById("loader").classList.add("opacity-0");
  setTimeout(function () {
    document.getElementById("loader").classList.add("hidden");
  }, 500);
  // SDK3DVerse.updateControllerSetting({ speed: 1, sensitivity: 0.4 }); //reduce scroll speed
}

//--------------------------------------------------------------------------------------------------
async function InitCarAttachment() {
  [gCarAttachment] =
    await SDK3DVerse.engineAPI.findEntitiesByNames("CAR_ATTACHMENT");
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

async function ChangeCar(e) {
  gSelectedCar = AppConfig.cars[e.value];
  await RemoveExistingCar();
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
  switchCar(e.value);
  await ApplySelectedCar();
  // await InitColor();
  await ApplySelectedMaterial();
}

//--------------------------------------------------------------------------------------------------
async function changeSpoiler(i) {
  if (i >= gSelectedCar.spoilers.length) {
    return;
  }

  carParts.spoiler = await ChangePart(
    carParts.spoiler,
    gSelectedCar.name + " SPOILER " + i,
    gSelectedCar.spoilers[i],
  );
}

//--------------------------------------------------------------------------------------------------
async function changeFrontBumper(i) {
  if (i >= gSelectedCar.frontBumpers.length) {
    return;
  }

  carParts.frontBumper = await ChangePart(
    carParts.frontBumper,
    gSelectedCar.name + " FRONT BUMPER " + i,
    gSelectedCar.frontBumpers[i],
  );
}

//--------------------------------------------------------------------------------------------------
async function changeRearBumper(i) {
  if (i >= gSelectedCar.rearBumpers.length) {
    return;
  }

  carParts.rearBumper = await ChangePart(
    carParts.rearBumper,
    gSelectedCar.name + " REAR BUMPER " + i,
    gSelectedCar.rearBumpers[i],
  );
}

//--------------------------------------------------------------------------------------------------
async function RemoveExistingCar() {
  const children = await SDK3DVerse.engineAPI.getEntityChildren(gCarAttachment);
  await SDK3DVerse.engineAPI.deleteEntities(children);

  carParts.body = null;
  carParts.frontBumper = null;
  carParts.rearBumper = null;
  carParts.spoiler = null;
}

//--------------------------------------------------------------------------------------------------
async function ApplySelectedCar() {
  carParts.body = await ChangePart(
    carParts.body,
    gSelectedCar.name,
    gSelectedCar.sceneUUID,
  );
  await changeFrontBumper(0);
  await changeRearBumper(0);
  await changeSpoiler(0);
}

//--------------------------------------------------------------------------------------------------
async function ChangePart(part, name, partUUID) {
  if (part !== null) {
    await SDK3DVerse.engineAPI.deleteEntities([part]);
  }

  return await SelectPart(name, partUUID);
}

//--------------------------------------------------------------------------------------------------
async function SelectPart(partName, partSceneUUID) {
  const part = { debug_name: { value: partName } };
  SDK3DVerse.utils.resolveComponentDependencies(part, "scene_ref");

  part.scene_ref.value = partSceneUUID;
  return await SDK3DVerse.engineAPI.spawnEntity(gCarAttachment, part);
}

var isCarSwitchEnabled = true;
var carSwitchDelay = 3000; //delay to avoid car model switch spam

async function nextCar() {
  if (isCarSwitchEnabled) {
    isCarSwitchEnabled = false;
    gCarIndex = (gCarIndex + 1) % AppConfig.cars.length;
    await ChangeCar({ value: gCarIndex });
  }
  setTimeout(function () {
    isCarSwitchEnabled = true;
  }, carSwitchDelay);
}
async function previousCar() {
  if (isCarSwitchEnabled) {
    isCarSwitchEnabled = false;
    gCarIndex = gCarIndex === 0 ? AppConfig.cars.length - 1 : gCarIndex - 1;
    await ChangeCar({ value: gCarIndex });
  }
  setTimeout(function () {
    isCarSwitchEnabled = true;
  }, carSwitchDelay);
}

//--------------------------------------------------------------------------------------------------
// use setTimeout to delay a task that may be async (returning a promise) or not.
// wrap the setTimeout in a Promise that can be awaited.
function asyncSetTimeout(task, delay) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      let result;
      try {
        result = task();
      } catch (error) {
        // the task has thrown an error
        return reject(error);
      }

      if (result && typeof result.then === "function") {
        // the result is a promise so we deal with it
        return result.then(resolve).catch(reject);
      }

      // the result is not a promise so we can resolve it
      return resolve(result);
    }, delay);
  });
}

//--------------------------------------------------------------------------------------------------
function SetInformation(str) {
  const infoSpan = document.getElementById("info_span");
  infoSpan.innerHTML = str;
  console.debug(str);
}

//--------------------------------------------------------------------------------------------------
function SetResolution(showInfo = true) {
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
    SetInformation(`Setting resolution to ${w} x ${h} (scale=${scale})`);
  }
}

let rotationState = false;
//--------------------------------------------------------------------------------------------------
const rotateOnIcon = document.getElementById("rotate-on");
const rotateOffIcon = document.getElementById("rotate-off");
function toggleRotation() {
  const event = rotationState ? "pause_simulation" : "start_simulation";
  rotationState = !rotationState;

  SDK3DVerse.engineAPI.fireEvent(SDK3DVerse.utils.invalidUUID, event);

  rotateOnIcon.classList.toggle("hidden");
  rotateOffIcon.classList.toggle("hidden");
}

//--------------------------------------------------------------------------------------------------
function Reset() {
  SDK3DVerse.engineAPI.fireEvent(
    SDK3DVerse.utils.invalidUUID,
    "stop_simulation",
  );
  rotationState = false;
}

//--------------------------------------------------------------------------------------------------
async function Connect() {
  SetInformation("Connecting to 3dverse...");

  const connectionInfo = await SDK3DVerse.webAPI.createSession(
    AppConfig.sceneUUID,
  );
  connectionInfo.useSSL = true;
  SDK3DVerse.setupDisplay(document.getElementById("display_canvas"));
  SDK3DVerse.startStreamer(connectionInfo);
  await SDK3DVerse.connectToEditor();
  SetInformation("Connection to 3dverse established...");
  return true; //connectionInfo.sessionCreated;
}

//--------------------------------------------------------------------------------------------------
async function InitColor() {
  const desc = await getAssetDescription(
    "materials",
    gSelectedCar.paintMaterialUUID,
  );
  desc.dataJson.albedo = gColor;
}

//--------------------------------------------------------------------------------------------------
async function changeColor(color) {
  const desc = await getAssetDescription(
    "materials",
    gSelectedMaterial.matUUID,
  );
  gColor = color;
  desc.dataJson.albedo = color;
  SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
    gSelectedCar.paintMaterialUUID,
    desc,
  );
}

//--------------------------------------------------------------------------------------------------
async function ApplySelectedMaterial() {
  const desc = await getAssetDescription(
    "materials",
    gSelectedMaterial.matUUID,
  );
  desc.dataJson.albedo = gColor;
  SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
    gSelectedCar.paintMaterialUUID,
    desc,
  );
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

const lightOnIcon = document.getElementById("light-on");
const lightOffIcon = document.getElementById("light-off");
async function toggleLights() {
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

// ------------------------------------------------

async function toggleGradientPlatform() {
  const gradientPlatforms =
    await SDK3DVerse.engineAPI.findEntitiesByNames("SM_StaticPlatform");
  const gradientPlatform = gradientPlatforms[0];
  if (gradientPlatform.isVisible()) {
    await SDK3DVerse.engineAPI.setEntityVisibility(gradientPlatform, false);
  } else {
    await SDK3DVerse.engineAPI.setEntityVisibility(gradientPlatform, true);
  }
}

// --------------------------------------------------------------

const firstSectionElements = document.querySelectorAll(
  ".first-section-element",
);
const secondSectionElements = document.querySelectorAll(
  ".second-section-element",
);
const thirdSectionElements = document.querySelectorAll(
  ".third-section-element",
);

function launchModelSelection() {
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

function launchCustomization() {
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

function launchReview() {
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

//----------------------------------------------------------

const colors = document.querySelectorAll(".color");

colors.forEach((color) => {
  color.addEventListener("click", () => {
    colors.forEach((color) => color.classList.remove("active-color"));
    color.classList.add("active-color");
  });
});

// ---------------------------------------------------------

const materialIcons = document.querySelectorAll(".material-icon");

materialIcons.forEach((icon) => {
  icon.addEventListener("click", () => {
    materialIcons.forEach((icon) => icon.classList.remove("active-material"));
    icon.classList.add("active-material");
  });
});

//--------------------------------------------------------------------------------------------------
async function changeMaterial(matIndex) {
  gSelectedMaterial = AppConfig.materials[matIndex];
  await ApplySelectedMaterial();

  colors.forEach((color) => {
    colors.forEach((color) => color.classList.remove("active-color"));
  });
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
const settingsOnIcon = document.getElementById("settings-on");
const settingsOffIcon = document.getElementById("settings-off");
const settingsPanel = document.getElementById("settings-panel");

function toggleSettingsPanel() {
  settingsOnIcon.classList.toggle("hidden");
  settingsOffIcon.classList.toggle("hidden");
  settingsPanel.classList.toggle("hidden");
}

// --------------------------------------------------------------------------
const cubemaps = document.querySelectorAll(".cubemap");

cubemaps.forEach((cubemap) => {
  cubemap.addEventListener("click", () => {
    cubemaps.forEach((cubemap) => cubemap.classList.remove("active-cubemap"));
    cubemap.classList.add("active-cubemap");
  });
});

//---------------------------------------------------------------------------
function toggleDisplayBackground() {
  const cameraAPI = SDK3DVerse.engineAPI.cameraAPI;
  const viewport =
    cameraAPI.currentViewportEnabled || cameraAPI.getActiveViewports()[0];
  const camera = viewport.getCamera();
  let cameraComponent = camera.getComponent("camera");
  // cameraComponent = SDK3DVerse.utils.clone(cameraComponent); //clone du component camera
  cameraComponent.dataJSON.displayBackground =
    !cameraComponent.dataJSON.displayBackground;
  camera.setComponent("camera", cameraComponent);
  SDK3DVerse.engineAPI.propagateChanges();
}

async function changeCubemap(cubemapIndex) {
  const cubemap = AppConfig.cubemaps[cubemapIndex];
  const environmentEntities =
    await SDK3DVerse.engineAPI.findEntitiesByNames("Env");
  const environmentEntity = environmentEntities[0];
  let envComponent = await environmentEntity.getComponent("environment");
  envComponent.skyboxUUID = cubemap.skyboxUUID;
  envComponent.radianceUUID = cubemap.radianceUUID;
  envComponent.irradianceUUID = cubemap.irradianceUUID;
  await environmentEntity.setComponent("environment", envComponent);
  SDK3DVerse.engineAPI.propagateChanges();
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
  const cameraAPI = SDK3DVerse.engineAPI.cameraAPI;
  const viewport =
    cameraAPI.currentViewportEnabled || cameraAPI.getActiveViewports()[0];

  SDK3DVerse.engineAPI.cameraAPI.travel(
    viewport,
    destinationPosition,
    destinationOrientation,
    10,
  );
}
window.changeFrontBumper = changeFrontBumper;

Object.assign(window, {
  nextCar,
  previousCar,
  changeSpoiler,
  changeRearBumper,
  changeFrontBumper,
  launchModelSelection,
  launchCustomization,
  launchReview,
  changeColor,
  changeMaterial,
  toggleLights,
  toggleRotation,
  toggleSettingsPanel,
  toggleGradientPlatform,
  toggleDisplayBackground,
  changeCubemap,
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

function Toolbox() {
  // Extract data from AppConfig.js
  const { cars } = AppConfig;

  // State variables to keep track of the selected car, category, and part
  const [selectedCarIndex, setSelectedCarIndex] = React.useState(0);
  const [selectedCategory, setSelectedCategory] =
    React.useState("frontBumpers");
  const [selectedPartIndex, setSelectedPartIndex] = React.useState({});

  // Function to call the specific function for a given category and element index
  const callSpecificFunction = (category, elementIndex) => {
    // Check the category and index and call the corresponding function
    if (category === "spoilers") {
      changeSpoiler(elementIndex);
    } else if (category === "frontBumpers") {
      changeFrontBumper(elementIndex);
    } else if (category === "rearBumpers") {
      changeRearBumper(elementIndex);
    }
    // ... Add other conditions for other categories and functions here
  };

  const resetToolbox = () => {
    setSelectedCategory("frontBumpers"); // Set the first category as active
    setSelectedPartIndex({}); // Clear the active part indices
  };

  // Function to switch between cars
  window.switchCar = (index) => {
    setSelectedCarIndex(index);
    resetToolbox();
  };

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
