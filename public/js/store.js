import { AppConfig } from "./config.js";

/**
 * https://stackoverflow.com/q/41343535
 * @template T
 * @param {T} obj
 * @returns {T}
 */
function deepFreezeObject(obj) {
  if (obj && typeof obj === "object") {
    for (const key of /** @type {(keyof T)[]} */ (Reflect.ownKeys(obj))) {
      deepFreezeObject(obj[key]);
    }
  }
  return Object.freeze(obj);
}

/**
 * @typedef {{
 *   selectedCarIndex: number;
 *   selectedPartCategory: keyof (typeof AppConfig.partCategoryNames);
 *   selectedParts: Record<keyof (typeof AppConfig.partCategoryNames), number>;
 *   selectedColor: [Number, Number, number];
 *   selectedMaterial: (typeof AppConfig)['materials'][number];
 *   selectedCubemap: (typeof AppConfig)['cubemaps'][number];
 *   lightsOn: boolean;
 *   rotationOn: boolean;
 *   rgbGradientOn: boolean;
 *   userCameraLuminosity: number;
 *   currentStep: 'modelSelection' | 'customization' | 'review';
 *   sceneLoadingState: string;
 *   isSceneLoaded: boolean;
 * }} CarConfiguratorState
 */

export const CarConfiguratorStore = new (class CarConfiguratorStore {
  /** @private @type {CarConfiguratorState} */
  internalState = deepFreezeObject({
    selectedCarIndex: 0,
    selectedPartCategory:
      /** @type {CarConfiguratorState['selectedPartCategory']} */ (
        Object.keys(AppConfig.partCategoryNames)[0]
      ),
    selectedParts: {
      frontBumpers: 0,
      rearBumpers: 0,
      spoilers: 0,
    },
    selectedColor: AppConfig.colorChoices[0],
    selectedMaterial: AppConfig.materials[0],
    selectedCubemap: AppConfig.cubemaps[0],
    lightsOn: true,
    rotationOn: false,
    rgbGradientOn: false,
    userCameraLuminosity: 1.5,
    currentStep: "modelSelection",
    sceneLoadingState: "Loading...",
    isSceneLoaded: false,
  });
  /** @private @type {[string[], () => void][]} */
  subscribers = [];

  /**
   * Should only be called from CarConfiguratorActions, not any of the Views!
   * @param {Partial<CarConfiguratorState>} value
   */
  setState(value) {
    const oldState = this.internalState;
    this.internalState = deepFreezeObject({
      ...oldState,
      ...value,
    });
    const changedKeys = /** @type {(keyof (typeof this.internalState))[]} */ (
      Object.keys(this.internalState)
    ).filter((key) => this.internalState[key] !== oldState[key]);

    // notify subscribers
    for (const [watchedKeys, handler] of this.subscribers) {
      if (changedKeys.some((key) => watchedKeys.includes(key))) {
        handler();
      }
    }
  }

  get state() {
    return this.internalState;
  }

  set state(value) {
    throw new Error("Cannot write state directly.");
  }

  /**
   * @param {(keyof CarConfiguratorState)[]} watchedKeys
   * @param {() => void} handler
   */
  subscribe(watchedKeys, handler) {
    this.subscribers.push([watchedKeys, handler]);
  }
})();
