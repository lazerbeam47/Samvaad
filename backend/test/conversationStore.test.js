const test = require("node:test");
const assert = require("node:assert/strict");

const conversationStore = require("../services/conversationStore");

test("conversation store preserves speaker labels", () => {
  const sessionId = `store-${Date.now()}`;

  conversationStore.append(sessionId, {
    speaker: "agent",
    text: "Thanks for calling Samvaad.",
  });
  conversationStore.append(sessionId, {
    speaker: "customer",
    text: "I want to understand pricing.",
  });

  assert.equal(
    conversationStore.getTranscript(sessionId),
    "AGENT: Thanks for calling Samvaad.\nCUSTOMER: I want to understand pricing.",
  );

  conversationStore.endSession(sessionId);
});
