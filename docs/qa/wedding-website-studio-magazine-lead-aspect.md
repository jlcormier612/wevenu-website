# Magazine lead blur on desktop / picker thumbs

**Date:** 2026-08-09  
**Symptom:** Magazine layout — big left photo looked soft/blown-out sky on setup Photo Style card and desktop Live Preview; Studio phone (stacked) looked sharp.

## Cause

Wide Mag grid stretched the lead to the full height of the support fleet (`items-stretch` + `h-full` absolute cover). With 5 supports that cell is extremely tall; `object-fit: cover` on a landscape specimen zooms into soft sky/bokeh. Phone uses Phase 3 stack + fixed `4/5`, so it stayed sharp.

## Fix

Match Editorial: lead always `aspect-ratio: 4/5`, grid `items-start`, face-safe `GALLERY_SPLIT_FACE_FOCAL`. Support fleet remains aspect-intrinsic beside/below. Mag≠Edit wide silhouette and Phase 3 mobile stack preserved.

## Spot-check

1. Setup → Photo Style Magazine card: lead subject readable (not sky mush)
2. Desktop Live Preview Magazine gallery: same
3. Studio phone Magazine: still stacked and sharp
