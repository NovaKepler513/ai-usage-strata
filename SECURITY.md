# Security policy

## Scope

The most important security property of AI Usage Strata is that an imported
ledger stays in the browser that imported it. The app must not upload, scan,
sync, or quietly expose ledger data.

Please report suspected disclosure risks privately rather than opening a public
issue. Examples include an accidental network request, a way for an evidence
link to execute code, an import that can leak data, or private data committed
to the repository.

## AI-assisted ledger preparation

The app can generate a task guide for Codex, Claude Code, or another AI, but
it does not connect to those products. There are no embedded provider tokens,
account links, APIs, or remote agents in this repository.

If a user gives a local coding AI access to a folder, that permission is
between the user and the AI environment. The app must never claim to grant,
verify, extend, or observe it. The supported local-write pattern is deliberately
narrow: the AI reads an explicitly named scope, writes only
`ai-usage-ledger.json`, and creates a `.bak` copy before replacing it.

Do not propose automatic chat scraping, browser-profile access, credential
collection, or arbitrary filesystem scanning as an integration. A cloud AI must
be treated as able to use only material the user deliberately uploads or pastes.

## Reporting

Use GitHub's private security-advisory flow for this repository. If it is not
available, contact the repository owner through the email address listed on the
GitHub profile and include a minimal reproduction with fictional data only.

Do not attach real ledgers, screenshots containing private material, access
tokens, or local filesystem paths.

## Supported versions

Security fixes are made on the latest `main` branch. Do not rely on old local
copies for sensitive work; update from a reviewed release.
