# FEP Master Autofill Suite

A standalone Chrome extension version of your Tampermonkey autofill script for FEP environments.

## What it does

The extension injects autofill buttons directly into supported FEP pages:

- `Auto Fill Lead`
- `Auto Fill Proposal`
- `Auto Fill PO`

Version 1.2.2 prefills the payment console with the supplied sample values and removes manual type controls. It retains the compact icon-only launcher and resizable tool panel. Drag the panel’s upper-left corner to resize it; use arrow keys when the resize handle has focus, or double-click it to reset. Your preferred size is saved in extension local storage. Saved field values still apply at their turn before dependent fields.

## Supported URLs

- `https://fep.freyrenergy.com/*`
- `https://uat-fep.freyrenergy.com/*`
- `https://qa-fep.freyrenergy.com/*`
- `https://qa-fep-api.freyrenergy.com:444/*`
- `https://stg-fep.freyrenergy.com/*`
- `https://stg-fep-api.freyrenergy.com:444/*`
- `https://qa-console.sunpro.tilicho.in/*` (legacy QA frontend)

## Files

- `manifest.json` - Chrome extension manifest (Manifest V3)
- `content.js` - injected autofill logic and floating action buttons
- `ui.css` - scoped launcher, settings, action, and notification styles
- `custom-tools.js` - custom-field rules and feedback dialogs

## How to load in Chrome

1. Open `chrome://extensions/`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select this folder:
   `C:\Users\rahul\OneDrive\Desktop\Projects\FEP Automation`

## How to use

1. Load the extension in Chrome
2. Open one of the supported FEP pages
3. Use the floating autofill button shown for that page

## Notes

- This extension does not need Tampermonkey.
- Uses extension local storage and environment-specific host permissions.
- The logic is intentionally close to your original script for an easier migration.

## Custom Field Builder

1. Open the FEP form and click the floating launcher.
2. Open **Settings → Custom Field Builder**, then **Pick a field on this page**. Click the field you want to configure. Press Escape to cancel picking.
3. Confirm the detected field type and enter the value. For dropdowns, enter the exact visible option text. Choose the environment and page path, then save.
4. Use **Test** to check a single rule, or **Fill saved fields** for all matching enabled rules. During Fill Lead, Auto Fill Details, and Non Finance, saved rules replace defaults at the matching field step, before dependent fields are filled. Newly added fields are inserted before the next built-in field below them on the page.
5. Edit, enable, disable, or delete rules from the builder. Rules are stored in Chrome extension local storage, not in the FEP site.

Supported: text, number, email, textarea, native dates, native single-select dropdowns, Ant Design single-select dropdowns, checkboxes, and radio options. Multi-selects, file uploads, password fields, and read-only date widgets are not supported. Numeric, MongoDB, and UUID path segments default to `*` so rules can apply to different project IDs. Query parameters are ignored; review the path when two forms share a route. Duplicate matches use the selected occurrence and expected match count; recheck rules after page layout changes. Forms are never submitted automatically.

## Payments

Open **Payments** in the launcher or click **Pay Advance Payment** on the PO confirmation page. The supplied sample payload is prefilled exactly, including proposal `2000001118`, invoice `FE/26-27/2000001118`, June 30 timestamps, amounts, links, and transaction IDs. Users edit the values needed for their request; no request is sent automatically. The endpoint still follows the selected environment.

- Import the Postman cURL for any configured payment environment, including a body with Postman JSON comments. The trailing empty query string in exported examples is normalized away.
- Edit nested payload values without choosing data types. Numbers and booleans are preserved automatically; unset optional fields remain null. **Reset to sample** restores the sample values while preserving the selected environment. Imported optional fields are preserved. Use **Advanced: replace JSON payload** to add or remove fields, or **Show cURL** to export your edited request.
- Choose UAT, QA, staging, or production explicitly. The console can target a different environment from the open page. Requests are restricted to the four configured payment endpoints; this is not a general-purpose HTTP client.
- Review the proposal ID, amounts, environment, headers, and complete payload. **Send to [environment]** performs one POST and shows HTTP status, elapsed time, and the response text. No automatic retries are performed.
- A network failure or timeout has an unknown outcome. Verify the project's payment record before resending through the editor. Duplicate in-flight requests from the same tab are rejected.
- Content-Type is fixed to application/json. Optional Accept, Authorization, and X-API-Key headers can be edited. cURL options such as --insecure, cookies, file uploads, and non-POST methods are rejected.
- Drafts, optional credentials, and the last response are held only in the page's memory. They are not saved to extension storage and disappear on page refresh. Switching to another detected project starts a new draft.

## Feedback & feature requests

Choose **Settings → Feedback & feature requests** from the launcher. Enter the summary, feature, steps, expected result, and actual result. **Review report on GitHub** opens the structured issue form in [rahulcv1003/fepautomation](https://github.com/rahulcv1003/fepautomation/issues/new?template=bug_report.yml). Review it and click **Submit new issue** there. A GitHub account is required. Reports are public; omit customer and payment details. Only extension version, hostname, and browser family are added automatically; page URLs, project IDs, field values, and request payloads are not collected. Repository notification settings control delivery to its owner.

## Development checks

Install development dependencies with `npm install`, install Chromium with `npx playwright install chromium`, and run `npm test`. Browser tests use local fixtures, never live payment submissions.

## API environments

Payments use `/api/v1/zoho/proformainvoicedetailsfromzoho` on `https://uat-fep-api.freyrenergy.com:444` (UAT), `https://fep-api.freyrenergy.com:444` (production), `https://qa-fep-api.freyrenergy.com:444` (QA), and `https://stg-fep-api.freyrenergy.com:444` (staging). Payment requests run through the background worker with environment-specific validation and host permissions. GraphQL retains its existing environment-specific API hosts. Direct API actions are disabled on localhost and unmapped hosts.

Reload the extension from `chrome://extensions/` after updating, then refresh the FEP page.
