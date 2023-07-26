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

  await ToggleGradientPlatform();
  await changeCubemap(AppConfig.cubemaps[0]);
  await InitCarAttachment();
  gSelectedMaterial = AppConfig.materials[0];
  await ChangeCar({ value: 0 });
  // SDK3DVerse.updateControllerSetting({ rotation: 10 });

  SetInformation("Loading complete");
    document.getElementById("loader").classList.add("opacity-0");
    setTimeout(function () {
      document.getElementById("loader").classList.add("hidden");
    }, 500);

    SDK3DVerse.updateControllerSetting({ speed: 1 }); //reduce scroll speed
}

//--------------------------------------------------------------------------------------------------
async function InitCarAttachment() {
  [gCarAttachment] = await SDK3DVerse.engineAPI.findEntitiesByNames(
    "CAR_ATTACHMENT"
  );
}

//--------------------------------------------------------------------------------------------------
const carName = document.getElementById("car_name");
const carDescription = document.getElementById("car_description");
const carMaximumSpeed = document.getElementById("maximum-speed-number");
const carAcceleration =  document.getElementById("acceleration-number");
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
  carDescription.innerHTML =
    gSelectedCar.description;
  carMaximumSpeed.innerHTML =
    gSelectedCar.maxSpeed;
  carAcceleration.innerHTML =
    gSelectedCar.acceleration;
  carMaximumPower.innerHTML =
    gSelectedCar.maximumPower;
  carMaximumTorque.innerHTML =
    gSelectedCar.maximumTorque;
  carEngineCapacity.innerHTML =
    gSelectedCar.engineCapacity;
  startingPrice.innerHTML = gSelectedCar.price;
  startingPriceMobile.innerHTML =
    gSelectedCar.price;
  await ApplySelectedCar();
  await InitColor();
  await ApplySelectedMaterial();
}

//--------------------------------------------------------------------------------------------------
async function ChangeSpoiler(i) {
  if (i >= gSelectedCar.spoilers.length) {
    return;
  }

  carParts.spoiler = await ChangePart(
    carParts.spoiler,
    gSelectedCar.name + " SPOILER " + i,
    gSelectedCar.spoilers[i]
  );
}

//--------------------------------------------------------------------------------------------------
async function ChangeFrontBumper(i) {
  if (i >= gSelectedCar.frontBumpers.length) {
    return;
  }

  carParts.frontBumper = await ChangePart(
    carParts.frontBumper,
    gSelectedCar.name + " FRONT BUMPER " + i,
    gSelectedCar.frontBumpers[i]
  );
}

//--------------------------------------------------------------------------------------------------
async function ChangeRearBumper(i) {
  if (i >= gSelectedCar.rearBumpers.length) {
    return;
  }

  carParts.rearBumper = await ChangePart(
    carParts.rearBumper,
    gSelectedCar.name + " REAR BUMPER " + i,
    gSelectedCar.rearBumpers[i]
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
    gSelectedCar.sceneUUID
  );
  await ChangeFrontBumper(0);
  await ChangeRearBumper(0);
  await ChangeSpoiler(0);
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
var carSwitchDelay = 0; //delay to avoid car model switch spam

async function nextCar() {
  if (isCarSwitchEnabled){
    isCarSwitchEnabled = false;
    gCarIndex = (gCarIndex + 1) % AppConfig.cars.length;
    await ChangeCar({ value: gCarIndex });
  }
  setTimeout(function () {
    isCarSwitchEnabled = true;
  }, carSwitchDelay)
}
async function previousCar() {
  if (isCarSwitchEnabled){
    isCarSwitchEnabled = false;
    gCarIndex = gCarIndex === 0 ? AppConfig.cars.length - 1 : gCarIndex - 1;
    await ChangeCar({ value: gCarIndex });
  }
  setTimeout(function () {
    isCarSwitchEnabled = true;
  }, carSwitchDelay)
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
rotateOnIcon = document.getElementById("rotate-on");
rotateOffIcon = document.getElementById("rotate-off");
function ToggleRotation() {
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
    "stop_simulation"
  );
  rotationState = false;
}

//--------------------------------------------------------------------------------------------------
async function Connect() {
  SetInformation("Connecting to 3dverse...");

  const connectionInfo = await SDK3DVerse.webAPI.createSession(
    AppConfig.sceneUUID
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
  const desc = await SDK3DVerse.webAPI.getAssetDescription(
    "material",
    gSelectedCar.paintMaterialUUID
  );
  desc.dataJson.albedo = gColor;
}

//--------------------------------------------------------------------------------------------------
async function ChangeColor(color) {
  const desc = await SDK3DVerse.webAPI.getAssetDescription(
    "material",
    gSelectedMaterial.matUUID
  );
  gColor = color;
  desc.dataJson.albedo = color;
  SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
    gSelectedCar.paintMaterialUUID,
    desc
  );
}

//--------------------------------------------------------------------------------------------------
async function ApplySelectedMaterial() {
  const desc = await SDK3DVerse.webAPI.getAssetDescription(
    "material",
    gSelectedMaterial.matUUID
  );
  desc.dataJson.albedo = gColor;
  SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
    gSelectedCar.paintMaterialUUID,
    desc
  );
}

