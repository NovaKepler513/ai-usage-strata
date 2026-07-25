# Security policy

## Scope

The most important security property of AI Usage Strata is that an imported
ledger stays in the browser that imported it. The app must not upload, scan,
sync, or quietly expose ledger data.

Please report suspected disclosure risks privately rather than opening a public
issue. Examples include an accidental network request, a way for an evidence
link to execute code, an import that can leak data, or private data committed
to the repository.

## Reporting

Use GitHub's private security-advisory flow for this repository. If it is not
available, contact the repository owner through the email address listed on the
GitHub profile and include a minimal reproduction with fictional data only.

Do not attach real ledgers, screenshots containing private material, access
tokens, or local filesystem paths.

## Supported versions

Security fixes are made on the latest `main` branch. Do not rely on old local
copies for sensitive work; update from a reviewed release.
