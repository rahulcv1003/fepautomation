# Changelog

## 1.0.4 — 27 October 2026

This release consolidates the recent development builds into version **1.0.4** for Chrome distribution.

### Interface

- Compact graphite icon launcher and matching toolbar icons.
- Smaller tool panel with pointer and keyboard resizing, remembered dimensions, and a reset gesture.
- Consistent neutral controls, responsive dialogs, visible keyboard focus, and reduced-motion support.
- Custom Field Builder and Feedback & feature requests grouped under Settings.
- Expanded in-extension What’s New covering the complete release.

### Custom fields

- Click a field to save its value for a page pattern and environment.
- Edit, test, disable, enable, and delete rules.
- Apply custom values at their step in autofill, before dependent fields.
- Insert new custom fields before the next built-in field below them in page order.
- Support text, numbers, email, textarea, native dates, single-select dropdowns, checkboxes, and radio options.
- Fix numeric normalization, exact dropdown selection, delayed options, and controlled-input rerenders.
- Stop autofill with an explanation when a custom override cannot be applied.

### Payments

- Editable payment console from the launcher and Pay Advance Payment button.
- Supplied sample payload prefilled, with automatic JSON type handling and reset-to-sample.
- Postman cURL import, including JSON comments, and edited cURL export.
- Explicit UAT, QA, staging, and production API destinations.
- Payload review before submission, HTTP status, response body, and elapsed time.
- Duplicate in-flight protection and no automatic retry on an uncertain outcome.
- In-memory drafts and responses; optional credentials are not persisted to extension storage.

### Feedback and distribution

- Structured GitHub bug, feature, and feedback form with maintainer assignment.
- Installation guide, privacy and permissions documentation, screenshots, and release packaging.
- Runtime-only download ZIP with a SHA-256 checksum.

## 1.0.3 and earlier

Core FEP autofill workflows for leads, proposals, POs, document-related actions, surveys, installation forms, and OTP assistance. Detailed historical release notes were not maintained in this repository.
