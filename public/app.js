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
  const viewports = [
    {
      id: 0,
      left: 0,
      top: 0,
      width: 1,
      height: 1,
      defaultControllerType: 1,
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
  SDK3DVerse.updateControllerSetting({speed: 1}); //reduce scroll speed

  SetInformation("Connection established.");
  setTimeout(function () {
    document.getElementById("loader").classList.add("opacity-0");
    setTimeout(function () {
      document.getElementById("loader").classList.add("hidden");
    }, 1000);
  }, 1000);
}

//--------------------------------------------------------------------------------------------------
async function InitCarAttachment() {
  [gCarAttachment] = await SDK3DVerse.engineAPI.findEntitiesByNames(
    "CAR_ATTACHMENT"
  );
}

//--------------------------------------------------------------------------------------------------
async function ChangeCar(e) {
  gSelectedCar = AppConfig.cars[e.value];
  await RemoveExistingCar();
  document.getElementById("car_name").innerHTML = gSelectedCar.name;
  firstWordFromId("car_name", "highlighted-word");
  document.getElementById("car_description").innerHTML =
    gSelectedCar.description;
  document.getElementById("maximum-speed-number").innerHTML =
    gSelectedCar.maxSpeed;
  document.getElementById("acceleration-number").innerHTML =
    gSelectedCar.acceleration;
  document.getElementById("maximum-power-number").innerHTML =
    gSelectedCar.maximumPower;
  document.getElementById("maximum-torque-number").innerHTML =
    gSelectedCar.maximumTorque;
  document.getElementById("engine-capacity-number").innerHTML =
    gSelectedCar.engineCapacity;
  document.getElementById("starting-price").innerHTML = gSelectedCar.price;
  document.getElementById("starting-price-mobile").innerHTML =
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

async function nextCar() {
  // gCarIndex = (gCarIndex + 1) >= AppConfig.cars.length ? 0 : gCarIndex + 1;
  gCarIndex = (gCarIndex + 1) % AppConfig.cars.length;
  await ChangeCar({ value: gCarIndex });
}
async function previousCar() {
  gCarIndex = gCarIndex === 0 ? AppConfig.cars.length - 1 : gCarIndex - 1;
  await ChangeCar({ value: gCarIndex });
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
  //const canvasSize    = {width: window.innerWidth, height: window.innerHeight};

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
function ToggleRotation() {
  const event = rotationState ? "pause_simulation" : "start_simulation";
  rotationState = !rotationState;

  SDK3DVerse.engineAPI.fireEvent(SDK3DVerse.utils.invalidUUID, event);

  document.getElementById("rotate-on").classList.toggle("hidden");
  document.getElementById("rotate-off").classList.toggle("hidden");
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

async function ToggleLights() {
  document.getElementById("light-on").classList.toggle("hidden");
  document.getElementById("light-off").classList.toggle("hidden");

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
async function ToggleGradientPlatform(){
  // const gradientPlatform  = await SDK3DVerse.engineAPI.findEntitiesByEUID("83575f30-fc35-40c1-9173-23052a93a176");
  // gradientPlatformEntity     = gradientPlatform[0];
  const gradientPlatforms  = await SDK3DVerse.engineAPI.findEntitiesByNames("SM_StaticPlatform");
  const gradientPlatform = gradientPlatforms[0];

  if (gradientPlatform.isVisible()){
    SDK3DVerse.engineAPI.setEntityVisibility(gradientPlatform, false);
  } else {
    SDK3DVerse.engineAPI.setEntityVisibility(gradientPlatform, true);
  }
  console.log("Platform Visibility changed to", gradientPlatform.isVisible());
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
  hiddenButtons.forEach((button) =>
  button.classList.remove("hidden-button"));

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

// document.onclick = function(e) {
//   if(e.target.classList.contains("active-tab")) {
//     toolboxPanel.classList.add("hidden");
//     e.target.classList.remove("active-tab");
//   }}

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
    "<span class=" + addClass + ">"
    .concat(splitWords[0], "</span>") + "&#32;" + originalString
    .substr(originalString.indexOf(" ") + 1);
}


//---------------------------------------------------------------------------
function toggleSettingsPanel() {
  document.getElementById("settings-on").classList.toggle("hidden");
  document.getElementById("settings-off").classList.toggle("hidden");

  document.getElementById("settings-panel").classList.toggle("hidden");
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
  const viewport = cameraAPI.currentViewportEnabled || cameraAPI.getActiveViewports()[0];
  const camera = viewport.getCamera();
  let cameraComponent = camera.getComponent("camera");
  cameraComponent = SDK3DVerse.utils.clone(cameraComponent); //clone du component camera
  cameraComponent.dataJSON.displayBackground = !cameraComponent.dataJSON.displayBackground;
  camera.setComponent("camera", cameraComponent);
  SDK3DVerse.engineAPI.propagateChanges();
}

async function changeCubemap(cubemap) {
  const environementEntitys  = await SDK3DVerse.engineAPI.findEntitiesByNames("Env");
  const environementEntity = environementEntitys[0];
  let envComponent = environementEntity.getComponent("environment");
  envComponent = SDK3DVerse.utils.clone(envComponent); //clone du component environment
  envComponent.skyboxUUID = cubemap.skyboxUUID;
  envComponent.radianceUUID = cubemap.radianceUUID;
  envComponent.irradianceUUID = cubemap.irradianceUUID;
  environementEntity.setComponent("environment", envComponent);
  SDK3DVerse.engineAPI.propagateChanges();
}

//---------------------------------------------------------------------------
async function changeLightIntensity(newIntensity){
  const cameraAPI = SDK3DVerse.engineAPI.cameraAPI;
  const viewport = cameraAPI.currentViewportEnabled || cameraAPI.getActiveViewports()[0];
  const camera = viewport.getCamera();
  let cameraComponent = camera.getComponent("camera");
  cameraComponent = SDK3DVerse.utils.clone(cameraComponent); //clone du component camera
  cameraComponent.dataJSON.brightness = newIntensity;
  camera.setComponent("camera", cameraComponent);
  SDK3DVerse.engineAPI.propagateChanges();
  console.log("Light updated to", newIntensity);
}

//---------------------------------------------------------------------------
var luminositySlider = document.getElementById("luminosity-slider");
var luminosityValue = document.getElementById("luminosity-value");
luminosityValue.innerHTML = luminositySlider.value;

luminositySlider.oninput = function() {
  luminosityValue.innerHTML = this.value;
  changeLightIntensity(Number(this.value));
}