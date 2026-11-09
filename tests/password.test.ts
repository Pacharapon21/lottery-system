import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "@/lib/password";

test("hashes passwords with a unique salt and verifies the password", () => {
  const firstHash = hashPassword("correct-horse-battery");
  const secondHash = hashPassword("correct-horse-battery");

  assert.notEqual(firstHash, secondHash);
  assert.equal(verifyPassword("correct-horse-battery", firstHash), true);
  assert.equal(verifyPassword("incorrect-password", firstHash), false);
  assert.equal(verifyPassword("anything", "invalid-hash"), false);
});
