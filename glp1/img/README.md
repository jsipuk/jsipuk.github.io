# Guide images

The guide (`js/content.js`) references the image files below. Until a file is
present, that section gracefully shows its grey placeholder card instead of a
broken image — so missing files never break the page.

Add an image by saving it here with the **exact filename**:

| Section | Filename |
|---------|----------|
| Before You Start — Dose Ladder | `dose-ladder.png` |
| Starting Out — Injection Site Rotation Map | `injection-site-rotation.png` |
| Dose Progression — Dose Progression Tracker | `dose-progression-tracker.png` |
| Side Effects — Symptom Decision Tree | `symptom-decision-tree.png` |
| Food — Hunger Scale | `hunger-scale.png` |
| Non-Scale Victories — NSV Checklist Card | `nsv-checklist.png` |
| Plateaus — Weight Trend vs Daily Fluctuation | `weight-trend-vs-fluctuation.png` |
| Maintenance — Maintenance Planning Page | `maintenance-planning.png` |

Notes:
- PNG keeps text crisp (best for these infographics). JPG works too, but then
  update the `src` extension in `js/content.js` to match.
- Aim for roughly 1000–1600px wide.
- The "Weekly Tracker" slot is intentionally a link to the live tracker
  (`tracker.html`), not an image.
