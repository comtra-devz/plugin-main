const $ = (id) => document.getElementById(id);

const LS_BACKEND = "comtra_web_backend_url";
const LS_TOKEN = "comtra_web_jwt";
const LS_USER_LABEL = "comtra_web_user_label";

/** Server flow store TTL is 600s; stop slightly before to avoid racing 404. */
const OAUTH_FLOW_MAX_MS = 580_000;

const backendInput = $("backendUrl");
const tokenInput = $("token");
const statusEl = $("status");
const creditsOut = $("creditsOut");
const trophiesOut = $("trophiesOut");
const historyOut = $("historyOut");
const loadBtn = $("loadBtn");
const clearBtn = $("clearBtn");
const loginFigmaBtn = $("loginFigmaBtn");
const cancelOauthBtn = $("cancelOauthBtn");
const logoutBtn = $("logoutBtn");
const sessionRow = $("sessionRow");
const sessionLabel = $("sessionLabel");

let oauthPollInterval = null;
let oauthDeadlineTimeout = null;
let oauthWindow = null;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function pretty(v) {
  return JSON.stringify(v, null, 2);
}

function baseUrl() {
  return String(backendInput.value || "").trim().replace(/\/$/, "");
}

function effectiveToken() {
  const fromField = String(tokenInput.value || "").trim();
  if (fromField) return fromField;
  return String(localStorage.getItem(LS_TOKEN) || "").trim();
}

function setOauthWaiting(on) {
  cancelOauthBtn.classList.toggle("hidden", !on);
  loginFigmaBtn.disabled = on;
}

function updateSessionUi() {
  const token = effectiveToken();
  const label = localStorage.getItem(LS_USER_LABEL);
  if (token && label) {
    sessionRow.classList.remove("hidden");
    sessionLabel.textContent = `Signed in as ${label}`;
    loadBtn.disabled = false;
    return;
  }
  if (token) {
    sessionRow.classList.remove("hidden");
    sessionLabel.textContent = "Signed in (token saved)";
    loadBtn.disabled = false;
    return;
  }
  sessionRow.classList.add("hidden");
  sessionLabel.textContent = "";
}

function persistSession(token, userLabel) {
  const b = baseUrl();
  if (b) localStorage.setItem(LS_BACKEND, b);
  if (token) localStorage.setItem(LS_TOKEN, token);
  else localStorage.removeItem(LS_TOKEN);
  if (userLabel) localStorage.setItem(LS_USER_LABEL, userLabel);
  else localStorage.removeItem(LS_USER_LABEL);
  updateSessionUi();
}

function stopOauthFlow() {
  if (oauthPollInterval) {
    clearInterval(oauthPollInterval);
    oauthPollInterval = null;
  }
  if (oauthDeadlineTimeout) {
    clearTimeout(oauthDeadlineTimeout);
    oauthDeadlineTimeout = null;
  }
}

function clearOauthWindow() {
  try {
    if (oauthWindow && !oauthWindow.closed) oauthWindow.close();
  } catch (_) {}
  oauthWindow = null;
}

