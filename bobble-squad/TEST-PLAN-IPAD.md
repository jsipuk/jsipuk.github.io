# Bobble Squad — iPad run-through test plan

Everything in Phase 1 was tested in a desktop browser with simulated touch.
**Nothing has ever run on an iPad.** This plan is the first real-device pass.

There are 54 checks. A full pass takes about 60–80 minutes. The 20 marked
**SMOKE** are the ones to do first — about 20 minutes on their own. If any of
those fail, stop and report, because the rest will probably fail too.

## How to run it

You do not need to write anything down. The game has a **Test Kit** built in.

1. Open the game on the iPad.
2. **Press and hold the ⏸ pause button for about 2.5 seconds.**
3. Answer the grown-up sum.
4. Tick each check off as ✓ pass / ✗ fail / – skip as you go.

Marking something ✗ automatically attaches a screenshot of exactly what was on
screen plus the last 40 things that happened. There is also a 🐞 button in the
**top-left of the play screen** for anything odd you spot that is not on the
list — press it the moment you see it, and add a note later.

Results, notes, issues, screenshots and errors all survive force-quitting the
app, so sections B, M and O will not lose anything. Frame rate and the event
log cover the current run only.

At the end, **Report → Save report** writes one self-contained HTML file to
Files. Send me that file and I will have everything.

One thing the Test Kit cannot capture: the screenshot is of the 3D world only,
because the buttons are drawn by the browser rather than the game. It records
the exact position and size of every control instead, which is enough to prove
an overlap. **If a control itself looks wrong, take a normal iOS screenshot too**
(side button + volume up) and send that as well.

The Test Kit also records, without you doing anything: frame rate and stutters,
JavaScript errors, falls and respawns, times you got stuck in one spot, times
you pressed ⭐ with nothing to press, orientation changes, and how long each
mission step took.

## Before you start

- Aeroplane mode **off** for section A, **on** for section B.
- If you have tested before, use **Start again** in the pause menu so missions
  run from the beginning.
- Section P needs an actual 5–7-year-old and is the most valuable part of the
  whole document. Do not coach them.

---

## A · Launch and install

| ID | Do this | Should happen | |
| --- | --- | --- | --- |
| A1 | Open the game's URL in Safari | Start screen appears within a few seconds; hat colours and ▶ visible | **SMOKE** |
| A2 | Share → Add to Home Screen, then launch from the icon | Opens full screen with no Safari address bar | **SMOKE** |
| A3 | Pick a hat colour, press ▶ | Game starts; you are in the square looking at the fountain | **SMOKE** |
| A4 | Look at the four corners of the screen | Nothing important sits under the rounded corners, the camera housing or the home bar | |

## B · Offline

| ID | Do this | Should happen | |
| --- | --- | --- | --- |
| B1 | Turn on Aeroplane Mode. Force-quit the game. Relaunch from the Home Screen icon | Loads and plays exactly as before | **SMOKE** |
| B2 | Still offline, play for two minutes and complete a mission step | No difference at all from being online | |
| B3 | Still offline, force-quit and relaunch | Progress is exactly where you left it | |

## C · Layout and orientation

| ID | Do this | Should happen | |
| --- | --- | --- | --- |
| C1 | In landscape, check the joystick, ⭐, ⤴, 🧱, gadgets, mission card and 🏅 counter | Nothing overlaps anything else; every button fully on screen | **SMOKE** |
| C2 | Rotate to portrait while playing | A "turn your tablet sideways" card appears; the game carries on behind it | |
| C3 | Rotate back to landscape | Controls return to the right places, nothing left stretched or off-screen | |

## D · Touch controls

| ID | Do this | Should happen | |
| --- | --- | --- | --- |
| D1 | Put a thumb down anywhere in the bottom-left quarter | The stick appears under your thumb wherever you put it | **SMOKE** |
| D2 | Walk forwards, backwards, left and right | Character moves smoothly in the direction you push, relative to the camera | **SMOKE** |
| D3 | Tap ⤴ repeatedly while walking, and just as you land | Jumps every time, including when pressed slightly early or late | |
| D4 | Walk with the left thumb while dragging the camera with the right | Both work at once, neither cancels the other | **SMOKE** |
| D5 | Walk up to a doorbell, the fountain, a bird, the buggy | The ⭐ icon changes to match, and a small icon floats over the thing | |
| D6 | Try to scroll, pinch-zoom, double-tap-zoom, or long-press for a menu | None of them happen; the page never moves | **SMOKE** |

## E · Camera

| ID | Do this | Should happen | |
| --- | --- | --- | --- |
| E1 | Drag around, look up, look down | Smooth; does not flip over or get stuck at the limits | |
| E2 | Walk in a straight line without touching the camera | Camera gently swings round behind you after about a second | |
| E3 | Walk inside the café, the shop and HQ | Camera does not end up inside a wall; if it gets close it switches to a first-person view | |

## F · Mission 1 — Wake the Fizzbots

| ID | Do this | Should happen | |
| --- | --- | --- | --- |
| F1 | Follow the bouncing arrow to all three robots and press ⭐ at each | Each giggles, turns friendly and follows you; the three pips fill in | **SMOKE** |
| F2 | Follow the arrow to the café and press the swirl on the floor | Whoosh, and you are in the underground HQ | |
| F3 | Press the glowing gift box on the bench | Confetti; the 🔎 button appears in the gadget row | **SMOKE** |

