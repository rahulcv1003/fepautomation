# FEP Master Autofill Suite

A standalone Chrome extension version of your Tampermonkey autofill script for FEP environments.

## What it does

The extension injects autofill buttons directly into supported FEP pages:

- `Auto Fill Lead`
- `Auto Fill Proposal`
- `Auto Fill PO`

It currently preserves the same behavior as your existing userscript so we can optimize safely in the next pass.

## Supported URLs

- `https://fep.freyrenergy.com/*`
- `https://uat-fep.freyrenergy.com/*`
- `https://qa-console.sunpro.tilicho.in/*`

## Files

- `manifest.json` - Chrome extension manifest (Manifest V3)
- `content.js` - injected autofill logic and floating action buttons

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
- No special permissions are required right now beyond the site matches in the manifest.
- The logic is intentionally close to your original script for an easier migration.

## Next step

The extension is ready for the optimization phase whenever you want to improve reliability, speed, configurability, or UI.
