# Privacy

FEP Master Autofill Suite runs on its configured FEP hosts and local development pages.

## Stored in the browser

The extension uses Chrome local extension storage for the profile name, autofill statistics, custom-field rules and their values, dismissed release version, and preferred panel size. These are not automatically synchronized or sent to a separate analytics service. Removing the extension removes its extension-local data.

## Payment requests

Payment requests send the reviewed JSON payload and any supplied optional headers to the selected configured FEP API endpoint. Drafts, optional Authorization/X-API-Key values, and the last response are kept in the current page’s memory, not extension storage, and are cleared by a page refresh. The supplied default payload is sample data: review and edit its identifiers, dates, amounts, links, and transaction details for your request.

## FEP automation and OTP assistance

Autofill reads the current form and writes values into the page. Existing document, survey, installation, and other workflow actions may submit requests or advance the FEP workflow. OTP assistance reads OTP values present in FEP login responses and fills the matching input. It does not use a separate OTP service.

## GitHub feedback

Feedback leaves the browser only when you open and submit a GitHub report. The extension prefills its version, environment hostname, browser family, and the text you provide. It does not collect page URLs, project IDs, saved rules, payment payloads, or API responses for feedback. GitHub reports are public; review the text and attachments before submitting. GitHub’s own terms and privacy policy apply there.

## Diagnostics

Some existing workflow actions log diagnostics, identifiers, and request or response data in the browser developer console. Review and redact console output before sharing it. There are no analytics, advertising scripts, or separate extension-operated telemetry endpoints.
