import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultConfiguration,
  optionsFor,
  validateConfiguration,
} from "./product-configuration.ts";

test("catalogue options remain eligible at zero physical stock", () => {
  const options = optionsFor("core", "groupset");
  assert.ok(options.length > 0);
  assert.ok(options.every((option) => option.stockQty === 0));
});

test("variant fixes its groupset while retaining model option restrictions", () => {
  const configuration = defaultConfiguration("pro-rival-axs");
  assert.equal(configuration.groupset, "gs-rival-axs");
  assert.doesNotThrow(() => validateConfiguration("pro-rival-axs", configuration));
  assert.throws(
    () => validateConfiguration("pro-rival-axs", { ...configuration, groupset: "gs-105-r7150" }),
    /must match/,
  );
  assert.throws(
    () =>
      validateConfiguration("core-105", {
        ...defaultConfiguration("core-105"),
        wheelset: "ws-carbon-flagship",
      }),
    /not allowed/,
  );
});
