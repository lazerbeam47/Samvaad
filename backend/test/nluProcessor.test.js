const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeNluOutput, parseNluJson } = require("../nlu/processor");

test("parseNluJson parses strict JSON", () => {
  assert.deepEqual(parseNluJson('{"intent":{"label":"pricing"}}'), {
    intent: { label: "pricing" },
  });
});

test("parseNluJson extracts JSON from wrapped model output", () => {
  assert.deepEqual(parseNluJson('```json\n{"actions":["Follow up"]}\n```'), {
    actions: ["Follow up"],
  });
});

test("normalizeNluOutput supplies stable default shapes", () => {
  assert.deepEqual(normalizeNluOutput({ suggestions: "bad shape" }), {
    intent: {},
    suggestions: [],
    compliance: [],
    crm: {},
    actions: [],
    conversation_state: {},
  });
});
