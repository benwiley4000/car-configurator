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

  SetInformation("Connection established.");
  setTimeout(function () {
    document.getElementById("loader").classList.add("opacity-0");
    setTimeout(function () {
      document.getElementById("loader").classList.add("hidden");
    }, 1000);
  }, 1000);

  await InitCarAttachment();

  gSelectedMaterial = AppConfig.materials[0];
  await ChangeCar({ value: 0 });
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
async function ChangeSpoiler(e) {
  const i = e.value;
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
async function ChangeFrontBumper(e) {
  const i = e.value;
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
async function ChangeRearBumper(e) {
  const i = e.value;
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
  await ChangeFrontBumper({ value: 0 });
  await ChangeRearBumper({ value: 0 });
  await ChangeSpoiler({ value: 0 });
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

  if (document.getElementById("rotate-on").classList.contains("hidden")) {
    document.getElementById("rotate-on").classList.remove("hidden");
    document.getElementById("rotate-off").classList.add("hidden");
  } else {
    document.getElementById("rotate-on").classList.add("hidden");
    document.getElementById("rotate-off").classList.remove("hidden");
  }
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
  gColor = desc.dataJson.albedo;
}

//--------------------------------------------------------------------------------------------------
async function ChangeColor(color) {
  const desc = await SDK3DVerse.webAPI.getAssetDescription(
    "material",
    gSelectedMaterial.matUUID
  );
  desc.dataJson.albedo = color;
  SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
    gSelectedCar.paintMaterialUUID,
    desc
  );
}

//--------------------------------------------------------------------------------------------------
async function ChangeMaterial(e) {
  const matIndex = e.value;
  gSelectedMaterial = AppConfig.materials[matIndex];
  await ApplySelectedMaterial();
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

  document.getElementById("light-on").classList.toggle("hidden");
}

// --------------------------------------------------------------

function highlightTitle(){
  let title = document.getElementById("car-name");
  let firstWord = title.onsecuritypolicyviolation(' ')[0];
  console.log(firstWord);
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

document.onclick = function(e) {
  if(e.target.id !== "first-tab-selector" && e.target.id !== "second-tab-selector" && e.target.id !== "third-tab-selector" && e.target.id !== "tab-panels") {
    toolboxPanel.classList.add("hidden")
    document.getElementById("first-tab-selector").classList.remove("active-tab");
    document.getElementById("second-tab-selector").classList.remove("active-tab");
    document.getElementById("third-tab-selector").classList.remove("active-tab");
  }}

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
