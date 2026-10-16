"""Assemble a Pages release without changing the source or published checkout."""
import argparse
import shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--published', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--mode', choices=['preview', 'live'], required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
published = Path(args.published).resolve()
output = Path(args.output).resolve()
if output.exists() or published == output or published in output.parents:
    raise ValueError('Output must be a new directory outside published files.')
shutil.copytree(published, output, ignore=shutil.ignore_patterns('.git'))
destination = output / 'preview' if args.mode == 'preview' else output
if args.mode == 'preview' and destination.exists():
    shutil.rmtree(destination)
destination.mkdir(exist_ok=True)
for file in (root / 'dist').iterdir():
    if file.is_file():
        shutil.copy2(file, destination / file.name)
if args.mode == 'preview':
    page = destination / 'index.html'
    html = page.read_text().replace('<head>', '<head><meta name="position-preview" content="review"><meta name="robots" content="noindex,nofollow">')
    html = html.replace('<body>', '<body><div class="preview-banner"><span><strong>REVIEW PREVIEW</strong>Proposed changes. Separate saved holdings.</span><a href="../">Open live app ↗</a></div>')
    page.write_text(html)
    for file in published.rglob('*'):
        relative = file.relative_to(published)
        if file.is_file() and relative.parts[0] not in ('.git', 'preview'):
            assert (output / relative).read_bytes() == file.read_bytes(), 'Live files changed'
else:
    preview = published / 'preview'
    if preview.exists():
        for file in preview.rglob('*'):
            if file.is_file():
                assert (output / 'preview' / file.relative_to(preview)).read_bytes() == file.read_bytes()
print('Release assembled:', args.mode)
