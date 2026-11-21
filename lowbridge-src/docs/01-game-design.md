# Game design

## What you buy into

You know Lowbridge well enough to take a job. You want to know it well enough to take a better route. On the first night a crab living in a ticket machine opens a shutter. Several shifts later you recognise the same shutter mechanism during a getaway, before the game has to point it out.

The world runs in real time on foot and behind the wheel. An on-foot creature encounter pauses street simulation. Jobs, discoveries and favours all advance one save.

## Time to play

| Time available | One concrete way to play | Moment that feels finished | What you keep |
| --- | --- | --- | --- |
| 3–5 minutes | Run the ferry battery, check a reported sighting or beat your own depot-to-quay delivery. | A handover, a named guide entry or a route result. The next call waits. | The job outcome, clue, recruit or best time. |
| 20–30 minutes | Follow a linked dispatch shift. Choose a client, follow a lead, use a companion and resolve a local problem. | Stand in the street and see what you changed. | Crew trust, route access and a journal entry naming the next lead. |
| Several weeks of occasional play | Work through three districts, master a small crew of creatures and trace calls from a disconnected flood-warning line. | Finish a district case, earn a captain’s mark or fill a missing guide page. | District state, companions, marks and permanent shortcuts. |

**Continuity.** After each job the dispatch screen offers “Park up” or “Take the next call”. Parking ends the session immediately. On return, one line recalls the decision and one button resumes. Free roam remains available. Show an estimated duration before accepting each call. Shift progress also checkpoints between its jobs. Leaving for a week costs nothing. The in-world tide and clock move at named story beats.

**Example after three days away:** “You gave Mo the battery. The ferry’s running. He heard a disconnected phone ring on the slipway.” The next action reads “Inspect the slipway · about 5 min”. Derive text from saved flags.

## Driving and street rules

- Fixed north-up camera, modest look-ahead while moving, short stopping distance near points of interest. On a small screen the player should see the next junction before reaching it.
- Compare two touch presets with the same vehicle physics. A: push a thumb pad towards a screen direction, with spring-to-stop. B: left/right steering plus throttle; release throttle to slow. Give both a deliberate brake/reverse control. Walking always uses screen-relative directions. Keyboard maps to both modes and a labelled interact action.
- Drive a compact courier van or a quicker express car with a wider turning circle. Exit only when slow and a walkable exit point exists. Keep the camera steady on entry and exit. A parcel follows the courier when changing vehicles.
- Taking the express car raises one level of heat. In the first playable one patrol gives chase. Initial tune: lose line of sight for six simulation seconds to clear heat; three continuous seconds boxed in while nearly stationary counts as caught. Pause freezes both timers. Being caught returns you to the depot on foot with the van available; cargo and permanent progress survive.
- Interact while parked and on foot for phone calls, handovers, the shutter and creatures. Clear heat before starting an encounter or a handover. Always leave a legal, quiet route through a story job.
- Safe exits and collisions favour readability. Bend a wing mirror, sound a horn or slow the vehicle after a bump. Pedestrians step back on the pavement. Early builds need only a patrol and readable traffic props.

## Encounters, companions and collection

Two active companions. The starter, Wickwing, is a lantern moth that can dim its light. Clatterjack is a bottle-cap crab that can lift. A depot roster holds later recruits. Swapping the active team is free and a learned permanent shortcut stays open.

Wild encounters reward observation. A short text and sprite pose advertise intent. Players can use a companion move, offer a relevant object or leave. Opening encounter: a raised claw means “give it space”; Wickwing’s Dim calms it, then a washer recruits it. Offer the washer too early and it bounces back. A failed attempt costs one turn. The washer remains available. A recruit is a new guide page and a partner with a field ability.

**Later contest rules, first used in M3.** Each side fields one active creature at a time. A player team has two slots. Each active creature begins with three resolve. A normal action removes one opposing resolve. Brace absorbs the next normal hit for that turn; a guard-breaking move defeats Brace and removes one resolve. A swap uses the player's action. Preview the rival’s next intent. At turn start, apply any declared Brace on either side; resolve the player move, then any surviving rival’s offensive action, then expire one-turn stances. At zero resolve switch to an available companion; when none remain the contest ends. Recover at the start of the next attempt. Captains teach a pattern and can be retried immediately. Wickwing has a basic strike, so the opening captain can be beaten through timing even if the player skipped Clatterjack.

**Mastery.** A species has three authored accomplishments: recruit it, use its signature skill at a marked location, and answer a distinctive encounter or contest cue with it. The guide records each once. Completing all three unlocks one alternate technique and a visible portrait variation. The signature skill stays available. Ordinary deliveries do not grant grindable experience. The first playable implements recruitment and one field use only.

## Crews and rewards

Nell Price keeps the Night Market lit. Mo Vale runs the Ferry Crew. They need the same supplies and both believe their patch keeps the town alive. Give each its own radio voice and a recognisable place on the street.

Trust is a small signed integer for each crew, initially zero, bounded from -2 to +3. A battery handover gives the recipient +1 and the other crew -1. Their first personal dispatch opens immediately. A one-time amends job later raises the other crew by 1. Authored favours can raise standing; repeatable quick jobs only award results or guide clues specified by their definitions. At +2 a crew offers an optional favour. At -2 it refuses optional favours and offers a way back. Main cases and alternate routes remain available. The first playable needs the battery rule and the resulting call.

Your rewards are places, partners and people you can call. The core campaign needs no shop economy. A kept promise might light a market, lend you a vehicle or open a shutter for good. Repeat delivery runs can improve a personal best; a peaceful delivery and a pursuit use separate result categories.

## Screen and sound direction

Wet teal brick, amber street lamps, cream signs. A British phone box, ferry ramp, lit awning and shutter should read from their silhouettes. Vehicles show front lights and a distinct rear shape. Creature encounters switch to a large illustrated two-tone portrait. Original names, sprites, maps and music throughout.

Landscape is the driving default. Keep an accessible pause/resume screen in portrait and preserve state on rotation. Put the current job on one line, with an arrow towards its street junction. Label every touch action with the current verb. Aim for at least 48 CSS-pixel touch targets, use words or shapes alongside colour, support mute and reduced motion. A ringing phone flashes; a radio call is captioned. Respect safe-area insets. Prefer a landmark and sightline to another permanent HUD widget.
