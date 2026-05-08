# Security Policy

## Reporting a vulnerability

If you believe you've found a security vulnerability in
`parse-nested-form-data`, please report it privately. **Do not open a public
issue.**

Preferred channel:
[open a private vulnerability report](https://github.com/milamer/parse-nested-form-data/security/advisories/new)
on this repository. GitHub's private reporting flow keeps the discussion private
until a fix is ready and supports CVE assignment.

If you cannot use GitHub's private reporting, email **chris@schurr.dev** with
`[security] parse-nested-form-data` in the subject line.

When reporting, please include:

- A description of the issue and its impact
- Affected version(s)
- A minimal reproduction (PoC code, input that triggers the bug, expected vs.
  actual behavior)
- Any suggested mitigation, if you have one

You will receive an acknowledgement within a few business days. I'll keep you
updated as the fix progresses and credit you in the published advisory unless
you'd prefer to remain anonymous.

## Disclosure

Coordinated disclosure is preferred. The default window is 90 days from initial
report to public disclosure, which can be shortened if a fix ships sooner or
extended by mutual agreement.

Once a patched release is available on npm, the corresponding GitHub Security
Advisory is published so that downstream users are notified through Dependabot
and `npm audit`.

## Supported versions

Only the latest published version on npm receives security fixes.
