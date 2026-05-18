# MyGaragePro UI preview

## My opinion (recommended direction)

Your RMS PDF is an excellent **layout reference**, not a product to copy:

| Keep from reference | Change for MyGaragePro |
|---------------------|------------------------|
| Navy left rail + orange active pill | Brand name **MyGaragePro** + tenant garage name under logo |
| KPI card row on dashboard | **Garage KPIs**: today's profit, open jobs, unpaid invoices, stock, approvals, low stock |
| White table cards + "See all" | Repair jobs, invoices, customers — your modules |
| Navy + orange chart legend | **Income vs expenses** (or module mix), not rental utilisation |
| List page: breadcrumb + actions + table | Repair jobs, customers, used cars, stock |
| Light + dark shells | Default **light** for office; system/dark optional |

**Why this works for your business:** Owners get an at-a-glance **financial health** dashboard (Option 8 pattern); desk staff get fast **dense tables** (Option 7 pattern); mechanics get a **stripped mobile** shell without the rail. Orange reads as automotive/action without looking like a consumer app; navy rail stays professional for long shifts.

**Accent alternative:** If orange feels too strong later, switch default accent to **amber-600** (`#d97706`) — same layout, slightly more "workshop". Orange is the recommended default.

## Visual assets

1. **Static mockup (AI):** [`../refs/mygaragepro-dashboard-mockup.png`](../refs/mygaragepro-dashboard-mockup.png) — dashboard screenshot-style reference.
2. **Interactive HTML:** [`mygaragepro-ui-preview.html`](mygaragepro-ui-preview.html) — open in Chrome/Safari.
   - **Dashboard** / **Repair jobs** screens
   - **Light / dark** (dark mode contrast fixed)
   - **☰** in top bar = **collapsible sidebar** (icons-only when collapsed; auto-collapsed on narrow screens)

**Open on macOS:**

```bash
open docs/design/preview/mygaragepro-ui-preview.html
```