SDK3DVerse.webAPI.getAssetDescription = async function (assetType, assetUUID) {
  return await this.httpGet(`asset/desc/${assetType}/${assetUUID}`, {
    token: this.apiToken,
  });
};

const lightOnIcon = document.getElementById("light-on");
const lightOffIcon = document.getElementById("light-off");
async function ToggleLights() {
  lightOnIcon.classList.toggle("hidden");
  lightOffIcon.classList.toggle("hidden");

  const desc1 = await SDK3DVerse.webAPI.getAssetDescription(
    "material",
    gSelectedCar.headLightsMatUUID
  );
  desc1.dataJson.emissionIntensity = gIntensity;
  SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
    gSelectedCar.headLightsMatUUID,
    desc1
  );

  const desc2 = await SDK3DVerse.webAPI.getAssetDescription(
    "material",
    gSelectedCar.rearLightsMatUUID
  );
  desc2.dataJson.emissionIntensity = gIntensity;
  SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
    gSelectedCar.rearLightsMatUUID,
    desc2
  );

  gIntensity = gIntensity === 0 ? 100 : 0;
}

// ------------------------------------------------

async function ToggleGradientPlatform() {
  const gradientPlatforms = await SDK3DVerse.engineAPI.findEntitiesByNames(
    "SM_StaticPlatform"
  );
  const gradientPlatform = gradientPlatforms[0];
  if (gradientPlatform.isVisible()) {
    await SDK3DVerse.engineAPI.setEntityVisibility(gradientPlatform, false);
  } else {
    await SDK3DVerse.engineAPI.setEntityVisibility(gradientPlatform, true);
  }
}

// --------------------------------------------------------------

const firstSectionElements = document.querySelectorAll(
  ".first-section-element"
);
const secondSectionElements = document.querySelectorAll(
  ".second-section-element"
);
const thirdSectionElements = document.querySelectorAll(
  ".third-section-element"
);

function launchModelSelection() {
  firstSectionElements.forEach((element) => {
    element.classList.remove("hidden");
  });
  secondSectionElements.forEach((element) => {
    element.classList.add("hidden");
  });

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

  hiddenButtons = document.querySelectorAll(".hidden-button");
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
}

// ---------------------------------------------------------------

toolboxPanel = document.getElementById("tab-panels");

function showTabOne() {
  document.getElementById("first-tab").classList.remove("hidden");
  document.getElementById("second-tab").classList.add("hidden");
  document.getElementById("third-tab").classList.add("hidden");

  document.getElementById("first-tab-selector").classList.add("active-tab");
  document.getElementById("second-tab-selector").classList.remove("active-tab");
  document.getElementById("third-tab-selector").classList.remove("active-tab");

  document.getElementById("tab-panels").style.borderTopLeftRadius = "0px";
  document.getElementById("tab-panels").style.borderTopRightRadius = "12px";

  toolboxPanel.classList.remove("hidden");
}

