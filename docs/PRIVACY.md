# Privacy

FEP Master Autofill Suite runs on its configured FEP hosts and local development pages.

## Stored in the browser

The extension uses Chrome local extension storage for the profile name, autofill statistics, custom-field rules and their values, saved request templates and headers, dismissed release version, preferred panel size, and Crumble suggestion timing and opt-out. These are not automatically synchronized or sent to a separate analytics service. Removing the extension removes its extension-local data.

## Payment requests

The payment editor sends the reviewed payload and supplied headers to the selected configured FEP endpoint. Drafts and the last response remain in page memory until refresh. If you explicitly save a request template or choose “Save for Pay Advance Payment,” its payload and headers (including any supplied Authorization/X-API-Key) are stored in Chrome local extension storage until reset or removal. One-click advance payments use the saved template, the current project ID, and the page’s environment. Review saved fixed values before using them.

## Crumble suggestion

An occasional dismissible card links to Rahul’s Crumble extension on the Chrome Web Store. It appears after three launcher opens and at most once every 14 days. It makes no remote requests until you click the link, uses no advertising or tracking service, and can be disabled permanently or re-enabled in Other cURLS.

## FEP automation and OTP assistance

Autofill reads the current form and writes values into the page. Existing document, survey, installation, and other workflow actions may submit requests or advance the FEP workflow. OTP assistance reads OTP values present in FEP login responses and fills the matching input. It does not use a separate OTP service.

## GitHub feedback

Feedback leaves the browser only when you open and submit a GitHub report. The extension prefills its version, environment hostname, browser family, and the text you provide. It does not collect page URLs, project IDs, saved rules, payment payloads, or API responses for feedback. GitHub reports are public; review the text and attachments before submitting. GitHub’s own terms and privacy policy apply there.

## Diagnostics

Some existing workflow actions log diagnostics, identifiers, and request or response data in the browser developer console. Review and redact console output before sharing it. There are no analytics, advertising scripts, or separate extension-operated telemetry endpoints.
