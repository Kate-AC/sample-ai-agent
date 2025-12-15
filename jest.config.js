module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests", "<rootDir>/src"],
  testMatch: ["**/tests/**/*.test.ts", "**/tests/**/*.spec.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/tests/e2e/"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          baseUrl: "./src",
          paths: {
            "domain/*": ["domain/*"],
            "application/*": ["application/*"],
            "infrastructure/*": ["infrastructure/*"],
            "presentation/*": ["presentation/*"],
          },
        },
      },
    ],
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
  moduleNameMapper: {
    "^domain/(.*)$": "<rootDir>/src/domain/$1",
    "^application/(.*)$": "<rootDir>/src/application/$1",
    "^infrastructure/(.*)$": "<rootDir>/src/infrastructure/$1",
    "^presentation/(.*)$": "<rootDir>/src/presentation/$1",
    "^sample-mcp$": "<rootDir>/node_modules/sample-mcp",
  },
};
