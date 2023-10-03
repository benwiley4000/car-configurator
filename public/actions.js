import { AppConfig } from "./config.js";
import { CarConfiguratorStore } from "./store.js";
import {
  getAssetDescription,
  getAssetEditorAPIForMaterial,
  setCameraSettings,
} from "./utils-3dverse.js";

/** @typedef {import('./store.js').CarConfiguratorState} CarConfiguratorState */
/** @typedef {import('./AssetEditorAPI.js').default} AssetEditorAPI */

// TODO: get rid of this and use real types
const SDK3DVerse = /** @type {typeof window & { SDK3DVerse: any }} */ (window)
  .SDK3DVerse;

const INVALID_UUID = SDK3DVerse.utils.invalidUUID;

export const CarConfiguratorActions = new (class CarConfiguratorActions {
  /** @private @type {object | null} */
  bodyEntity = null;
  /**
   * @private
   * @type {{
   *   frontBumpers: object | null;
   *   rearBumpers: object | null;
   *   spoilers: object | null;
   * }}
   */
  carPartEntities = {
    frontBumpers: null,
    rearBumpers: null,
    spoilers: null,
  };
  /** @private @type {object | null} */
  environmentEntity = null;
  /** @private @type {object | null} */
  platformEntity = null;
  /** @private @type {object | null} */
  gradientPlatformEntity = null;
  /** @private @type {object | null} */
  isAnimationActiveTokenEntity = null;
  /** @type {Record<string, object>} */
  cachedMaterialAssetDescriptions = {};
  /** @type {AssetEditorAPI[]} */
  headlightAssetEditors = [];
  /** @type {AssetEditorAPI[]} */
  rearlightAssetEditors = [];
  /** @type {AssetEditorAPI[]} */
  paintAssetEditors = [];

  /**
   * @private
   * @param  {...object} updatedEntities
   */
  updateStateFromEntities = (...updatedEntities) => {
    /**
     * @typedef {Pick<
     *   CarConfiguratorState,
     *   | 'selectedCarIndex'
     *   | 'selectedParts'
     *   | 'selectedCubemap'
     *   | 'rgbGradientOn'
     *   | 'rotationOn'
     * >} StateSyncableFromEntities
     */

    // We might receive several entity updates in series,
    // so in order to not undo optimistic UI updates,
    // we should only update UI based on the entities
    // passed into the function.

    /** @type {(keyof StateSyncableFromEntities)[]} */
    let updatedKeys = [];
    if (updatedEntities.length === 0) {
      // In this case we're doing the initial sync so we update everything.
      updatedKeys = /** @type {typeof updatedKeys} */ (
        Object.keys(CarConfiguratorStore.state)
      );
    } else {
      const carPartEntitiesList = Object.values(this.carPartEntities);
      for (const entity of updatedEntities) {
        if (entity === this.bodyEntity) {
          updatedKeys.push("selectedCarIndex");
        }
        if (carPartEntitiesList.includes(entity)) {
          updatedKeys.push("selectedParts");
        }
        if (entity === this.environmentEntity) {
          updatedKeys.push("selectedCubemap");
        }
        if (entity === this.isAnimationActiveTokenEntity) {
          updatedKeys.push("rotationOn");
        }
        if (entity === this.gradientPlatformEntity) {
          updatedKeys.push("rgbGradientOn");
        }
      }
    }

    /** @type {Partial<StateSyncableFromEntities>} */
    const newState = {};

    if (updatedKeys.includes("selectedCarIndex")) {
      newState.selectedCarIndex = AppConfig.cars.findIndex(({ sceneUUID }) => {
        return this.bodyEntity.getComponent("scene_ref").value === sceneUUID;
      });
    }
    if (updatedKeys.includes("selectedParts")) {
      // if visibility on a car part is updated before its respective car body,
      // we will go ahead and update the index respective to the correct car.
      const selectedParts =
        /** @type {CarConfiguratorState['selectedParts']} */ ({});
      for (const [key, entity] of Object.entries(this.carPartEntities)) {
        const partSceneUUID = entity.getComponent("scene_ref").value;
        selectedParts[key] = Math.max(
          ...AppConfig.cars.map(({ frontBumpers }) =>
            frontBumpers.findIndex((id) => partSceneUUID === id),
          ),
          0,
        );
      }
      // only update object in state if the values are different (to avoid
      // triggering unnecessary re-render).
      /** @type {CarConfiguratorState['selectedParts']} */
      if (
        Object.entries(CarConfiguratorStore.state.selectedParts).some(
          ([key, index]) => selectedParts[key] !== index,
        )
      ) {
        newState.selectedParts = selectedParts;
      }
    }
    if (updatedKeys.includes("selectedCubemap")) {
      newState.selectedCubemap = AppConfig.cubemaps.find(({ skyboxUUID }) => {
        return (
          this.environmentEntity.getComponent("environment").skyboxUUID ===
          skyboxUUID
        );
      });
    }
    if (updatedKeys.includes("rotationOn")) {
      newState.rotationOn = this.isAnimationActiveTokenEntity
        .getComponent("tags")
        .value.includes("animationIsActive");
    }
    if (updatedKeys.includes("rgbGradientOn")) {
      newState.rgbGradientOn =
        this.gradientPlatformEntity.getComponent("mesh_ref").value ===
        this.platformEntity.getComponent("mesh_ref").value;
    }

    CarConfiguratorStore.setState(newState);
  };

  /**
   * @private
   * @param {string} [changedMaterialUUID]
   */
  updateStateFromMaterials = (changedMaterialUUID) => {
    const { selectedCarIndex } = CarConfiguratorStore.state;
    const selectedCar = AppConfig.cars[selectedCarIndex];

    /**
     * @typedef {Pick<
     *   CarConfiguratorState,
     *   | 'selectedColor'
     *   | 'selectedMaterial'
     *   | 'lightsOn'
     * >} StateSyncableFromMaterials
     */

    /** @type {Partial<StateSyncableFromMaterials>} */
    const newState = {};

    if (
      !changedMaterialUUID ||
      changedMaterialUUID === selectedCar.paintMaterialUUID
    ) {
      const carPaintDataJson =
        this.cachedMaterialAssetDescriptions[selectedCar.paintMaterialUUID]
          .dataJson;
      newState.selectedColor =
        AppConfig.colorChoices.find((color) => {
          return (
            // albedo might be empty, defaults to 1,1,1,
            // although if our scene is properly configured
            // this should never happen.
            (carPaintDataJson.albedo || [1, 1, 1]).every(
              (v, i) => color[i] === v,
            )
          );
        }) ||
        // we shouldn't need to fall back but in case we changed the color
        // in the scene to something we don't recognize, we want to store it
        // so that this color is used when we switch cars or parts.
        carPaintDataJson.albedo;
      newState.selectedMaterial = AppConfig.materials.find(({ matUUID }) => {
        const sourceMaterialDataJson =
          this.cachedMaterialAssetDescriptions[matUUID].dataJson;
        const { clearCoatRoughness, clearCoatStrength } = carPaintDataJson;
        return (
          sourceMaterialDataJson.clearCoatRoughness === clearCoatRoughness &&
          sourceMaterialDataJson.clearCoatStrength === clearCoatStrength
        );
      });
    }

    if (
      !changedMaterialUUID ||
      changedMaterialUUID === selectedCar.headLightsMatUUID
    ) {
      newState.lightsOn =
        this.cachedMaterialAssetDescriptions[selectedCar.headLightsMatUUID]
          .dataJson.emissionIntensity > 0;
    }

    CarConfiguratorStore.setState(newState);
  };

  /** @private */
  applySelectedCar() {
    const selectedCar =
      AppConfig.cars[CarConfiguratorStore.state.selectedCarIndex];
    this.applySelectedMaterial();
    this.bodyEntity.setComponent("scene_ref", { value: selectedCar.sceneUUID });
    for (const [key, entity] of Object.entries(this.carPartEntities)) {
      entity.setComponent("scene_ref", {
        value: selectedCar[key][0] || INVALID_UUID,
      });
    }
    SDK3DVerse.engineAPI.propagateChanges();
  }

  /** @private */
  applySelectedMaterial() {
    const { selectedMaterial, selectedColor } = CarConfiguratorStore.state;
    const desc = this.cachedMaterialAssetDescriptions[selectedMaterial.matUUID];
    desc.dataJson.albedo = selectedColor;
    AppConfig.cars.forEach((_, i) => {
      this.paintAssetEditors[i].updateAsset(desc);
    });
  }

  /** @private */
  applySelectedPart() {
    const { selectedPartCategory, selectedParts, selectedCarIndex } =
      CarConfiguratorStore.state;
    const selectedPartIndex = selectedParts[selectedPartCategory];
    this.carPartEntities[selectedPartCategory].setComponent("scene_ref", {
      value:
        AppConfig.cars[selectedCarIndex][selectedPartCategory][
          selectedPartIndex
        ] || INVALID_UUID,
    });
    SDK3DVerse.engineAPI.propagateChanges();
  }

  /** @private */
  applyLightsSetting() {
    const { lightsOn } = CarConfiguratorStore.state;

    const intensity = lightsOn ? 100 : 0;

    AppConfig.cars.forEach(({ headLightsMatUUID, rearLightsMatUUID }, i) => {
      const desc1 = this.cachedMaterialAssetDescriptions[headLightsMatUUID];
      desc1.dataJson.emissionIntensity = intensity;
      this.headlightAssetEditors[i].updateAsset(desc1);

      const desc2 = this.cachedMaterialAssetDescriptions[rearLightsMatUUID];
      desc2.dataJson.emissionIntensity = intensity;
      this.rearlightAssetEditors[i].updateAsset(desc2);
    });
  }

  async fetchSceneEntities() {
    const [
      environmentEntity,
      platformEntity,
      gradientPlatformEntity,
      isAnimationActiveTokenEntity,
      bodyEntity,
      frontBumperEntity,
      rearBumperEntity,
      spoilerEntity,
    ] = await SDK3DVerse.engineAPI.findEntitiesByNames(
      AppConfig.environmentEntityName,
      AppConfig.platformEntityName,
      AppConfig.gradientPlatformEntityName,
      AppConfig.isAnimationActiveTokenEntityName,
      AppConfig.sceneRefEntityNames.body,
      AppConfig.sceneRefEntityNames.frontBumpers,
      AppConfig.sceneRefEntityNames.rearBumpers,
      AppConfig.sceneRefEntityNames.spoilers,
    );
    Object.assign(this, {
      environmentEntity,
      platformEntity,
      gradientPlatformEntity,
      isAnimationActiveTokenEntity,
      bodyEntity,
    });
    this.carPartEntities.frontBumpers = frontBumperEntity;
    this.carPartEntities.rearBumpers = rearBumperEntity;
    this.carPartEntities.spoilers = spoilerEntity;

    this.updateStateFromEntities();
    SDK3DVerse.notifier.on("onEntitiesUpdated", this.updateStateFromEntities);
  }

  async cacheMaterials() {
    await Promise.all(
      [
        ...AppConfig.cars
          .map(
            ({ headLightsMatUUID, rearLightsMatUUID, paintMaterialUUID }) => {
              return [headLightsMatUUID, rearLightsMatUUID, paintMaterialUUID];
            },
          )
          .flat(),
        ...AppConfig.materials.map(({ matUUID }) => matUUID),
      ].map(async (materialUUID) => {
        const desc = await getAssetDescription("materials", materialUUID);
        this.cachedMaterialAssetDescriptions[materialUUID] = desc;
      }),
    );

    this.headlightAssetEditors = AppConfig.cars.map(({ headLightsMatUUID }) => {
      return getAssetEditorAPIForMaterial(headLightsMatUUID, (event, desc) => {
        if (event !== "assetUpdated") return;
        this.cachedMaterialAssetDescriptions[headLightsMatUUID] = desc;
        this.updateStateFromMaterials(headLightsMatUUID);
      });
    });
    this.rearlightAssetEditors = AppConfig.cars.map(({ rearLightsMatUUID }) => {
      return getAssetEditorAPIForMaterial(rearLightsMatUUID, (event, desc) => {
        if (event !== "assetUpdated") return;
        this.cachedMaterialAssetDescriptions[rearLightsMatUUID] = desc;
        this.updateStateFromMaterials(rearLightsMatUUID);
      });
    });
    this.paintAssetEditors = AppConfig.cars.map(({ paintMaterialUUID }) => {
      return getAssetEditorAPIForMaterial(paintMaterialUUID, (event, desc) => {
        if (event !== "assetUpdated") return;
        this.cachedMaterialAssetDescriptions[paintMaterialUUID] = desc;
        this.updateStateFromMaterials(paintMaterialUUID);
      });
    });
  }

  /**
   * @param {number} selectedCarIndex
   */
  changeCar(selectedCarIndex) {
    CarConfiguratorStore.setState({
      selectedCarIndex,
      selectedParts: { frontBumpers: 0, rearBumpers: 0, spoilers: 0 },
      selectedPartCategory: "frontBumpers",
    });
    this.applySelectedCar();
  }

  /**
   * @param {[number, number, number]} selectedColor
   */
  changeSelectedColor(selectedColor) {
    CarConfiguratorStore.setState({ selectedColor });
    this.applySelectedMaterial();
  }

  /**
   * @param {number} matIndex
   */
  changeSelectedMaterial(matIndex) {
    CarConfiguratorStore.setState({
      selectedMaterial: AppConfig.materials[matIndex],
    });
    this.applySelectedMaterial();
  }

  /**
   * @param {CarConfiguratorState['selectedPartCategory']} selectedPartCategory
   */
  changeSelectedPartCategory(selectedPartCategory) {
    CarConfiguratorStore.setState({ selectedPartCategory });
  }

  /**
   * @param {number} partIndex
   */
  changeSelectedPart(partIndex) {
    const { selectedParts, selectedPartCategory } = CarConfiguratorStore.state;
    CarConfiguratorStore.setState({
      selectedParts: {
        ...selectedParts,
        [selectedPartCategory]: partIndex,
      },
    });
    this.applySelectedPart();
  }

  /**
   * @param {number} cubemapIndex
   */
  changeCubemap(cubemapIndex) {
    CarConfiguratorStore.setState({
      selectedCubemap: AppConfig.cubemaps[cubemapIndex],
    });
    const { skyboxUUID, radianceUUID, irradianceUUID } =
      CarConfiguratorStore.state.selectedCubemap;
    this.environmentEntity.setComponent("environment", {
      skyboxUUID,
      radianceUUID,
      irradianceUUID,
    });
    SDK3DVerse.engineAPI.propagateChanges();
  }

  toggleLightsOn() {
    CarConfiguratorStore.setState({
      lightsOn: !CarConfiguratorStore.state.lightsOn,
    });
    this.applyLightsSetting();
  }

  toggleRotationOn() {
    CarConfiguratorStore.setState({
      rotationOn: !CarConfiguratorStore.state.rotationOn,
    });
    const event = CarConfiguratorStore.state.rotationOn
      ? "start_simulation"
      : "pause_simulation";
    SDK3DVerse.engineAPI.fireEvent(INVALID_UUID, event);

    // We are going to use a blank entity in the scene to track the
    // rotation state until we have a way to query animation state
    const tagsValue = CarConfiguratorStore.state.rotationOn
      ? ["animationIsActive"]
      : [];
    this.isAnimationActiveTokenEntity.setComponent("tags", {
      value: CarConfiguratorStore.state.rotationOn ? ["animationIsActive"] : [],
    });
    SDK3DVerse.engineAPI.propagateChanges();
  }

  toggleRgbGradientOn() {
    CarConfiguratorStore.setState({
      rgbGradientOn: !CarConfiguratorStore.state.rgbGradientOn,
    });
    this.gradientPlatformEntity.setComponent("mesh_ref", {
      value: CarConfiguratorStore.state.rgbGradientOn
        ? this.platformEntity.getComponent("mesh_ref").value
        : INVALID_UUID,
    });
    SDK3DVerse.engineAPI.propagateChanges();
  }

  /**
   * @param {number} userCameraLuminosity
   */
  changeUserCameraLuminosity(userCameraLuminosity) {
    CarConfiguratorStore.setState({ userCameraLuminosity });
    setCameraSettings({
      brightness: CarConfiguratorStore.state.userCameraLuminosity,
    });
  }

  /**
   * @param {CarConfiguratorState['currentStep']} currentStep
   */
  changeCurrentStep(currentStep) {
    CarConfiguratorStore.setState({ currentStep });
    setCameraSettings({
      displayBackground: CarConfiguratorStore.state.currentStep === "review",
    });
  }

  /**
   * @param {string | null} sceneLoadingState
   */
  setSceneLoadingState(sceneLoadingState) {
    CarConfiguratorStore.setState({ sceneLoadingState });
  }
})();
