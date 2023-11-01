/// <reference path="./vendor/handlebars.d.ts" />

import { AppConfig } from "./config.js";
import { CarConfiguratorStore } from "./store.js";
import { CarConfiguratorActions } from "./actions.js";

/** @typedef {import('./store.js').CarConfiguratorState} CarConfiguratorState */

/** @global */
export const LoadingOverlayView = new (class LoadingOverlayView {
  fadeoutTimeout = 0;

  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(
      ["sceneLoadingState", "isSceneLoaded"],
      this.render,
    );
  }

  /** @private */
  render = () => {
    const { sceneLoadingState, isSceneLoaded } = CarConfiguratorStore.state;

    const loader = /** @type {HTMLElement} */ (
      document.getElementById("loading-overlay")
    );
    loader.classList.toggle("fadeout", isSceneLoaded);

    /** @type {HTMLElement} */ (
      document.getElementById("info-span")
    ).innerHTML = sceneLoadingState;
  };
})();

/** @global */
export const TimeoutOverlayView = new (class TimeoutOverlayView {
  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(
      ["isUserInactive", "wasDisconnected"],
      this.render,
    );
  }

  /** @private */
  render = () => {
    const { isUserInactive, wasDisconnected } = CarConfiguratorStore.state;
    const timeoutOverlay = /** @type {HTMLElement} */ (
      document.getElementById("timeout-overlay")
    );
    timeoutOverlay.classList.toggle(
      "hidden",
      !isUserInactive && !wasDisconnected,
    );
    /** @type {HTMLElement} */ (
      timeoutOverlay.querySelector(".inactive-message")
    ).classList.toggle("hidden", !isUserInactive);
    /** @type {HTMLElement} */ (
      timeoutOverlay.querySelector(".disconnected-message")
    ).classList.toggle("hidden", !wasDisconnected);
  };

  stayConnected() {
    CarConfiguratorActions.setUserIsActiveAgain();
  }
})();

/** @global */
export const CarSelectionView = new (class CarSelectionView {
  template = Handlebars.compile(
    /** @type {HTMLElement} */ (document.getElementById("car-heading-template"))
      .innerHTML,
  );

  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(["selectedCarIndex"], this.render);
  }

  /** @private */
  render = () => {
    const selectedCar =
      AppConfig.cars[CarConfiguratorStore.state.selectedCarIndex];
    var [firstWord, ...otherWords] = selectedCar.name.split(" ");
    /** @type {HTMLElement} */ (
      document.getElementById("car-heading")
    ).innerHTML = this.template({
      firstWord,
      afterFirstWord: otherWords.join(" "),
      credits: selectedCar.credits,
    });
  };

  // UI EVENT HANDLERS:

  handleNextCar() {
    const { selectedCarIndex } = CarConfiguratorStore.state;
    CarConfiguratorActions.changeCar(
      (selectedCarIndex + 1) % AppConfig.cars.length,
    );
  }
})();

/** @global */
export const CarColorsView = new (class CarColorsView {
  template = Handlebars.compile(
    /** @type {HTMLElement} */ (
      document.getElementById("colors-selection-template")
    ).innerHTML,
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
    CarConfiguratorStore.subscribe(["selectedColor"], this.render);
  }

  /** @private */
  render = () => {
    const { selectedColor } = CarConfiguratorStore.state;
    /** @type {HTMLElement} */ (
      document.getElementById("colors-selection")
    ).innerHTML = this.template({
      colors: [...this.cssToSdkColorChoicesMap.entries()].map(
        ([cssColor, sdkColor]) => {
          const averageRgb =
            sdkColor.reduce((total, value) => total + value, 0) / 3;
          // All the colors are pretty dark but we display them in the menu
          // with double brightness, so we want to check if their average is
          // above 0.25, not 0.5.
          const useDarkAccent = averageRgb > 0.25;
          return {
            cssColor,
            isActive: sdkColor === selectedColor,
            useDarkAccent,
          };
        },
      ),
    });
  };

  // UI EVENT HANDLERS:

  /** @param {string} cssColor */
  handleChangeSelectedColor(cssColor) {
    const newSelectedColor = this.cssToSdkColorChoicesMap.get(cssColor);
    if (newSelectedColor) {
      CarConfiguratorActions.changeSelectedColor(newSelectedColor);
    } else {
      throw new Error(`Unrecognized color: ${cssColor}`);
    }
  }
})();

