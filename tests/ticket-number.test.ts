import assert from "node:assert/strict";
import test from "node:test";
import { formatTicketNumber, isValidTicketNumber } from "@/lib/ticket-number";

test("formats the supported ticket range as five digits", () => {
  assert.equal(formatTicketNumber(1), "00001");
  assert.equal(formatTicketNumber(99_999), "99999");
});

test("rejects ticket values outside the supported range", () => {
  for (const value of [0, -1, 100_000, 1.5, Number.NaN]) {
    assert.throws(() => formatTicketNumber(value), RangeError);
  }
});

test("accepts only five-digit ticket strings from 00001 through 99999", () => {
  for (const value of ["00001", "01000", "99999"]) {
    assert.equal(isValidTicketNumber(value), true);
  }
  for (const value of ["00000", "0001", "100000", "12a45"]) {
    assert.equal(isValidTicketNumber(value), false);
  }
});
