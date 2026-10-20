# Position

Open `dist/index.html` in a browser. No installation or account is needed.

Add your stock symbol, shares owned, average cost, new buy price, desired average, and optional purchase fee. Save each holding. Use the fixed-budget preview to compare an affordable purchase. Holdings are saved in browser local storage; export JSON backups to preserve or transfer them. Import adds holdings without replacing existing entries.

Prices are manually entered. Use one currency for all holdings; changing currency does not convert amounts. The calculator includes a flat fee for the new purchase and assumes the entered existing average already includes prior costs. Whole-share purchases round up to reach or beat the target; fractional shares can be enabled per holding.

Run calculation checks with `node test.cjs`. Run scenario interface regression checks with `npm ci --ignore-scripts` followed by `node scenarios-test.cjs` (Node 22). These load the real HTML, calculator, planner and scenario scripts in jsdom, dispatch input/click events, and check displayed results and saved-holding preservation. They do not call authentication or market-data services. Pull requests run the scenario checks without publishing; releases require the checks to pass.

## Review previews

The live app stays at the repository's GitHub Pages root. Proposed changes are published at `preview/`, marked with a banner and using `position-preview-holdings-v1` browser storage. Live storage remains `position-holdings-v1`. Preview is publicly accessible and does not copy live holdings automatically. Use Load example or import a backup to test.

To prepare preview hosting files: fetch `origin gh-pages`, then run `python scripts/prepare-preview.py`. It prints a new Pages commit SHA and checks that every changed path is under `preview/`. Push that SHA to `gh-pages`. This publishes the preview without promoting it to the live root. Promote only after review, preserving the preview folder when preparing subsequent production releases.

Step 5 adds JSON/CSV backups and imports. CSV columns are `symbol,shares,average,price,target,fee,budget,fractional,currency`; use plain decimal numbers without thousands separators and `true`/`false` for fractional. Imports validate all rows first, show an add confirmation with duplicate-symbol warnings, and reject a different currency when holdings already exist. Exports mark spreadsheet formula-like symbols as text and restore them on reimport. Backup status records generation, not proof that the browser saved the file. Deletion asks for confirmation. Test imports with `node data-test.cjs`.

