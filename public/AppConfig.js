export default {
  sceneUUID: "da5e1a59-4213-4015-b6c6-faa838c7367a",
  cubemaps: [
    {
      name: "Pure Sky",
      skyboxUUID: "eb6b6cfc-a25f-4f9b-9cbf-287488a5f902",
      radianceUUID: "2abf3b02-7ce9-437c-a85f-5f2f54ecc67b",
      irradianceUUID: "ff345697-eca6-4970-bec7-7e6b1d52c715",
    },
    {
      name: "Zwinger Night",
      skyboxUUID: "3d87dcf8-7e9e-40b2-9187-521d6a2f0d7a",
      radianceUUID: "2312C1F1-3277-4DDE-8D74-6F42B413F447",
      irradianceUUID: "e8308b91-206b-4314-b1de-5d9831534fc8",
    },
    {
      name: "Blouberg Sunrise",
      skyboxUUID: "3d73a47a-ade0-43a8-bfe3-ac9488d79d59",
      radianceUUID: "5cb7653e-fbf1-497a-bd64-26ad617ee6aa",
      irradianceUUID: "2f957174-2439-444f-95ed-5409a2c7a7b5",
    },
  ],
  cameraComponentDataJSON: {},
  materials: [
    { name: "Metallic", matUUID: "e1357fe8-7a6f-4af5-83e0-b16643b98372" },
    { name: "Solid", matUUID: "bd9dc4c5-20b7-404c-8a94-b84cf21de580" },
    { name: "Matte", matUUID: "8585675f-5dad-4b3a-904d-3afe8cbf0c03" },
  ],
  colorChoices: /** @type {[number, number, number][]} */ ([
    [0, 0.369, 0.302], // teal
    [0.467, 0.51, 0], // yellow
    [0, 0.035, 0.29], // blue
    [0.58, 0.141, 0.506], // pink
    [0.251, 0, 0], // burnt red
  ]),
  cars: [
    {
      name: "Dodge Viper SRT",
      description:
        "The legend became infamous after ex-Top Gear presenter Richard Hammond crashed one of only eight cars built.",
      price: "346 000$",
      paintMaterialUUID: "85f74efa-1f3e-4ddb-8b16-dad907d2ecad",
      frontBumpers: [
        "Dodge Viper SRT FRONT BUMPER 0",
        "Dodge Viper SRT FRONT BUMPER 1",
        "Dodge Viper SRT FRONT BUMPER 2",
      ],
      rearBumpers: [],
      spoilers: [
        "Dodge Viper SRT SPOILER 0",
        "Dodge Viper SRT SPOILER 1",
        "Dodge Viper SRT SPOILER 2",
      ],
      headLightsMatUUID: "6062958a-4e07-4fa9-929f-3455d5160f4f",
      rearLightsMatUUID: "ca52ec66-ec04-43ca-bb39-0f2e6055e7bb",

      maxSpeed: "380",
      acceleration: "2.1",
      maximumPower: "962",
      maximumTorque: "932",
      engineCapacity: "4.3",
    },
    {
      name: "Lamborghini Urus",
      description:
        "Lamborghini Urus is the first Super Sport Utility Vehicle in the world, merging the soul of a super car with the practical functionality of an SUV.",
      price: "228 000$",
      paintMaterialUUID: "20f3387f-b549-49ce-bf21-1fec67abef63",
      frontBumpers: [
        "Lamborghini Urus FRONT BUMPER 0",
        "Lamborghini Urus FRONT BUMPER 1",
      ],
      rearBumpers: [
        "Lamborghini Urus REAR BUMPER 0",
        "Lamborghini Urus REAR BUMPER 1",
      ],
      spoilers: ["Lamborghini Urus SPOILER 0", "Lamborghini Urus SPOILER 1"],
      headLightsMatUUID: "d2de613c-9d0e-4612-b253-e8ea0740c960",
      rearLightsMatUUID: "ef8b7508-7ef3-47a9-9e5a-6ed6f039b62a",

      maxSpeed: "270",
      acceleration: "3.2",
      maximumPower: "1045",
      maximumTorque: "1234",
      engineCapacity: "12.6",
    },
  ],
};
