# FEP Master Autofill Suite — Extension Overview

This document explains **what this Chrome extension does today and how it works**, in plain language, so a developer or an AI coding agent can extend it without first reading through `content.js` line by line.

It reflects the code as of this writing. If behavior changes, update this file alongside the code.

---

## 1. What this is

A Manifest V3 Chrome extension that speeds up manual testing/data-entry on the **FEP** platform (a React + Ant Design web app used for solar project sales, proposals, purchase orders, installation tracking, etc.).

It does two broad things:

1. **Form autofill** — injects a floating button that fills out whichever FEP form is currently open with test data (fake names, fixed pincodes, "first available" dropdown choices, etc.), so a tester doesn't have to type every field by hand.
2. **One-click backend actions** — injects extra buttons on specific pages that skip the UI entirely and POST a hardcoded payload straight to FEP's API/GraphQL endpoint (e.g. "mark advance payment as paid", "submit site survey", "submit pre/post-installation form").

It also quietly helps with **OTP entry** during login, so testers don't have to fetch the OTP from SMS/email manually.

This is a **testing/QA productivity tool**, not customer-facing. Every value it fills is fake/placeholder data.

---

## 2. File map

| File | Role |
|---|---|
| `manifest.json` | Manifest V3 config. Declares two content scripts and the host permissions. |
| `content.js` | **Everything lives here.** One big IIFE: form-filling logic, injected buttons, floating launcher UI, OTP handling, stats tracking. ~2,400 lines. |
| `interceptor.js` | Injected only on login pages, in the page's own JS context (`world: "MAIN"`), before any site code runs. Watches network traffic for the OTP value. |
| `background.js` | Service worker required by Manifest V3. Currently an empty stub — does nothing. |
| `generate-icons.html` / `generate-icons.js` | Standalone dev tool to (re)generate the extension icons. Not loaded at runtime. |
| `icons/` | Extension icon PNGs. |
| `README.md` | Install/load instructions. **Out of date** — describes only 3 buttons (Lead/Proposal/PO); the extension now supports many more pages and features. Should be refreshed or pointed at this document. |

There is also a `fepautomation/` subfolder in this repo — a nested, independent git repository that historically lagged behind these root files. It has been manually synced to match the root files as of this writing; it is **not** auto-synced, so future changes to the root files must be copied there again by hand if that copy needs to stay current.

### How the two content scripts are wired (`manifest.json`)

