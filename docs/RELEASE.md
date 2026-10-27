# Releasing

## Validate

1. Use Node.js 22 or newer.
2. Run `npm ci`.
3. Run `npx playwright install chromium`.
4. Run `npm run check` and `npm test`.
5. Review screenshots generated under `test-results/` with fixture data.
6. Run `npm run package`.

The manifest, package metadata, and in-extension What’s New must use the same version. Version 1.0.4 is the requested Chrome distribution version; earlier 1.1.x/1.2.x labels were development builds. A Chrome Web Store update must be newer than the version already published in that listing.

## Package

`release/fep-master-autofill-suite-1.0.4.zip` contains only the manifest, runtime scripts, stylesheet, and referenced PNG icons. The manifest is at the archive root. The same ZIP can be uploaded to Chrome or extracted and loaded with Developer mode. Source, tests, screenshots, documentation, dependencies, and editor folders are excluded. `SHA256SUMS.txt` records the package checksum.

## Publish

Publish a GitHub release tagged `v1.0.4` with the ZIP and checksum as assets. Copy the relevant notes from CHANGELOG.md. Users should download the named extension ZIP, not GitHub’s automatically generated source archives.

Upload the extension ZIP in the Chrome Web Store Developer Dashboard when ready. GitHub publication does not submit or approve a Chrome Web Store release. Review your listing, privacy disclosures, and screenshots to match the current extension behavior.

## Manual acceptance

- Load the extracted ZIP in an isolated Chrome profile and check version 1.0.4.
- Open a supported environment and verify the launcher, panel resize, and Settings navigation.
- Test one text rule, numeric rule, dropdown rule, and a parent/child dependency.
- Import the sample payment cURL and inspect the review screen. Only send if you deliberately intend to update the selected environment’s payment record.
- Open Feedback & feature requests and verify the GitHub form without submitting a test issue.
