# Release checklist

Run this checklist before a public push, tag, ZIP, or screenshot pack.

1. Work in a fresh repository with no private project history.
2. Confirm the sample ledger is fictional and no user export is staged.
3. Run the disclosure and local-link audit:

   ```bash
   python3 scripts/release_audit.py
   ```

4. Add your own private project names as local-only audit terms, then run it
   again. Keep that terms file outside the repository.
5. Inspect `git status --short` and `git diff --cached --name-only` before the
   first commit. No export, browser cache, secret, or local data file belongs
   in the release.
6. Check that the commit identity is a deliberate public identity, not an
   automatic global Git setting.
7. Start the local launcher, verify the empty first-run state, direct entry with a date and hours only, CSV/TSV conversion, template download, JSON import, current-ledger download, the visible loading copy when loading and leaving the fictional example, and the Reference period shortcut if the ledger contains one.
8. Verify that clearing a real ledger asks for confirmation, and that evidence without a safe `http` or `https` URL stays readable but is not rendered as a link.
9. Check both 中文 and English in the language switch. New visible interface
   copy belongs in `assets/i18n.js`; do not add one-language-only controls or
   explanatory text.
10. After publication, clone the remote repository into a new folder and repeat
   the audit there. A local draft is not proof of what was published.
11. If GitHub Pages is enabled, inspect the deployed URL in both languages and
    confirm that importing a ledger still stays in that browser only.

Before the first public push, confirm which GitHub account or organisation will
be shown as the repository owner. The commit author can be a pseudonym, but the
repository owner is always visible on GitHub.
