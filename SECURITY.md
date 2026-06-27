# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.4.x   | ✅        |
| < 0.4   | ❌        |

## Reporting a Vulnerability

Please **do not** report security vulnerabilities via public GitHub issues.

Instead, report them via GitHub's private vulnerability reporting:  
👉 https://github.com/oluwatosinolamilekan/fintech-fraud-sim/security/advisories/new

Or email: **oluwatosinolamilekan@gmail.com**

Include as much of the following as possible:
- Type of issue (e.g. dependency confusion, prototype pollution, code injection)
- Full paths of source file(s) related to the issue
- Steps to reproduce
- Proof-of-concept or exploit code (if possible)
- Impact of the issue

You will receive a response within **48 hours**. If the issue is confirmed, a patch will be released as soon as possible.

## Security Practices

- All npm releases are published with **provenance** (signed via Sigstore/OIDC)
- GitHub Actions are pinned to **full commit SHAs**
- Dependencies install with `--ignore-scripts` to prevent malicious install hooks
- This package generates **synthetic data only** — no real PII, credentials, or network calls
- Runtime dependencies are intentionally minimal and reviewed before release
- Published package contents are allow-listed through `package.json#files`
