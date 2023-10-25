import templateJson from "../template.3dverse.js";

/** @typedef {keyof (typeof templateJson.assets)} AssetKey */

const assetIds = Object.entries(templateJson.assets).reduce(
  (assetIds, [name, { asset_id }]) => {
    assetIds[/** @type {AssetKey} */ (name)] = asset_id;
    return assetIds;
  },
  /** @type {Record<AssetKey, string>} */ ({}),
);

export const AppConfig = {
  // This public user token gives any app user read-only access to the scene.
  // Read-only access still permits temporary changes to the scene graph,
  // within the context of a session, and these changes will be synced with
  // other users connected to the same session. However the changes will not
  // be persisted.
  publicUserToken: templateJson.publicToken,
  sceneUUID: assetIds.SceneCarConfigurator,
  environmentEntityName: "Env",
  platformEntityName: "Platform",
  gradientPlatformEntityName: "RGB Platform",
  isAnimationActiveTokenEntityName: "isAnimationActiveToken",
  sceneRefEntityNames: {
    body: "Car",
  },
  // the cubemaps are from an external project that won't be copied so
  // we don't include their UUIDS in the template config
  cubemaps: [
    {
      name: "Pure Sky",
      skyboxUUID: "eb6b6cfc-a25f-4f9b-9cbf-287488a5f902",
      radianceUUID: "2abf3b02-7ce9-437c-a85f-5f2f54ecc67b",
      irradianceUUID: "ff345697-eca6-4970-bec7-7e6b1d52c715",
      previewSrc: "./img/cubemap1.png",
    },
    {
      name: "Zwinger Night",
      skyboxUUID: "3d87dcf8-7e9e-40b2-9187-521d6a2f0d7a",
      radianceUUID: "2312c1f1-3277-4dde-8d74-6f42b413f447",
      irradianceUUID: "e8308b91-206b-4314-b1de-5d9831534fc8",
      previewSrc: "./img/cubemap2.png",
    },
    {
      name: "Blouberg Sunrise",
      skyboxUUID: "3d73a47a-ade0-43a8-bfe3-ac9488d79d59",
      radianceUUID: "5cb7653e-fbf1-497a-bd64-26ad617ee6aa",
      irradianceUUID: "2f957174-2439-444f-95ed-5409a2c7a7b5",
      previewSrc: "./img/cubemap3.png",
    },
  ],
  colorChoices: /** @type {[number, number, number][]} */ ([
    [0, 0.369, 0.302],
    [0.467, 0.51, 0],
    [0, 0.035, 0.29],
    [0.58, 0.141, 0.506],
    [0.251, 0, 0],
  ]),
  partCategoryNames: {
    frontBumpers: "Front Bumper",
    rearBumpers: "Rear Bumper",
    spoilers: "Spoiler",
  },
  materials: [
    {
      name: "Metallic",
      matUUID: assetIds.MaterialMetallic,
    },
    {
      name: "Solid",
      matUUID: assetIds.MaterialSolid,
    },
    {
      name: "Matte",
      matUUID: assetIds.MaterialMatte,
    },
  ],
  cars: [
    {
      name: "Dodge Viper SRT",
      sceneUUID: assetIds.SceneViper,
      description:
        "The legend became infamous after ex-Top Gear presenter Richard Hammond crashed one of only eight cars built.",
      paintMaterialUUID: assetIds.MaterialViperPaint,
      headLightsMatUUID: assetIds.MaterialViperHeadlights,
      rearLightsMatUUID: assetIds.MaterialViperRearlights,
    },
    {
      name: "Lamborghini Urus",
      sceneUUID: assetIds.SceneUrus,
      description:
        "Lamborghini Urus is the first Super Sport Utility Vehicle in the world, merging the soul of a super sports car with the practical functionality of an SUV.",
      paintMaterialUUID: assetIds.MaterialUrusPaint,
      headLightsMatUUID: assetIds.MaterialUrusHeadlights,
      rearLightsMatUUID: assetIds.MaterialUrusRearlights,
    },
  ],
};
