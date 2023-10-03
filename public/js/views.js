/// <reference path="./vendor/handlebars.d.ts" />

import { AppConfig } from "./config.js";
import { CarConfiguratorStore } from "./store.js";
import { CarConfiguratorActions } from "./actions.js";

/** @typedef {import('./store.js').CarConfiguratorState} CarConfiguratorState */

/** @global */
export const CarSelectionView = new (class CarSelectionView {
  template = Handlebars.compile(
    document.getElementById("model-selection-template").innerHTML,
  );

  constructor() {
    this.render();
    this.updateVisibility();
    CarConfiguratorStore.subscribe(["selectedCarIndex"], this.render);
    CarConfiguratorStore.subscribe(["currentStep"], this.updateVisibility);
  }

  /** @private */
  updateVisibility = () => {
    document
      .getElementById("model-selection")
      .classList.toggle(
        "hidden",
        CarConfiguratorStore.state.currentStep !== "modelSelection",
      );
  };

  /** @private */
  render = () => {
    const selectedCar =
      AppConfig.cars[CarConfiguratorStore.state.selectedCarIndex];
    var [firstWord, ...otherWords] = selectedCar.name.split(" ");
    document.getElementById("model-selection").innerHTML = this.template({
      arrows: [{ direction: "left" }, { direction: "right" }],
      firstWord,
      afterFirstWord: otherWords.join(" "),
      description: selectedCar.description,
      stats: [
        { label: "Maximum Speed", unit: "KPH", value: selectedCar.maxSpeed },
        { label: "0-100kph", unit: "S", value: selectedCar.acceleration },
        { label: "Maximum Power", unit: "PS", value: selectedCar.maximumPower },
        {
          label: "Maximum Torque",
          unit: "NM",
          value: selectedCar.maximumTorque,
        },
        {
          label: "Engine Capacity",
          unit: "CC",
          value: selectedCar.engineCapacity,
        },
      ],
    });
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
export const CarPartsView = new (class CarPartsView {
  /** @private */
  template = Handlebars.compile(
    document.getElementById("car-parts-template").innerHTML,
  );

  constructor() {
    this.render();
    this.updateVisibility();
    CarConfiguratorStore.subscribe(
      ["selectedPartCategory", "selectedParts", "selectedCarIndex"],
      this.render,
    );
    CarConfiguratorStore.subscribe(["currentStep"], this.updateVisibility);
  }

  /** @private */
  updateVisibility = () => {
    document
      .getElementById("car-parts")
      .classList.toggle(
        "hidden",
        CarConfiguratorStore.state.currentStep !== "customization",
      );
  };

  /** @private */
  render = () => {
    const { selectedPartCategory, selectedParts, selectedCarIndex } =
      CarConfiguratorStore.state;

    const selectedPartIndex = selectedParts[selectedPartCategory];

    document.getElementById("car-parts").innerHTML = this.template({
      availableCategories: Object.keys(AppConfig.partCategoryNames)
        .filter((category) => AppConfig.cars[selectedCarIndex][category].length)
        .map((name) => ({
          name,
          displayName: AppConfig.partCategoryNames[name],
          isSelected: selectedPartCategory === name,
        })),
      selectedCategoryData: AppConfig.cars[selectedCarIndex][
        selectedPartCategory
      ].map((_, i) => ({
        displayName: `${AppConfig.partCategoryNames[selectedPartCategory]} ${
          i + 1
        }`,
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
export const CarColorsView = new (class CarColorsView {
  template = Handlebars.compile(
    document.getElementById("color-selection-template").innerHTML,
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
    this.updateVisibility();
    CarConfiguratorStore.subscribe(["selectedColor"], this.render);
    CarConfiguratorStore.subscribe(["currentStep"], this.updateVisibility);
  }

  /** @private */
  updateVisibility = () => {
    document
      .getElementById("color-selection")
      .classList.toggle(
        "hidden",
        CarConfiguratorStore.state.currentStep !== "customization",
      );
  };

  /** @private */
  render = () => {
    const { selectedColor } = CarConfiguratorStore.state;
    document.getElementById("color-selection").innerHTML = this.template({
      colors: [...this.cssToSdkColorChoicesMap.entries()].map(
        ([cssColor, sdkColor]) => ({
          cssColor,
          isActive: sdkColor === selectedColor,
        }),
      ),
    });
  };

  // UI EVENT HANDLERS:

  /**
   * @param {string} cssColor
   */
  handleChangeSelectedColor(cssColor) {
    CarConfiguratorActions.changeSelectedColor(
      this.cssToSdkColorChoicesMap.get(cssColor),
    );
  }
})();

export const CarMaterialsView = new (class CarMaterialsView {
  constructor() {
    this.render();
    this.updateVisibility();
    CarConfiguratorStore.subscribe(["selectedMaterial"], this.render);
    CarConfiguratorStore.subscribe(["currentStep"], this.updateVisibility);
  }

  /** @private */
  updateVisibility = () => {
    document
      .getElementById("materials-selection")
      .classList.toggle(
        "hidden",
        CarConfiguratorStore.state.currentStep !== "customization",
      );
  };

  /** @private */
  render = () => {
    const { selectedMaterial } = CarConfiguratorStore.state;
    document.querySelectorAll(".material-icon").forEach((icon, i) => {
      icon.classList.toggle(
        "active-material",
        AppConfig.materials.indexOf(selectedMaterial) === i,
      );
    });
  };

  // UI EVENT HANDLERS:

  /**
   * @param {number} materialIndex
   */
  handleChangeSelectedMaterial(materialIndex) {
    CarConfiguratorActions.changeSelectedMaterial(materialIndex);
  }
})();

/** @global */
export const CarBackgroundView = new (class CarBackgroundView {
  template = Handlebars.compile(
    document.getElementById("cubemap-selection-template").innerHTML,
  );

  constructor() {
    this.initialRender();
    this.updateVisibility();
    CarConfiguratorStore.subscribe(["selectedCubemap"], this.updateRender);
    CarConfiguratorStore.subscribe(["currentStep"], this.updateVisibility);
  }

  /** @private */
  initialRender() {
    document.getElementById("cubemap-selection").innerHTML = this.template({
      cubemaps: AppConfig.cubemaps.map((cubemap) => ({
        displayName: cubemap.name,
        previewSrc: cubemap.previewSrc,
      })),
    });
    this.updateRender();
  }

  /** @private */
  updateVisibility = () => {
    document
      .getElementById("cubemap-selection")
      .classList.toggle(
        "hidden",
        CarConfiguratorStore.state.currentStep !== "review",
      );
  };

  /** @private */
  updateRender = () => {
    const { selectedCubemap } = CarConfiguratorStore.state;
    document.querySelectorAll(".cubemap").forEach((cubemap, i) => {
      cubemap.classList.toggle(
        "active-cubemap",
        AppConfig.cubemaps.indexOf(selectedCubemap) === i,
      );
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
export const CarConfigStepperView = new (class CarConfigStepperView {
  template = Handlebars.compile(
    document.getElementById("stepper-buttons-template").innerHTML,
  );

  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(
      ["currentStep", "selectedCarIndex"],
      this.render,
    );
  }

  /** @private */
  render = () => {
    const { currentStep, selectedCarIndex } = CarConfiguratorStore.state;
    const selectedCar = AppConfig.cars[selectedCarIndex];

    /** @type {typeof currentStep} */
    const prevStep =
      currentStep === "modelSelection"
        ? null
        : currentStep === "customization"
        ? "modelSelection"
        : "customization";
    /** @type {typeof currentStep} */
    const nextStep =
      currentStep === "modelSelection"
        ? "customization"
        : currentStep === "customization"
        ? "review"
        : null;
    const nextStepName =
      nextStep === "customization"
        ? "Customize"
        : nextStep === "review"
        ? "Confirm & Review"
        : null;
    const carPrice = selectedCar.price;

    document.getElementById("stepper-buttons").innerHTML = this.template({
      prevStep,
      nextStep,
      nextStepName,
      carPrice,
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
export const CarOptionsBarView = new (class CarOptionsBarView {
  isSettingsPanelOpen = false;

  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(
      ["lightsOn", "rotationOn", "rgbGradientOn", "userCameraLuminosity"],
      this.render,
    );
    window.addEventListener("click", (e) => {
      const settingsToggle = document.getElementById("settings-toggle");
      const settingsPanel = document.getElementById("settings-panel");
      if (
        !settingsToggle.contains(/** @type {Node} */ (e.target)) &&
        !settingsPanel.contains(/** @type {Node} */ (e.target))
      ) {
        this.isSettingsPanelOpen = false;
        this.render();
      }
    });
  }

  /** @private */
  render = () => {
    document
      .getElementById("light-toggle")
      .classList.toggle("active", CarConfiguratorStore.state.lightsOn);

    document
      .getElementById("rotate-toggle")
      .classList.toggle("active", CarConfiguratorStore.state.rotationOn);

    document
      .getElementById("settings-toggle")
      .classList.toggle("active", this.isSettingsPanelOpen);

    document
      .getElementById("settings-panel")
      .classList.toggle("hidden", !this.isSettingsPanelOpen);

    /** @type {HTMLInputElement} */ (
      document.getElementById("rgb-gradient")
    ).checked = CarConfiguratorStore.state.rgbGradientOn;

    const luminosityValue =
      CarConfiguratorStore.state.userCameraLuminosity.toString();
    document.getElementById("luminosity-value").innerHTML = luminosityValue;
    /** @type {HTMLInputElement} */ (
      document.getElementById("luminosity-slider")
    ).value = luminosityValue;
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
export const CarSceneLoadingView = new (class CarSceneLoadingView {
  constructor() {
    this.render();
    CarConfiguratorStore.subscribe(["sceneLoadingState"], this.render);
  }

  /** @private */
  render = () => {
    const { sceneLoadingState } = CarConfiguratorStore.state;

    const loader = document.getElementById("loader");
    loader.classList.toggle("hidden", !sceneLoadingState);
    loader.classList.toggle(
      "opacity-0",
      sceneLoadingState === "Loading complete.",
    );

    document.getElementById("info_span").innerHTML = sceneLoadingState || "";
  };
})();
