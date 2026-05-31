const appOriginInput = document.getElementById("appOrigin");
const launcherToggle = document.getElementById("showFloatingLauncher");
const statusNode = document.getElementById("status");

function setStatus(message) {
  statusNode.textContent = message;
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function loadSettings() {
  const settings = await chrome.runtime.sendMessage({
    type: "samvaad:get-settings",
  });

  appOriginInput.value = settings.appOrigin;
  launcherToggle.checked = settings.showFloatingLauncher;
}

async function saveSettings() {
  const response = await chrome.runtime.sendMessage({
    type: "samvaad:save-settings",
    appOrigin: appOriginInput.value,
    showFloatingLauncher: launcherToggle.checked,
  });

  await chrome.runtime.sendMessage({ type: "samvaad:refresh-launcher" });
  setStatus(`Saved ${response.appOrigin}`);
}

async function openSamvaad(path, openInPopup = false) {
  const tab = await getCurrentTab();
  await saveSettings();
  await chrome.tabs.sendMessage(tab.id, {
    type: "samvaad:open-launch",
    path,
    openInPopup,
  }).catch(async () => {
    await chrome.runtime.sendMessage({ type: "samvaad:open", path, openInPopup });
  });
  window.close();
}

document.getElementById("openHome").addEventListener("click", () => {
  openSamvaad("/homepage");
});

document.getElementById("openDemo").addEventListener("click", () => {
  openSamvaad("/demo");
});

document.getElementById("openPopup").addEventListener("click", () => {
  openSamvaad("/demo", true);
});

appOriginInput.addEventListener("change", saveSettings);
launcherToggle.addEventListener("change", saveSettings);

loadSettings().catch((error) => {
  setStatus(`Failed to load settings: ${error.message}`);
});
