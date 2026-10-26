// Runs in the isolated world at document_start — as early as interceptor.js's
// own MAIN-world script, and deliberately independent of content.js.
//
// Why this exists as its own file: content.js used to own this listener, but
// it only attached it after start() -> loadPersistedState()'s async
// chrome.storage.local.get() callback resolved. If the login page's OTP
// response came back before that finished, interceptor.js's
// window.postMessage({__fepOtp}) was posted with nobody listening yet —
// postMessage isn't queued for late listeners, so the OTP was silently lost
// and the only fix was refreshing the page (a second attempt got luckier on
// timing). Registering this at document_start, with zero async setup of its
// own, closes that gap.
(function () {
  if (window.__fepOtpListenerReady) return;
  window.__fepOtpListenerReady = true;

  const LOG_PREFIX = "[FEP MASTER]";

  function normalize(str) {
    return (str || "").replace(/\s+/g, " ").trim().toLowerCase();
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

  // Small self-contained toast — duplicated rather than shared with
  // content.js, since this script must not depend on content.js having
  // loaded yet (that dependency is exactly what caused the original bug).
  function showToast(message, isSuccess) {
    try {
      if (!document.body) return;
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
        "word-break:break-word"
      ].join(";");

      const titleEl = document.createElement("div");
      titleEl.textContent = (isSuccess ? "✓ " : "✗ ") + message;
      titleEl.style.cssText = `font-size:13px;font-weight:700;color:${isSuccess ? "#166534" : "#991b1b"};`;
      toast.appendChild(titleEl);

      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
    } catch (_) {
      // Best-effort UI only — never let a toast failure affect OTP filling.
    }
  }

  window.addEventListener("message", function (e) {
    if (!e.data || !e.data.__fepOtp) return;
    const otp = e.data.__fepOtp;
    console.log(LOG_PREFIX, "postMessage received, OTP:", otp);

    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      const inputs = Array.from(document.querySelectorAll("input"));
      const input =
        inputs.find((el) => normalize(el.placeholder).includes("enter otp")) ||
        inputs.find((el) => normalize(el.placeholder).includes("otp")) ||
        inputs.find((el) => el.maxLength >= 4 && el.maxLength <= 8 && el.type !== "hidden");

      if (input) {
        clearInterval(interval);
        setReactValue(input, otp);
        input.focus();
        showToast("OTP auto-filled: " + otp, true);
        console.log(LOG_PREFIX, "OTP filled into input:", input.placeholder || "(no placeholder)");
      } else if (attempts >= 20) {
        clearInterval(interval);
        console.warn(LOG_PREFIX, "OTP input not found after 4s. OTP was:", otp);
        showToast("OTP captured (" + otp + "), but input field not found", false);
      }
    }, 200);
  });
})();
