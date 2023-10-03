import templateJson from "./template.3dverse.js";

const assetIds = Object.entries(templateJson.assets).reduce(
  (assetIds, [name, { asset_id }]) => {
    assetIds[name] = asset_id;
    return assetIds;
  },
  /** @type {Record<keyof (typeof templateJson.assets), string>} */ ({}),
);

export const AppConfig = {
  sceneUUID: assetIds.SceneCarConfigurator,
  visibleEntitiesContainerName: "VISIBLE_ENTITIES",
  hiddenEntitiesContainerName: "HIDDEN_ENTITIES",
  sceneRefEntityNames: {
    body: "Car Body",
    frontBumpers: "Car Front Bumper",
    rearBumpers: "Car Rear Bumper",
    spoilers: "Car Spoiler",
  },
  cubemaps: [
    {
      name: "Pure Sky",
      skyboxUUID: assetIds.CubemapPureSkySkybox,
      radianceUUID: assetIds.CubemapPureSkyRadiance,
      irradianceUUID: assetIds.CubemapPureSkyIrradiance,
    },
    {
      name: "Zwinger Night",
      skyboxUUID: assetIds.CubemapZwingerNightSkybox,
      radianceUUID: assetIds.CubemapZwingerNightRadiance,
      irradianceUUID: assetIds.CubemapZwingerNightIrradiance,
    },
    {
      name: "Blouberg Sunrise",
      skyboxUUID: assetIds.CubemapBloubergSunriseSkybox,
      radianceUUID: assetIds.CubemapBloubergSunriseRadiance,
      irradianceUUID: assetIds.CubemapBloubergSunriseIrradiance,
    },
  ],
  colorChoices: /** @type {[number, number, number][]} */ ([
    [0, 0.369, 0.302],
    [0.467, 0.51, 0],
    [0, 0.035, 0.29],
    [0.58, 0.141, 0.506],
    [0.251, 0, 0],
  ]),
  materials: [
    {
      name: "Solid",
      matUUID: assetIds.MaterialSolid,
    },
    {
      name: "Metallic",
      matUUID: assetIds.MaterialMetallic,
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
      price: "346 000$",
      paintMaterialUUID: assetIds.MaterialViperPaint,
      frontBumpers: [
        assetIds.SceneViperFrontBumper0,
        assetIds.SceneViperFrontBumper1,
        assetIds.SceneViperFrontBumper2,
      ],
      rearBumpers: [],
      spoilers: [
        assetIds.SceneViperSpoiler0,
        assetIds.SceneViperSpoiler1,
        assetIds.SceneViperSpoiler2,
      ],
      headLightsMatUUID: assetIds.MaterialViperHeadlights,
      rearLightsMatUUID: assetIds.MaterialViperRearlights,
      maxSpeed: "380",
      acceleration: "2.1",
      maximumPower: "962",
      maximumTorque: "932",
      engineCapacity: "4.3",
    },
    {
      name: "Lamborghini Urus",
      sceneUUID: assetIds.SceneUrus,
      description:
        "Lamborghini Urus is the first Super Sport Utility Vehicle in the world, merging the soul of a super sports car with the practical functionality of an SUV.",
      price: "228 000$",
      paintMaterialUUID: assetIds.MaterialUrusPaint,
      frontBumpers: [
        assetIds.SceneUrusFrontBumper0,
        assetIds.SceneUrusFrontBumper1,
      ],
      rearBumpers: [
        assetIds.SceneUrusRearBumper0,
        assetIds.SceneUrusRearBumper1,
      ],
      spoilers: [assetIds.SceneUrusSpoiler0, assetIds.SceneUrusSpoiler1],
      headLightsMatUUID: assetIds.MaterialViperHeadlights,
      rearLightsMatUUID: assetIds.MaterialViperRearlights,
      maxSpeed: "270",
      acceleration: "3.2",
      maximumPower: "1045",
      maximumTorque: "1234",
      engineCapacity: "12.6",
    },
  ],
};