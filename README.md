# Position

Open `dist/index.html` in a browser. No installation or account is needed.

Add your stock symbol, shares owned, average cost, new buy price, desired average, and optional purchase fee. Save each holding. Use the fixed-budget preview to compare an affordable purchase. Holdings are saved in browser local storage; export JSON backups to preserve or transfer them. Import adds holdings without replacing existing entries.

Prices are manually entered. Use one currency for all holdings; changing currency does not convert amounts. The calculator includes a flat fee for the new purchase and assumes the entered existing average already includes prior costs. Whole-share purchases round up to reach or beat the target; fractional shares can be enabled per holding.

Run calculation checks with `node test.cjs`.
