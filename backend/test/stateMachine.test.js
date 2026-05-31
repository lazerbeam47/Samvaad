const test = require("node:test");
const assert = require("node:assert/strict");

const stateMachine = require("../conversationState/stateMachine");

test("state machine handles object-shaped intent and returns updated state", () => {
  const sessionId = `test-${Date.now()}`;

  stateMachine.init(sessionId);
  const result = stateMachine.processNLU(sessionId, {
    intent: { label: "complaint" },
    crm: { sentiment: "negative" },
    compliance: [],
  });
  stateMachine.clear(sessionId);

  assert.equal(result.state, "opening");
  assert.equal(result.risk, 55);
  assert.equal(result.opportunity, 0);
});
