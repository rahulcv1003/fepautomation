# Permissions

| Permission or capability | Purpose |
|---|---|
| `storage` | Save custom-field rules, profile preferences, statistics, panel size, and the dismissed release version locally. |
| FEP frontend host matches | Add the launcher, autofill controls, custom-field picker, and supported form automation to configured FEP pages. |
| Payment API host permissions | Let the background worker submit reviewed payment requests to the four configured HTTPS API hosts on port 444. |
| Existing Sunpro API permissions | Support the existing production and UAT GraphQL workflow actions. |
| Login content scripts | Observe FEP login responses for OTP assistance and fill the OTP input. |
| Localhost / 127.0.0.1 content matches | Support local form development. Direct API actions are disabled on these hosts. |

The extension does not request cookies, browsing history, all-sites access, downloads, or clipboard permissions. Feedback opens GitHub in a browser tab; it does not embed a GitHub access token. There is no remote executable code in the packaged extension.
