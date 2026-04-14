const $ = (id) => document.getElementById(id);

const backendInput = $("backendUrl");
const tokenInput = $("token");
const statusEl = $("status");
const creditsOut = $("creditsOut");
const trophiesOut = $("trophiesOut");
const historyOut = $("historyOut");
const loadBtn = $("loadBtn");
const clearBtn = $("clearBtn");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function pretty(v) {
  return JSON.stringify(v, null, 2);
}

async function authGet(baseUrl, token, path) {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.error || `${res.status} ${res.statusText}`;
    throw new Error(`${path}: ${msg}`);
  }
  return data;
}

async function loadAll() {
  const baseUrl = String(backendInput.value || "").trim();
  const token = String(tokenInput.value || "").trim();
  if (!baseUrl) {
    setStatus("Missing backend URL.", true);
    return;
  }
  if (!token) {
    setStatus("Paste a JWT token first.", true);
    return;
  }

  loadBtn.disabled = true;
  setStatus("Loading...");
  try {
    const [credits, trophies, history] = await Promise.all([
      authGet(baseUrl, token, "/api/credits?lite=1"),
      authGet(baseUrl, token, "/api/trophies"),
      authGet(baseUrl, token, "/api/history?include=all&limit_generate=10&limit_activity=20"),
    ]);

    creditsOut.textContent = pretty(credits);
    trophiesOut.textContent = pretty({
      unlocked_count: Array.isArray(trophies?.unlocked_ids) ? trophies.unlocked_ids.length : 0,
      unlocked_ids: trophies?.unlocked_ids || [],
    });
    historyOut.textContent = pretty(history);
    setStatus("Loaded.");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
  } finally {
    loadBtn.disabled = false;
  }
}

function clearAll() {
  tokenInput.value = "";
  creditsOut.textContent = "-";
  trophiesOut.textContent = "-";
  historyOut.textContent = "-";
  setStatus("Cleared.");
}

loadBtn.addEventListener("click", loadAll);
clearBtn.addEventListener("click", clearAll);
