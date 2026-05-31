const LAUNCHER_ID = "samvaad-extension-launcher";

function canInject() {
  return document.documentElement && document.body;
}

async function getSettings() {
  return chrome.runtime.sendMessage({ type: "samvaad:get-settings" });
}

function removeLauncher() {
  document.getElementById(LAUNCHER_ID)?.remove();
}

function createLauncher() {
  const launcher = document.createElement("button");
  launcher.id = LAUNCHER_ID;
  launcher.type = "button";
  launcher.textContent = "Open Samvaad";
  launcher.style.position = "fixed";
  launcher.style.right = "18px";
  launcher.style.bottom = "18px";
  launcher.style.zIndex = "2147483647";
  launcher.style.border = "none";
  launcher.style.borderRadius = "999px";
  launcher.style.padding = "12px 16px";
  launcher.style.background = "#0e8f6b";
  launcher.style.color = "#fff";
  launcher.style.fontSize = "13px";
  launcher.style.fontWeight = "700";
  launcher.style.boxShadow = "0 14px 30px rgba(14, 143, 107, 0.32)";
  launcher.style.cursor = "pointer";
  launcher.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  launcher.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "samvaad:open",
      path: "/demo",
      openInPopup: true,
    });
  });
  return launcher;
}

async function syncLauncher() {
  if (!canInject()) return;

  const { showFloatingLauncher } = await getSettings();
  removeLauncher();
  if (!showFloatingLauncher) return;
  document.body.appendChild(createLauncher());
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "samvaad:settings-updated") {
    syncLauncher();
  }

  if (message?.type === "samvaad:open-launch") {
    chrome.runtime.sendMessage({
      type: "samvaad:open",
      path: message.path,
      openInPopup: Boolean(message.openInPopup),
    });
  }
});

syncLauncher().catch(() => {});
