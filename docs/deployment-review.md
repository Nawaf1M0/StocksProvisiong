# Step 6: deployment automation for review

The approved workflow is installed at `.github/workflows/deploy.yml`. GitHub Pages must use the GitHub Actions source before its deployment job can succeed. It changes the release process, not the app interface.

After activation:

1. A push to `work` that changes app or test files runs calculation tests, data tests, and JavaScript syntax checks.
2. Passing checks publish only `/preview/`. The live root is copied from the existing hosting branch and verified unchanged.
3. You review the preview link as usual.
4. To approve a live release, run the workflow on `work`, select `live`, and enter `PUBLISH`. The preview and saved-holdings storage remain separate.
5. GitHub Actions records the source commit, logs, and deployment URL. A failed check prevents publication. Failed hosting deployment can be retried from Actions.

Activation after approval: move the example to `.github/workflows/deploy.yml`, and change Settings → Pages → Source to **GitHub Actions**. Repository Actions policy must allow these actions, and the `github-pages` environment must allow deployment from `work`. No hosting settings have been changed by preparing this proposal.

The workflow saves each assembled release on `gh-pages`, so the next preview preserves the most recently approved live files. A GitHub token push does not start branch-based Pages publishing; the explicit Pages deployment job publishes the artifact. Keep the existing branch-based hosting setup until activation is ready.

Browser visual checks remain a separate review step; these automated checks validate calculations, data parsing, script syntax, and release separation.
