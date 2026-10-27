(function () {
  "use strict";

  const LOG_PREFIX = "[FEP MASTER]";

  // Shared style for all injected inline buttons — matches the site's design language
  function inlineBtn(extraCss) {
    return (
      "padding:8px 14px;border:1px solid #303236;border-radius:7px;cursor:pointer;" +
      "font:500 12px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#fff;background:#242528;white-space:nowrap;" +
      "box-shadow:0 1px 2px #0000000a;transition:opacity .15s;" +
      (extraCss || "").replace(/background:[^;]+;/g, "")
    );
  }

  const BUTTON_IDS = {
    docs:       "fep-master-docs-btn",
    payAdvance: "fep-pay-advance-btn",
    siteSurvey: "fep-site-survey-btn",
    preInstall: "fep-pre-install-btn",
    postInstall:"fep-post-install-btn"
  };

  function isLocalDevHost() {
    return ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  }

  // Explicit mappings prevent QA, staging, or an unknown host falling back to production.
  const API_ENVIRONMENTS = Object.freeze({
    "fep.freyrenergy.com": {
      name: "production",
      apiBase: "https://prod-api.sunpro.tilicho.in:444",
      paymentBase: "https://fep-api.freyrenergy.com:444"
    },
    "uat-fep.freyrenergy.com": {
      name: "uat",
      apiBase: "https://uat-api.sunpro.tilicho.in:444",
      paymentBase: "https://uat-fep-api.freyrenergy.com:444"
    },
    "qa-fep.freyrenergy.com": {
      name: "qa",
      apiBase: "https://qa-fep-api.freyrenergy.com:444",
      paymentBase: "https://qa-fep-api.freyrenergy.com:444"
    },
    "qa-fep-api.freyrenergy.com": {
      name: "qa",
      apiBase: "https://qa-fep-api.freyrenergy.com:444",
      paymentBase: "https://qa-fep-api.freyrenergy.com:444"
    },
    "qa-console.sunpro.tilicho.in": {
      name: "qa",
      apiBase: "https://qa-fep-api.freyrenergy.com:444",
      paymentBase: "https://qa-fep-api.freyrenergy.com:444"
    },
    "stg-fep.freyrenergy.com": {
      name: "staging",
      apiBase: "https://stg-fep-api.freyrenergy.com:444",
      paymentBase: "https://stg-fep-api.freyrenergy.com:444"
    },
    "stg-fep-api.freyrenergy.com": {
      name: "staging",
      apiBase: "https://stg-fep-api.freyrenergy.com:444",
      paymentBase: "https://stg-fep-api.freyrenergy.com:444"
    }
  });

  function getApiEnvironment() {
    return Object.hasOwn(API_ENVIRONMENTS, location.hostname)
      ? API_ENVIRONMENTS[location.hostname]
      : null;
  }

  function canUseHardcodedApiEndpoints() {
    return !isLocalDevHost() && getApiEnvironment() !== null;
  }

  function getApiEndpoint(path, payment = false) {
    const environment = getApiEnvironment();
    if (!environment || isLocalDevHost()) {
      throw new Error("Direct API actions are unavailable on this host.");
    }
    const base = payment ? (environment.paymentBase || environment.apiBase) : environment.apiBase;
    return new URL(path, base).href;
  }

  console.log(LOG_PREFIX, "Loaded on", location.href);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const AUTOFILL_STATS_KEY = "fep-master-autofill-stats-v2";
  const LEGACY_AUTOFILL_STATS_KEY = "fep-master-autofill-stats-v1";
  // Assumed manual-entry time saved per field/action the autofill bypasses.
  const MS_SAVED_PER_FIELD = 2000;
  const USER_NAME_KEY = "fep-master-user-name";
  const LAST_SEEN_VERSION_KEY = "fep-master-last-seen-version";

  // Shown once per version bump (including a brand-new install) via a
  // paginated "What's New" card — update `version` and `pages` whenever this
  // ships a change worth telling people about. Keep it to the current
  // release only; it's a highlight reel, not a full multi-version diff.
  const CHANGELOG = {
    version: "1.2.2",
    reviewUrl: "https://chromewebstore.google.com/detail/fep-testing-helper/mannmcffpagagaebademcepjemfglida",
    pages: [{
      title: "Your payment template, ready.",
      items: ["The payment editor starts with your sample values. Update what you need, then review and send.", "Data types are handled automatically. Reset to sample restores the values without changing the environment."],
      final: true
    }]
  };

  let statsCache = null;
  let userNameCache = null;
  let lastSeenVersionCache = null;

  function hasChromeStorage() {
    try {
      return !!(chrome && chrome.storage && chrome.storage.local);
    } catch (err) {
      return false;
    }
  }

  // Loads persisted profile/stats state before the launcher first renders.
  // Backed by chrome.storage.local (survives the site's own "clear site data"),
  // with a one-time migration from the old localStorage-only values and a
  // localStorage fallback if the storage API is ever unavailable.
  function readLegacyV1Stats() {
    try {
      return JSON.parse(localStorage.getItem(LEGACY_AUTOFILL_STATS_KEY) || "null");
    } catch (err) {
      return null;
    }
  }

  // Folds the old flat {lead,details,total} shape into the new
  // {lifetime,today} shape so upgrading doesn't reset a user's history.
  // fieldsFilled wasn't tracked under the old model, so it starts at 0;
  // the old savedMs (baseline-based) carries over as-is for continuity.
  function migrateLegacyStats(old) {
    const fresh = emptyAutofillStats();
    ["lead", "details", "total"].forEach((key) => {
      const src = old[key] || {};
      fresh.lifetime[key] = {
        clicks: src.clicks || 0,
        actualMs: src.actualMs || 0,
        fieldsFilled: 0,
        savedMs: src.savedMs || 0
      };
    });
    return fresh;
  }

  // Falls back to reading whatever localStorage has, used both when
  // chrome.storage was never available and when it throws mid-session
  // (e.g. the extension was reloaded in chrome://extensions while this tab's
  // content script — now orphaned — is still running).
  function loadFromLocalStorageOnly() {
    userNameCache = localStorage.getItem(USER_NAME_KEY);
    lastSeenVersionCache = localStorage.getItem(LAST_SEEN_VERSION_KEY);
    try {
      statsCache = JSON.parse(localStorage.getItem(AUTOFILL_STATS_KEY) || "null");
    } catch (err) {
      statsCache = null;
    }
    if (!statsCache) {
      const legacy = readLegacyV1Stats();
      if (legacy && (legacy.lead || legacy.details || legacy.total)) {
        statsCache = migrateLegacyStats(legacy);
      }
    }
  }

  function loadPersistedState(done) {
    if (!hasChromeStorage()) {
      loadFromLocalStorageOnly();
      done();
      return;
    }

    try {
      chrome.storage.local.get([USER_NAME_KEY, LAST_SEEN_VERSION_KEY, AUTOFILL_STATS_KEY, LEGACY_AUTOFILL_STATS_KEY], (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          loadFromLocalStorageOnly();
          done();
          return;
        }

        userNameCache = result[USER_NAME_KEY] || null;
        lastSeenVersionCache = result[LAST_SEEN_VERSION_KEY] || null;
        statsCache = result[AUTOFILL_STATS_KEY] || null;

        if (userNameCache === null) {
          const legacyName = localStorage.getItem(USER_NAME_KEY);
          if (legacyName) userNameCache = legacyName;
        }
        if (statsCache === null) {
          const legacy = result[LEGACY_AUTOFILL_STATS_KEY] || readLegacyV1Stats();
          if (legacy && (legacy.lead || legacy.details || legacy.total)) {
            statsCache = migrateLegacyStats(legacy);
            saveAutofillStats(statsCache);
          }
        }

        done();
      });
    } catch (err) {
      // "Extension context invalidated" — the extension was reloaded while
      // this page's (now orphaned) content script kept running.
      console.warn(LOG_PREFIX, "chrome.storage unavailable — falling back to localStorage", err);
      loadFromLocalStorageOnly();
      done();
    }
  }

  function getUserName() {
    return (userNameCache || "").trim();
  }

  // Shared by every persistX() function below. Tries chrome.storage.local
  // first; if that throws — most commonly "Extension context invalidated"
  // because the extension was reloaded while this tab's content script kept
  // running — falls back to localStorage instead of leaving an uncaught
  // rejection.
  function persistToStorage(key, chromeValue, localStorageValue) {
    if (hasChromeStorage()) {
      try {
        chrome.storage.local.set({ [key]: chromeValue });
        return;
      } catch (err) {
        console.warn(LOG_PREFIX, `chrome.storage unavailable, saving "${key}" to localStorage instead`, err);
      }
    }
    try {
      localStorage.setItem(key, localStorageValue);
    } catch (err) {
      console.warn(LOG_PREFIX, `Unable to save "${key}"`, err);
    }
  }

  function persistUserName(name) {
    const trimmed = (name || "").trim();
    userNameCache = trimmed;
    persistToStorage(USER_NAME_KEY, trimmed, trimmed);
  }

  // Used anywhere a fill function stamps a "Test <something>" name — swaps in
  // the configured name so records created by different people are easy to
  // tell apart, falling back to random letters when no name is set.
  function testName(randomLength) {
    const name = getUserName();
    return name || getRandomLetters(randomLength);
  }

  function persistLastSeenVersion(version) {
    lastSeenVersionCache = version;
    persistToStorage(LAST_SEEN_VERSION_KEY, version, version);
  }

  // One-time, paginated "What's New" card — self-contained styling so it
  // doesn't depend on the launcher/popup having been built yet. Same overall
  // footprint as before (380px max-width card), just one page of content
  // shown at a time with a Next/Got it! flow instead of one long list.
  function showWhatsNewModal() {
    if (document.getElementById("fep-whats-new")) return;

    let pageIndex = 0;
    const pages = CHANGELOG.pages;

    const SERIF_FONT = "-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";
    const TEAL = "#202124";

    const overlay = document.createElement("div");
    overlay.id = "fep-whats-new";
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "background:rgba(28,25,23,0.55)",
      "z-index:2147483647",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "font-family:system-ui,-apple-system,'Segoe UI',sans-serif"
    ].join(";");

    const card = document.createElement("div");
    card.style.cssText = [
      "background:#fffdf9",
      "border-radius:16px",
      "padding:22px 24px",
      "max-width:380px",
      "width:88%",
      "max-height:80vh",
      "overflow-y:auto",
      "box-sizing:border-box",
      "box-shadow:0 20px 60px rgba(0,0,0,0.35)"
    ].join(";");

    const content = document.createElement("div");
    const dots = document.createElement("div");
    dots.style.cssText = "display:flex;justify-content:center;gap:6px;margin:16px 0 14px;";

    const buttonRow = document.createElement("div");
    buttonRow.style.cssText = "display:flex;flex-direction:column;gap:8px;";

    function close() {
      persistLastSeenVersion(CHANGELOG.version);
      overlay.remove();
    }

    function render() {
      const page = pages[pageIndex];
      const isFinal = pageIndex === pages.length - 1;

      content.innerHTML = "";
      const title = document.createElement("div");
      title.textContent = page.title;
      title.style.cssText = `font-family:${SERIF_FONT};font-size:19px;font-weight:700;color:#1c1917;margin-bottom:12px;letter-spacing:-.01em;`;
      content.appendChild(title);

      (page.items || []).forEach((text) => {
        const row = document.createElement("div");
        row.style.cssText = "font-size:13px;color:#57534e;line-height:1.6;margin-bottom:8px;";
        row.textContent = text;
        content.appendChild(row);
      });

      dots.innerHTML = "";
      pages.forEach((_, i) => {
        const dot = document.createElement("div");
        dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${i === pageIndex ? TEAL : "#e7e5e4"};`;
        dots.appendChild(dot);
      });

      buttonRow.innerHTML = "";

      if (isFinal) {
        const rateBtn = document.createElement("button");
        rateBtn.type = "button";
        rateBtn.textContent = "Review on Chrome Web Store";
        rateBtn.style.cssText = [
          "width:100%",
          "padding:10px 14px",
          `border:1px solid ${TEAL}`,
          "border-radius:10px",
          "background:#fffdf9",
          `color:${TEAL}`,
          "font-size:13px",
          "font-weight:700",
          "cursor:pointer",
          "box-sizing:border-box"
        ].join(";");
        rateBtn.addEventListener("click", () => {
          window.open(CHANGELOG.reviewUrl, "_blank", "noopener");
        });
        buttonRow.appendChild(rateBtn);
      }

      const primaryBtn = document.createElement("button");
      primaryBtn.type = "button";
      primaryBtn.textContent = isFinal ? "Got it!" : "Next";
      primaryBtn.style.cssText = [
        "width:100%",
        "padding:10px 14px",
        "border:none",
        "border-radius:10px",
        `background:${TEAL}`,
        "color:#fff",
        "font-size:13px",
        "font-weight:700",
        "cursor:pointer",
        "box-sizing:border-box"
      ].join(";");
      primaryBtn.addEventListener("click", () => {
        if (isFinal) {
          close();
        } else {
          pageIndex += 1;
          render();
        }
      });
      buttonRow.appendChild(primaryBtn);
    }

    render();

    card.appendChild(content);
    card.appendChild(dots);
    card.appendChild(buttonRow);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // Called once per page load; only actually shows the card the first time
  // this version is seen (including a brand-new install, where the cache is
  // null). Safe to call repeatedly — it's a no-op once dismissed.
  function maybeShowWhatsNew() {
    if (lastSeenVersionCache === CHANGELOG.version) return;
    showWhatsNewModal();
  }

  function isUatHost() {
    return getApiEnvironment()?.name === "uat";
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function emptyBucket() {
    return { clicks: 0, actualMs: 0, fieldsFilled: 0, savedMs: 0 };
  }

  function emptyAutofillStats() {
    return {
      lifetime: { lead: emptyBucket(), details: emptyBucket(), total: emptyBucket() },
      today: { date: todayKey(), lead: emptyBucket(), details: emptyBucket(), total: emptyBucket() }
    };
  }

  function mergeBucket(fallback, src) {
    return Object.assign({}, fallback, src || {});
  }

  // Lifetime totals are permanent — there is no user-facing way to reset them.
  // "today" auto-rolls to a fresh bucket the first time it's read on a new
  // calendar date; that's the only kind of "reset" this data ever gets.
  function readAutofillStats() {
    const fallback = emptyAutofillStats();
    const parsed = statsCache || {};
    const lifetimeSrc = parsed.lifetime || {};
    const todaySrc = parsed.today && parsed.today.date === fallback.today.date ? parsed.today : fallback.today;

    return {
      lifetime: {
        lead: mergeBucket(fallback.lifetime.lead, lifetimeSrc.lead),
        details: mergeBucket(fallback.lifetime.details, lifetimeSrc.details),
        total: mergeBucket(fallback.lifetime.total, lifetimeSrc.total)
      },
      today: {
        date: fallback.today.date,
        lead: mergeBucket(fallback.today.lead, todaySrc.lead),
        details: mergeBucket(fallback.today.details, todaySrc.details),
        total: mergeBucket(fallback.today.total, todaySrc.total)
      }
    };
  }

  function saveAutofillStats(stats) {
    statsCache = stats;
    persistToStorage(AUTOFILL_STATS_KEY, stats, JSON.stringify(stats));
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }

  // Incremented once per field/action a fill function successfully bypasses —
  // see the individual fillInputByX / selectDropdownByX / clickChoiceByText
  // helpers and the manual loops in fillLETFR/fillNetMetering/etc.
  let fieldTouchCount = 0;
  function countField() {
    fieldTouchCount += 1;
  }

  function addToBucket(bucket, elapsedMs, fieldsTouched, savedMs) {
    bucket.clicks += 1;
    bucket.actualMs += elapsedMs;
    bucket.fieldsFilled += fieldsTouched;
    bucket.savedMs += savedMs;
  }

  function recordAutofillRun(type, elapsedMs, fieldsTouched) {
    const stats = readAutofillStats();
    const savedMs = fieldsTouched * MS_SAVED_PER_FIELD;

    [stats.lifetime, stats.today].forEach((scope) => {
      addToBucket(scope[type], elapsedMs, fieldsTouched, savedMs);
      addToBucket(scope.total, elapsedMs, fieldsTouched, savedMs);
    });

    saveAutofillStats(stats);

    console.log(
      LOG_PREFIX,
      `[Autofill Stats] ${type} click #${stats.lifetime[type].clicks}: ${fieldsTouched} field(s) bypassed, saved ${formatDuration(savedMs)} (lifetime total saved ${formatDuration(stats.lifetime.total.savedMs)})`
    );
  }

  async function runTrackedAutofill(type, fn) {
    const startedAt = performance.now();
    const fieldsBefore = fieldTouchCount;
    let sessionStarted = false;
    try {
      await globalThis.FepCustomTools.beginAutofill();
      sessionStarted = true;
      const result = await fn();
      await globalThis.FepCustomTools.finishAutofill();
      return result;
    } catch (error) {
      showApiToast("Autofill stopped", false, error.message);
      console.error(LOG_PREFIX, "Autofill stopped", error);
    } finally {
      if (sessionStarted) globalThis.FepCustomTools.endAutofill();
      const fieldsTouched = fieldTouchCount - fieldsBefore;
      recordAutofillRun(type, performance.now() - startedAt, fieldsTouched);
    }
  }

  function normalize(str) {
    return (str || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function realClick(el) {
    if (!el) return;
    // Guard: if the element has been removed from the DOM (SPA navigation,
    // React re-render, etc.) calling .click() on a detached submit-button
    // produces Chrome's "Form submission canceled — form not connected" warning.
    if (!el.isConnected) return;

    const rect = el.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      button: 0,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };

    if (window.PointerEvent) {
      el.dispatchEvent(new PointerEvent("pointerdown", Object.assign({}, init, {
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        buttons: 1
      })));
    }
    el.dispatchEvent(new MouseEvent("mousedown", Object.assign({}, init, { buttons: 1 })));

    if (window.PointerEvent) {
      el.dispatchEvent(new PointerEvent("pointerup", Object.assign({}, init, {
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        buttons: 0
      })));
    }
    el.dispatchEvent(new MouseEvent("mouseup", Object.assign({}, init, { buttons: 0 })));
    el.dispatchEvent(new MouseEvent("click", Object.assign({}, init, { buttons: 0 })));
  }

  function setReactValue(el, value) {
    const descriptor = Object.getOwnPropertyDescriptor(el.__proto__, "value");
    if (!descriptor || typeof descriptor.set !== "function") {
      el.value = value;
    } else {
      descriptor.set.call(el, value);
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function getRandomLetters(length = 6) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    return Array.from(
      { length },
      () => chars.charAt(Math.floor(Math.random() * chars.length))
    ).join("");
  }

  function getValidPhone() {
    const first = Math.floor(Math.random() * 5) + 1;
    return (
      first +
      Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("")
    );
  }

  function getRandomEmail() {
    return `test${Math.floor(Math.random() * 100000)}@mail.com`;
  }

  function getFormItems() {
    return Array.from(document.querySelectorAll(".ant-form-item"));
  }

  function findFormItemsByLabel(label) {
    return getFormItems().filter((el) =>
      normalize(el.innerText).includes(normalize(label))
    );
  }

  function findFormItemByLabel(label, occurrence = 1) {
    const items = findFormItemsByLabel(label);
    return items[Math.max(0, occurrence - 1)];
  }

  async function waitDropdown(timeoutMs = 1250) {
    const attempts = Math.ceil(timeoutMs / 50);
    for (let i = 0; i < attempts; i += 1) {
      const dropdowns = Array.from(
        document.querySelectorAll(".ant-select-dropdown")
      ).filter((el) => el.offsetHeight > 0);

      if (dropdowns.length) {
        return dropdowns[dropdowns.length - 1];
      }

      await sleep(50);
    }

    return null;
  }

  function dropdownOptions(dropdown) {
    return Array.from(dropdown.querySelectorAll(".ant-select-item-option"));
  }

  async function waitFormSelectByLabel(label, occurrence = 1, timeoutMs = 1200) {
    const attempts = Math.ceil(timeoutMs / 50);
    for (let i = 0; i < attempts; i += 1) {
      const item = findFormItemByLabel(label, occurrence);
      const select = item && item.querySelector(".ant-select-selector");
      const wrapper = select && select.closest(".ant-select");
      if (select && wrapper && !wrapper.classList.contains("ant-select-disabled")) {
        return { item, select };
      }
      await sleep(50);
    }

    const item = findFormItemByLabel(label, occurrence);
    return { item, select: item && item.querySelector(".ant-select-selector") };
  }

  async function waitDropdownOptions(dropdown, timeoutMs = 1200) {
    const attempts = Math.ceil(timeoutMs / 50);
    for (let i = 0; i < attempts; i += 1) {
      const options = dropdownOptions(dropdown);
      if (options.length) return options;
      await sleep(50);
    }
    return dropdownOptions(dropdown);
  }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
  }

  async function waitDropdownSettled(dropdown) {
    for (let i = 0; i < 8; i += 1) {
      if (!isVisible(dropdown)) return;
      await sleep(50);
    }
  }

  async function clickDropdownOption(option, dropdown) {
    option.scrollIntoView({ block: "nearest" });
    option.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
    option.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, view: window }));
    realClick(option);
    await waitDropdownSettled(dropdown);
  }

  function selectedDropdownText(select) {
    const wrapper = select && select.closest(".ant-select");
    const selected = wrapper && wrapper.querySelector(".ant-select-selection-item");
    const renderedText = selected && selected.textContent;
    const input = wrapper && wrapper.querySelector(".ant-select-selection-search-input");
    return normalize(renderedText || (input && input.value));
  }

  function pressKey(el, key) {
    if (!el) return;
    const init = { bubbles: true, cancelable: true, key, code: key, view: window };
    el.dispatchEvent(new KeyboardEvent("keydown", init));
    el.dispatchEvent(new KeyboardEvent("keyup", init));
  }

  function debugLeadTiming(label, start) {
    const debugEnabled =
      window.__fepDebugLead ||
      localStorage.getItem("fepDebugLead") === "1" ||
      document.documentElement.dataset.fepDebugLead === "1";
    if (!debugEnabled) return;
    console.log(LOG_PREFIX, `[Lead timing] ${label}: ${Math.round(performance.now() - start)}ms`);
  }

  async function timedLeadStep(label, fn) {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      debugLeadTiming(label, start);
    }
  }

  async function selectDropdownByLabel(label, mode = "first", occurrence = 1, options = {}) {
    const waitMs = options.waitMs || 1200;
    const retries = options.retries || 2;
    for (let attempt = 0; attempt < retries; attempt += 1) {
      const { item, select } = await waitFormSelectByLabel(label, occurrence, waitMs);
      if (!item || !select) return false;
      if (await globalThis.FepCustomTools.beforeField(select)) { countField(); return true; }

      realClick(select);

      const dropdown = await waitDropdown();
      if (!dropdown) return false;

      const dropdownItems = await waitDropdownOptions(dropdown, waitMs);
      if (!dropdownItems.length) return false;

      const option = mode === "last" ? dropdownItems[dropdownItems.length - 1] : dropdownItems[0];
      const expected = normalize(option.innerText);
      await clickDropdownOption(option, dropdown);
      await sleep(100);

      if (expected && selectedDropdownText(select).includes(expected)) {
        countField();
        return true;
      }
    }

    console.warn(LOG_PREFIX, `Dropdown not confirmed: ${label}`);
    return false;
  }

  async function selectDropdownByText(label, text, occurrence = 1, options = {}) {
    const wanted = normalize(text);
    const waitMs = options.waitMs || 1200;
    const retries = options.retries || 2;
    for (let attempt = 0; attempt < retries; attempt += 1) {
      const { item, select } = await waitFormSelectByLabel(label, occurrence, waitMs);
      if (!item || !select) return false;
      if (await globalThis.FepCustomTools.beforeField(select)) { countField(); return true; }

      realClick(select);

      const dropdown = await waitDropdown();
      if (!dropdown) return false;

      const dropdownItems = await waitDropdownOptions(dropdown, waitMs);
      let option =
        dropdownItems.find((el) => normalize(el.innerText) === wanted) ||
        dropdownItems.find((el) => normalize(el.innerText).includes(wanted));

      if (option) {
        await clickDropdownOption(option, dropdown);
        await sleep(100);
      }

      if (selectedDropdownText(select).includes(wanted)) {
        countField();
        return true;
      }

      const wrapper = select.closest(".ant-select");
      const searchInput = wrapper && wrapper.querySelector(".ant-select-selection-search-input");
      if (!searchInput) continue;

      searchInput.focus();
      setReactValue(searchInput, text);
      await sleep(100);

      const searchDropdown = await waitDropdown();
      if (searchDropdown) {
        const searchOptions = await waitDropdownOptions(searchDropdown, waitMs);
        option =
          searchOptions.find((el) => normalize(el.innerText) === wanted) ||
          searchOptions.find((el) => normalize(el.innerText).includes(wanted));
        if (option) {
          await clickDropdownOption(option, searchDropdown);
          await sleep(100);
        }
      }

      if (selectedDropdownText(select).includes(wanted)) {
        countField();
        return true;
      }

      pressKey(searchInput, "Enter");
      await sleep(100);
      if (selectedDropdownText(select).includes(wanted)) {
        countField();
        return true;
      }
    }

    console.warn(LOG_PREFIX, `Dropdown not confirmed: ${label} -> ${text}`);
    return false;
  }

  async function selectSearchableDropdownByText(label, text, occurrence = 1) {
    const wanted = normalize(text);
    const { item, select } = await waitFormSelectByLabel(label, occurrence, 1000);
    if (!item || !select) return false;
    if (await globalThis.FepCustomTools.beforeField(select)) { countField(); return true; }

    realClick(select);
    await sleep(50);

    const wrapper = select.closest(".ant-select");
    const searchInput = wrapper && wrapper.querySelector(".ant-select-selection-search-input");
    if (!searchInput) return selectDropdownByText(label, text, occurrence, { waitMs: 800, retries: 1 });

    searchInput.focus();
    setReactValue(searchInput, text);
    await sleep(100);

    const dropdown = await waitDropdown();
    if (!dropdown) return false;

    const options = await waitDropdownOptions(dropdown, 800);
    const option =
      options.find((el) => normalize(el.innerText) === wanted) ||
      options.find((el) => normalize(el.innerText).includes(wanted));

    if (option) {
      await clickDropdownOption(option, dropdown);
      await sleep(100);
    }

    if (selectedDropdownText(select).includes(wanted)) {
      countField();
      return true;
    }

    pressKey(searchInput, "ArrowDown");
    pressKey(searchInput, "Enter");
    await sleep(150);

    const confirmed = selectedDropdownText(select).includes(wanted);
    if (confirmed) countField();
    else console.warn(LOG_PREFIX, `Searchable dropdown not confirmed: ${label} -> ${text}`);
    return confirmed;
  }

  async function selectFirstDropdownOptionFast(label, occurrence = 1, optionsConfig = {}) {
    const waitMs = optionsConfig.waitMs || 800;
    const totalStart = performance.now();
    let stepStart = performance.now();
    const { item, select } = await waitFormSelectByLabel(label, occurrence, waitMs);
    debugLeadTiming(`${label} wait select`, stepStart);
    if (!item || !select) return false;
    if (await globalThis.FepCustomTools.beforeField(select)) { countField(); return true; }

    stepStart = performance.now();
    realClick(select);
    debugLeadTiming(`${label} open click`, stepStart);

    stepStart = performance.now();
    // A field whose options depend on a slower computation (e.g. Lender,
    // whose eligible options depend on tenure + ticked documents) can take
    // longer than the default 1.25s for its dropdown panel to actually
    // render — Math.max keeps the wait at least as long as before for every
    // other caller that doesn't pass a custom waitMs.
    const dropdown = await waitDropdown(Math.max(waitMs, 1250));
    debugLeadTiming(`${label} wait dropdown`, stepStart);
    if (!dropdown) return false;

    stepStart = performance.now();
    const options = await waitDropdownOptions(dropdown, waitMs);
    debugLeadTiming(`${label} wait options`, stepStart);
    if (!options.length) return false;

    stepStart = performance.now();
    await clickDropdownOption(options[0], dropdown);
    await sleep(80);
    debugLeadTiming(`${label} click first option`, stepStart);

    if (selectedDropdownText(select)) {
      debugLeadTiming(`${label} total`, totalStart);
      countField();
      return true;
    }

    const wrapper = select.closest(".ant-select");
    const searchInput = wrapper && wrapper.querySelector(".ant-select-selection-search-input");
    if (searchInput) {
      stepStart = performance.now();
      searchInput.focus();
      pressKey(searchInput, "ArrowDown");
      pressKey(searchInput, "Enter");
      await sleep(100);
      debugLeadTiming(`${label} keyboard fallback`, stepStart);
    }

    debugLeadTiming(`${label} total`, totalStart);
    const confirmed = !!selectedDropdownText(select);
    if (confirmed) countField();
    return confirmed;
  }

  async function fillInputByLabel(label, value, occurrence = 1) {
    const item = findFormItemByLabel(label, occurrence);
    if (!item) {
      return;
    }

    const inputs = Array.from(item.querySelectorAll("input"));
    const input = inputs.find((i) => !i.closest(".ant-select")) || inputs[0];
    if (!input) {
      return;
    }

    if (await globalThis.FepCustomTools.beforeField(input)) { countField(); return true; }
    input.focus();
    setReactValue(input, value);
    countField();

    await sleep(50);
  }

  async function fillInputById(id, value) {
    const input = document.getElementById(id);
    if (!input) {
      return;
    }

    if (await globalThis.FepCustomTools.beforeField(input)) { countField(); return true; }
    input.focus();
    setReactValue(input, value);
    countField();

    await sleep(50);
  }

  async function fillInputByPlaceholder(placeholder, value) {
    const input = Array.from(document.querySelectorAll("input")).find((el) =>
      normalize(el.placeholder).includes(normalize(placeholder))
    );
    if (!input) {
      return;
    }

    if (await globalThis.FepCustomTools.beforeField(input)) { countField(); return true; }
    input.focus();
    setReactValue(input, value);
    countField();

    await sleep(50);
  }

  async function fillDate(id, dateStr) {
    const input = document.getElementById(id);
    if (!input) {
      return;
    }

    if (await globalThis.FepCustomTools.beforeField(input)) { countField(); return true; }
    input.focus();
    setReactValue(input, dateStr);
    input.blur();
    countField();

    await sleep(300);
  }

  function formatDate(date) {
    return [
      String(date.getDate()).padStart(2, "0"),
      String(date.getMonth() + 1).padStart(2, "0"),
      date.getFullYear()
    ].join("-");
  }

  async function fillDateByLabel(label, dateStr, occurrence = 1) {
    const item = findFormItemByLabel(label, occurrence);
    const input = item && item.querySelector(".ant-picker input, input");
    if (!input || input.disabled || input.readOnly) return false;

    if (await globalThis.FepCustomTools.beforeField(input)) { countField(); return true; }
    input.focus();
    setReactValue(input, dateStr);
    pressKey(input, "Enter");
    input.blur();
    countField();
    await sleep(150);
    return true;
  }

  async function clickChoiceByText(text, label) {
    const scope = label ? findFormItemByLabel(label) || document : document;
    const wanted = normalize(text);
    const candidates = Array.from(
      scope.querySelectorAll("button,[role='button'],.ant-radio-button-wrapper")
    );
    const choice = candidates.find((el) => normalize(el.innerText || el.textContent) === wanted);
    if (!choice) return false;
    const control = choice.querySelector("input");
    if (control && await globalThis.FepCustomTools.beforeField(control)) { countField(); return true; }

    realClick(choice);
    countField();
    await sleep(80);
    return true;
  }

  async function fillLead() {
    const leadStart = performance.now();
    await timedLeadStep("First Name", () => fillInputByLabel("First Name", `Test ${testName(4)}`));
    await timedLeadStep("Last Name", () => fillInputByLabel("Last Name", getRandomLetters(5)));
    await timedLeadStep("Contact Number", () => fillInputByLabel("Contact Number", getValidPhone()));
    await timedLeadStep("Email", () => fillInputByLabel("Email", getRandomEmail()));

    await timedLeadStep("Pincode 1", () => fillInputByLabel("Pincode", "500019", 1));
    await timedLeadStep("Area 1", () => selectDropdownByLabel("Area", "first", 1, { waitMs: 5000, retries: 3 }));
    await timedLeadStep("Project Type", () => selectDropdownByText("Project Type", "Independent"));
    await timedLeadStep("Range of Electricity Bill", () => selectDropdownByLabel("Range of Electricity Bill", "first"));

    await timedLeadStep("Door No", () => fillInputByLabel("Door No", "12"));
    await timedLeadStep("Pincode 2", () => fillInputByLabel("Pincode", "500019", 2));
    await timedLeadStep("Area 2", () => selectDropdownByLabel("Area", "first", 2, { waitMs: 5000, retries: 3 }));
    await timedLeadStep("Serviceable State", () => selectDropdownByText("Serviceable State", "Telangana"));
    await timedLeadStep("Serviceable City", () => selectDropdownByText("Serviceable City", "Hyderabad", 1, { waitMs: 5000, retries: 3 }));
    if (isUatHost() && findFormItemByLabel("DISCOM")) {
      await timedLeadStep("DISCOM", async () => {
        let selected = await selectFirstDropdownOptionFast("DISCOM", 1, { waitMs: 2500 });
        if (!selected) {
          await sleep(400);
          selected = await selectFirstDropdownOptionFast("DISCOM", 1, { waitMs: 2500 });
        }
        if (!selected) console.warn(LOG_PREFIX, "Lead form: DISCOM was not selected on UAT");
        return selected;
      });
    }
    await timedLeadStep("Lead Source", () => selectFirstDropdownOptionFast("Lead Source"));

    const comment = document.querySelector("textarea");
    if (comment && !(await globalThis.FepCustomTools.beforeField(comment))) {
      setReactValue(comment, "Created using autofill");
      countField();
    }

    console.log(LOG_PREFIX, "Lead Autofill Done");
    debugLeadTiming("Lead total", leadStart);
  }

  async function fillTCLeadDetails() {
    await fillInputByLabel("Pincode", "500019");
    await fillInputByLabel("Door No", "12");
    await selectDropdownByLabel("Area", "first", 1, { waitMs: 5000, retries: 3 });
    await selectDropdownByText("Serviceable State", "Telangana");
    await selectFirstDropdownOptionFast("Serviceable City", 1, { waitMs: 3000 });
    let discomSelected = await selectFirstDropdownOptionFast("DISCOM", 1, { waitMs: 3000 });
    if (!discomSelected) {
      await sleep(500);
      discomSelected = await selectFirstDropdownOptionFast("DISCOM", 1, { waitMs: 2500 });
    }
    if (!discomSelected) console.warn(LOG_PREFIX, "TC Lead Details: DISCOM was not selected");

    await fillInputByLabel("Project Name", `Test ${testName(4)}_residential_independent`);
    await selectDropdownByText("Project Type", "Independent");
    await clickChoiceByText("Own House", "Own House / Rented");
    await selectFirstDropdownOptionFast("Site Under Construction");

    await clickChoiceByText("Permanent", "Meter Type");
    await selectDropdownByLabel("Range of Electricity Bill", "first");
    await fillInputByLabel("Average Electricity Bill", 1000);
    await fillInputByPlaceholder("units consumed", 100);
    await fillInputByLabel("Current Contract Load", 4);
    await selectFirstDropdownOptionFast("Current Grid Phase");

    await selectDropdownByText("Avail Subsidy", "Yes");
    await selectFirstDropdownOptionFast("Required Solar System Size", 1, { waitMs: 5000 });
    await selectFirstDropdownOptionFast("Required Inverter Phase");
    await selectDropdownByText("Storage Type", "WITHOUT_STORAGE");
    await fillInputByLabel("Roof Area Available", 500);
    await selectFirstDropdownOptionFast("Roof Type");

    await clickChoiceByText("Yes", "Interested in Finance");
    await selectFirstDropdownOptionFast("Employment Type");
    await fillInputByLabel("Exact Employment Type", "Software Engineer");
    await clickChoiceByText("No", "Wants to go with Bajaj Finserv");

    await clickChoiceByText("10 AM - 2 PM", "Preferred Time to Call");
    // Keep this "No" — "Yes" reveals required Preferred Visit Date/Time fields
    // that autofill doesn't fill, which blocks Save.
    await clickChoiceByText("No", "Interested in Showcase Home Visit");
    await selectFirstDropdownOptionFast("Lead Source");
    await selectDropdownByText("Priority", "Low");

    const textareas = Array.from(document.querySelectorAll("textarea")).filter((el) => !el.disabled && !el.readOnly);
    const remarks = textareas[textareas.length - 1];
    if (remarks && !(await globalThis.FepCustomTools.beforeField(remarks))) {
      setReactValue(remarks, "Created using autofill");
      countField();
    }

    console.log(LOG_PREFIX, "TC Lead Details Autofill Done");
  }

  async function fillProposal() {
    await selectDropdownByLabel("DISCOM", "first");
    await sleep(800);

    const subsidy = document.querySelector(
      '#subsidyEnergyRequirements input[value="Yes"]'
    );
    if (subsidy && !(await globalThis.FepCustomTools.beforeField(subsidy))) {
      subsidy.click();
      countField();
    }

    await fillInputByLabel("Current Contract Load", 4);
    await selectDropdownByLabel("Current Grid/Home Phase", "first");
    await selectDropdownByLabel("Required Solar System Size", "last");
    await selectDropdownByLabel("Required Solar Inverter Phase", "last");
    await fillInputByLabel("Available Roof Area", 5000000);

    const structure = Array.from(document.querySelectorAll("div")).find((el) =>
      normalize(el.innerText).includes("flat roof")
    );
    if (structure) {
      realClick(structure);
      countField();
    }

    await fillInputByLabel("Grid tariff", 7);

    console.log(LOG_PREFIX, "Proposal Autofill Done");
  }

  // "Documents you have available" checklist on the Bom Customization tab.
  // Confirmed via DevTools: rows aren't real checkbox inputs and aren't
  // wrapped in .ant-form-item — each is a clickable div (class includes
  // "cursor-pointer") holding a decorative checkbox-shaped <span> (empty
  // when unticked, holds a checkmark icon once ticked) and a label span.
  // The exact set of documents varies per project (e.g. some show an extra
  // "Business Proof" row others don't), so rows are found generically —
  // every direct-child row under the "Applicant documents" sub-heading —
  // rather than matched against a fixed list of expected document names.
  async function tickAllLoanDocuments() {
    const sectionHeading = Array.from(document.querySelectorAll("*")).find(
      (el) => el.children.length === 0 && normalize(el.textContent) === "applicant documents"
    );
    const container = sectionHeading ? sectionHeading.parentElement : null;
    if (!container) {
      console.warn(LOG_PREFIX, "Could not find the loan documents checklist");
      return;
    }

    const rows = Array.from(container.children).filter(
      (el) => el !== sectionHeading && el.classList.contains("cursor-pointer")
    );

    let ticked = 0;
    for (const row of rows) {
      const box = row.querySelector("span");
      const alreadyChecked = !!(box && box.children.length > 0);
      if (alreadyChecked) continue;

      realClick(row);
      countField();
      ticked += 1;
      await sleep(150);
    }

    if (ticked) {
      console.log(LOG_PREFIX, `Ticked ${ticked} loan document row(s)`);
    } else if (!rows.length) {
      console.warn(LOG_PREFIX, "No loan document rows were found to tick");
    }
  }

  // Unlike every other field on this page, "Lender" isn't wrapped in an
  // .ant-form-item — it's a plain <div class="max-w-sm flex-1"> holding a
  // label span and the <Select> directly. findFormItemByLabel (and every
  // helper built on it) can never find it, so this locates its select
  // control straight from the "Lender" label text instead. Called last,
  // after eligibility has already had the entire rest of the form's fill
  // time to settle — so no retry/poll budget here, just act immediately.
  async function selectLenderDropdown() {
    const labelEl = Array.from(document.querySelectorAll("*")).find(
      (el) => el.children.length === 0 && normalize(el.textContent) === "lender"
    );
    if (!labelEl) {
      console.warn(LOG_PREFIX, "Lender field not found");
      return false;
    }

    const container = labelEl.parentElement;
    const select = container ? container.querySelector(".ant-select-selector") : null;
    if (!select) {
      console.warn(LOG_PREFIX, "Lender select control not found");
      return false;
    }

    if (await globalThis.FepCustomTools.beforeField(select)) { countField(); return true; }
    realClick(select);
    await sleep(50); // one tick for the dropdown panel to mount

    const dropdown = Array.from(document.querySelectorAll(".ant-select-dropdown")).find(
      (el) => el.offsetHeight > 0
    );
    if (!dropdown) {
      console.warn(LOG_PREFIX, "Lender dropdown never opened");
      return false;
    }

    const option = dropdown.querySelector(".ant-select-item-option");
    if (!option) {
      console.warn(LOG_PREFIX, "Lender dropdown had no options");
      return false;
    }

    realClick(option);
    await sleep(50);

    const confirmed = !!selectedDropdownText(select);
    if (confirmed) countField();
    else console.warn(LOG_PREFIX, "Lender selection did not stick");
    return confirmed;
  }

  async function fillPO(options = {}) {
    const financeMode = options.financeMode === "none" ? "none" : "finance";

    await selectDropdownByText("Site Status", "Ready Building");
    await selectDropdownByText("Name Change Required", "No");
    await selectDropdownByText("Category Change Required", "No");

    if (financeMode === "none") {
      // "No" hides Tenure/Marital Status/DOB and everything financing-related below,
      // but PAN Number and Gender stay on the form either way — still fill those.
      await selectDropdownByText("project under finance", "No");
      await fillInputById("pan", "ABCDE1234F");
      await selectDropdownByLabel("Gender", "first");
      console.log(LOG_PREFIX, "PO Autofill Done (Non Finance)");
      return;
    }

    await selectDropdownByText("project under finance", "Yes");

    await fillInputById("pan", "ABCDE1234F");
    await selectDropdownByLabel("Gender", "first");
    await selectDropdownByText("Tenure", "24 months");

    // Tenure affects lender eligibility, so it's selected before ticking
    // documents.
    await tickAllLoanDocuments();

    await selectDropdownByLabel("Marital Status", "first");
    await fillDate("dob", "15-03-1990");

    await fillInputByPlaceholder("Amount to be financed", 200000);
    await fillInputByPlaceholder("Monthly Power bill", 12345);
    await selectFirstDropdownOptionFast("Profession");
    await fillInputByPlaceholder("Monthly Income", 12345);

    await fillInputByPlaceholder("Applicant Name", "TEST APPLICANT");
    await fillInputByPlaceholder("Mother", "TEST MOTHER");
    await fillInputById("phoneNumber", getValidPhone());
    await fillInputByPlaceholder("Email of the Applicant", "5136572@mail.com");

    await fillInputByPlaceholder("Name of the Company", "TESTCOMPANY");
    await fillInputByPlaceholder("Email of the Company", "testcompany@mail.com");
    await fillInputById("companyContact", getValidPhone());

    await selectDropdownByText("Financed through Jan Samarth", "Yes", 1, { waitMs: 5000, retries: 3 });
    await fillInputById("janSamarthBankName", "Test Bank");

    // Selected last — the Lender field only renders once eligibility settles
    // from the tenure + ticked documents above, and by this point every other
    // field has already given that computation time to finish. Just picks
    // whichever lender is first; which ones are eligible varies per project.
    await selectLenderDropdown();

    console.log(LOG_PREFIX, "PO Autofill Done");
  }

  // ED module — DPR "System Information" tab. Only the Project Summary block
  // is filled; Project Name/Prepared for/Prepared by/Checked by and System
  // Size are read-only (auto-populated from the project itself). Every field
  // here is a plain text input, not a dropdown, so fillInputByLabel is enough.
  async function fillEDSystemInformation() {
    await fillInputByLabel("Type of roof", "RCC");
    await fillInputByLabel("Total number of roofs and KWP and roofs", "1");
    await fillInputByLabel("Total number of SPV Modules", "1");
    await fillInputByLabel("Wattage of Module", "1");
    await fillInputByLabel("Total number of grid tied inverters", "1");
    await fillInputByLabel("Rating of inverter", "1");
    await fillInputByLabel("Module type angle", "1");
    await fillInputByLabel("Module Azimuth", "1");

    console.log(LOG_PREFIX, "ED System Information Autofill Done");
  }

  function makeSerialNumber(index) {
    const stamp = Date.now().toString(36).toUpperCase();
    const suffix = getRandomLetters(3).toUpperCase();
    return `SN${stamp}${String(index + 1).padStart(2, "0")}${suffix}`.replace(/[^A-Z0-9]/g, "");
  }

  async function fillPackageSerialNumbers() {
    const serialInputs = Array.from(document.querySelectorAll("input")).filter((input) => {
      if (input.disabled || input.readOnly || !isVisible(input)) return false;
      return normalize(input.placeholder).includes("serial number");
    });

    for (const [index, input] of serialInputs.entries()) {
      if (await globalThis.FepCustomTools.beforeField(input)) { countField(); continue; }
      input.focus();
      setReactValue(input, makeSerialNumber(index));
      countField();
    }

    if (serialInputs.length) await sleep(100);
    return serialInputs.length;
  }

  async function setFileOnInput(input, fileName = "test-document.jpg") {
    const dt = new DataTransfer();
    dt.items.add(createDummyFile(fileName));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(250);
  }

  async function autoUploadPackageDocuments() {
    await autoUploadDocs(document);
  }

  async function fillPackageAndDispatchDetails() {
    await selectFirstDropdownOptionFast("Transporter Company Name", 1, { waitMs: 2500 });
    await fillInputByLabel("Truck Number", `TS09AB${Math.floor(1000 + Math.random() * 9000)}`);
    await fillInputByLabel("Driver Name", "Test Driver");
    await fillInputByLabel("Driver Mobile Number", getValidPhone());

    const expected = new Date();
    expected.setDate(expected.getDate() + 3);
    await fillDateByLabel("Expected Delivery Date", formatDate(expected));

    const serialCount = await fillPackageSerialNumbers();
    await autoUploadPackageDocuments();

    console.log(LOG_PREFIX, `Package & Dispatch Autofill Done (${serialCount} serials)`);
  }

  function createDummyFile(name = "test-document.jpg") {
    // Minimal 1x1 white JPEG generated in memory.
    const base64 =
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Ar//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const safeName = name.toLowerCase().endsWith(".jpg") || name.toLowerCase().endsWith(".jpeg")
      ? name
      : `${name.replace(/\.[^.]+$/, "")}.jpg`;
    const blob = new Blob([bytes], { type: "image/jpeg" });
    return new File([blob], safeName, { type: "image/jpeg" });
  }

  // Minimal but structurally valid single-page blank PDF (correct header,
  // catalog/pages/page objects, xref table with real byte offsets, trailer) —
  // built in memory rather than hardcoded, so the xref offsets are always
  // correct for this exact content. Some document types (e.g. Bank Statement)
  // reject an image and specifically require a PDF.
  function createBlankPdfFile(name = "test-document.pdf") {
    const objects = [
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>\nendobj\n"
    ];

    const header = "%PDF-1.4\n";
    let body = "";
    const offsets = [0];
    let pos = header.length;
    for (const obj of objects) {
      offsets.push(pos);
      body += obj;
      pos += obj.length;
    }

    const xrefOffset = header.length + body.length;
    const pad = (n) => String(n).padStart(10, "0");
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      xref += `${pad(offsets[i])} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    const pdfString = header + body + xref + trailer;
    const safeName = name.toLowerCase().endsWith(".pdf") ? name : `${name.replace(/\.[^.]+$/, "")}.pdf`;
    const blob = new Blob([pdfString], { type: "application/pdf" });
    return new File([blob], safeName, { type: "application/pdf" });
  }

  // Some document rows require a specific file type — Bank Statement expects
  // a PDF and rejects an image, per FEP's own upload validation.
  function createFileForDocumentRow(rowText) {
    if (normalize(rowText).includes("bank statement")) {
      return createBlankPdfFile("bank-statement.pdf");
    }
    return createDummyFile("test-document.jpg");
  }

  async function autoUploadDocs(scope) {
    // Wait for any loading spinner inside the scope to disappear
    async function waitForReady() {
      for (let i = 0; i < 60; i++) {
        if (!scope.querySelector(".ant-spin-spinning")) return;
        await sleep(100);
      }
    }

    // A row is "pending" if its list item does NOT contain "re-upload" text —
    // but not every Documents panel relabels its button that way once done
    // (some just show a "(n)" count and a "View" button instead), and Ant
    // Design's hidden file input for a row never goes away even after a
    // successful upload. So this text check alone isn't enough to know
    // whether a row is done — `attempted` below is what actually prevents
    // re-uploading into the same row over and over.
    function pendingInputs() {
      return Array.from(scope.querySelectorAll('input[type="file"]')).filter(
        (input) => {
          if (attempted.has(input)) return false;
          const row =
            input.closest("li") ||
            input.closest('[class*="ant-list-item"]');
          return row ? !normalize(row.innerText).includes("re-upload") : true;
        }
      );
    }

    const attempted = new Set();
    const total = pendingInputs().length;
    if (!total) {
      console.log(LOG_PREFIX, "No pending file inputs found");
      return;
    }

    // One pass through every row, in order — each input is attempted exactly
    // once and then marked done regardless of what the surrounding UI shows,
    // so the loop always moves on to the next document instead of looping
    // back onto the one it just uploaded.
    for (let attempt = 0; attempt < total; attempt++) {
      await waitForReady();

      const pending = pendingInputs();
      if (!pending.length) break;

      const input = pending[0];
      attempted.add(input);

      const row = input.closest("li") || input.closest('[class*="ant-list-item"]') || scope;
      const dt = new DataTransfer();
      dt.items.add(createFileForDocumentRow(row.textContent));
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      countField();

      await waitForSpinnerToClear(row, 400, 15000);
    }

    const leftover = pendingInputs().length;
    console.log(
      LOG_PREFIX,
      leftover === 0
        ? "All documents uploaded successfully"
        : `Upload done — ${leftover} document(s) still pending`
    );
  }

  // Actual network activity, read from the browser's own Resource Timing
  // buffer — a page-agnostic backup for "is a request still in flight" that
  // doesn't depend on guessing a page's spinner/loading CSS classes (which
  // differ from page to page and are easy to get wrong sight-unseen).
  // Content scripts can't hook the page's own fetch/XHR (that runs in the
  // MAIN world), but every fetch/XHR call still shows up here regardless.
  function isNetworkBusy(sinceTime, quietMs) {
    let entries;
    try {
      entries = performance.getEntriesByType("resource");
    } catch (err) {
      return false;
    }
    const requests = entries.filter(
      (e) =>
        e.startTime >= sinceTime - 50 &&
        (e.initiatorType === "fetch" || e.initiatorType === "xmlhttprequest")
    );
    if (!requests.length) return false; // nothing observed — don't block on this signal
    const completed = requests.filter((e) => e.responseEnd > 0);
    if (completed.length < requests.length) return true; // something still in flight
    const lastEnd = Math.max(...completed.map((e) => e.responseEnd));
    return performance.now() - lastEnd < quietMs;
  }

  // Waits for an in-flight upload/save to actually finish instead of a blind
  // fixed sleep, so the next step never starts before the previous one's
  // response comes back. `minMs` is a floor (never waits less than before);
  // beyond that it keeps polling the page's own loading spinner AND real
  // network activity, up to `timeoutMs` total — whichever signal is actually
  // present on a given page still catches it if the other one doesn't apply.
  async function waitForSpinnerToClear(scope, minMs, timeoutMs) {
    const triggeredAt = performance.now();
    await sleep(minMs);
    const start = performance.now();
    while (performance.now() - start < Math.max(0, timeoutMs - minMs)) {
      const spinning = !!scope.querySelector(".ant-spin-spinning");
      if (!spinning && !isNetworkBusy(triggeredAt, 300)) return true;
      await sleep(200);
    }
    return !scope.querySelector(".ant-spin-spinning");
  }

  // Same idea, but also checks the clicked button's own Ant Design loading
  // state (the spinner AntD shows on a submit button while its request is
  // in flight) in addition to any page-level spinner in scope and real
  // network activity.
  async function waitForActionToSettle(btn, scope, minMs, timeoutMs) {
    const triggeredAt = performance.now();
    await sleep(minMs);
    const start = performance.now();
    while (performance.now() - start < Math.max(0, timeoutMs - minMs)) {
      const btnLoading = !!btn && (btn.classList.contains("ant-btn-loading") || !!btn.querySelector(".ant-btn-loading-icon"));
      const scopeLoading = !!(scope && scope.querySelector(".ant-spin-spinning"));
      if (!btnLoading && !scopeLoading && !isNetworkBusy(triggeredAt, 300)) return true;
      await sleep(200);
    }
    return false;
  }

  async function fillLETFR() {
    // Process one section by its DOM id
    async function processSection(sectionId) {
      const section = document.getElementById(sectionId);
      if (!section) {
        console.log(LOG_PREFIX, `Section not found: #${sectionId}`);
        return;
      }
      console.log(LOG_PREFIX, `Processing: #${sectionId}`);

      // 1. Date pickers — inputs inside .ant-picker, empty and not disabled/readonly
      const dateInputs = Array.from(
        section.querySelectorAll(".ant-picker input")
      ).filter((el) => !el.disabled && !el.readOnly && !el.value);

      for (const input of dateInputs) {
        if (await globalThis.FepCustomTools.beforeField(input)) { countField(); continue; }
        countField();
        const d = new Date();
        const typed = [
          String(d.getDate()).padStart(2, "0"),
          String(d.getMonth() + 1).padStart(2, "0"),
          d.getFullYear()
        ].join("-");
        input.focus();
        setReactValue(input, typed);
        pressKey(input, "Enter");
        input.blur();
        await sleep(100);
        if (input.value) continue;

        // Close any stale calendar before opening a new one
        const staleDropdown = Array.from(
          document.querySelectorAll(".ant-picker-dropdown")
        ).find((el) => {
          if (el.classList.contains("ant-picker-dropdown-hidden")) return false;
          const r = el.getBoundingClientRect();
          return r.height > 0 && r.width > 0;
        });
        if (staleDropdown) {
          document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
          await sleep(400);
        }
        await sleep(300);

        // Click the OUTER .ant-picker wrapper — Ant Design's open handler lives there
        const pickerWrapper = input.closest(".ant-picker") || input;
        realClick(pickerWrapper);
        await sleep(1500);

        const dropdown = Array.from(
          document.querySelectorAll(".ant-picker-dropdown")
        ).find((el) => {
          if (el.classList.contains("ant-picker-dropdown-hidden")) return false;
          const r = el.getBoundingClientRect();
          return r.height > 0 && r.width > 0;
        });

        if (dropdown) {
          const target =
            dropdown.querySelector(".ant-picker-today-btn") ||
            dropdown.querySelector(".ant-picker-cell-today .ant-picker-cell-inner") ||
            dropdown.querySelector(".ant-picker-cell-in-view .ant-picker-cell-inner");
          if (target) {
            realClick(target);
            await sleep(800);
          }
          // Force-close if still open
          const stillOpen = Array.from(
            document.querySelectorAll(".ant-picker-dropdown")
          ).find((el) => {
            if (el.classList.contains("ant-picker-dropdown-hidden")) return false;
            const r = el.getBoundingClientRect();
            return r.height > 0 && r.width > 0;
          });
          if (stillOpen) {
            document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            await sleep(300);
          }
        } else {
          // Fallback: type the date in DD-MM-YYYY format (same as DOB field)
          input.focus();
          setReactValue(input, typed);
          pressKey(input, "Enter");
          input.blur();
          await sleep(400);
        }

        await sleep(500);
      }

      // 2. Plain text/number inputs — skip date pickers, file inputs, hidden, disabled
      const textInputs = Array.from(section.querySelectorAll("input")).filter(
        (el) =>
          el.type !== "file" &&
          !el.disabled &&
          !el.readOnly &&
          !el.value &&
          !el.closest(".ant-picker") &&
          !el.classList.contains("hidden") &&
          el.style.display !== "none"
      );

      for (const input of textInputs) {
        if (await globalThis.FepCustomTools.beforeField(input)) { countField(); continue; }
        input.focus();
        // Ant Design InputNumber wraps its <input> inside .ant-input-number
        // — feeding it a string like "TEST-001" is silently rejected.
        const isNumeric =
          input.type === "number" ||
          !!input.closest(".ant-input-number") ||
          /amount|price|fee|cost|rate|charge/i.test(input.placeholder || "");
        setReactValue(input, isNumeric ? "100000" : "TEST-001");
        countField();
        await sleep(200);
      }

      // 3. Textareas — empty, not disabled
      const textareas = Array.from(
        section.querySelectorAll("textarea")
      ).filter((el) => !el.disabled && !el.readOnly && !el.value);

      for (const ta of textareas) {
        if (await globalThis.FepCustomTools.beforeField(ta)) { countField(); continue; }
        ta.focus();
        setReactValue(ta, "Test remarks");
        countField();
        await sleep(200);
      }

      // 4. File inputs — Ant Design hidden + native "Choose file"
      const fileInputs = Array.from(
        section.querySelectorAll("input[type='file']")
      );

      for (const fileInput of fileInputs) {
        const dt = new DataTransfer();
        dt.items.add(createDummyFile("test-document.jpg"));
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        countField();
        // Wait for the upload's own spinner to clear rather than a fixed delay —
        // S3 uploads can take longer than 800ms, and clicking Save before the
        // upload actually finishes leaves the document out of that submission.
        await waitForSpinnerToClear(section, 800, 15000);
      }

      // 5. Save and wait for the processFeasibility response, not a guess
      const saveBtn = Array.from(section.querySelectorAll("button")).find(
        (b) => normalize(b.innerText) === "save"
      );
      if (saveBtn) {
        await globalThis.FepCustomTools.beforeField(saveBtn);
        realClick(saveBtn);
        await waitForActionToSettle(saveBtn, section, 2000, 20000);
      }

      await sleep(500);
    }

    // Run all 4 sections sequentially using their DOM ids
    await processSection("nationalFeasibilityApplication");
    await processSection("nationalFeasibilityApproval");
    await processSection("stateFeasibilityApplication");
    await processSection("stateFeasibilityApproval");

    console.log(LOG_PREFIX, "LE-TFR Autofill Done");
  }

  async function fillLiaising() {
    // 1. Toggle "All Documents Clear?" to Yes if not already
    const toggle = document.getElementById("allDocumentsReceived");
    if (toggle && toggle.getAttribute("aria-checked") !== "true") {
      realClick(toggle);
      countField();
      await sleep(600);
    }

    // 2. Click the "Clear" button that appears after toggling Yes
    const clearBtn = Array.from(document.querySelectorAll("button")).find(
      (el) => normalize(el.innerText) === "clear"
    );
    if (clearBtn) {
      realClick(clearBtn);
      await sleep(600);
    }

    // 3. Initial Contract Load = 4
    await fillInputByLabel("Initial Contract Load", 4);

    // 4. Consumer Number
    await fillInputById("consumerNumber", "1234567");

    // 5. DISCOM dropdown → first item
    await selectDropdownByLabel("DISCOM", "first");

    // 6. Grid Phase dropdown → first item
    await selectDropdownByLabel("Grid Phase", "first");

    // 7. Bill Category dropdown → first item
    await selectDropdownByLabel("Bill Category", "first");

    console.log(LOG_PREFIX, "Liaising Autofill Done");
  }

  async function fillNetMetering() {
    // ── Discover sections from DOM structure, not from heading text ────────────
    //
    // Each section on this page has exactly ONE "Save" button.
    // Strategy: for every Save button, walk UP the DOM until we find the
    // smallest ancestor whose total Save-button count is exactly 1.
    // That ancestor IS the section boundary.
    // Sort results by document order so we process top → bottom.
    function discoverSections() {
      const found = new Set();

      Array.from(document.querySelectorAll("button"))
        .filter((b) => normalize(b.innerText) === "save")
        .forEach((saveBtn) => {
          let el = saveBtn.parentElement;
          while (el && el !== document.body) {
            const n = el.querySelectorAll("button").length
              ? Array.from(el.querySelectorAll("button")).filter(
                  (b) => normalize(b.innerText) === "save"
                ).length
              : 0;
            if (n === 1) { found.add(el); break; }
            if (n > 1) break; // overshot — contains multiple sections
            el = el.parentElement;
          }
        });

      // Sort by DOM position (top of page first)
      return Array.from(found).sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );
    }

    // "Net meter Testing" section should click Complete, not Save.
    // Detect it by looking for an ant-switch (the No/Yes toggle) inside the section.
    function needsComplete(section) {
      return !!section.querySelector(".ant-switch");
    }

    // ── Close any floating calendar that is still visible ─────────────────────
    async function closeOpenCalendar() {
      const stillOpen = Array.from(
        document.querySelectorAll(".ant-picker-dropdown")
      ).some((el) => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.width > 0;
      });
      if (stillOpen) {
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        await sleep(400);
      }
    }

    // ── Process one section: Date → Files → Save/Complete ─────────────────────
    async function processSection(section) {
      const headingEl = section.querySelector("h2,h3,h4,h5,h6,strong,b");
      const label = headingEl ? headingEl.textContent.trim() : "(unknown)";
      const clickComplete = needsComplete(section);
      console.log(LOG_PREFIX, `Net-metering: "${label}"${clickComplete ? " → Complete" : " → Save"}`);

      // STEP 1 — Date pickers (empty, enabled)
      const dateInputs = Array.from(
        section.querySelectorAll(".ant-picker input")
      ).filter((el) => !el.disabled && !el.readOnly && !el.value);

      for (const input of dateInputs) {
        countField();
        await closeOpenCalendar();
        await sleep(300);

        // Click the OUTER .ant-picker wrapper — Ant Design attaches its
        // open-calendar handler there, not on the bare <input> element.
        const pickerWrapper = input.closest(".ant-picker") || input;
        realClick(pickerWrapper);
        await sleep(1500); // give the calendar panel time to render

        // A visible dropdown is one that is NOT marked hidden by Ant Design
        // AND has real dimensions (guard against display:none or visibility tricks)
        const dropdown = Array.from(
          document.querySelectorAll(".ant-picker-dropdown")
        ).find((el) => {
          if (el.classList.contains("ant-picker-dropdown-hidden")) return false;
          const r = el.getBoundingClientRect();
          return r.height > 0 && r.width > 0;
        });

        if (dropdown) {
          const target =
            dropdown.querySelector(".ant-picker-today-btn") ||
            dropdown.querySelector(".ant-picker-cell-today .ant-picker-cell-inner") ||
            dropdown.querySelector(".ant-picker-cell-in-view .ant-picker-cell-inner");
          if (target) {
            realClick(target);
            await sleep(800);
          }
          await closeOpenCalendar();
        } else {
          // Calendar did not open — type the date string directly as fallback
          const d = new Date();
          const typed = [
            String(d.getDate()).padStart(2, "0"),
            String(d.getMonth() + 1).padStart(2, "0"),
            d.getFullYear()
          ].join("-");
          input.focus();
          setReactValue(input, typed);
          input.blur();
          await sleep(500);
        }

        await sleep(500); // small gap between consecutive date fields
      }

      if (dateInputs.length) await sleep(2000);

      // STEP 2 — File inputs (enabled only)
      const fileInputs = Array.from(
        section.querySelectorAll("input[type='file']")
      ).filter((el) => !el.disabled);

      for (const fi of fileInputs) {
        const dt = new DataTransfer();
        dt.items.add(createDummyFile("test-document.jpg"));
        fi.files = dt.files;
        fi.dispatchEvent(new Event("change", { bubbles: true }));
        countField();
        // Wait for the upload's own spinner to clear instead of a fixed delay —
        // an upload that takes longer than 1.5s otherwise gets left mid-flight.
        await waitForSpinnerToClear(section, 1500, 15000);
      }

      if (fileInputs.length) await sleep(2000);

      // STEP 3 — Click Save or Complete, and wait for its actual response
      const actionText = clickComplete ? "complete" : "save";
      const actionBtn = Array.from(section.querySelectorAll("button")).find(
        (b) => normalize(b.innerText) === actionText && !b.disabled
      );
      if (actionBtn) {
        await globalThis.FepCustomTools.beforeField(actionBtn);
        realClick(actionBtn);
        await waitForActionToSettle(actionBtn, section, 3000, 20000);
      } else {
        console.log(LOG_PREFIX, `  ⚠ "${actionText}" not available in "${label}"`);
      }

      await sleep(2000); // gap before next section
    }

    // ── Main: find all sections in DOM order and run them sequentially ─────────
    const sections = discoverSections();
    console.log(LOG_PREFIX, `Net-metering: found ${sections.length} sections`);

    for (const section of sections) {
      await processSection(section);
    }

    console.log(LOG_PREFIX, "Net Metering Autofill Done");
  }

  // Returns "YY-YY" for the current Indian financial year (Apr 1 – Mar 31)
  function getFiscalYear() {
    const now = new Date();
    const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
  }

  // Scans the DOM for the numeric Project ID shown in the Project Details section
  function getProjectId() {
    // Ant Design Descriptions list
    const items = document.querySelectorAll(".ant-descriptions-item");
    for (const item of items) {
      const label   = item.querySelector(".ant-descriptions-item-label");
      const content = item.querySelector(".ant-descriptions-item-content");
      if (label && normalize(label.textContent) === "project id" && content) {
        const val = content.textContent.trim();
        if (/^\d+$/.test(val)) return val;
      }
    }

    // Generic fallback: find a leaf element whose exact text is "Project ID",
    // then check its next sibling or parent's next sibling for a numeric value.
    for (const el of document.querySelectorAll("*")) {
      if (el.children.length === 0 && normalize(el.textContent) === "project id") {
        const candidate =
          el.nextElementSibling ||
          el.parentElement?.nextElementSibling;
        if (candidate) {
          const val = candidate.textContent.trim();
          if (/^\d{6,}$/.test(val)) return val;
        }
      }
    }

    return null;
  }

  // Reads the advance amount from the #paymentMethod card.
  // Returns the number, or null if not found.
  function getAdvanceAmount() {
    const card = document.getElementById("paymentMethod");
    const scope = card || document;

    // Walk every element in scope; the h3/span containing "Rs. XXXXX" is
    // a sibling of the "Advance amount:" label — scan broadly.
    for (const el of scope.querySelectorAll("*")) {
      const match = el.textContent.match(/rs\.?\s*([\d,]+)/i);
      if (match) {
        // Make sure this element is actually inside the payment method area
        // by checking its text also mentions "advance" somewhere in its subtree.
        const parent = el.closest
          ? el.closest("#paymentMethod, [id*='payment']") || el
          : el;
        if (normalize(parent.textContent).includes("advance")) {
          const num = parseInt(match[1].replace(/,/g, ""), 10);
          if (!isNaN(num) && num > 0) return num;
        }
      }
    }
    return null;
  }

  // Pulls a short, human-readable line out of an API response instead of
  // dumping the whole JSON body — GraphQL error/message shapes, a plain
  // REST { message } / { error }, or nothing if none of those are present.
  function extractApiMessage(data) {
    if (!data || typeof data !== "object") return "";
    if (Array.isArray(data.errors) && data.errors.length && data.errors[0].message) {
      return String(data.errors[0].message);
    }
    if (data.error) return String(data.error);
    if (data.message) return String(data.message);
    if (data.data && typeof data.data === "object") {
      const inner = Object.values(data.data)[0];
      if (inner && typeof inner === "object" && inner.message) return String(inner.message);
    }
    return "";
  }

  // Floating toast, auto-dismisses after 5s. Small white card — bold title
  // line + optional muted detail line, with a colored left accent for
  // success/failure — matching the popup's own clean-card look instead of a
  // solid colored block full of raw JSON. Full response bodies still go to
  // console.log for anyone who needs them.
  function showApiToast(title, isSuccess, detail) {
    const existing = document.getElementById("fep-api-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "fep-api-toast";
    toast.style.cssText = [
      "position:fixed",
      "bottom:80px",
      "right:24px",
      "max-width:340px",
      "padding:12px 16px",
      "border-radius:12px",
      `border-left:4px solid ${isSuccess ? "#27ae60" : "#e74c3c"}`,
      "background:#ffffff",
      "box-shadow:0 10px 32px rgba(15,23,42,0.18),0 2px 10px rgba(15,23,42,0.10)",
      "z-index:2147483647",
      "font-family:system-ui,-apple-system,'Segoe UI',sans-serif",
      "word-break:break-word",
      "transition:opacity 0.4s ease"
    ].join(";");

    const titleEl = document.createElement("div");
    titleEl.textContent = (isSuccess ? "✓ " : "✗ ") + title;
    titleEl.style.cssText = `font-size:13px;font-weight:700;color:${isSuccess ? "#166534" : "#991b1b"};line-height:1.4;`;
    toast.appendChild(titleEl);

    if (detail) {
      const detailEl = document.createElement("div");
      detailEl.textContent = detail;
      detailEl.style.cssText = "font-size:12px;font-weight:500;color:#64748b;margin-top:4px;line-height:1.5;";
      toast.appendChild(detailEl);
    }

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 420);
    }, 5000);
  }

  async function payAdvancePayment() {
    if (!canUseHardcodedApiEndpoints()) {
      showApiToast("Payments unavailable", false, "Open a supported FEP environment to send payment requests.");
      return;
    }
    try {
      globalThis.FepPaymentTools.open({ projectId: getProjectId(), amount: getAdvanceAmount(), fiscalYear: getFiscalYear() });
    } catch (error) { showApiToast("Payments unavailable", false, error.message); }
  }

  function injectPayAdvanceButton() {
    if (!canUseHardcodedApiEndpoints()) return;
    if (!location.href.includes("confirm-po")) return;
    if (document.getElementById(BUTTON_IDS.payAdvance)) return;

    // Primary: find the #paymentMethod card body (visible in DevTools)
    const paymentCard = document.getElementById("paymentMethod");
    if (!paymentCard) return;

    const cardBody = paymentCard.querySelector(".ant-card-body");
    if (!cardBody) return;

    const btn = document.createElement("button");
    btn.id = BUTTON_IDS.payAdvance;
    btn.type = "button";
    btn.textContent = "Pay Advance Payment";
    btn.style.cssText = inlineBtn("background:#7c3aed;margin-left:8px;");
    btn.addEventListener("click", payAdvancePayment);

    // Prefer inserting right after the "Record Payment Collection" button if present
    const recordBtn = Array.from(cardBody.querySelectorAll("button")).find(
      (el) => normalize(el.textContent).includes("record payment collection")
    );

    if (recordBtn) {
      recordBtn.insertAdjacentElement("afterend", btn);
    } else {
      cardBody.appendChild(btn);
    }
  }

  function createButton({ id, text, style, onClick }) {
    if (document.getElementById(id)) {
      return;
    }

    const btn = document.createElement("button");
    btn.id = id;
    btn.type = "button";
    btn.textContent = text;
    btn.style.cssText = style;
    btn.addEventListener("click", onClick);
    document.body.appendChild(btn);
  }

  async function autoUploadDocsViaModal() {
    // Click "Manage Documents" to open the modal
    const manageBtn = Array.from(document.querySelectorAll("button")).find(
      (el) => normalize(el.innerText).includes("manage documents")
    );
    if (manageBtn) realClick(manageBtn);

    // Wait for the modal to open and file inputs to be available
    let modal = null;
    for (let i = 0; i < 30; i++) {
      modal = Array.from(document.querySelectorAll(".ant-modal-content")).find(
        (el) => el.offsetHeight > 0 && el.querySelector('input[type="file"]')
      );
      if (modal) break;
      await sleep(300);
    }

    if (!modal) {
      console.log(LOG_PREFIX, "Document modal did not open");
      return;
    }

    await autoUploadDocs(modal);
  }

  function injectUploadDocsButton() {
    if (location.href.includes("package-and-dispatch-details")) {
      if (document.getElementById(BUTTON_IDS.docs)) return;

      // Top of the Documents panel (next to the "Documents" heading), not
      // inline in the first document row — it was sitting inside that row
      // before, which is why it kept re-triggering the same field.
      const heading = Array.from(document.querySelectorAll("*")).find(
        (el) => el.children.length === 0 && normalize(el.textContent) === "documents"
      );
      if (!heading) return;

      const btn = document.createElement("button");
      btn.id = BUTTON_IDS.docs;
      btn.type = "button";
      btn.textContent = "Auto Upload Docs";
      btn.style.cssText = inlineBtn("background:#d97706;margin-left:12px;");
      btn.addEventListener("click", autoUploadPackageDocuments);
      heading.insertAdjacentElement("afterend", btn);
      return;
    }

    // ── confirm-po: file inputs live directly on the page ──────────────────
    if (location.href.includes("confirm-po")) {
      if (document.getElementById(BUTTON_IDS.docs)) return;

      const card = document.getElementById("uploadDocuments");
      if (!card) return;

      const cardHead = card.querySelector(".ant-card-head");
      if (!cardHead) return;

      cardHead.style.cssText += ";display:flex;align-items:center;justify-content:space-between;";

      const btn = document.createElement("button");
      btn.id = BUTTON_IDS.docs;
      btn.type = "button";
      btn.textContent = "Auto Upload Docs";
      btn.style.cssText = inlineBtn("background:#d97706;margin-left:12px;");
      btn.addEventListener("click", () => autoUploadDocs(card));
      cardHead.appendChild(btn);
      return;
    }

    // ── project-details: inject button next to "Manage Documents" ───────────
    if (location.href.includes("project-details")) {
      if (document.getElementById(BUTTON_IDS.docs)) return;

      // Find the "Manage Documents" button on the page
      const manageBtn = Array.from(document.querySelectorAll("button")).find(
        (el) => normalize(el.innerText).includes("manage documents")
      );
      if (!manageBtn) return;

      const btn = document.createElement("button");
      btn.id = BUTTON_IDS.docs;
      btn.type = "button";
      btn.textContent = "Auto Upload Docs";
      btn.style.cssText = inlineBtn("background:#d97706;margin-right:8px;");
      btn.addEventListener("click", autoUploadDocsViaModal);

      // Insert our button just before "Manage Documents"
      manageBtn.parentNode.insertBefore(btn, manageBtn);
    }
  }

  // ── Unified draggable launcher ─────────────────────────────────────────────
  //
  // One small pill button lives on every page.
  // Click it → popup with two options:
  //   "Fill Lead"        — enabled only while the Add Lead form's own fields
  //                        are present (it has no dedicated URL to key off)
  //   "Auto Fill Details"— context-aware: triggers the right filler for the
  //                        current URL; greyed out when no filler applies.
  // Drag the pill anywhere on screen; a small movement (<6 px) is treated as
  // a click, not a drag.
  function createLauncher() {
    if (document.getElementById("fep-launcher")) return;

    // ── Pill button ──────────────────────────────────────────────────────────
    const launcher = document.createElement("div");
    launcher.id = "fep-launcher";
    launcher.title = "FEP Autofill";
    launcher.style.cssText = [
      "position:fixed",
      "bottom:20px",
      "left:50%",
      "transform:translateX(-50%)",
      "width:58px",
      "height:58px",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "background:#ffffff",
      "border-radius:16px",
      "cursor:pointer",
      "z-index:2147483647",
      "box-shadow:0 6px 20px rgba(15,23,42,0.24),0 1px 4px rgba(15,23,42,0.16)",
      "border:1px solid rgba(15,23,42,0.12)",
      "user-select:none",
      "transition:box-shadow .2s,transform .15s"
    ].join(";");

    launcher.setAttribute("role", "button");
    launcher.setAttribute("tabindex", "0");
    launcher.setAttribute("aria-label", "Open FEP tools");
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-controls", "fep-popup");
    launcher.innerHTML = '<span class="fep-launcher-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M14 17.5h7m-3.5-3.5v7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>';

    // Subtle completion indicator on the launcher once a full autofill run (Fill Lead /
    // Auto Fill Details / Non Finance) finishes — one indicator for the whole
    // run rather than one per field, shown on the launcher itself so it works
    // identically on every page regardless of which filler just ran.
    function flashLauncherDone() {
      if (!launcher.isConnected) return;
      launcher.dataset.state = "done";
      setTimeout(() => { delete launcher.dataset.state; }, 1500);
    }

    // ── Popup card ───────────────────────────────────────────────────────────
    const popup = document.createElement("div");
    popup.id = "fep-popup";
    popup.style.cssText = [
      "position:fixed",
      "display:none",
      "flex-direction:column",
      "gap:6px",
      "background:#fff",
      "border-radius:18px",
      "padding:11px",
      "box-shadow:0 10px 32px rgba(15,23,42,0.18),0 2px 10px rgba(15,23,42,0.10)",
      "border:1px solid #dbeafe",
      "z-index:2147483646",
      "min-width:194px",
      "width:194px",
      // Fixed footprint regardless of which view is showing — Settings (stats +
      // profile and activity) is much taller than the main view, and letting
      // the popup balloon to fit it forced re-dragging the launcher each time.
      "max-height:400px",
      "overflow-y:auto",
      "overflow-x:hidden"
    ].join(";");

    const bubbleTail = document.createElement("div");
    bubbleTail.style.cssText = [
      "position:absolute",
      "width:14px",
      "height:14px",
      "background:#fff",
      "border-right:1px solid #dbeafe",
      "border-bottom:1px solid #dbeafe",
      "transform:rotate(45deg)",
      "right:22px"
    ].join(";");

    const base = [
      "width:100%",
      "padding:9px 14px",
      "border:none",
      "border-radius:10px",
      "font-size:13px",
      "font-weight:600",
      "cursor:pointer",
      "text-align:left",
      "box-sizing:border-box",
      "transition:opacity .15s"
    ].join(";");

    const leadBtn = document.createElement("button");
    leadBtn.type = "button";
    leadBtn.textContent = "Fill Lead";
    leadBtn.className = "fep-tool-button";
    leadBtn.dataset.primary = "true";
    leadBtn.style.cssText = base + ";background:#00897b;color:#fff;";

    const detailsBtn = document.createElement("button");
    detailsBtn.type = "button";
    detailsBtn.textContent = "Auto Fill Details";
    detailsBtn.className = "fep-tool-button";
    detailsBtn.dataset.primary = "true";
    detailsBtn.style.cssText = base + ";background:#4f46e5;color:#fff;";

    // Only relevant on the PO page — sets "project under finance" to No and
    // skips every applicant/finance field that only appears when it's Yes.
    const nonFinanceBtn = document.createElement("button");
    nonFinanceBtn.type = "button";
    nonFinanceBtn.textContent = "Non Finance";
    nonFinanceBtn.className = "fep-tool-button";
    nonFinanceBtn.style.cssText = base + ";background:#0891b2;color:#fff;display:none;";

    const settingsBtn = document.createElement("button");
    settingsBtn.type = "button";
    settingsBtn.textContent = "Settings";
    settingsBtn.className = "fep-tool-button";
    settingsBtn.style.cssText = base + ";background:#f8fafc;color:#334155;border:1px solid #e2e8f0;";

    const mainView = document.createElement("div");
    mainView.style.cssText = "display:flex;flex-direction:column;gap:6px;";
    const panelHeader = document.createElement("header");
    panelHeader.className = "fep-panel-header";
    const panelTitle = document.createElement("div");
    panelTitle.textContent = "Tools";
    const panelSubtitle = document.createElement("p");
    panelSubtitle.textContent = "Autofill, rules, and feedback.";
    panelTitle.appendChild(panelSubtitle);
    const environmentBadge = document.createElement("span");
    environmentBadge.className = "fep-environment";
    environmentBadge.textContent = (getApiEnvironment()?.name || "local").toUpperCase();
    panelHeader.append(panelTitle, environmentBadge);
    mainView.appendChild(panelHeader);
    const autofillLabel = document.createElement("div");
    autofillLabel.className = "fep-section-label";
    autofillLabel.textContent = "AUTOFILL";
    mainView.appendChild(autofillLabel);
    mainView.appendChild(leadBtn);
    mainView.appendChild(detailsBtn);
    mainView.appendChild(nonFinanceBtn);
    const customFieldsBtn = document.createElement("button");
    customFieldsBtn.type = "button";
    customFieldsBtn.textContent = "Custom Field Builder";
    customFieldsBtn.className = "fep-tool-button";
    customFieldsBtn.style.cssText = base + ";background:#eef2ff;color:#3730a3;";
    customFieldsBtn.addEventListener("click", () => {
      closePopup();
      globalThis.FepCustomTools.manager().catch(error => showApiToast("Custom fields unavailable", false, error.message));
    });
    const reportBugBtn = document.createElement("button");
    reportBugBtn.type = "button";
    reportBugBtn.textContent = "Feedback & feature requests";
    reportBugBtn.className = "fep-tool-button";
    reportBugBtn.style.cssText = base + ";background:#fff7ed;color:#9a3412;";
    reportBugBtn.addEventListener("click", () => {
      closePopup();
      globalThis.FepCustomTools.report();
    });
    const workspaceLabel = document.createElement("div");
    workspaceLabel.className = "fep-section-label";
    workspaceLabel.textContent = "WORKSPACE";
    mainView.appendChild(workspaceLabel);
    leadBtn.dataset.description = "Create a lead with your saved defaults";
    detailsBtn.dataset.description = "Fill the form on this page";
    nonFinanceBtn.dataset.description = "Create a PO without financing";
    customFieldsBtn.dataset.description = "Your fields. Your values.";
    reportBugBtn.dataset.description = "Help shape what comes next";
    settingsBtn.dataset.description = "Profile, custom fields, and feedback";
    [leadBtn, detailsBtn, nonFinanceBtn, customFieldsBtn, reportBugBtn, settingsBtn].forEach(button => button.setAttribute("aria-label", button.textContent));
    const paymentsBtn = document.createElement("button");
    paymentsBtn.type = "button";
    paymentsBtn.className = "fep-tool-button";
    paymentsBtn.textContent = "Payments";
    paymentsBtn.setAttribute("aria-label", "Payments");
    paymentsBtn.dataset.description = "Edit and send payment requests";
    paymentsBtn.disabled = !canUseHardcodedApiEndpoints();
    paymentsBtn.addEventListener("click", () => { closePopup(); payAdvancePayment(); });
    mainView.appendChild(paymentsBtn);
    mainView.appendChild(settingsBtn);

    // ── Settings view: Profile, custom fields, feedback, and stats (tucked behind one button to keep the
    // main popup to just the actions people use every run) ───────────────────
    const settingsView = document.createElement("div");
    settingsView.className = "fep-settings-view";
    settingsView.style.cssText = "display:none;flex-direction:column;gap:6px;";

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.textContent = "← Back";
    backBtn.className = "fep-tool-button";
    backBtn.style.cssText = base + ";background:#f8fafc;color:#334155;border:1px solid #e2e8f0;";

    const whatsNewLink = document.createElement("button");
    whatsNewLink.type = "button";
    whatsNewLink.textContent = `What's New (v${CHANGELOG.version})`;
    whatsNewLink.style.cssText = [
      "align-self:center",
      "margin-top:2px",
      "padding:0",
      "border:none",
      "background:transparent",
      "color:#94a3b8",
      "font-size:11px",
      "font-weight:600",
      "cursor:pointer",
      "text-decoration:underline"
    ].join(";");
    whatsNewLink.addEventListener("click", (e) => {
      e.stopPropagation();
      showWhatsNewModal();
    });

    // ── Your Name — stamped into "Test <name>" wherever autofill names a new
    // lead/project, so records made by different people are easy to tell apart.
    const nameLabel = document.createElement("div");
    nameLabel.textContent = "Your Name";
    nameLabel.style.cssText = "font-size:11px;font-weight:700;color:#94a3b8;padding:2px 2px 0;text-transform:uppercase;letter-spacing:.04em;";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Enter your name";
    nameInput.value = getUserName();
    nameInput.style.cssText = [
      "width:100%",
      "padding:8px 10px",
      "border:2px solid #111827",
      "border-radius:10px",
      "font-size:13px",
      "font-weight:600",
      "color:#334155",
      "box-sizing:border-box",
      "outline:none"
    ].join(";");

    function commitUserName() {
      persistUserName(nameInput.value);
      nameInput.value = getUserName();
    }

    nameInput.addEventListener("click", (e) => e.stopPropagation());
    nameInput.addEventListener("blur", commitUserName);
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.stopPropagation();
        nameInput.blur();
      }
    });

    // ── Stats — lifetime totals are permanent (no reset control anywhere);
    // "today" rolls over to a fresh count automatically at midnight. ─────────
    const statsLabel = document.createElement("div");
    statsLabel.textContent = "Stats";
    statsLabel.style.cssText = "font-size:11px;font-weight:700;color:#94a3b8;padding:4px 2px 0;text-transform:uppercase;letter-spacing:.04em;";

    const statsToday = document.createElement("div");
    statsToday.className = "fep-stat-row";
    statsToday.style.cssText = "font-size:12px;font-weight:700;color:#334155;padding:2px 2px 0;";

    const statsLifetime = document.createElement("div");
    statsLifetime.className = "fep-stat-row";
    statsLifetime.style.cssText = "font-size:12px;font-weight:700;color:#334155;padding:0 2px;";

    const statsBreakdown = document.createElement("div");
    statsBreakdown.style.cssText = "font-size:11px;color:#64748b;padding:0 2px;line-height:1.5;";

    function renderStats() {
      const stats = readAutofillStats();
      const today = stats.today.total;
      const lifetime = stats.lifetime.total;
      statsToday.textContent = `Today: ${today.clicks} fill${today.clicks === 1 ? "" : "s"} · ${formatDuration(today.savedMs)} saved`;
      statsLifetime.textContent = `All-time: ${lifetime.clicks} fill${lifetime.clicks === 1 ? "" : "s"} · ${formatDuration(lifetime.savedMs)} saved`;
      statsBreakdown.textContent = `Lifetime — Lead: ${stats.lifetime.lead.clicks} · Details: ${stats.lifetime.details.clicks}`;
    }

    settingsView.appendChild(backBtn);
    settingsView.appendChild(customFieldsBtn);
    settingsView.appendChild(reportBugBtn);
    settingsView.appendChild(nameLabel);
    settingsView.appendChild(nameInput);
    settingsView.appendChild(statsLabel);
    settingsView.appendChild(statsToday);
    settingsView.appendChild(statsLifetime);
    settingsView.appendChild(statsBreakdown);
    settingsView.appendChild(whatsNewLink);

    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-label", "FEP tools");
    popup.appendChild(mainView);
    popup.appendChild(settingsView);
    document.body.appendChild(popup);
    document.body.appendChild(launcher);

    function showMainView() {
      mainView.style.display = "flex";
      settingsView.style.display = "none";
    }

    function showSettingsView() {
      renderStats();
      nameInput.value = getUserName();
      mainView.style.display = "none";
      settingsView.style.display = "flex";
      positionPopup();
    }

    settingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showSettingsView();
    });

    backBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showMainView();
      positionPopup();
    });

    // The "Add Lead" modal doesn't have a dedicated URL — it can be opened from
    // several different pages — so we detect it by its own fields instead of a
    // URL check, the same way its very first autofill step (fillLead) does.
    function isLeadFormOpen() {
      return !!findFormItemByLabel("First Name") && !!findFormItemByLabel("Contact Number");
    }

    // ── URL → filler mapping (checked fresh on every popup open) ─────────────
    function getDetailsFn() {
      const h = location.href;
      if (h.includes("create-proposal"))    return fillProposal;
      if (h.includes("generate-po"))        return fillPO;
      if (h.includes("TC/my-leads/lead-details")) return fillTCLeadDetails;
      if (h.includes("package-and-dispatch-details")) return fillPackageAndDispatchDetails;
      if (h.includes("liaising-tracker/new")) return fillLiaising;
      if (h.includes("le-and-tfr"))         return fillLETFR;
      if (h.includes("net-metering"))       return fillNetMetering;
      if (h.includes("/ED/my-projects/project-details/")) return fillEDSystemInformation;
      return null;
    }

    const panelSizeKey = "fep-tools-panel-size";
    let preferredSize = { width: 264, height: 354 };
    let sizeChanged = false;
    function applyPanelSize() {
      popup.style.setProperty("--fep-panel-width", Math.min(preferredSize.width, Math.max(180, window.innerWidth - 24)) + "px");
      popup.style.setProperty("--fep-panel-height", Math.min(preferredSize.height, Math.max(180, window.innerHeight - 32)) + "px");
    }
    function savePanelSize() {
      chrome.storage.local.set({ [panelSizeKey]: preferredSize }).catch(error => console.warn(LOG_PREFIX, "Panel size could not be saved", error));
    }
    chrome.storage.local.get(panelSizeKey).then(result => {
      const saved = result[panelSizeKey];
      if (!sizeChanged && saved && Number.isFinite(saved.width) && Number.isFinite(saved.height)) {
        preferredSize = { width: Math.max(230, Math.min(480, saved.width)), height: Math.max(230, Math.min(720, saved.height)) };
        applyPanelSize();
        if (popup.style.display !== "none") positionPopup();
      }
    }).catch(error => console.warn(LOG_PREFIX, "Panel size could not be loaded", error));
    const resizeGrip = document.createElement("button");
    resizeGrip.type = "button";
    resizeGrip.className = "fep-resize-grip";
    resizeGrip.textContent = "↖";
    resizeGrip.setAttribute("aria-label", "Resize tools panel");
    resizeGrip.title = "Drag this corner to resize. Arrow keys resize; double-click resets.";
    popup.prepend(resizeGrip);
    resizeGrip.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      const start = { x: event.clientX, y: event.clientY, width: popup.offsetWidth, height: popup.offsetHeight };
      resizeGrip.setPointerCapture(event.pointerId);
      const move = next => {
        preferredSize = { width: Math.max(230, Math.min(480, start.width + start.x - next.clientX)), height: Math.max(230, Math.min(720, start.height + start.y - next.clientY)) };
        sizeChanged = true; applyPanelSize(); positionPopup();
      };
      const stop = () => { resizeGrip.removeEventListener("pointermove", move); resizeGrip.removeEventListener("pointerup", stop); resizeGrip.removeEventListener("pointercancel", stop); savePanelSize(); };
      resizeGrip.addEventListener("pointermove", move);
      resizeGrip.addEventListener("pointerup", stop);
      resizeGrip.addEventListener("pointercancel", stop);
    });
    resizeGrip.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === "ArrowLeft") preferredSize.width -= 16;
      if (event.key === "ArrowRight") preferredSize.width += 16;
      if (event.key === "ArrowUp") preferredSize.height -= 16;
      if (event.key === "ArrowDown") preferredSize.height += 16;
      preferredSize.width = Math.max(230, Math.min(480, preferredSize.width));
      preferredSize.height = Math.max(230, Math.min(720, preferredSize.height));
      sizeChanged = true; applyPanelSize(); positionPopup(); savePanelSize();
    });
    resizeGrip.addEventListener("dblclick", event => { event.stopPropagation(); preferredSize = {width:264,height:354}; sizeChanged = true; applyPanelSize(); positionPopup(); savePanelSize(); });

    // ── Popup open / close ───────────────────────────────────────────────────
    function positionPopup() {
      const r = launcher.getBoundingClientRect();
      // Prefer positioning above the launcher; flip below if not enough room
      const spaceAbove = r.top;
      const popupH = popup.offsetHeight || 100;
      if (spaceAbove > popupH + 12) {
        popup.style.bottom = (window.innerHeight - r.top + 8) + "px";
        popup.style.top    = "auto";
        bubbleTail.style.bottom = "-7px";
        bubbleTail.style.top = "auto";
      } else {
        popup.style.top    = Math.max(12, Math.min(r.bottom + 8, window.innerHeight - popupH - 12)) + "px";
        popup.style.bottom = "auto";
        bubbleTail.style.top = "-7px";
        bubbleTail.style.bottom = "auto";
      }
      popup.style.left = Math.max(12, Math.min(r.right - popup.offsetWidth, window.innerWidth - popup.offsetWidth - 12)) + "px";
      popup.style.right = "auto";
    }

    function openPopup() {
      const fn = getDetailsFn();
      detailsBtn.disabled        = !fn;
      detailsBtn.style.opacity   = fn ? "1" : "0.4";
      detailsBtn.style.cursor    = fn ? "pointer" : "not-allowed";
      detailsBtn.title           = fn ? "" : "No autofill available for this page";
      detailsBtn.textContent     = location.href.includes("generate-po") ? "Finance" : "Auto Fill Details";
      detailsBtn.setAttribute("aria-label", detailsBtn.textContent);

      const leadReady = isLeadFormOpen();
      leadBtn.disabled      = !leadReady;
      leadBtn.style.opacity = leadReady ? "1" : "0.4";
      leadBtn.style.cursor  = leadReady ? "pointer" : "not-allowed";
      leadBtn.title         = leadReady ? "" : "Open the Add Lead form first";

      nonFinanceBtn.style.display = location.href.includes("generate-po") ? "block" : "none";
      showMainView();
      applyPanelSize();
      popup.style.display = "flex";
      launcher.setAttribute("aria-expanded", "true");
      positionPopup();
    }

    function closePopup() {
      popup.style.display  = "none";
      launcher.setAttribute("aria-expanded", "false");
    }

    launcher.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (popup.style.display === "none") openPopup(); else closePopup();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && popup.style.display !== "none") { closePopup(); launcher.focus(); }
    });

    // ── Button handlers ──────────────────────────────────────────────────────
    leadBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closePopup();
      runTrackedAutofill("lead", fillLead).finally(flashLauncherDone);
    });

    detailsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const fn = getDetailsFn();
      if (!fn) return;
      closePopup();
      runTrackedAutofill("details", fn).finally(flashLauncherDone);
    });

    nonFinanceBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closePopup();
      runTrackedAutofill("details", () => fillPO({ financeMode: "none" })).finally(flashLauncherDone);
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
      if (!launcher.contains(e.target) && !popup.contains(e.target)) {
        if (popup.style.display !== "none") closePopup();
      }
    });

    window.addEventListener("resize", () => { applyPanelSize(); if (popup.style.display !== "none") positionPopup(); });

    // ── Drag logic ───────────────────────────────────────────────────────────
    let dragging = false;
    let didMove  = false;
    let ox = 0, oy = 0; // cursor offset from launcher top-left

    launcher.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      dragging = true;
      didMove  = false;
      const r  = launcher.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - ox;
      const dy = e.clientY - oy;
      // Threshold: 6 px before we treat it as a drag
      if (!didMove && Math.hypot(dx - launcher.getBoundingClientRect().left,
                                 dy - launcher.getBoundingClientRect().top) > 6) {
        didMove = true;
      }
      if (!didMove) return;

      const maxX = window.innerWidth  - launcher.offsetWidth;
      const maxY = window.innerHeight - launcher.offsetHeight;
      launcher.style.left   = Math.max(0, Math.min(dx, maxX)) + "px";
      launcher.style.top    = Math.max(0, Math.min(dy, maxY)) + "px";
      launcher.style.right  = "auto";
      launcher.style.bottom = "auto";
      launcher.style.transform = "none";

      if (popup.style.display !== "none") positionPopup();
    });

    document.addEventListener("mouseup", () => {
      if (dragging && !didMove) {
        // Pure click — toggle popup
        if (popup.style.display === "none") openPopup();
        else closePopup();
      }
      dragging = false;
    });
  }

  // True only for the project-details root page, not sub-pages like confirm-po
  function isProjectDetailsRootPage() {
    return /\/project-details\/[a-f0-9]{24}$/i.test(location.pathname);
  }

  // Extracts the 24-char hex MongoDB ID from the current URL path
  function getProjectIdFromUrl() {
    const match = location.pathname.match(/\/project-details\/([a-f0-9]{24})/i);
    return match ? match[1] : null;
  }

  // Reads the system size in kW from the Ant Design descriptions on the page
  function getProjectSizeKw() {
    // Ant Design Descriptions list
    const items = document.querySelectorAll(".ant-descriptions-item");
    for (const item of items) {
      const label   = item.querySelector(".ant-descriptions-item-label");
      const content = item.querySelector(".ant-descriptions-item-content");
      const labelText = normalize(label.textContent).replace(":", "").trim();
      if ((labelText === "size" || labelText === "system size") && content) {
        const match = content.textContent.match(/([\d.]+)\s*kw/i);
        if (match) return parseFloat(match[1]);
      }
    }

    // Generic fallback: find "Size:" / "System Size:" label and grab sibling value
    for (const el of document.querySelectorAll("*")) {
      const t = normalize(el.textContent).replace(":", "").trim();
      if (el.children.length === 0 && (t === "size" || t === "system size")) {
        const sibling = el.nextElementSibling || el.parentElement?.nextElementSibling;
        if (sibling) {
          const match = sibling.textContent.match(/([\d.]+)\s*kw/i);
          if (match) return parseFloat(match[1]);
        }
      }
    }
    return null;
  }

  // Returns a random lat/long pair within India's bounding box, so each
  // Site Survey submission carries a plausible real-world coordinate
  // instead of the same fixed placeholder point every time.
  function getRandomIndianCoordinates() {
    const latitude = Number((8 + Math.random() * (37 - 8)).toFixed(4));
    const longitude = Number((68 + Math.random() * (97 - 68)).toFixed(4));
    return { latitude, longitude };
  }

  async function fillSiteSurveyForm() {
    if (!canUseHardcodedApiEndpoints()) {
      showApiToast("Direct API actions are disabled on localhost.", false);
      return;
    }

    const btn = document.getElementById(BUTTON_IDS.siteSurvey);
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Processing…";
    }

    try {
      const projectId = getProjectIdFromUrl();
      if (!projectId) {
        showApiToast("Could not extract project ID from URL.", false);
        return;
      }

      const projectSize = getProjectSizeKw();
      if (!projectSize) {
        showApiToast("Could not find project size on this page.", false);
        return;
      }

      const endpoint = getApiEndpoint("/api/v1/graphql");

      const { latitude, longitude } = getRandomIndianCoordinates();

      const payload = {
        query: `mutation ($project: String!, $surveyDetails: JSON, $stage: Int, $roofDetailsData: [JSON], $electricityDetails: JSON, $media: JSON) {
      saveSurvey (project: $project, surveyDetails: $surveyDetails, stage: $stage, roofDetailsData: $roofDetailsData, electricityDetails: $electricityDetails, media: $media) {
    message
  }
    }`,
        variables: {
          project: projectId,
          surveyDetails: {
            dateOfSurvey: "2025-06-17",
            siteSurveyBy: "699c1a3c197c74dadc556b36",
            surveyMobileNumber: "6546565655",
            surveyName: "test site eng",
            surveyEmail: "testtilicho_se@tilicho.in",
            customerName: "Testing sridhar warr 06-07-2026",
            projectSize: { projectSize: projectSize },
            customerMobileNumber: "7997714333",
            customerEmail: "csssrh@freyr.in",
            customerAddress: "Boduvalasa, Visakhapatanam, Anakapalle Division, Andhra Pradesh",
            latitude: latitude,
            longitude: longitude
          },
          stage: 4,
          roofDetailsData: [
            {
              roofDetails: "RCC",
              accessToRoofRCC: "Yes",
              isDrillingUpto2InchesAllowedRCC: "Yes",
              slabThicknessRCC: { slabThicknessRCC: 11 },
              parapetWallWidthRCC: { parapetWallWidthRCC: 1 },
              parapetWallheightRCC: { parapetWallheightRCC: 1 },
              isWaterProofileAvailableOnRoofSlabRCC: "Yes",
              metionTheAdjustableOrRemobaleObjectsForInstallationRCC: "11",
              additionalInformationRCC: "11",
              dimensionForEachRoofRCC: [
                { areaName: "11", length: { reading1: 11 }, height: { reading3: 11 }, width: { reading2: 8 } }
              ],
              ageOfTheBuildingRCC: { ageOfTheBuildingRCC: 11 },
              areThereAnyPreExistingWaterLeakagesFromTheRoofRCC: "11",
              distanceOfWaterSourceFromRoofRCC: { distanceOfWaterSourceFromRoofRCC: 11 },
              waterSourceOnRoofRCC: "Yes",
              motorAvailabilityRCC: "Yes"
            }
          ],
          electricityDetails: {
            contractLoadLessThan20: { contractLoadLessThan20: 11 },
            acCountLessThan20: { acCountLessThan20: 11 },
            geyserCountLessThan20: { geyserCountLessThan20: 11 },
            transformerCapacityLessThan20: { transformerCapacityLessThan20: 11 },
            cableLengthBetweenInterverterAndTerminationPointLessThan20: { cableLengthBetweenInterverterAndTerminationPointLessThan20: 10 },
            cableLengthBetweenSolarModuleAndInterverterLessThan20: { cableLengthBetweenSolarModuleAndInterverterLessThan20: 11 },
            cableLengthBetweenInverterAndEarthingAreaLessThan20: { cableLengthBetweenInverterAndEarthingAreaLessThan20: 11 },
            cableLengthBetweenSolarModuleAndEarthingAreaLessThan20: { cableLengthBetweenSolarModuleAndEarthingAreaLessThan20: 11 },
            cableLengthBetweenPowerSocketAndMotorLessThan20: { cableLengthBetweenPowerSocketAndMotorLessThan20: 11 },
            typeOFAreaForEarthingLessThan20: "Loose soil",
            doestheClientHasAnLTPanelLessThan20: [
              {
                doestheClientHasAnLTPanelLessThan20: "YES",
                lengthOfLTPanelLessThan20: { lengthOfLTPanelLessThan20: 11 },
                widthOfLTPanelLessThan20: { widthOfLTPanelLessThan20: 11 },
                heightOfLTPanelLessThan20: { heightOfLTPanelLessThan20: 7 }
              }
            ],
            powerSocketInBetweenLTPanelAndSolarLocationLessThan20: "Yes",
            doesTheWifiHasFullStrengthNearTheLTPanelLessThan20: "Yes",
            nameOfBroadbandProviderLessThan20: "11",
            mcbRatingLessThan20: { mcbRatingLessThan20: 11 },
            wifiAvailabilityLessThan20: "Yes",
            wifiServiceProviderLessThan20: "Jio",
            wifiFrequencyBandLessThan20: "5Ghz Only",
            routerImageLessThan20: [
              {
                name: "Screenshot 2025-06-17 at 3.02.23 PM.png",
                type: "image/png",
                content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/e155ca22-5928-4ffb-8219-e4575688fdb8_Screenshot-2025-06-17-at-3.02.23-PM1750152745653.png"
              }
            ]
          },
          media: {
            entireRoofLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.34 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/2aef6589-be6d-471d-bcbd-e11a855475c7_Screenshot-2025-06-17-at-3.02.34-PM1750152755451.png" }],
            mapMarkingLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.39 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/6caa7b57-e7a9-4b90-9b28-dd61b9e0e24a_Screenshot-2025-06-17-at-3.02.39-PM1750152760245.png" }],
            meterPhotoLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.41 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/627db4df-7bd9-4e9b-a343-99ee4e7eec23_Screenshot-2025-06-17-at-3.02.41-PM1750152762307.png" }],
            handSketchLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.43 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/78c0b01b-ef72-4194-a9f1-8bdba79631bd_Screenshot-2025-06-17-at-3.02.43-PM1750152764630.png" }],
            powerBillLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.46 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/0dd846af-f162-4fa4-a3fa-b88ecf36b207_Screenshot-2025-06-17-at-3.02.46-PM1750152767134.png" }],
            inverterMountingLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.48 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/12998292-740a-4077-b04b-0e7329c87d84_Screenshot-2025-06-17-at-3.02.48-PM1750152769323.png" }],
            earthingAreaLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.50 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/081725b2-aad2-4b11-ada0-6e34212e63c3_Screenshot-2025-06-17-at-3.02.50-PM1750152771788.png" }],
            lthtPanelNameplateLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.53 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/254bfba2-2b12-4d1b-be23-acd95012d12b_Screenshot-2025-06-17-at-3.02.53-PM1750152774024.png" }],
            designatedMaterialDeliveryAreaImageLessThan20: [{ name: "Screenshot 2025-06-17 at 3.02.53 PM.png", type: "image/png", content: "https://freyr-energy-media-uat.s3.ap-south-1.amazonaws.com/survey/254bfba2-2b12-4d1b-be23-acd95012d12b_Screenshot-2025-06-17-at-3.02.53-PM1750152774024.png" }],
            designatedMaterialDeliveryAreaVideoLessThan20: [{ name: "6f247569-f958-4331-8682-6db340204ae5-100029566417792021198641783277877766.mp4", type: "video/mp4", content: "https://freyr-energy-media-prod.s3.ap-south-1.amazonaws.com/survey/f403ff71-d0f6-42e3-b032-54fb09371232_10005045571783257192417.mp4" }]
          }
        }
      };

      console.log(LOG_PREFIX, "Fill Site Survey → sending to", endpoint, "project:", projectId, "size:", projectSize, "coords:", latitude, longitude);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "accept": "*/*",
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      let data;
      try { data = await res.json(); } catch (_) { data = {}; }

      // GraphQL always returns 200; errors live in data.errors
      if (res.ok && !data.errors) {
        showApiToast("Site Survey submitted", true, extractApiMessage(data));
        console.log(LOG_PREFIX, "Fill Site Survey — SUCCESS", data);
      } else {
        showApiToast("Site Survey failed", false, extractApiMessage(data) || `Status ${res.status}`);
        console.log(LOG_PREFIX, "Fill Site Survey — FAILED", res.status, data);
      }
    } catch (err) {
      showApiToast("Site Survey error", false, err.message);
      console.error(LOG_PREFIX, "Fill Site Survey — ERROR", err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Fill Site Survey Form";
      }
    }
  }

  function injectSiteSurveyButton() {
    if (!canUseHardcodedApiEndpoints()) return;
    if (!isProjectDetailsRootPage()) return;
    if (document.getElementById(BUTTON_IDS.siteSurvey)) return;

    // my-projects page → show only when status is "Won" (green tag)
    // project-tracker page → show only when status is "Site Survey" (yellow tag)
    const isTracker = location.pathname.includes("project-tracker");
    const targetText = isTracker ? "site survey" : "won";

    const statusTag = Array.from(document.querySelectorAll(".ant-tag")).find(
      (el) => normalize(el.textContent) === targetText
    );
    if (!statusTag) return;

    const btn = document.createElement("button");
    btn.id = BUTTON_IDS.siteSurvey;
    btn.type = "button";
    btn.textContent = "Fill Site Survey Form";
    btn.style.cssText = inlineBtn("background:#0284c7;margin-left:8px;");
    btn.addEventListener("click", fillSiteSurveyForm);

    statusTag.insertAdjacentElement("afterend", btn);
  }

  // Reads the numeric Project ID from the "Project ID : XXXXXX" badge in the page header
  function getNumericProjectId() {
    // project-tracker shows it as an .ant-tag badge: "Project ID : 110000001"
    for (const tag of document.querySelectorAll(".ant-tag")) {
      if (normalize(tag.textContent).includes("project id")) {
        const match = tag.textContent.match(/:\s*(\d+)/);
        if (match) return parseInt(match[1], 10);
      }
    }

    // Fallback: Ant Design Descriptions list (my-projects page)
    for (const item of document.querySelectorAll(".ant-descriptions-item")) {
      const label   = item.querySelector(".ant-descriptions-item-label");
      const content = item.querySelector(".ant-descriptions-item-content");
      if (label && normalize(label.textContent).replace(":", "").trim() === "project id" && content) {
        const val = content.textContent.trim();
        if (/^\d+$/.test(val)) return parseInt(val, 10);
      }
    }
    return null;
  }

  async function fillPreInstallForm() {
    if (!canUseHardcodedApiEndpoints()) {
      showApiToast("Direct API actions are disabled on localhost.", false);
      return;
    }

    const btn = document.getElementById(BUTTON_IDS.preInstall);
    if (btn) { btn.disabled = true; btn.textContent = "Processing…"; }

    try {
      const projectId  = getProjectIdFromUrl();
      const uniqueId   = getNumericProjectId();
      const systemSize = getProjectSizeKw();

      if (!projectId)  { showApiToast("Could not extract project ID from URL.", false); return; }
      if (!uniqueId)   { showApiToast("Could not find numeric Project ID on this page.", false); return; }
      if (!systemSize) { showApiToast("Could not find System Size on this page.", false); return; }

      const endpoint = getApiEndpoint("/api/v1/graphql");

      const payload = {
        query: `mutation ($input: savePreInstallationFormInput) {
      savePreInstallationForm (input: $input) {
    message
  }
    }`,
        variables: {
          input: {
            project: projectId,
            projectDetails: {
              uniqueId: uniqueId,
              projectName: "test sridhar T3_residential_independent",
              freyrSiteEngineerName: "test site eng",
              systemCapacity: systemSize,
              freyrSiteEngineer: "67ca958234a956e0d98304e3",
              dateOfFormSubmission: "2025-08-14",
              phoneNumberOfClient: "9854623656",
              startDateofInstallation: "2025-08-14"
            },
            ppeAcknowledgedAt: 1783658968000,
            customerDetails: {
              nameofClientOnSite: "test tilicho T3",
              phoneNumberOfClient: "9854623656",
              vendorCompanyName: null,
              VendorFirstName: null,
              VendorLastName: null,
              vendorMobileNumber: null,
              vendorEmailId: null,
              preInstallationChecklist: {
                siteIsShadowFree: "Yes",
                siteIsAsPerDPR: "Yes",
                allMaterialReceivedAsPerBOM: "Yes"
              }
            },
            media: {
              installationCrewPhoto: [{ name: "Screenshot 2025-05-13 012934.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-pre-installation/b7bc1428-8661-4bcc-aa1f-832292f9344e_Screenshot-2025-05-13-0129341755166762522.png" }],
              preInstallationSiteVideo: [{ name: "Screen Recording 2025-05-13 174423.mp4", type: "video/mp4", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-pre-installation/de536fc1-6d46-4c54-a2d6-782a53b96191_Screen-Recording-2025-05-13-1744231755166766624.mp4" }],
              completeMaterialVideo: [{ name: "Screen Recording 2025-05-13 174423.mp4", type: "video/mp4", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-pre-installation/1e527f7a-4116-4f5d-832c-23c98f3ce962_Screen-Recording-2025-05-13-1744231755166769169.mp4" }],
              ModulesPhotos1: [{ name: "Screenshot 2025-05-13 002140.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-pre-installation/fb22793e-cf9e-4139-b344-c80d4853e063_Screenshot-2025-05-13-0021401755166773842.png" }],
              ModulesPhotos2: [{ name: "Screenshot 2025-05-13 002140.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-pre-installation/6b93fcbf-7c68-4141-86c4-2f6e113bbcaa_Screenshot-2025-05-13-0021401755166776674.png" }],
              inverter: [{ name: "Screenshot 2025-05-13 181219.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-pre-installation/591e3643-94ef-41dd-8a54-d1aade87c012_Screenshot-2025-05-13-1812191755166785545.png" }],
              geoTaggedSitePhoto: [{ name: "Screenshot 2025-05-13 181219.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-pre-installation/591e3643-94ef-41dd-8a54-d1aade87c012_Screenshot-2025-05-13-1812191755166785545.png" }]
            },
            isLastPage: true
          }
        }
      };

      console.log(LOG_PREFIX, "Pre-Install Form → sending to", endpoint, "project:", projectId, "uniqueId:", uniqueId, "size:", systemSize);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "accept": "*/*", "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      let data;
      try { data = await res.json(); } catch (_) { data = {}; }

      if (res.ok && !data.errors) {
        showApiToast("Pre-Install form submitted", true, extractApiMessage(data));
        console.log(LOG_PREFIX, "Pre-Install — SUCCESS", data);
      } else {
        showApiToast("Pre-Install form failed", false, extractApiMessage(data) || `Status ${res.status}`);
        console.log(LOG_PREFIX, "Pre-Install — FAILED", res.status, data);
      }
    } catch (err) {
      showApiToast("Pre-Install form error", false, err.message);
      console.error(LOG_PREFIX, "Pre-Install — ERROR", err);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Fill Pre Installation Form"; }
    }
  }

  async function fillPostInstallForm() {
    if (!canUseHardcodedApiEndpoints()) {
      showApiToast("Direct API actions are disabled on localhost.", false);
      return;
    }

    const btn = document.getElementById(BUTTON_IDS.postInstall);
    if (btn) { btn.disabled = true; btn.textContent = "Processing…"; }

    try {
      const projectId  = getProjectIdFromUrl();
      const uniqueId   = getNumericProjectId();
      const systemSize = getProjectSizeKw();

      if (!projectId)  { showApiToast("Could not extract project ID from URL.", false); return; }
      if (!uniqueId)   { showApiToast("Could not find numeric Project ID on this page.", false); return; }
      if (!systemSize) { showApiToast("Could not find System Size on this page.", false); return; }

      const endpoint = getApiEndpoint("/api/v1/graphql");

      const payload = {
        query: `mutation ($input: savePostInstallationFormInput) {
 savePostInstallationForm (input: $input) {
 message
 }
 }`,
        variables: {
          input: {
            project: projectId,
            isLastPage: true,
            projectDetails: {
              uniqueId: uniqueId,
              projectName: "test Sridhar_residential_society",
              systemCapacity: systemSize,
              freyrSiteEngineer: "67ca958234a956e0d98304e3",
              freyrSiteEngineerName: "test site eng",
              vendorCompanyName: null,
              vendorMobileNumber: null,
              vendorEmailId: null,
              firstName: "test",
              lastName: "site eng"
            },
            media: {
              videoOfAnchorFastnersDrillingAndChemicalFilling: [{ name: "Screen Recording 2025-05-13 174423.mp4", type: "video/mp4", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/e3296189-c039-45cf-b297-4b347f82a6d4_Screen-Recording-2025-05-13-1744231755167021642.mp4" }],
              structureInstallationPhoto: [{ name: "Screenshot 2025-05-13 181219.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/ea09e0e3-adb1-45e5-8ec9-90f04ce85184_Screenshot-2025-05-13-1812191755167030134.png" }],
              moduleInstalliationPhoto: [{ name: "Screenshot 2025-05-06 123749.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/84881a2e-3342-49e8-882d-e64ffdeb120f_Screenshot-2025-05-06-1237491755167033610.png" }],
              inverterTestReport: [{ name: "Screenshot 2025-05-13 002140.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/5d7e77b5-2268-4265-b18d-a3f975aa5eac_Screenshot-2025-05-13-0021401755167037004.png" }],
              postInstallationInverterOrACDBOrDCDBPhoto: [{ name: "Screenshot 2025-05-13 002140.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/3aad1266-5d4f-4df5-a3a6-4676a6d2d652_Screenshot-2025-05-13-0021401755167040167.png" }],
              inverterAndDataLoggerSNoPhoto: [{ name: "Screenshot 2025-05-13 002140.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/19199538-bb42-47ba-9b45-717cc3336564_Screenshot-2025-05-13-0021401755167043162.png" }],
              earthPitInstallationVideo: [{ name: "Screen Recording 2025-05-13 174423.mp4", type: "video/mp4", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/b7fbd5d8-abd6-48b2-983c-c34663761b33_Screen-Recording-2025-05-13-1744231755167057818.mp4" }],
              postInstallationEarthPitsPhotos: [{ name: "Screenshot 2025-05-13 145703.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/036d6d78-d36b-468e-a0a5-7060b67aea13_Screenshot-2025-05-13-1457031755167050486.png" }],
              civilFoundationOrWorkPhotos: [{ name: "Screenshot 2025-05-13 002140.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/1e3938cc-2bbd-4808-b639-91597a63e47d_Screenshot-2025-05-13-0021401755167046906.png" }],
              acCableTerminationAtClientsPanelOrMeter: [{ name: "Screenshot 2025-05-13 181219.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/fdb920af-d41a-41d8-9df7-4eedf3588fc4_Screenshot-2025-05-13-1812191755167066059.png" }],
              postInstallationFullSiteVideo: [{ name: "Screen Recording 2025-05-13 174423.mp4", type: "video/mp4", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/638d0a84-3973-4670-86e7-dff733ed4619_Screen-Recording-2025-05-13-1744231755167071510.mp4" }],
              installationCrewPhotoWithSystem: [{ name: "Screenshot 2025-05-13 180724.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/86ba8d52-0d0c-4165-9b09-3076c4567b75_Screenshot-2025-05-13-1807241755167080374.png" }],
              beneficiaryPhotoAlongWithCompleteModuleSetUp: [{ name: "Screenshot 2025-05-13 180724.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/26cbc502-b0bd-4403-bc5c-dc2b0f1d9c1a_Screenshot-2025-05-13-1807241755167083372.png" }],
              beneficiaryPhotoAlongWithCompleteInverterSetUp: [{ name: "Screenshot 2025-05-13 181219.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/e951b98f-0002-4844-acb1-70b8428d8267_Screenshot-2025-05-13-1812191755167086550.png" }],
              postInstallationCeilingPhoto: [{ name: "Screenshot 2025-05-13 181219.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/e951b98f-0002-4844-acb1-70b8428d8267_Screenshot-2025-05-13-1812191755167086550.png" }],
              structureAreaCleanupPhoto: [{ name: "Screenshot 2025-05-13 181219.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/e951b98f-0002-4844-acb1-70b8428d8267_Screenshot-2025-05-13-1812191755167086550.png" }],
              roofCleanupPhoto: [{ name: "Screenshot 2025-05-13 181219.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/e951b98f-0002-4844-acb1-70b8428d8267_Screenshot-2025-05-13-1812191755167086550.png" }],
              materialStorageAreaCleanupPhoto: [{ name: "Screenshot 2025-05-13 181219.png", type: "image/png", content: "https://freyr-energy-media-qa.s3.ap-south-1.amazonaws.com/se-post-installation/e951b98f-0002-4844-acb1-70b8428d8267_Screenshot-2025-05-13-1812191755167086550.png" }]
            },
            customerDetails: {
              nameofClientOnSite: "test tilicho T3",
              phoneNumberOfClient: "9854623656",
              clientCooperationonSite: 5,
              dateOfFormSubmission: "2025-08-14",
              endDateOfInstallation: "2025-08-14",
              rmsUsername: "12",
              rmsPassword: "12",
              rmsSetupViaWifiOrMobileHotspot: "Wifi",
              freyrEnergyEngineersAssistance: 5,
              overallInstallationExperience: 5
            }
          }
        }
      };

      console.log(LOG_PREFIX, "Post-Install Form → sending to", endpoint, "project:", projectId, "uniqueId:", uniqueId, "size:", systemSize);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "accept": "*/*", "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      let data;
      try { data = await res.json(); } catch (_) { data = {}; }

      if (res.ok && !data.errors) {
        showApiToast("Post-Install form submitted", true, extractApiMessage(data));
        console.log(LOG_PREFIX, "Post-Install — SUCCESS", data);
      } else {
        showApiToast("Post-Install form failed", false, extractApiMessage(data) || `Status ${res.status}`);
        console.log(LOG_PREFIX, "Post-Install — FAILED", res.status, data);
      }
    } catch (err) {
      showApiToast("Post-Install form error", false, err.message);
      console.error(LOG_PREFIX, "Post-Install — ERROR", err);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Fill Post Installation Form"; }
    }
  }

  function injectInstallationButtons() {
    if (!canUseHardcodedApiEndpoints()) return;
    if (!location.pathname.includes("project-tracker")) return;
    if (!isProjectDetailsRootPage()) return;

    const alreadyDone =
      document.getElementById(BUTTON_IDS.preInstall) &&
      document.getElementById(BUTTON_IDS.postInstall);
    if (alreadyDone) return;

    // Only show when status tag text is exactly "Installation"
    const installTag = Array.from(document.querySelectorAll(".ant-tag")).find(
      (el) => normalize(el.textContent) === "installation"
    );
    if (!installTag) return;

    const makeBtn = (id, label, color, handler) => {
      if (document.getElementById(id)) return null;
      const b = document.createElement("button");
      b.id = id;
      b.type = "button";
      b.textContent = label;
      b.style.cssText = inlineBtn(`background:${color};margin-left:8px;`);
      b.addEventListener("click", handler);
      return b;
    };

    const preBtn  = makeBtn(BUTTON_IDS.preInstall,  "Fill Pre Installation Form",  "#ea580c", fillPreInstallForm);
    const postBtn = makeBtn(BUTTON_IDS.postInstall, "Fill Post Installation Form", "#059669", fillPostInstallForm);

    // Insert both buttons after the Installation tag
    if (postBtn) installTag.insertAdjacentElement("afterend", postBtn);
    if (preBtn)  installTag.insertAdjacentElement("afterend", preBtn);
  }

  function createButtons() {
    if (
      location.href.includes("confirm-po") ||
      location.href.includes("project-details") ||
      location.href.includes("package-and-dispatch-details")
    ) {
      injectUploadDocsButton();
    }

    if (location.href.includes("confirm-po")) {
      injectPayAdvanceButton();
    }

    if (isProjectDetailsRootPage()) {
      injectSiteSurveyButton();
      injectInstallationButtons();
    }

    createLauncher();
  }

  async function fillOTPModal() {
    // Wait for the OTP modal to appear
    let otpInput = null;
    for (let i = 0; i < 25; i++) {
      otpInput = Array.from(document.querySelectorAll("input")).find(
        (el) => normalize(el.placeholder).includes("enter otp")
      );
      if (otpInput) break;
      await sleep(200);
    }

    if (!otpInput) return;

    otpInput.focus();
    setReactValue(otpInput, "748596");
    await sleep(300);

    // Find and click the "Verify OTP" button inside the modal
    const verifyBtn = Array.from(document.querySelectorAll(".ant-modal button"))
      .find((el) => normalize(el.innerText).includes("verify otp"));

    if (verifyBtn) {
      realClick(verifyBtn);
    }
  }

  function watchOTPButton() {
    if (!location.href.includes("confirm-po")) return;

    const otpTrigger = Array.from(document.querySelectorAll("button")).find(
      (el) => normalize(el.innerText).includes("click here to verify otp")
    );

    if (!otpTrigger || otpTrigger.dataset.otpWatched) return;

    otpTrigger.dataset.otpWatched = "true";
    otpTrigger.addEventListener("click", () => {
      fillOTPModal();
    });
  }

  const observer = new MutationObserver(() => {
    createButtons();
    watchOTPButton();
  });

  function start() {
    if (!document.body) {
      return;
    }

    // Wait for the profile/stats cache to load from chrome.storage.local before
    // the launcher renders, so the launcher starts with the saved profile.
    loadPersistedState(() => {
      maybeShowWhatsNew();

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      window.setTimeout(() => { createButtons(); watchOTPButton(); }, 1500);
    });
  }

  start();
})();
