const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset({
  tsconfig: "apps/backend/tsconfig.json",
}).transform;

/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",

  transform: {
    ...tsJestTransformCfg,
  },

  moduleNameMapper: {
    "^@shared/(.*)$": "<rootDir>/apps/backend/src/shared/$1",
    "^@modules/(.*)$": "<rootDir>/apps/backend/src/modules/$1",
    "^@generated/(.*)$": "<rootDir>/apps/backend/src/generated/$1",
  },
};
