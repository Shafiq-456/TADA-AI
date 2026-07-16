# TADA AI — Feature Test Checklist

> Run both servers before testing: frontend on `:4001`, backend on `:8000`

---

## 🔴 Critical / Broken

- [x] **1. Profile Stats (Real Data)** ✅ FIXED
  - `Profile.tsx` now calls `/api/users/me` for real dataset/report/forecast/analyses counts
  - Shows a loading spinner while fetching; shows `0` if no data yet
  - _Test: Go to `/profile` after uploading a dataset → counts should match reality_

- [x] **2. Profile Activity Timeline (Real Data)** ✅ FIXED
  - Timeline now pulls from real `activity_timeline` returned by `/api/users/me`
  - Shows "No activity yet" empty state if the user has no logs
  - _Test: Upload a dataset, run a forecast, then visit `/profile` → timeline should list both actions_

- [x] **3. Settings → Save Changes (Persistent)** ✅ FIXED
  - All settings (notifications, AI model, Gemini API key, backend URL) are stored in `localStorage` via Zustand persist
  - Values survive page refresh and re-opening the browser
  - _Test: Go to `/settings` → API Configuration → set an API key → Save → refresh page → key still there_

- [x] **4. Settings → Account Management Buttons** ✅ FIXED
  - **Export All My Data** → downloads a `tada_export_*.json` file (datasets + reports)
  - **Download Activity Logs** → downloads a `tada_activity_logs_*.txt` file
  - **Delete Account & All Data** → requires two clicks (double-confirmation guard) before signing out
  - _Test: Click each button and verify the download / sign-out behaviour_

- [x] **5. Reports → PowerPoint Format** ✅ FIXED
  - PowerPoint button is now disabled with `cursor-not-allowed` and `opacity-40`
  - Hovering shows tooltip: "PowerPoint export coming soon"
  - No more 400 crash from the backend
  - _Test: Go to `/reports` → New Report → PowerPoint button should be greyed out and unclickable_

- [x] **6. Charts → Fullscreen Mode** ✅ FIXED
  - Uses the native browser `requestFullscreen()` API on the chart container element
  - Press `Esc` or click the icon again to exit
  - _Test: Load a dataset in `/visualizations` → hover a chart → click ⤢ → browser fullscreens the chart_

- [x] **7. Charts → Export / Download** ✅ FIXED
  - SVG from Recharts is serialized → drawn onto a canvas with dark background → downloaded as `.png`
  - Filename is `{ChartTitle}_chart.png`
  - _Test: Load a dataset in `/visualizations` → hover a chart → click ↓ → PNG downloaded_

---

## 🟡 Partially Wired / Fallback-Only

- [ ] **8. Executive Insights → Uses AI (not just heuristics)**
  - Set `GROQ_API_KEY=your_key` in `tada-backend/.env` then restart the backend
  - Go to `/insights`, select a dataset, click Generate
  - SWOT should be richer and dataset-specific vs. generic heuristic output
  - _No code change needed — purely a configuration step_

- [x] **9. Reports list — No fake sample data** ✅ FIXED
  - Fake `sampleReports` array completely removed
  - Shows proper empty state card ("No reports yet") when list is empty
  - Generate errors now show a real error toast instead of inserting a phantom report
  - _Test: Go to `/reports` before generating anything → should see empty state, not 3 fake entries_

- [x] **10. Heatmap & Boxplot chart tabs** ✅ FIXED
  - Two new tabs added: 🌡️ Heatmap and 📦 Box Plot
  - Heatmap renders a CSS-grid correlation matrix (purple = positive, pink = negative)
  - Boxplot renders IQR bars with a median line for up to 4 numeric columns
  - Backend already returned this data — the tabs were just missing from the UI
  - _Test: Load a dataset with multiple numeric columns in `/visualizations` → select Heatmap or Box Plot_

---

## 🟢 Cleanup / Dead Code

- [x] **11. `_stubs.py` removed** ✅ DONE
  - `tada-backend/app/routes/_stubs.py` deleted — was dead code never imported

- [x] **12. `capture_preview.py` removed** ✅ DONE
  - `tada-backend/capture_preview.py` deleted — orphaned dev script

---

## 🔵 Future / Out of Scope

- [ ] **13. Google OAuth**
  - Full Supabase Google provider configuration required
  - The `/auth/callback` route and sign-in button already exist in the UI

---

## Summary

| Priority | Fixed | Remaining |
|----------|-------|-----------|
| 🔴 Critical | 7 / 7 | 0 |
| 🟡 Partial | 2 / 3 | 1 (GROQ config) |
| 🟢 Cleanup | 2 / 2 | 0 |
| 🔵 Future | 0 / 1 | 1 (OAuth) |

*Last updated: 2026-06-28*
