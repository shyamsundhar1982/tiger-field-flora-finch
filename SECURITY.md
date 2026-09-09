# Security Policy

## Supported version

The `main` branch is the only supported production line for the VYNDI operating system. Preview and feature branches are not production releases.

## Reporting a vulnerability

Do not publish credentials, exploit details, customer data, authentication tokens, or reproducible attack payloads in a public issue.

Report security-sensitive findings privately to the repository owner or through GitHub's private vulnerability reporting feature when enabled. Include:

- affected route, component, workflow, or deployment surface;
- the observed impact;
- the minimum steps needed to reproduce the issue;
- whether the issue affects Cloudflare production, Vercel preview, Grok preview, or only local development;
- suggested remediation if known.

## Security boundaries

VYNDI treats individual authentication, role assignment, transactional authorization, database truth, audit evidence, and deployment configuration as separate control boundaries. A preview-only condition must not be treated as production authority, and planning or advisory outputs must never become transactional truth without an authorised action in the owning workspace.

## Credential handling

Do not commit production secrets, database credentials, Better Auth secrets, provider credentials, API tokens, or private keys. Deployment secrets belong in the hosting provider's protected environment configuration.