async function authGet(base, token, path) {
  const url = `${base}${path}`;
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
  const base = baseUrl();
  const token = effectiveToken();
  if (!base) {
    setStatus("Missing backend URL.", true);
    return;
  }
  if (!token) {
    setStatus("Use “Log in with Figma” or paste a JWT under Manual JWT.", true);
    return;
  }

  loadBtn.disabled = true;
  setStatus("Loading...");
  try {
    const [credits, trophies, history] = await Promise.all([
      authGet(base, token, "/api/credits?lite=1"),
      authGet(base, token, "/api/trophies"),
      authGet(base, token, "/api/history?include=all&limit_generate=10&limit_activity=20"),
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
  stopOauthFlow();
  setOauthWaiting(false);
  clearOauthWindow();
  tokenInput.value = "";
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_USER_LABEL);
  creditsOut.textContent = "-";
  trophiesOut.textContent = "-";
  historyOut.textContent = "-";
  setStatus("Session cleared.");
  updateSessionUi();
}

function cancelOauth() {
  stopOauthFlow();
  setOauthWaiting(false);
  clearOauthWindow();
  setStatus("Login cancelled.");
}

async function loginWithFigma() {
  const base = baseUrl();
  if (!base) {
    setStatus("Missing backend URL.", true);
    return;
  }

  setOauthWaiting(true);
  setStatus("Opening Figma login…");

  oauthWindow = window.open(
    "about:blank",
    "comtra_figma_oauth",
    "width=560,height=720,scrollbars=yes,resizable=yes"
  );
  if (!oauthWindow) {
    setOauthWaiting(false);
    setStatus("Popup blocked. Allow popups for this site and try again.", true);
    return;
  }

  try {
    const initUrl = `${base}/api/figma-oauth/init`;
    const res = await fetch(initUrl);
    if (!res.ok) throw new Error(`Init failed: ${res.status}`);
    const data = await res.json();
    const authUrl = data?.authUrl;
    const readKey = data?.readKey;
    if (!authUrl || !readKey) throw new Error("Invalid server response");

    try {
      oauthWindow.location.href = authUrl;
    } catch {
      oauthWindow.close();
      throw new Error("Could not open OAuth URL in popup.");
    }

    setStatus(
      "Complete login in the popup. When you see “Login completato”, you can close it — this page will update automatically."
    );

    const pollUrl = `${base}/api/figma-oauth/poll?read_key=${encodeURIComponent(readKey)}`;
    stopOauthFlow();

    oauthDeadlineTimeout = setTimeout(() => {
      stopOauthFlow();
      setOauthWaiting(false);
      clearOauthWindow();
      setStatus(
        "Login timed out (the server flow expired). Close the popup if it is still open and try again.",
        true
      );
    }, OAUTH_FLOW_MAX_MS);

    oauthPollInterval = setInterval(async () => {
      try {
        const r = await fetch(pollUrl);
        if (r.status === 202) return;
        if (r.status === 404) {
          stopOauthFlow();
          setOauthWaiting(false);
          setStatus("Login flow expired on the server. Try again.", true);
          clearOauthWindow();
          return;
        }
        if (!r.ok) return;
        const payload = await r.json();
        if (payload?.error) {
          stopOauthFlow();
          setOauthWaiting(false);
          setStatus("Login did not complete. Try again.", true);
          clearOauthWindow();
          return;
        }
        if (payload?.user) {
          stopOauthFlow();
          setOauthWaiting(false);
          if (payload.tokenSaved === false) {
            setStatus("Login did not complete (token not saved). Try again.", true);
            clearOauthWindow();
            return;
          }
          const u = payload.user;
          const label = u.name || u.email || u.id || "Figma user";
          const jwt = u.authToken;
          if (!jwt) {
            setStatus("Server returned no token.", true);
            clearOauthWindow();
            return;
          }
          tokenInput.value = "";
          persistSession(jwt, label);
          clearOauthWindow();
          setStatus("Signed in. Loading dashboard…");
          await loadAll();
          document.getElementById("panel-dashboard")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } catch (_) {}
    }, 2000);
  } catch (e) {
    stopOauthFlow();
    setOauthWaiting(false);
    clearOauthWindow();
    const msg = e instanceof Error ? e.message : "Connection error";
    const isNetwork = msg === "Failed to fetch" || /fetch|network|CORS/i.test(msg);
    setStatus(
      isNetwork
        ? `Could not reach ${base} (${msg}). Check CORS and that the auth deploy is up.`
        : msg,
      true
    );
  }
}

function logout() {
  stopOauthFlow();
  setOauthWaiting(false);
  clearOauthWindow();
  tokenInput.value = "";
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_USER_LABEL);
  updateSessionUi();
  setStatus("Logged out.");
}

function deployDefaultBackend() {
  const raw =
    typeof window !== "undefined" && window.COMTRA_AUTH_BACKEND != null
      ? String(window.COMTRA_AUTH_BACKEND).trim()
      : "";
  return raw.replace(/\/$/, "");
}

function restoreFromStorage() {
  const savedBackend = localStorage.getItem(LS_BACKEND);
  if (savedBackend) backendInput.value = savedBackend;
  else {
    const def = deployDefaultBackend();
    if (def) backendInput.value = def;
  }
  const savedToken = localStorage.getItem(LS_TOKEN);
  if (savedToken) tokenInput.value = "";
  updateSessionUi();
}

loadBtn.addEventListener("click", loadAll);
clearBtn.addEventListener("click", clearAll);
loginFigmaBtn.addEventListener("click", loginWithFigma);
cancelOauthBtn.addEventListener("click", cancelOauth);
logoutBtn.addEventListener("click", logout);

restoreFromStorage();
