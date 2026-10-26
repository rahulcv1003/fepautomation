// Payment requests run here so extension host permissions, rather than page CORS,
// govern access. Only the payment endpoint for the sender's environment is allowed.
const PAYMENT_HOSTS = Object.freeze({
  "fep.freyrenergy.com": "fep-api.freyrenergy.com",
  "uat-fep.freyrenergy.com": "uat-fep-api.freyrenergy.com",
  "qa-fep.freyrenergy.com": "qa-fep-api.freyrenergy.com",
  "qa-fep-api.freyrenergy.com": "qa-fep-api.freyrenergy.com",
  "qa-console.sunpro.tilicho.in": "qa-fep-api.freyrenergy.com",
  "stg-fep.freyrenergy.com": "stg-fep-api.freyrenergy.com",
  "stg-fep-api.freyrenergy.com": "stg-fep-api.freyrenergy.com"
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "FEP_ADVANCE_PAYMENT") return;

  (async () => {
    try {
      const source = new URL(sender.url);
      const host = Object.hasOwn(PAYMENT_HOSTS, source.hostname)
        ? PAYMENT_HOSTS[source.hostname] : null;
      const expected = `https://${host}:444/api/v1/zoho/proformainvoicedetailsfromzoho`;
      if (sender.id !== chrome.runtime.id || source.protocol !== "https:" ||
          !host || message.endpoint !== expected || typeof message.body !== "string") {
        throw new Error("Payment request rejected: invalid environment or endpoint.");
      }
      const response = await fetch(expected, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: message.body,
        redirect: "error",
        signal: AbortSignal.timeout(30000)
      });
      let data;
      try { data = await response.json(); } catch (_) { data = {}; }
      sendResponse({ ok: response.ok, status: response.status, data });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  })();
  return true;
});
