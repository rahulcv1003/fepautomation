// Runs in MAIN world at document_start — wraps XHR/fetch before any page code runs.
// Communicates OTP to content.js (isolated world) via window.postMessage.
(function () {
  if (window.__fepXhrWrapped) return;
  window.__fepXhrWrapped = true;

  function extractOtp(responseText) {
    try {
      const j = JSON.parse(responseText);
      function findOtp(obj) {
        if (!obj || typeof obj !== "object") return null;
        for (const key of Object.keys(obj)) {
          if (key.toLowerCase() === "otp") {
            const val = String(obj[key]).trim();
            if (/^\d{4,8}$/.test(val)) return val;
          }
          const nested = findOtp(obj[key]);
          if (nested) return nested;
        }
        return null;
      }
      return findOtp(j);
    } catch (_) {}
    return null;
  }

  // If the page's login mutation doesn't request otp, inject it.
  // This covers prod where the frontend omits otp from the selection set.
  function injectOtpField(body) {
    if (typeof body !== "string") return body;
    try {
      const req = JSON.parse(body);
      if (req.query && req.query.includes("type:OTP") && !req.query.includes("otp")) {
        req.query = req.query.replace(/\bid\b/, "id\n        otp");
        return JSON.stringify(req);
      }
    } catch (_) {}
    return body;
  }

  // ── XHR interception ──────────────────────────────────────────────────────
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._fepUrl = String(url || "");
    return _open.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const sendBody = this._fepUrl.includes("graphql") ? injectOtpField(body) : body;

    this.addEventListener("load", function () {
      try {
        if (!this._fepUrl.includes("graphql")) return;

        const type = this.responseType;

        if (type === "" || type === "text") {
          const otp = extractOtp(this.responseText);
          if (otp) window.postMessage({ __fepOtp: otp }, "*");

        } else if (type === "blob" && this.response instanceof Blob) {
          const reader = new FileReader();
          reader.onload = function () {
            const otp = extractOtp(reader.result);
            if (otp) window.postMessage({ __fepOtp: otp }, "*");
          };
          reader.readAsText(this.response);

        } else if (type === "arraybuffer" && this.response) {
          const otp = extractOtp(new TextDecoder().decode(this.response));
          if (otp) window.postMessage({ __fepOtp: otp }, "*");

        } else if (type === "json" && this.response) {
          const otp = extractOtp(JSON.stringify(this.response));
          if (otp) window.postMessage({ __fepOtp: otp }, "*");
        }
      } catch (_) {}
    });

    return _send.call(this, sendBody);
  };

  // ── fetch interception (fallback) ─────────────────────────────────────────
  const _fetch = window.fetch;
  if (_fetch) {
    window.fetch = async function (input, init) {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      if (url.includes("graphql") && init && typeof init.body === "string") {
        init = Object.assign({}, init, { body: injectOtpField(init.body) });
      }
      const res = await _fetch.call(this, input, init);
      try {
        const text = await res.clone().text();
        if (res.url && res.url.includes("graphql")) {
          const otp = extractOtp(text);
          if (otp) window.postMessage({ __fepOtp: otp }, "*");
        }
      } catch (_) {}
      return res;
    };
  }
})();
