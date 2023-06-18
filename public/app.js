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
  setTimeout(function(){
    document.getElementById("loader").classList.add("opacity-0");
    setTimeout(function(){document.getElementById("loader").classList.add("hidden");}, 1000);
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
  document.getElementById("car_description").innerHTML = gSelectedCar.description;
  document.getElementById("maximum-speed-number").innerHTML = gSelectedCar.maxSpeed;
  document.getElementById("acceleration-number").innerHTML = gSelectedCar.acceleration;
  document.getElementById("maximum-power-number").innerHTML = gSelectedCar.maximumPower;
  document.getElementById("maximum-torque-number").innerHTML = gSelectedCar.maximumTorque;
  document.getElementById("engine-capacity-number").innerHTML = gSelectedCar.engineCapacity;
  document.getElementById("starting-price").innerHTML = gSelectedCar.price;
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

async function nextCar(){
  // gCarIndex = (gCarIndex + 1) >= AppConfig.cars.length ? 0 : gCarIndex + 1;
  gCarIndex = (gCarIndex + 1)% AppConfig.cars.length;
  await ChangeCar({ value: gCarIndex });
}
async function previousCar(){
  gCarIndex = gCarIndex === 0 ? AppConfig.cars.length-1 : gCarIndex - 1;
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

  if (document.getElementById("rotate-on").classList.contains("hidden")){
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
async function ChangeColor() {
  gColor = [Math.random(), Math.random(), Math.random()];
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
  SDK3DVerse.engineAPI.ftlAPI.updateMaterial(gSelectedCar.headLightsMatUUID, desc1);

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


  if (document.getElementById("light-on").classList.contains("hidden")){
    document.getElementById("light-on").classList.remove("hidden");
    document.getElementById("light-off").classList.add("hidden");
  } else {
    document.getElementById("light-on").classList.add("hidden");
    document.getElementById("light-off").classList.remove("hidden");
  }
  
}

function launchCustomization(){
  document.getElementById("previous-model").classList.add("hidden");
  document.getElementById("next-model").classList.add("hidden");
  document.getElementById("model-title").classList.add("hidden");
  document.getElementById("model-infos").classList.add("hidden");
  document.getElementById("select-model-button").classList.add("hidden");

  document.getElementById("colors").classList.remove("hidden");
  document.getElementById("part-selection").classList.remove("hidden");
  document.getElementById("select-parts-button").classList.remove("hidden");
  document.getElementById("back-to-model-button").classList.remove("hidden");
  document.getElementById("final-price").innerHTML = gSelectedCar.price;
}

function launchModelSelection(){
  document.getElementById("previous-model").classList.remove("hidden");
  document.getElementById("next-model").classList.remove("hidden");
  document.getElementById("model-title").classList.remove("hidden");
  document.getElementById("model-infos").classList.remove("hidden");
  document.getElementById("select-model-button").classList.remove("hidden");

  document.getElementById("colors").classList.add("hidden");
  document.getElementById("part-selection").classList.add("hidden");
  document.getElementById("select-parts-button").classList.add("hidden");
  document.getElementById("back-to-model-button").classList.add("hidden");
  document.getElementById("starting-price").innerHTML = gSelectedCar.price;
}