## G · Mission 2 — The Missing Slide

| ID | Do this | Should happen | |
| --- | --- | --- | --- |
| G1 | Go back up the swirl and walk to the playground | Objective changes to the magnifier | |
| G2 | Stand near the big rock in the park and press 🔎 | A ring sweeps out; a panel on the rock lights up and becomes pressable | **SMOKE** |
| G3 | Press the panel, take the swirl down, press the slide in the vault | Boots unlock, and the slide is back in the playground when you return | |

## H · Mission 3 — The Bubble Cog

| ID | Do this | Should happen | |
| --- | --- | --- | --- |
| H1 | Walk to the buggy and press ⭐ | You get in; the camera pulls back | **SMOKE** |
| H2 | Drive to the Build Yard | Steering is controllable; objective updates on arrival | |
| H3 | Get onto the tower roof (build a bridge over the gap, or bounce across) | Either route works and neither feels impossible | **SMOKE** |
| H4 | On the roof, press 🔎 then ⭐ on the crate | Crate appears, opens, confetti | |
| H5 | Return to the fountain and press ⭐ | Bubbles erupt, Grumbo turns up, 🧲 unlocks | |

## I · Gadgets

| ID | Do this | Should happen | |
| --- | --- | --- | --- |
| I1 | Press 🔎 and walk towards and away from a hidden thing | The bar meter on the right grows and shrinks; beeps speed up as you get closer | |
| I2 | Turn 🦿 on and jump; turn it off and jump | Obviously much higher with them on; the button clearly looks "on" | |
| I3 | Press 🧲 near a crate or a doorbell you cannot reach | It activates from a distance | |

## J · Vehicle

| ID | Do this | Should happen | |
| --- | --- | --- | --- |
| J1 | Drive around the streets for a minute | A child could steer this; it does not spin, flip or run away | **SMOKE** |
| J2 | Drive into walls, kerbs, lamp posts and the fountain | Soft bonk and a wobble; never stuck, never launched, never damaged | |
| J3 | Press ⭐ to get out in several different places | You always end up standing on something solid | |

## K · Building

| ID | Do this | Should happen | |
| --- | --- | --- | --- |
| K1 | Walk on and off the coloured pads in the Build Yard | The 🧱 button appears only on the pads | |
| K2 | Open build, try all three block types, place several, remove one | The ghost block shows where it will go; ＋ and － both work by touch | **SMOKE** |
| K3 | Walk out over the gap on blocks you placed | They hold you up; the bridge is level, not a staircase | |

## L · World and secrets

| ID | Do this | Should happen | |
| --- | --- | --- | --- |
| L1 | Try: trampolines, the musical steps, a doorbell, the noticeboard, the lookout lift, a bird | Every one does something immediately | **SMOKE** |
| L2 | Find at least three badges | Each gives confetti and a noise, and the counter goes up | |
| L3 | Deliberately jump off the tower, and off the map edge | Gentle whoops noise, put back on safe ground, nothing lost | |

## M · Performance and stability

| ID | Do this | Should happen | |
| --- | --- | --- | --- |
| M1 | Stand in the middle of the square with the people and robots visible and turn on the spot | Smooth; no stutter as things come into view | **SMOKE** |
| M2 | Play continuously for 20 minutes | No slowdown building up, no crash, no reload | |
| M3 | Press home, open another app, come back. Then lock the screen and come back | Game resumes, does not reload, is not stuck, sound still works | |

## N · Audio

| ID | Do this | Should happen | |
| --- | --- | --- | --- |
| N1 | Play with sound on. Mute in the pause menu. Quit and relaunch | Sounds work; mute sticks after relaunch | |
| N2 | Play a whole mission on mute | Nothing is impossible to work out without sound | |

## O · Save

| ID | Do this | Should happen | |
| --- | --- | --- | --- |
| O1 | Force-quit mid-mission and relaunch | Same mission step, same badges, same gadgets, same hat | **SMOKE** |
| O2 | Pause → Start again → confirm | Everything resets; nothing else on the iPad is affected | |

## P · With a child (the important part)

Hand the iPad over. Say nothing beyond "this is a game about a little town".
Do not point at anything. Just watch and answer these afterwards.

| ID | Question | |
| --- | --- | --- |
| P1 | Did they start moving the character within a minute, without being shown? | **SMOKE** |
| P2 | Did they work out the camera by themselves, or did they get lost facing the wrong way? | |
| P3 | Did they complete mission 1 without help? If not, where exactly did they stall? | |
| P4 | Did they wander off and explore things that were not the mission? | |
| P5 | What did they try that did not work? (Tapping the world? Tapping a robot on screen? Anything they expected to be a button?) | |

---

## If you find something without the Test Kit open

Press the 🐞 button on the play screen. It takes a screenshot there and then
and records what was happening. Add a note later from the Test Kit, or leave it
blank — the screenshot and the event log usually tell the story.

## What a useful bug report contains

The exported report already includes all of this, but if you are describing
something by hand:

1. Which check ID (or "not on the list")
2. What you did, in the order you did it
3. What happened
4. What you expected
5. Whether it happens every time or just once
6. Where in the town you were

---

*54 checks · 20 smoke · sections A–O are the software, section P is the game.*
