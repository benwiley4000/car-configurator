//--------------------------------------------------------------------------------------------------
window.addEventListener("load", InitApp);

//--------------------------------------------------------------------------------------------------
async function InitApp() {
  SDK3DVerse.setViewports(null);
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

  if (sessionCreated) {
    // This must be done before attaching the camera & controller scripts.
    // The hasPlayer allows to start the simulation if the session was created by something else
    // than the current application. But it means we could start simulation more than one time
    // in the same session if all player have left and new one comes in.
    console.debug("Start simulation");
    SDK3DVerse.engineAPI.fireEvent(
      SDK3DVerse.utils.invalidUUID,
      "start_simulation"
    );
  }
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
function FadeOut() {
  const fade = document.getElementById("fade");
  fade.style.animation = "fadeOut linear 2s";
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

//--------------------------------------------------------------------------------------------------
async function Connect() {
  SetInformation("Connecting to 3dverse...");

  const connectionInfo = await SDK3DVerse.webAPI.createOrJoinSession(
    AppConfig.sceneUUID
  );
  SDK3DVerse.setupDisplay(document.getElementById("display_canvas"));
  SDK3DVerse.startStreamer(connectionInfo);
  await SDK3DVerse.connectToEditor();

  SetInformation("Connection to 3dverse established...");
  return connectionInfo.sessionCreated;
}
