// Verifies visual preferences validate safely for new and existing profiles.
import { expect, it } from "vitest";
import { configSchema, defaultConfig } from "./config";
it("adds compatible defaults when existing profiles omit appearance preferences", () => {
  const {
    theme,
    iconSize,
    labelPosition,
    menuBackground,
    appNames,
    activationStyle,
    ...old
  } = defaultConfig;
  expect(configSchema.parse(old)).toMatchObject({
    theme,
    iconSize,
    labelPosition,
    menuBackground,
    appNames,
    activationStyle,
  });
});
it("accepts real choices and rejects unsupported values", () => {
  expect(
    configSchema.parse({
      ...defaultConfig,
      theme: "dark",
      iconSize: "large",
      labelPosition: "bottom",
      menuBackground: "soft",
      appNames: "hidden",
      activationStyle: "open",
    }).theme,
  ).toBe("dark");
  expect(
    configSchema.safeParse({ ...defaultConfig, theme: "blue" }).success,
  ).toBe(false);
  expect(
    configSchema.safeParse({ ...defaultConfig, iconSize: "huge" }).success,
  ).toBe(false);
});
