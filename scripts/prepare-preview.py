"""Prepare a preview-only Pages commit from the fetched gh-pages branch.

Run git fetch origin gh-pages first. This script prints a commit SHA; it does
not push. Root website files are preserved and checked before the commit.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]

def git(*args, cwd=root):
    return subprocess.check_output(['git', *args], cwd=cwd, text=True).strip()

base = git('rev-parse', 'FETCH_HEAD')
workspace = Path(tempfile.mkdtemp(prefix='position-preview-'))
checkout = workspace / 'pages'
try:
    git('worktree', 'add', '--detach', str(checkout), base)
    destination = checkout / 'preview'
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(root / 'dist', destination)
    page = destination / 'index.html'
    html = page.read_text()
    html = html.replace('<head>', '<head><meta name="position-preview" content="step-4"><meta name="robots" content="noindex,nofollow">')
    html = html.replace('<body>', '<body><div class="preview-banner"><span><strong>PREVIEW · STEP 4</strong>Mobile improvements for review. Uses separate saved holdings.</span><a href="../">Open live app ↗</a></div>')
    page.write_text(html)
    git('add', '--', 'preview', cwd=checkout)
    changes = git('diff', '--cached', '--name-only', cwd=checkout).splitlines()
    assert changes and all(path.startswith('preview/') for path in changes), 'Unexpected live file changes'
    git('commit', '-m', 'Publish Step 4 mobile preview without changing live app', cwd=checkout)
    print(git('rev-parse', 'HEAD', cwd=checkout))
finally:
    if checkout.exists():
        git('worktree', 'remove', '--force', str(checkout))
    shutil.rmtree(workspace, ignore_errors=True)