- `interceptor.js` → only on `*/login*` pages of `fep.freyrenergy.com` / `uat-fep.freyrenergy.com`, in the **MAIN world**, at `document_start` (runs before the page's own scripts, so it can wrap network functions in time).
- `content.js` → on all matched FEP/QA/localhost URLs, in the normal **isolated world**, at `document_end`.
- The two scripts talk to each other via `window.postMessage` (isolated-world content scripts can't call MAIN-world functions directly, and vice versa).

---

## 3. The core technique: how it fills Ant Design forms

Before touching any specific form, understand this — it's reused everywhere.

FEP's forms are built with **Ant Design** React components. You can't just set `input.value = "x"` because:
- React tracks input state itself and will overwrite a plain `.value` assignment.
- Dropdowns (`.ant-select`) aren't real `<select>` elements — they're a text-like box that opens a floating list of clickable options when clicked.
- Fields are matched **by their visible label text**, not by DOM id/name, because those aren't stable/predictable across forms.

So the toolkit works like this:

- **Find a field by its label** — `findFormItemByLabel(label)` scans all `.ant-form-item` elements and returns the one whose visible text contains the label (case/whitespace-insensitive). An `occurrence` number picks the 2nd, 3rd, etc. match when a label repeats on the page (e.g. two "Pincode" fields for two different addresses).
- **Type into a text field** — `fillInputByLabel(label, value)` finds the field, then uses `setReactValue()`, which sets the value through the *native* input setter (bypassing React's override) and then fires real `input`/`change` events — this is the standard trick to make a React-controlled field "notice" a programmatic value change.
- **Click things realistically** — `realClick(el)` fires a full `pointerdown → mousedown → pointerup → mouseup → click` sequence at the element's actual screen position, instead of calling `.click()`. Some Ant components only respond to a real pointer sequence.
- **Operate a dropdown** — click it open (`realClick`), wait for `.ant-select-dropdown` to appear and populate with `.ant-select-item-option` items, click the option you want, then verify the selection actually landed (by reading back the displayed text). There are a few flavors:
  - `selectDropdownByLabel(label, "first"|"last")` — just pick the first or last option (used when the exact answer doesn't matter, only that *something* is selected).
  - `selectDropdownByText(label, text)` — try to pick a specific option by its text; if it's not visible yet, type into the dropdown's search box and retry.
  - `selectFirstDropdownOptionFast(label)` — a faster "just pick the first option" path with a keyboard fallback (Arrow Down + Enter) if clicking doesn't register.
- **Click a Yes/No or multiple-choice control** — `clickChoiceByText(text, label)` for Ant's radio-button-styled choice groups.
- **Waiting** — nearly everything is a bounded polling loop (`sleep(50)` in a loop with a max attempt count), not event-driven. This matters if a page becomes slower — timeouts are hardcoded per call (e.g. `waitMs: 5000` for a dropdown that depends on another field's async lookup).

**Practical implication for future work:** if a new form field isn't getting filled, the two most common causes are (a) the visible label text was changed on the FEP site so it no longer matches the string in the code (this just happened with "Current Grid Phase" → "Current Grid/Home Phase"), or (b) the field is genuinely disabled/hidden until some other field is filled first, so the timing/order in the fill function is wrong.

---

## 4. The floating launcher (main UI)

A small floating button (`#fep-launcher`, a rounded 58×58 pill showing a cat or dog pixel-art icon) appears on every page the extension runs on. It's draggable — clicking without dragging opens a popup menu; dragging repositions it (a >6px movement threshold tells the two apart).

Clicking it opens a small popup with 3 options:

1. **Fill Lead** — always available. Fills the "create lead" modal (see §5).
2. **Auto Fill Details** — fills whatever form matches the *current URL* (see the page map in §5). Greyed out with a tooltip ("No autofill available for this page") if the current URL doesn't match any known form.
3. **Switch to Dog / Switch to Cat** — cosmetic toggle between the two mascot icons, saved in `localStorage`.

This popup is the **only** place the launcher exposes actions. The document-upload buttons and the "Pay Advance / Site Survey / Pre-Install / Post-Install" buttons (§7, §8) are separate, injected directly next to the relevant page element — they do not appear in this popup.

The launcher and all page-specific buttons are (re-)injected by a single function `createButtons()`, which runs every time the page's DOM mutates (via a `MutationObserver` watching the whole `<body>`) plus once on a 1.5s fallback timer. This is how the extension keeps up with the FEP site being a single-page app that swaps content without a full page reload — there's no explicit "route changed" event; it just re-checks the current URL/DOM continuously.

---

## 5. Page → autofill function map

"Auto Fill Details" decides what to run purely by checking substrings in the current URL:

| URL contains... | Function called | Form / page |
|---|---|---|
| `create-proposal` | `fillProposal()` | Proposal creation (System Type / Contract Load page) |
| `generate-po` | `fillPO()` | Purchase Order generation |
| `TC/my-leads/lead-details` | `fillTCLeadDetails()` | Tele-caller lead details form |
| `package-and-dispatch-details` | `fillPackageAndDispatchDetails()` | Package & dispatch details |
| `liaising-tracker/new` | `fillLiaising()` | New liaising tracker entry |
| `le-and-tfr` | `fillLETFR()` | Liaising Engineer / TFR feasibility flow |
| `net-metering` | `fillNetMetering()` | Net metering flow |
| *(none of the above)* | — | "Auto Fill Details" is disabled |

`fillLead()` is separate — it always runs from the "Fill Lead" button regardless of URL, because the lead-creation form is a modal, not a distinct page.

**To add support for a new page:** write a new `fillXyz()` function using the toolkit in §3, then add one line to this dispatch map (a function named `getDetailsFn()` inside `createLauncher()`).

---

## 6. What each fill function actually does

All values below are **hardcoded test/placeholder data** unless noted as "random" or "conditional."

### `fillLead()` — the "Fill Lead" button, any page
Fills the lead-creation modal: First/Last Name (random), Contact Number (random 10-digit), Email (random), Pincode `500019` (twice, for two separate address sections), Area (first option, both times), Project Type = "Independent", Range of Electricity Bill (first option), Door No `12`, Serviceable State = "Telangana", Serviceable City = "Hyderabad", DISCOM (first option — **only attempted on UAT**, since the field doesn't reliably appear on prod), Lead Source (first option), and a remarks textarea = "Created using autofill".

### `fillTCLeadDetails()` — URL contains `TC/my-leads/lead-details`
A longer, more detailed version of the lead form (~30 fields): address/location fields (same as above, plus DISCOM attempted **unconditionally** here, unlike `fillLead`), project basics (Project Name, Project Type, Own House/Rented, construction status, meter type), electricity usage (bill range, average bill, units consumed), **Current Contract Load = 4**, Current Grid Phase (first option), subsidy = "Yes", Required Solar System Size (first option), Required Inverter Phase (first option), storage type = "WITHOUT_STORAGE", roof area `500`, roof type (first option), finance interest = "Yes", employment details, contact preferences, lead source, priority = "Low", and a remarks textarea (the *last* textarea on the page, not the first).

### `fillProposal()` — URL contains `create-proposal`
This is the page shown in the "System Type" tab screenshot discussed earlier in this conversation. Fills: DISCOM (first option), clicks "Yes" on the subsidy radio, **Current Contract Load = 4**, **Current Grid/Home Phase** (first option — *this label was recently corrected to match a site rename*), Required Solar System Size (**last** option — note this one picks *last*, not *first*, unlike the lead forms), Required Solar Inverter Phase (last option), Available Roof Area `5000000`, clicks a "flat roof" structure-type card if present, Grid tariff `7`.

### `fillPO()` — URL contains `generate-po`
Fills Purchase Order fields: site status, name/category change flags, PAN `ABCDE1234F`, gender/tenure/marital status (first option each), date of birth `15-03-1990`, financing amount `200000`, monthly power bill `12345`, profession (first option), monthly income `12345`, applicant/mother name, applicant phone (random), applicant/company email, company name, company phone (random), "Financed through Jan Samarth" = "Yes", and a bank name "Test Bank".

### `fillPackageAndDispatchDetails()` — URL contains `package-and-dispatch-details`
Fills transporter (first option), a generated truck number (`TS09AB` + random 4 digits), driver name/phone, expected delivery date (today + 3 days), generates a unique serial number for every visible "serial number" input on the page, and then runs the **document upload engine** (§7) to attach a dummy image to every pending file upload on the page.

### `fillLiaising()` — URL contains `liaising-tracker/new`
Toggles an "all documents received" switch on, dismisses a "Clear" confirmation if it appears, then fills Initial Contract Load `4`, consumer number `1234567`, DISCOM/Grid Phase/Bill Category (first option each).

### `fillLETFR()` — URL contains `le-and-tfr` (Liaising Engineer / TFR feasibility)
Different approach from the others: instead of matching specific labels, it walks through 4 fixed page sections (`nationalFeasibilityApplication`, `nationalFeasibilityApproval`, `stateFeasibilityApplication`, `stateFeasibilityApproval`) one at a time and, within each, fills **every empty field it finds generically**: date pickers get today's date, number-looking inputs get `100000`, everything else gets `TEST-001`, empty textareas get "Test remarks", file inputs get a dummy image — then clicks that section's Save button before moving to the next section.

### `fillNetMetering()` — URL contains `net-metering`
Similar generic, section-by-section approach to `fillLETFR`, but instead of fixed section ids it **discovers sections automatically** by finding every "Save" button on the page and treating each one's smallest containing block as a section. Fills dates and file uploads the same generic way. If a section contains a toggle switch (used to detect the "Net Meter Testing" section specifically), it clicks "Complete" at the end instead of "Save".

---

## 7. Document upload engine (reused across pages)

Several pages need dummy files attached to file-upload inputs. One shared engine handles this: `autoUploadDocs(scope)`, where `scope` can be the whole page, a modal, or a specific card — so it can be reused in different contexts.

How it decides a row still needs a file: it looks at the text of the row containing the file input; if that text does **not** include the word "re-upload", the row is treated as still pending (FEP shows a "Re-upload" option/label once a file has been accepted). It repeats: find the first pending row → attach a generated 1×1 dummy JPEG → wait for the row to flip out of "pending" → repeat, until nothing pending remains (capped at `2 × number of rows` attempts as a safety limit).

This engine is wired up behind an **"Auto Upload Docs" button** that gets injected in three different places depending on the page:
- **Package & dispatch page** — button appears right before the page's own "Upload" button; uploads to every file input on the page.
- **Confirm PO page** — button appears inside the "Upload Documents" card; scoped to just that card.
- **Project details page** — button appears right before "Manage Documents"; clicking it opens that modal automatically and then uploads inside it.

---

## 8. OTP automation

There are **two separate, unrelated** OTP mechanisms — worth keeping distinct when working on either:

### A. Login OTP (real value, auto-fill only, no auto-submit)
- `interceptor.js` runs in the page's own JS context on login pages, before any site code, and wraps `fetch`/`XMLHttpRequest`. Any GraphQL response containing a field literally named `otp` (case-insensitive, 4–8 digits) is captured and sent to `content.js` via `window.postMessage`. It also patches the outgoing GraphQL query on prod, where the site's own query doesn't request the `otp` field, so a value is actually returned to intercept.
- `content.js` listens for that message (only active on `fep.freyrenergy.com/login`), then polls for an OTP input field (matched by placeholder, falling back to any short numeric input) for up to 4 seconds, fills it, and shows a green "OTP auto-filled" toast. **It does not click Verify/Login for you** — you still confirm manually.

### B. Confirm-PO OTP modal (fixed test value, does auto-submit)
- Completely separate flow, only active on the "confirm PO" page. Watches for a "click here to verify otp" button; once clicked, fills the OTP input with a **hardcoded fixed value `748596`** (not read from the network — this presumably matches a fixed test-mode OTP for that specific verification flow) and then clicks "Verify OTP" automatically.

---

## 9. Direct-to-API buttons (bypass the UI entirely)

These are different in kind from everything above: instead of filling visible form fields, they build a hardcoded JSON/GraphQL payload in JavaScript and `fetch()` it straight to FEP's backend. Each is its own injected button, shown only when a specific status/element is present on the page:

| Button | Shown when | Action |
|---|---|---|
| **Pay Advance Payment** | On the "confirm PO" page, next to the payment method card | Reads the Project ID and advance amount off the page, builds a Zoho invoice payload, POSTs it to the advance-payment endpoint. |
| **Fill Site Survey Form** | On a project's details page, when its status tag is "Site Survey" (or "Won" outside the tracker view) | POSTs a `saveSurvey` GraphQL mutation with pre-set roof/electricity/media details for that project. |
| **Fill Pre Installation Form** | On the project tracker page, when status is "Installation" | POSTs a `savePreInstallationForm` GraphQL mutation. |
| **Fill Post Installation Form** | Same page/status as above | POSTs a `savePostInstallationForm` GraphQL mutation. |

All four:
- Only appear/work when **not** on `localhost` (`canUseHardcodedApiEndpoints()`) — they're disabled in local dev because the hardcoded endpoint URLs point at UAT/prod.
- Pick between the UAT and prod API host automatically based on the current hostname.
- Show a green/red toast on success/failure, and relabel themselves "Processing…" while the request is in flight.

**Note for future work:** these four functions read project info off the rendered page (Project ID, system size, etc.) using their *own* set of helper functions, separate from the ones used by the fill functions above (`getProjectIdFromUrl`, `getNumericProjectId`, `getProjectSizeKw` vs. `getProjectId`, `getAdvanceAmount`). They're not unified — if you're fixing a "can't find project ID" bug, check which family the failing button actually uses.

---

## 10. Environment awareness

The extension behaves differently depending on where it's running:

- **`localhost` / `127.0.0.1`** → all four direct-API buttons above are hidden entirely, since their target endpoints are hardcoded UAT/prod URLs that don't make sense locally.
- **Environment routing** → `API_ENVIRONMENTS` maps production, UAT, QA (including the legacy console), and staging explicitly. Payments use the corresponding `fep-api`, `uat-fep-api`, `qa-fep-api`, or `stg-fep-api` Freyr host on port 444 through the background worker; GraphQL retains the API hosts. Unmapped hosts and localhost cannot run direct API actions. DISCOM autofill remains UAT-only.

---

## 11. Usage stats (tracked, but not shown anywhere in the UI)

Every "Fill Lead" and "Auto Fill Details" click is timed and recorded to `localStorage` under the key `fep-master-autofill-stats-v1`, tracking click counts, actual time spent, and estimated time saved (against a hardcoded assumption of 2 minutes to fill a lead by hand and 3 minutes for a details form).

**There is currently no visible panel or button showing these numbers** — the only way to see them today is opening the browser console (the summary is logged after every run) or manually inspecting `localStorage` in DevTools. If a "show me my time saved" feature is ever wanted, the data is already being collected — it just needs a UI.

---

## 12. Known quirks / things to be aware of before changing code

- **README.md is stale.** It only documents 3 buttons; the real feature set is everything in this document. Update the README to point here, or keep both in sync.
- **The confirm-PO OTP is a fixed value (`748596`)**, not the real intercepted OTP. If that test flow's expected OTP ever changes, this is a hardcoded string to update.
- **Two unrelated "get project info" helper families exist** (see §9's note) — don't assume fixing one fixes the other.
- **`selectSearchableDropdownByText()` and `createButton()` are defined but never called anywhere.** Likely leftover/reserved for future use — safe to reuse, but don't assume they're wired into anything today.
- **DISCOM retry behavior is inconsistent on purpose**: gated to UAT-only in `fillLead()`, but attempted unconditionally in `fillTCLeadDetails()`. This looks like a deliberate difference (prod lead form doesn't show DISCOM) rather than a bug — confirm before "fixing" it.
- **All "fill" functions use fixed/fake test data.** None of it is meant to look like real customer data (e.g. the phone generator produces numbers starting 1–5, which aren't valid Indian mobile prefixes — it's intentionally synthetic).
- **Labels are matched by substring, not exact text.** This is why a site-side label rename (e.g. "Current Grid Phase" → "Current Grid/Home Phase") silently breaks a field until the code string is updated — there's no error, the field is just quietly skipped. When a field "stops autofilling," check the current on-page label text first.
- **The `fepautomation/` nested folder is a separate git repo** that must be manually kept in sync with the root files (see §2) — it is not the source of truth and is not auto-updated.

---

## 13. How to extend this safely

- **New form page:** write `fillYourForm()` using the label-matching helpers in §3, then add one `if (h.includes("your-url-fragment")) return fillYourForm;` line to the dispatch map described in §5.
- **New injected action button:** follow the pattern in §7/§9 — check for a page-identifying element/URL, inject a button once (guard with `document.getElementById(id)` so it isn't duplicated on every DOM mutation), and hook up a handler.
- **New direct-API action:** copy the pattern in §9 — guard with `canUseHardcodedApiEndpoints()`, branch UAT vs prod host, wrap the `fetch` in try/catch/finally, use `showApiToast()` for feedback.
- Always test on **UAT** first; the direct-API buttons are disabled on localhost by design, so a browser with real UAT access is needed to exercise those paths.
