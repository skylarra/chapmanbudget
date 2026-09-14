# Boodget

Local-first personal budgeting as a Progressive Web App. No account, login, API, or database. Everything lives in `localStorage` on this device and works offline after the first load.

**Workflow:** Income → assign money to buckets → pay bills → record transactions → bucket balances go down → repeat.

## Pages

1. **Dashboard** — available money, Safe to Spend (with the formula shown), upcoming bills, next income, quick add
2. **Bills** — recurring and one-time bills, sorted by next due date
3. **Buckets** — expense envelopes with planned / actual / remaining for the month
4. **Savings** — goals separate from spending; transfers are not expenses
5. **Transactions** — expenses, income, and transfers with search and filters
6. **Income** — expected pay and variable actual deposits
7. **Settings** — theme, currency, download/restore JSON backup

**Budget this paycheck** is a workflow (from Dashboard or Income), not a top-level tab. Assign a deposit to bills, spending buckets, and savings, then keep the leftover unassigned.

## Safe to Spend

```
Available
− upcoming bill requirements
− planned savings contributions
− other reserved
= Safe to Spend
```

Bill funding suggestions (for example monthly × 12 ÷ 26 on a bi-weekly paycheck) are recommendations, not required allocations. Overspending is allowed and marked in red.

## Run locally

```bash
npm install
npm test
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

Install from the browser as a PWA. Download a JSON backup from Settings before clearing site data or switching devices.

GitHub Pages deploys from `main` via `.github/workflows/pages.yml`.
