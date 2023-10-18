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
  /**
   * @typedef {{ getComponent: Function; setComponent: Function }} Entity
   * @typedef {object} EntityMap
   * @property {Entity} environment
   * @property {Entity} platform
   * @property {Entity} gradientPlatform
   * @property {Entity} isAnimationActiveToken
   * @property {Entity} body
   */
  /** @private @type {EntityMap | null} */
  entities = null;
  /**
   * @type {Record<string, import("./utils-3dverse.js").AssetDescription>
   *   | null}
   */
  cachedMaterialAssetDescriptions = null;
  /** @type {AssetEditorAPI[] | null} */
  headlightAssetEditors = [];
  /** @type {AssetEditorAPI[] | null} */
  rearlightAssetEditors = [];
  /** @type {AssetEditorAPI[] | null} */
  paintAssetEditors = [];
  /** @type {(() => void) | null} */
  resumeCallback = null;

  /**
   * Only reason to use this is to satisfy typescript for nullable variable
   * access. Throws an error if the value is null.
   * @private
   * @template {'entities'
   *   | 'cachedMaterialAssetDescriptions'
   *   | 'headlightAssetEditors'
   *   | 'rearlightAssetEditors'
   *   | 'paintAssetEditors'
   * } T
   * @param {T} key
   * @returns {NonNullable<(typeof this)[T]>}
   */
  safeGet(key) {
    if (this[/** @type {keyof this} */ (key)] === null) {
      throw new Error(
        `Tried to access key ${/** @type {string} */ (key)} before definition`,
      );
    }
    // @ts-ignore ts can't figure this one out, oh well
    return this[/** @type {keyof this} */ (key)];
  }

  /**
   * @private
   * @param  {Entity[]} [updatedEntities]
   */
  updateStateFromEntities = (updatedEntities = []) => {
    console.log(updatedEntities)
    const entities = this.safeGet("entities");
    /**
     * @typedef {Pick<
     *   CarConfiguratorState,
     *   | 'selectedCarIndex'
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
      for (const entity of updatedEntities) {
        if (entity === entities.body) {
          updatedKeys.push("selectedCarIndex");
        }
        if (entity === entities.environment) {
          updatedKeys.push("selectedCubemap");
        }
        if (entity === entities.isAnimationActiveToken) {
          updatedKeys.push("rotationOn");
        }
        if (entity === entities.gradientPlatform) {
          updatedKeys.push("rgbGradientOn");
        }
      }
    }

    /** @type {Partial<StateSyncableFromEntities>} */
    const newState = {};

    if (updatedKeys.includes("selectedCarIndex")) {
      newState.selectedCarIndex = AppConfig.cars.findIndex(({ sceneUUID }) => {
        return entities.body.getComponent("scene_ref").value === sceneUUID;
      });
    }
    if (updatedKeys.includes("selectedCubemap")) {
      newState.selectedCubemap = AppConfig.cubemaps.find(({ skyboxUUID }) => {
        return (
          entities.environment.getComponent("environment").skyboxUUID ===
          skyboxUUID
        );
      });
    }
    if (updatedKeys.includes("rotationOn")) {
      newState.rotationOn = entities.isAnimationActiveToken
        .getComponent("tags")
        .value.includes("animationIsActive");
    }
    if (updatedKeys.includes("rgbGradientOn")) {
      newState.rgbGradientOn =
        entities.gradientPlatform.getComponent("mesh_ref").value ===
        entities.platform.getComponent("mesh_ref").value;
    }

    CarConfiguratorStore.setState(newState);
  };

  /**
   * @private
   * @param {string} [changedMaterialUUID]
   */
  updateStateFromMaterials = (changedMaterialUUID) => {
    const cachedMaterialAssetDescriptions = this.safeGet(
      "cachedMaterialAssetDescriptions",
    );
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
        cachedMaterialAssetDescriptions[selectedCar.paintMaterialUUID].dataJson;
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
        // so that this color is used when we switch cars.
        carPaintDataJson.albedo;
      newState.selectedMaterial = AppConfig.materials.find(({ matUUID }) => {
        const sourceMaterialDataJson =
          cachedMaterialAssetDescriptions[matUUID].dataJson;
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
        (cachedMaterialAssetDescriptions[selectedCar.headLightsMatUUID].dataJson
          .emissionIntensity || 0) > 0;
    }

    CarConfiguratorStore.setState(newState);
  };

  /** @private */
  applySelectedCar() {
    const entities = this.safeGet("entities");
    const selectedCar =
      AppConfig.cars[CarConfiguratorStore.state.selectedCarIndex];
    this.applySelectedMaterial();
    entities.body.setComponent("scene_ref", { value: selectedCar.sceneUUID });
    SDK3DVerse.engineAPI.commitChanges();
  }

  /** @private */
  applySelectedMaterial() {
    const cachedMaterialAssetDescriptions = this.safeGet(
      "cachedMaterialAssetDescriptions",
    );
    const paintAssetEditors = this.safeGet("paintAssetEditors");
    const { selectedMaterial, selectedColor } = CarConfiguratorStore.state;
    const desc = cachedMaterialAssetDescriptions[selectedMaterial.matUUID];
    desc.dataJson.albedo = selectedColor;
    AppConfig.cars.forEach((_, i) => {
      paintAssetEditors[i].updateAsset(desc);
    });
  }

  /** @private */
  applyLightsSetting() {
    const cachedMaterialAssetDescriptions = this.safeGet(
      "cachedMaterialAssetDescriptions",
    );
    const headlightAssetEditors = this.safeGet("headlightAssetEditors");
    const rearlightAssetEditors = this.safeGet("rearlightAssetEditors");
    const { lightsOn } = CarConfiguratorStore.state;

    const intensity = lightsOn ? 100 : 0;

    AppConfig.cars.forEach(({ headLightsMatUUID, rearLightsMatUUID }, i) => {
      const desc1 = cachedMaterialAssetDescriptions[headLightsMatUUID];
      desc1.dataJson.emissionIntensity = intensity;
      headlightAssetEditors[i].updateAsset(desc1);

      const desc2 = cachedMaterialAssetDescriptions[rearLightsMatUUID];
      desc2.dataJson.emissionIntensity = intensity;
      rearlightAssetEditors[i].updateAsset(desc2);
    });
  }

  async fetchSceneEntities() {
    const [
      environmentEntity,
      platformEntity,
      gradientPlatformEntity,
      isAnimationActiveTokenEntity,
      bodyEntity,
    ] = await SDK3DVerse.engineAPI.findEntitiesByNames(
      AppConfig.environmentEntityName,
      AppConfig.platformEntityName,
      AppConfig.gradientPlatformEntityName,
      AppConfig.isAnimationActiveTokenEntityName,
      AppConfig.sceneRefEntityNames.body,
    );
    this.entities = {
      environment: environmentEntity,
      platform: platformEntity,
      gradientPlatform: gradientPlatformEntity,
      isAnimationActiveToken: isAnimationActiveTokenEntity,
      body: bodyEntity,
    };

    this.updateStateFromEntities();
    SDK3DVerse.notifier.on("onEntitiesUpdated", this.updateStateFromEntities);
  }

  async cacheMaterials() {
    /** @typedef {NonNullable<typeof this.cachedMaterialAssetDescriptions>} D */
    const cachedMaterialAssetDescriptions = /** @type {D} */ ({});
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
        cachedMaterialAssetDescriptions[materialUUID] = desc;
      }),
    );
    this.cachedMaterialAssetDescriptions = cachedMaterialAssetDescriptions;

    /** @param {string} materialUUID */
    const hookUpAssetEditor = (materialUUID) => {
      return getAssetEditorAPIForMaterial(materialUUID, (event, desc) => {
        if (event !== "assetUpdated") return;
        this.cachedMaterialAssetDescriptions = {
          ...this.cachedMaterialAssetDescriptions,
          [materialUUID]: desc,
        };
        this.updateStateFromMaterials(materialUUID);
      });
    };

    this.headlightAssetEditors = AppConfig.cars.map(({ headLightsMatUUID }) => {
      return hookUpAssetEditor(headLightsMatUUID);
    });
    this.rearlightAssetEditors = AppConfig.cars.map(({ rearLightsMatUUID }) => {
      return hookUpAssetEditor(rearLightsMatUUID);
    });
    this.paintAssetEditors = AppConfig.cars.map(({ paintMaterialUUID }) => {
      return hookUpAssetEditor(paintMaterialUUID);
    });
  }

  /** @param {number} selectedCarIndex */
  changeCar(selectedCarIndex) {
    CarConfiguratorStore.setState({ selectedCarIndex });
    this.applySelectedCar();
  }

  /** @param {[number, number, number]} selectedColor */
  changeSelectedColor(selectedColor) {
    CarConfiguratorStore.setState({ selectedColor });
    this.applySelectedMaterial();
  }

  /** @param {number} matIndex */
  changeSelectedMaterial(matIndex) {
    CarConfiguratorStore.setState({
      selectedMaterial: AppConfig.materials[matIndex],
    });
    this.applySelectedMaterial();
  }

  /** @param {number} cubemapIndex */
  changeCubemap(cubemapIndex) {
    const entities = this.safeGet("entities");
    CarConfiguratorStore.setState({
      selectedCubemap: AppConfig.cubemaps[cubemapIndex],
    });
    const { skyboxUUID, radianceUUID, irradianceUUID } =
      CarConfiguratorStore.state.selectedCubemap;
    entities.environment.setComponent("environment", {
      skyboxUUID,
      radianceUUID,
      irradianceUUID,
    });
    SDK3DVerse.engineAPI.commitChanges();
  }

  toggleLightsOn() {
    CarConfiguratorStore.setState({
      lightsOn: !CarConfiguratorStore.state.lightsOn,
    });
    this.applyLightsSetting();
  }

  toggleRotationOn() {
    const entities = this.safeGet("entities");
    CarConfiguratorStore.setState({
      rotationOn: !CarConfiguratorStore.state.rotationOn,
    });
    const event = CarConfiguratorStore.state.rotationOn
      ? "start_simulation"
      : "pause_simulation";
    SDK3DVerse.engineAPI.fireEvent(INVALID_UUID, event);

    // We are going to use a blank entity in the scene to track the
    // rotation state until we have a way to query animation state
    entities.isAnimationActiveToken.setComponent("tags", {
      value: CarConfiguratorStore.state.rotationOn ? ["animationIsActive"] : [],
    });
    SDK3DVerse.engineAPI.commitChanges();
  }

  toggleRgbGradientOn() {
    const entities = this.safeGet("entities");
    CarConfiguratorStore.setState({
      rgbGradientOn: !CarConfiguratorStore.state.rgbGradientOn,
    });
    entities.gradientPlatform.setComponent("mesh_ref", {
      value: CarConfiguratorStore.state.rgbGradientOn
        ? entities.platform.getComponent("mesh_ref").value
        : INVALID_UUID,
    });
    SDK3DVerse.engineAPI.commitChanges();
  }

  /**  @param {number} userCameraLuminosity */
  changeUserCameraLuminosity(userCameraLuminosity) {
    CarConfiguratorStore.setState({ userCameraLuminosity });
    setCameraSettings({
      brightness: CarConfiguratorStore.state.userCameraLuminosity,
    });
  }

  /** @param {string} sceneLoadingState */
  setSceneLoadingState(sceneLoadingState) {
    CarConfiguratorStore.setState({ sceneLoadingState });
  }

  /** @param {boolean} isSceneLoaded */
  setIsSceneLoaded(isSceneLoaded) {
    CarConfiguratorStore.setState({ isSceneLoaded });
  }

  /** @param {() => void} resumeCallback */
  setUserIsInactive(resumeCallback) {
    CarConfiguratorStore.setState({ isUserInactive: true });
    this.resumeCallback = resumeCallback;
  }

  setUserIsActiveAgain() {
    CarConfiguratorStore.setState({ isUserInactive: false });
    if (this.resumeCallback) {
      this.resumeCallback();
    }
  }

  signalDisconnected() {
    CarConfiguratorStore.setState({
      wasDisconnected: true,
      isUserInactive: false,
    });
  }
})();
