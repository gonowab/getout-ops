import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deliverySchema,
  resellerSchema,
  followUpDate,
  shipmentWeight,
  optionalDate,
} from "../lib/resellers";

test("alla uppgifter får lämnas tomma", () => {
  assert.equal(resellerSchema.parse({}).name, "");
  const d = deliverySchema.parse({});
  assert.equal(d.deliveredOn, null);
  assert.equal(d.followUpOn, null);
  assert.deepEqual(d.lines, []);
});
test("30 kalenderdagar, även över månadsskifte och skottår", () => {
  assert.equal(followUpDate("2026-01-31", false, null), "2026-03-02");
  assert.equal(followUpDate("2028-02-01", false, null), "2028-03-02");
  assert.equal(followUpDate(null, false, null), null);
});
test("manuellt flyttat eller tömt datum bevaras", () => {
  assert.equal(followUpDate("2026-11-12", true, "2027-01-10"), "2027-01-10");
  assert.equal(followUpDate("2026-11-12", true, null), null);
});
test("190 gram per kortlek över alla produkter", () => {
  assert.equal(
    shipmentWeight([{ quantity: 3 }, { quantity: 2 }, { quantity: 5 }]),
    1900,
  );
  assert.equal(shipmentWeight([]), 0);
});
test("frivilliga värden valideras när de anges", () => {
  assert.equal(optionalDate.safeParse("2026-02-30").success, false);
  assert.equal(deliverySchema.safeParse({ unitPrice: -1 }).success, false);
  assert.equal(
    deliverySchema.safeParse({ lines: [{ productId: 1, quantity: 1.5 }] })
      .success,
    false,
  );
});
