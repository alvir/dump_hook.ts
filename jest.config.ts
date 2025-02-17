import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "tsx", "js"],
  testMatch: ["**/*.test.ts"],
  verbose: true
};

export default config;