export const CarMaterialsView = new (class CarMaterialsView {
  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(["selectedMaterial"], this.render);
  }

  /** @private */
  render = () => {
    const { selectedMaterial } = CarConfiguratorStore.state;
    document
      .querySelectorAll("#materials-selection .material-icon")
      .forEach((icon, i) => {
        icon.classList.toggle(
          "active-material",
          Boolean(
            selectedMaterial &&
              AppConfig.materials.indexOf(selectedMaterial) === i,
          ),
        );
      });
  };

  // UI EVENT HANDLERS:

  /** @param {number} materialIndex */
  handleChangeSelectedMaterial(materialIndex) {
    CarConfiguratorActions.changeSelectedMaterial(materialIndex);
  }
})();

/** @global */
export const CarCubemapView = new (class CarCubemapView {
  template = Handlebars.compile(
    /** @type {HTMLElement} */ (
      document.getElementById("cubemap-selection-template")
    ).innerHTML,
  );

  constructor() {
    this.initialRender();
    CarConfiguratorStore.subscribe(["selectedCubemap"], this.updateRender);
  }

  /** @private */
  initialRender() {
    /** @type {HTMLElement} */ (
      document.getElementById("cubemap-selection")
    ).innerHTML = this.template({
      cubemaps: AppConfig.cubemaps.map((cubemap) => ({
        displayName: cubemap.name,
        previewSrc: cubemap.previewSrc,
      })),
    });
    this.updateRender();
  }

  /** @private */
  updateRender = () => {
    const { selectedCubemap } = CarConfiguratorStore.state;
    document
      .querySelectorAll("#cubemap-selection .cubemap")
      .forEach((cubemap, i) => {
        cubemap.classList.toggle(
          "active-cubemap",
          AppConfig.cubemaps.indexOf(selectedCubemap) === i,
        );
      });
  };

  // UI EVENT HANDLERS:

  /** @param {number} cubemapIndex */
  handleChangeCubemap(cubemapIndex) {
    CarConfiguratorActions.changeCubemap(cubemapIndex);
  }
})();

/** @global */
export const CarOptionsView = new (class CarOptionsView {
  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(
      ["lightsOn", "rotationOn", "rgbGradientOn", "userCameraLuminosity"],
      this.render,
    );
  }

  /** @private */
  render = () => {
    /** @type {HTMLElement} */ (
      document.getElementById("light-toggle")
    ).classList.toggle("active", CarConfiguratorStore.state.lightsOn);

    /** @type {HTMLElement} */ (
      document.getElementById("rotate-toggle")
    ).classList.toggle("active", CarConfiguratorStore.state.rotationOn);

    /** @type {HTMLInputElement} */ (
      document.getElementById("rgb-gradient")
    ).checked = CarConfiguratorStore.state.rgbGradientOn;

    const luminosityValue =
      CarConfiguratorStore.state.userCameraLuminosity.toString();
    /** @type {HTMLElement} */ (
      document.getElementById("luminosity-value")
    ).innerHTML = luminosityValue;
    /** @type {HTMLInputElement} */ (
      document.getElementById("luminosity-slider")
    ).value = luminosityValue;
  };

  // UI EVENT HANDLERS:

  handleToggleLightsOn() {
    CarConfiguratorActions.toggleLightsOn();
  }

  handleToggleRotationOn() {
    CarConfiguratorActions.toggleRotationOn();
  }

  handleToggleRgbGradientOn() {
    CarConfiguratorActions.toggleRgbGradientOn();
  }

  /** @param {{ target: HTMLInputElement }} e */
  handleChangeUserCameraLuminosity(e) {
    const luminosity = Number(e.target.value);
    CarConfiguratorActions.changeUserCameraLuminosity(luminosity);
  }
})();

export const SharePromptView = new (class SharePromptView {
  constructor() {
    const template = Handlebars.compile(
      /** @type {HTMLElement} */ (
        document.getElementById("share-prompt-template")
      ).innerHTML,
    );
    const url = window.location.href;
    const urlEncoded = encodeURIComponent(url);
    /** @type {HTMLElement} */ (
      document.getElementById("share-prompt")
    ).innerHTML = template({ url, urlEncoded });
  }
})();
