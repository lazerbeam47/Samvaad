const test = require("node:test");
const assert = require("node:assert/strict");

const { isMeaningful } = require("../utils/textGates");

test("isMeaningful rejects empty and short filler text", () => {
  assert.equal(isMeaningful(""), false);
  assert.equal(isMeaningful("ok thanks"), false);
});

test("isMeaningful accepts questions, keywords, and substantive utterances", () => {
  assert.equal(isMeaningful("Can you help me with pricing?"), true);
  assert.equal(isMeaningful("I am calling about your product"), true);
  assert.equal(
    isMeaningful("This sentence has enough words to be treated as substantive"),
    true,
  );
});
