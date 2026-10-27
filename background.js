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

const PAYMENT_ENVIRONMENTS = Object.freeze({uat:"uat-fep-api.freyrenergy.com",qa:"qa-fep-api.freyrenergy.com",staging:"stg-fep-api.freyrenergy.com",production:"fep-api.freyrenergy.com"});
const paymentRequestsInFlight = new Set();
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["FEP_ADVANCE_PAYMENT", "FEP_PAYMENT_REQUEST"].includes(message?.type)) return;

  (async () => {
    let requestKey;
    const started = Date.now();
    try {
      const source = new URL(sender.url);
      const host = Object.hasOwn(PAYMENT_HOSTS, source.hostname)
        ? PAYMENT_HOSTS[source.hostname] : null;
      const targetHost = message.type === "FEP_PAYMENT_REQUEST" && Object.hasOwn(PAYMENT_ENVIRONMENTS, message.environment)
        ? PAYMENT_ENVIRONMENTS[message.environment] : host;
      const expected = `https://${targetHost}:444/api/v1/zoho/proformainvoicedetailsfromzoho`;
      if (sender.id !== chrome.runtime.id || source.protocol !== "https:" ||
          !host || message.endpoint !== expected || typeof message.body !== "string" || message.body.length > 100000 ||
          (message.type === "FEP_PAYMENT_REQUEST" && !Object.hasOwn(PAYMENT_ENVIRONMENTS, message.environment))) {
        throw new Error("Payment request rejected: invalid environment or endpoint.");
      }
      const payload = JSON.parse(message.body);
      if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
          !["string", "number"].includes(typeof payload.proposal_id) || !String(payload.proposal_id).trim() ||
          typeof payload.payment_stage !== "string" || !payload.payment_stage.trim() ||
          !payload.details || ["invoice_amount", "paid_amount", "due_amount"].some(key => typeof payload.details[key] !== "number" || !Number.isFinite(payload.details[key]) || payload.details[key] < 0)) {
        throw new Error("Invalid payment payload. Check proposal_id, payment_stage, and numeric amounts.");
      }
      const headers = { "Content-Type": "application/json" };
      for (const [key, value] of Object.entries(message.headers || {})) {
        if (!["authorization", "x-api-key", "accept"].includes(key.toLowerCase()) || typeof value !== "string" || /[\r\n]/.test(value)) throw new Error("Unsupported payment request header.");
        headers[key] = value;
      }
      requestKey = `${sender.tab?.id || sender.url}:${expected}:${message.body}`;
      if (paymentRequestsInFlight.has(requestKey)) { requestKey = null; throw new Error("This payment request is already in progress."); }
      paymentRequestsInFlight.add(requestKey);
      const response = await fetch(expected, {
        method: "POST",
        headers,
        body: message.body,
        redirect: "error",
        signal: AbortSignal.timeout(30000)
      });
      const responseText = await response.text();
      let data;
      try { data = JSON.parse(responseText); } catch (_) { data = { message: responseText }; }
      sendResponse({ ok: response.ok, status: response.status, data, text: responseText, elapsedMs: Date.now() - started });
    } catch (error) {
      sendResponse({ error: error.message });
    } finally { if (requestKey) paymentRequestsInFlight.delete(requestKey); }
  })();
  return true;
});
