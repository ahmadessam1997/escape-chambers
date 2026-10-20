# Escape Chambers — ad campaign

Google Ads App campaign material for this title. Published from
`ad-campaigns/` by `distribute.js` — edit the source there, not these copies.

- Package: `com.ahmadessam.escapechambers`
- Play listing: https://play.google.com/store/apps/details?id=com.ahmadessam.escapechambers
- Google Ads account: 484-455-8362

## Campaign settings

| Setting | Value |
|---|---|
| Objective | App promotion |
| Type / subtype | App / App installs |
| Platform | Android |
| Campaign name | `Escape — App installs — Android` |
| Locations | United States and Canada |
| Languages | English |
| Bidding | Maximize installs, no target CPI until ~30 conversions |
| Daily budget | $1.10 (portfolio total $6.60/day across six campaigns) |

## Images — `images/` (8 accepted)

Upload all of them; Google picks per slot. The A/B pair of each core
ratio differ in composition and hook so asset-level reporting can tell
you which direction won.

| File | Size | Slot |
|---|---|---|
| `landscape-1200x628-a/b.png` | 1200x628 | landscape 1.91:1 |
| `square-1200x1200-a/b.png` | 1200x1200 | square 1:1 |
| `portrait-1200x1500-a/b.png` | 1200x1500 | portrait 4:5 |
| `mrec-300x250.png` | 300x250 | in-app display |
| `interstitial-320x480.png` | 320x480 | interstitial |

### `not-accepted-by-google-ads/`

`leaderboard-728x90.png` was **rejected on upload** — Google Ads returned
*"Dimensions aren't allowed"* for it while accepting the other eight. Kept
because AdMob house ads do accept that size, which becomes worth doing once
this app has traffic of its own.

## Headlines (max 30 characters)

| # | Headline | Len |
|---|---|---|
| 1 | The Room Tells You Where | 24 |
| 2 | A New Room Every Day | 20 |
| 3 | Read It, Don't Ransack It | 25 |
| 4 | Escape In A Single Move | 23 |
| 5 | Deduction, Not Pixel Hunt | 25 |

## Descriptions (max 90 characters)

| # | Description | Len |
|---|---|---|
| 1 | Most escape games make you tap everything. This one tells you where to look. | 76 |
| 2 | Three facts, one conclusion, one hiding place. Open the door in a single move. | 78 |
| 3 | A prison cell, a sealed tomb, a lighthouse lamp room. Thirty rooms, thirty worlds. | 82 |
| 4 | Switch on the UV lamp and watch the rules blaze across the chamber wall. | 72 |
| 5 | Every wasted move costs a star. Escape flawlessly and the room gives up all five. | 81 |

## Video — `video/`

Google Ads takes video only as a **YouTube URL**, never a file upload.
Upload the clip to YouTube and paste the URL into the campaign. A campaign with
no video asset is shut out of YouTube inventory.

| | |
|---|---|
| File | `video/escape-chambers-ad-upload-1.7.0.mp4` (3 Oct 2026, for v1.7.0; master `escape-chambers-ad-1.7.0.mp4`; see `AD-UPDATE-2026-10-03.md`). Previous: `video/escape-chambers-ad.mp4` |
| Spec | 1080x1920 (9:16), 48.6 s, 30 fps, H.264 + silent AAC |
| Replaces | `video/escape-chambers-demo-v1-old.mp4 (24 s)` |
| Spec source | `video-src/spec.js` |
| YouTube | `BzwPXyyBiFY` — public on the channel, served as a Short |
| In the campaign | the only video asset on ad group `203028503434` since 26 Sept 2026 (replaced `56AU3qIMrkg`); reads **Length 0:48** |
| Campaign | `24221968454` |

### What changed

The old clip was a silent screen recording with nothing explaining what any of
it was. This one is built: a phone frame, a caption band, and an arrow into a
labelled card for every feature.

Built from the **live web game** in `www/`, not a device capture. The renderer
boots a patched copy in headless Chrome, calls `ECGame.startLevel()` per scene,
and screenshots every frame with the ad overlay on top.

| Time | Scene |
|---|---|
| 0:00 | The Cell Block, then the title |
| 0:03 | **Most escape games make you tap everything** -> **this one tells you where to look** |
| 0:10 | **Three facts. One conclusion.** over The Laboratory |
| 0:16 | **Switch on the UV lamp** |
| 0:21 | **Every room, its own world** - a montage of named chambers (incl. XXIII, XXIX, XXX) and the Daily Chamber (**A new room every day**) - 1.7.0 cut |
| 0:38 | the FLAWLESS win card, five stars |
| 0:44 | end card |

The capture copy adds a `window.__EC` harness exposing `give()`, `setUV()` and a
`flawless()` that sets moves to par and calls `escape()`. That is how the five-star
card is filmed. **It is not the e2e solver** - `game.js` forbids that solver from
touching `__answers`, so "all 30 completable" keeps meaning a player could do it.
This harness only exists to film a clean run, and only in the copy.

### Rebuilding it

`video-src/spec.js` is the whole script - scenes, captions, arrow anchors (in
1080x2400 screenshot pixels) and brand colours. It renders against the shared
`appad` harness used by all four app films: headless Chrome paints each frame,
ffmpeg assembles at 30 fps.

Two things to keep in mind when editing:

- **Anchors are in screenshot coordinates**, not canvas ones. Measure on the
  1080x2400 capture and the renderer maps it through the camera.
- **Keep the camera zoom at or below ~1.06.** The phone screen and the captures
  are both 9:20, so zoom crops horizontally too; past ~1.1 it clips screen titles.
