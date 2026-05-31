function isMeaningful(text) {
  if (!text || !text.trim()) return false;

  const words = text.trim().split(/\s+/);

  if (text.includes("?")) return true;

  if (
    /interested|demo|price|buy|problem|calling|product|minutes|time|help|issue|follow|schedule|connect|introduce/i.test(
      text,
    )
  ) {
    return true;
  }

  return words.length >= 8;
}

function normalizeSpeaker(speaker) {
  return speaker === "agent" ? "agent" : "customer";
}

module.exports = { isMeaningful, normalizeSpeaker };
