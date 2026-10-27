# Contributing

Use **Settings → Feedback & feature requests** in the extension or open the [GitHub form](https://github.com/rahulcv1003/fepautomation/issues/new?template=bug_report.yml).

Include the extension version, environment, steps, expected behavior, and actual behavior. Redact customer details, project identifiers, payment information, credentials, and private screenshots. Feature suggestions should explain the workflow they would improve.

For code changes, run `npm ci`, `npx playwright install chromium`, `npm run check`, and `npm test`. Keep tests on fixtures and simulated API responses. Do not introduce live payment submissions into automated checks. Discuss substantial changes in an issue before opening a pull request.