function showTabTwo() {
  document.getElementById("first-tab").classList.add("hidden");
  document.getElementById("second-tab").classList.remove("hidden");
  document.getElementById("third-tab").classList.add("hidden");

  document.getElementById("first-tab-selector").classList.remove("active-tab");
  document.getElementById("second-tab-selector").classList.add("active-tab");
  document.getElementById("third-tab-selector").classList.remove("active-tab");

  document.getElementById("tab-panels").style.borderTopLeftRadius = "12px";
  document.getElementById("tab-panels").style.borderTopRightRadius = "12px";

  toolboxPanel.classList.remove("hidden");
}

function showTabThree() {
  document.getElementById("first-tab").classList.add("hidden");
  document.getElementById("second-tab").classList.add("hidden");
  document.getElementById("third-tab").classList.remove("hidden");

  document.getElementById("first-tab-selector").classList.remove("active-tab");
  document.getElementById("second-tab-selector").classList.remove("active-tab");
  document.getElementById("third-tab-selector").classList.add("active-tab");

  document.getElementById("tab-panels").style.borderTopRightRadius = "0px";
  document.getElementById("tab-panels").style.borderTopLeftRadius = "12px";

  toolboxPanel.classList.remove("hidden");
}

const firstTabPanels = document.querySelectorAll(".first-panel-item");
const secondTabPanels = document.querySelectorAll(".second-panel-item");
const thirdTabPanels = document.querySelectorAll(".third-panel-item");

firstTabPanels.forEach((tab) => {
  tab.addEventListener("click", () => {
    firstTabPanels.forEach((tab) => tab.classList.remove("active-part"));
    tab.classList.add("active-part");
  });
});

secondTabPanels.forEach((tab) => {
  tab.addEventListener("click", () => {
    secondTabPanels.forEach((tab) => tab.classList.remove("active-part"));
    tab.classList.add("active-part");
  });
});

thirdTabPanels.forEach((tab) => {
  tab.addEventListener("click", () => {
    thirdTabPanels.forEach((tab) => tab.classList.remove("active-part"));
    tab.classList.add("active-part");
  });
});


// document.getElementsByClassName("active-part").addEventListener("click", closeToolbox);


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
async function ChangeMaterial(matIndex) {
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

// async function changeCubemap(cubemap) {
//   const environementEntitys = await SDK3DVerse.engineAPI.findEntitiesByNames(
//     "Env"
//   );
//   const environementEntity = environementEntitys[0];
//   let envComponent = environementEntity.getComponent("environment");
//   envComponent = SDK3DVerse.utils.clone(envComponent); //clone du component environment
//   envComponent.skyboxUUID = cubemap.skyboxUUID;
//   envComponent.radianceUUID = cubemap.radianceUUID;
//   envComponent.irradianceUUID = cubemap.irradianceUUID;
//   environementEntity.setComponent("environment", envComponent);
//   SDK3DVerse.engineAPI.propagateChanges();
// }

async function changeCubemap(cubemap) {
  const environmentEntities = await SDK3DVerse.engineAPI.findEntitiesByNames(
    "Env"
  );
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
      ]
    );
  } else {
    console.log("> 768px");
    changeCameraPosition(
      [-3.3017091751098633, 1.3626002073287964, 4.2906060218811035],
      [
        -0.12355230003595352, -0.3068566918373108, -0.04021146148443222,
        0.9428451061248779,
      ]
    );
  }
}

async function changeCameraPosition(
  destinationPosition,
  destinationOrientation
) {
  const cameraAPI = SDK3DVerse.engineAPI.cameraAPI;
  const viewport =
    cameraAPI.currentViewportEnabled || cameraAPI.getActiveViewports()[0];

  SDK3DVerse.engineAPI.cameraAPI.travel(
    viewport,
    destinationPosition,
    destinationOrientation,
    10
  );
}
