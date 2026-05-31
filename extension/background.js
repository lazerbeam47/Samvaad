const DEFAULT_APP_ORIGIN = "http://localhost:5174";

async function getSettings() {
  const stored = await chrome.storage.sync.get({
    appOrigin: DEFAULT_APP_ORIGIN,
    showFloatingLauncher: true,
  });
  return stored;
}

function normalizeOrigin(origin) {
  const value = (origin || DEFAULT_APP_ORIGIN).trim().replace(/\/+$/, "");
  return value || DEFAULT_APP_ORIGIN;
}

async function openSamvaad({
  path = "/homepage",
  sourceTabId = null,
  openInPopup = false,
} = {}) {
  const { appOrigin } = await getSettings();
  const origin = normalizeOrigin(appOrigin);
  const url = new URL(`${origin}${path}`);

  if (sourceTabId) {
    try {
      const tab = await chrome.tabs.get(sourceTabId);
      if (tab?.url) url.searchParams.set("sourceUrl", tab.url);
      if (tab?.title) url.searchParams.set("sourceTitle", tab.title);
    } catch {}
  }

  if (openInPopup) {
    await chrome.windows.create({
      url: url.toString(),
      type: "popup",
      width: 420,
      height: 860,
    });
    return;
  }

  await chrome.tabs.create({ url: url.toString() });
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  await chrome.storage.sync.set(settings);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "samvaad:get-settings") {
    getSettings().then((settings) => sendResponse(settings));
    return true;
  }

  if (message?.type === "samvaad:save-settings") {
    const payload = {
      appOrigin: normalizeOrigin(message.appOrigin),
      showFloatingLauncher: Boolean(message.showFloatingLauncher),
    };
    chrome.storage.sync.set(payload).then(() => sendResponse(payload));
    return true;
  }

  if (message?.type === "samvaad:open") {
    openSamvaad({
      path: message.path,
      sourceTabId: sender?.tab?.id ?? null,
      openInPopup: Boolean(message.openInPopup),
    }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "samvaad:refresh-launcher") {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (!tab.id || !/^https?:/.test(tab.url || "")) continue;
        chrome.tabs.sendMessage(tab.id, { type: "samvaad:settings-updated" }).catch(
          () => {},
        );
      }
      sendResponse({ ok: true });
    });
    return true;
  }
});
