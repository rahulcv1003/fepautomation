<p align="center"><img src="docs/assets/hero.svg" alt="FEP Master Autofill Suite — Autofill, custom fields, and payment testing" width="100%"></p>

<p align="center">
  <a href="https://github.com/rahulcv1003/fepautomation/releases/tag/v1.0.5">Version 1.0.5</a> ·
  <a href="https://github.com/rahulcv1003/fepautomation/releases/latest">Download</a> ·
  <a href="CHANGELOG.md">What’s new</a> ·
  <a href="https://github.com/rahulcv1003/fepautomation/issues/new?template=bug_report.yml">Feedback</a>
</p>

**Spend less time filling FEP forms.** FEP Master Autofill Suite is a Chrome Manifest V3 extension for repetitive FEP workflows. Fill leads, proposals, and POs; define your own field values; and prepare payment API requests without switching to Postman.

## Download and install

**[Download FEP Master Autofill Suite 1.0.5](https://github.com/rahulcv1003/fepautomation/releases/download/v1.0.5/fep-master-autofill-suite-1.0.5.zip)**

1. Download the named extension ZIP from [Releases](https://github.com/rahulcv1003/fepautomation/releases/latest).
2. Extract it into a folder you intend to keep.
3. Open `chrome://extensions/` and enable **Developer mode**.
4. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.
5. Open a supported FEP page and use the small graphite launcher.

No Node.js, build step, or Tampermonkey is needed to use the download. Keep the extracted folder in place while the extension is installed. The release ZIP also serves as the Chrome Web Store upload package.

To update an unpacked installation, replace its extracted runtime files, click **Reload** on the extension card, then refresh FEP. Custom rules and settings remain in extension-local storage when reloading the same installation. Uninstalling the extension removes that data.

## A focused workspace

| Tool | What it does |
|---|---|
| **Fill Lead** | Fill the open Add Lead form with generated defaults and matching saved rules. |
| **Auto Fill Details** | Select the appropriate autofill routine for the current supported FEP page. |
| **Finance / Non Finance** | Use the relevant PO flow on Generate PO pages. |
| **Pay Advance Payment** | Submit the saved payment template using the current project ID and advance amount. |
| **Settings → Payments** | Import, edit, review, and submit payment requests to a selected FEP API environment. |
| **Settings → Other cURLS** | Save payload changes for advance payments, surveys, and pre/post-installation actions. |
| **Settings → Custom Field Builder** | Pick fields and save values for a page pattern and environment. |
| **Settings → Feedback & feature requests** | Prepare a GitHub bug report, feature suggestion, or general feedback. |
| **Settings** | Set your autofill name, review activity statistics, and reopen What’s New. |

The launcher is draggable. Resize its expanded panel from the upper-left corner, or focus the resize handle and use arrow keys. Double-click the handle to reset. Your preferred size is remembered.

<table>
  <tr><th>Compact tools</th><th>Request review</th></tr>
  <tr>
    <td align="center"><img src="docs/assets/tool-panel.png" alt="Compact FEP tools panel with Settings and Crumble" width="264"></td>
    <td align="center"><img src="docs/assets/request-review.png" alt="One-time request review with environment, project values, and final JSON payload" width="520"></td>
  </tr>
</table>

*Screenshots use test fixtures and simulated responses, not live customer records.*

## Custom fields that follow the workflow

1. Open the form, then choose **Settings → Custom Field Builder**.
2. Choose **Pick a field on this page** and click the field.
3. Enter the value, choose the environment, review the page pattern, and save.
4. Use **Test** for one rule or **Fill saved fields** for matching enabled rules.

Saved values replace defaults **at each field’s turn**, before dependent fields are filled. For example, a saved “3 Phase” selection is applied before the system-size and inverter-phase steps. Newly added custom fields enter before the next built-in field below them in page order. A rejected override stops the run with an explanation.

For dropdowns, enter the **exact displayed option text**, including spelling and capitalization. Fields are matched using stable attributes or labels, with an occurrence check when needed. Numeric, MongoDB, and UUID path segments default to `*`; review the pattern if several forms share a route. Query parameters are ignored.

Supported: text, numbers, email, textarea, native date fields, native and Ant Design single-select dropdowns, checkboxes, and radio options. Multi-selects, file inputs, password fields, and read-only date widgets are not supported by the builder. Rules can be edited, tested, enabled, disabled, or deleted.

## Payments, without leaving FEP

**Pay Advance Payment** on the PO confirmation page sends the request directly. It reads the current project ID and advance amount, updates the invoice ID, and uses the page’s payment endpoint. Missing project details stop the request.

For manual changes, open **Settings → Payments**:

- Start from the prefilled sample payload or import a Postman cURL, including JSON comments.
- Edit nested values; numbers, booleans, and unset optional fields are handled automatically.
- Choose **UAT, QA, staging, or production**. The endpoint follows the selected environment.
- Review the proposal ID, amounts, headers, and complete payload before pressing **Send**.
- Inspect the HTTP status, elapsed time, and response body, or export the edited cURL.
- Use **Reset to sample** to restore the sample values without changing the environment.

The editor starts with sample data. Drafts and responses stay in page memory until refresh. **Save for Pay Advance Payment** saves the edited payload and headers for future one-click payments; project IDs still follow the current page. Automatic retries are not performed. If the connection fails, check the payment record before resending.

## Saved request templates

Open **Settings → Other cURLS** to edit or send Advance Payment, Site Survey, Pre-installation, Post-installation, or QC Form. Change individual values, import a Postman cURL, or replace the JSON to add or remove fields.

- **Save for future runs** stores your configuration without sending a request.
- **Review & send now** prepares a one-time request without saving your edits. Check the environment, endpoint, page values, headers, and final JSON, then choose **Send request**. Missing project values can be entered for this run. The response shows HTTP status, elapsed time, and the response body. No automatic retries are made.
- **Back to editor** keeps unsaved edits. **Reset to default** removes the saved override.

On the project tracker’s Installation stage, **Fill QC Form** appears beside the pre/post-installation buttons. It submits `saveQaForm` to the current environment’s FEP API, using the project’s internal ID from the URL and numeric ID from the page. QC uses `projectDetails.projectId` for the numeric ID; it does not need system size. Other QC values, including checklist answers, customer details, media links, and the supplied timestamp, start from the provided sample and can be changed in Other cURLS.

Project IDs always come from the page. Keep placeholders such as `{{amount}}`, `{{systemSize}}`, and `{{projectSize}}` for current page values, or replace them with fixed values. Endpoints follow the current FEP environment, including after importing a cURL. Templates and their headers are stored locally in Chrome.

Pre Installation, Post Installation, and QC use `https://<environment>-fep-api.freyrenergy.com:444/api/v1/graphql` (production: `https://fep-api.freyrenergy.com:444/api/v1/graphql`). Pre Installation defaults use the supplied October 30 payload; IDs and system capacity come from the page. Media links remain the supplied UAT files, since changing a storage hostname does not copy files into another environment. Previously saved custom templates still take priority; use **Reset to default** to load the updated built-in values. Browser-managed headers in copied cURLs are ignored during import.

The extension also shows an occasional link to **Crumble**, Rahul’s cookie-cleaning extension: after three launcher opens and at most once every 14 days. Choose **Not now** or **Don’t show again**. You can change that preference in Other cURLS. No tracking requests are made.

## Environments and workflow support

| Environment | Main frontend | Payment API host on port 444 |
|---|---|---|
| UAT | `uat-fep.freyrenergy.com` | `uat-fep-api.freyrenergy.com` |
| QA | `qa-fep.freyrenergy.com` | `qa-fep-api.freyrenergy.com` |
| Staging | `stg-fep.freyrenergy.com` | `stg-fep-api.freyrenergy.com` |
| Production | `fep.freyrenergy.com` | `fep-api.freyrenergy.com` |

Payment requests use `/api/v1/zoho/proformainvoicedetailsfromzoho`. The legacy QA console and existing QA/staging API page matches remain supported. UAT and production GraphQL actions retain their configured Sunpro backends. Localhost and `127.0.0.1` form pages are supported for development, with direct API actions disabled.

Existing tools also cover supported document, survey, installation, dispatch, and liaising workflows, plus OTP assistance on configured login pages. Availability depends on the current FEP page and visible fields. Some existing workflow actions submit data or advance the page; review the action you choose.

## Feedback and feature requests

Use **Settings → Feedback & feature requests**, or open the [GitHub form](https://github.com/rahulcv1003/fepautomation/issues/new?template=bug_report.yml). Reports are public and assigned to [@rahulcv1003](https://github.com/rahulcv1003); notification delivery follows GitHub preferences. A GitHub account is required to submit.

The form adds only the extension version, environment hostname, browser family, and the text you provide. It does not automatically include project IDs, saved values, payment payloads, or responses. Review your report and remove private information before submitting.

## Privacy and permissions

Profile preferences, field rules, statistics, and panel dimensions stay in Chrome local extension storage. FEP actions communicate with the configured FEP services; feedback is submitted through GitHub. There are no analytics or advertising scripts. Some workflow diagnostics are written to the browser developer console.

Read the [privacy notes](docs/PRIVACY.md) and [permission explanations](docs/PERMISSIONS.md) for the details.

## Development

Requirements: Node.js 22+ and Playwright’s Chromium for browser tests.

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run package
```

| Command | Purpose |
|---|---|
| `npm run check` | Validate runtime syntax, versions, manifest references, and icons. |
| `npm test` | Run custom-field, workflow, dropdown, numeric, and payment tests against fixtures. |
| `npm run package` | Build the runtime-only extension ZIP and SHA-256 checksum under `release/`. |
| `npm run icons` | Regenerate PNG icons from the shared vector mark. |

Tests use isolated browser contexts, fixture pages, and simulated payment responses. They do not submit live payments or use your personal browser profile. The repository root is itself loadable as an unpacked extension; a production download contains only the required runtime files.

## Repository guide

| Path | Contents |
|---|---|
| `manifest.json`, `content.js`, `ui.css` | Chrome configuration, FEP workflows, and scoped interface styles. |
| `custom-tools.js` | Field picker, saved-rule engine, and feedback dialogs. |
| `payment-tools.js`, `background.js` | Payment editor, cURL parsing, and validated request relay. |
| `request-tools.js`, `request-defaults.js` | Saved request templates, dynamic page values, and the Crumble suggestion. |
| `interceptor.js`, `otp-listener.js` | Login-response and OTP assistance. |
| `icons/` | Vector mark and packaged PNG icons. |
| `tests/` | Browser and worker regression tests. |
| `scripts/` | Release validation and ZIP packaging. |
| `docs/` | Architecture, privacy, permissions, release guide, and screenshots. |
| `tools/legacy/` | Earlier icon-generation utilities retained for reference. |

## Documentation

- [Changelog](CHANGELOG.md)
- [Architecture overview](docs/ARCHITECTURE.md)
- [Privacy](docs/PRIVACY.md)
- [Permissions](docs/PERMISSIONS.md)
- [Release and manual acceptance guide](docs/RELEASE.md)
- [Contributing](CONTRIBUTING.md)

Maintained by [Rahul / @rahulcv1003](https://github.com/rahulcv1003). Source is available for inspection; no open-source license has been assigned.
