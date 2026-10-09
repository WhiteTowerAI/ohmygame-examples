# Tidal Workshop · Game Design Document

## 1. Positioning and Current Version

A single-player browser incremental management game with light strategy and offline progress. Players turn a drifting dock into an automated harbor, craft parts from scrap, reconnect the islands, then return from voyages with permanent knowledge. Designed for desktop, tablet, mobile, and editor iframes of any size.

A playable TypeScript + Vite + Phaser + DOM implementation already exists. This expansion moves the experience from “buy machines and wait for a voyage” to “milestone rewards → tiered upgrades → production specialization → island expeditions → permanent research → voyage hexes.” An active session should last 3–8 minutes. First-voyage timing needs fresh measurement against the expanded economy; the earlier 35–55 minute estimate is no longer a verified target.

No ads, paid acceleration, stamina, mandatory connectivity, daily penalties, resource decay, or random critical hits. Expeditions and production settle deterministically. Hex offers are random, but their draw seed and candidates are saved.

## 2. Reference Research and Adaptation

Sources for this iteration were reviewed on 2026-10-07. The references inform gameplay structure; their artwork, writing, and numbers are not copied. Searchable guides are not treated as exact rules for the current versions of those games.

| Reference | Verifiable design features | Application in Tidal Workshop |
| --- | --- | --- |
| Yugong Moves Mountains / Yugong Moves Mountains 2 | Clicking starts production; facilities automate output; quantity thresholds unlock enhancements; completed mountain challenges improve production | Voyage goals offer claimable supplies; 4/12/32 machines unlock substantial upgrades; island expeditions provide research manuscripts |
| Cookie Clicker | Building counts unlock tiered upgrades, many of which double output; ascension preserves permanent growth | Each of the three machine families has three upgrades, each multiplying output or speed by ×2; voyages explicitly retain manuscripts, permanent knowledge, and hexes |
| Kittens Game | Workshop technologies alter production and functions; crafting, trade, and exploration compete for resources | Expeditions spend scrap and parts upfront, requiring a choice between current income and permanent growth; specializations trade benefits around actual bottlenecks |
| A Dark Room | A minimal opening gradually unfolds into adventure and new goals | Start with salvage/crafting/shipping; unlock islands after reaching a sales threshold; first discoveries reveal short harbor stories |

Sources:

- [4399: Yugong Moves Mountains 2 — faster population growth](https://news.4399.com/gonglue/ygys2/xinde/m/479389.html)
- [4399: Yugong Moves Mountains 2 — mountain-moving guide](https://news.4399.com/gonglue/ygys2/xinde/m/479411.html)
- [3DM: Yugong Moves Mountains — facilities and quantity upgrades](https://bbs.3dmgame.com/archiver/tid-5275868.html)
- [Cookie Clicker Wiki: Upgrades](https://cookieclicker.wiki.gg/wiki/Upgrades)
- [Cookie Clicker Wiki: Buildings](https://cookieclicker.wiki.gg/wiki/Buildings)
- [Kittens Game Official Wiki: Workshop](https://wiki.kittensgame.com/en/game-tabs/workshop)
- [Kittens Game Official Wiki: Trade](https://wiki.kittensgame.com/en/game-tabs/trade)
- [A Dark Room Official Open-Source Project](https://github.com/doublespeakgames/adarkroom)
- [Game Developer: Lessons of my first incremental game](https://www.gamedeveloper.com/design/lessons-of-my-first-incremental-game) (development lessons on discovering mechanics, play styles, and economic simulation)

Do not use invaders that destroy inventory, mandatory rapid clicking, or copied astronomical number curves. Motivate players with visible efficiency jumps, resource allocation, and gradually revealed content.

## 3. Core Experience and Loop

```text
Manual salvage → Scrap → Craft parts → Ship cargo → Coins
                   ↓           ↓                      ↓
             Voyage supplies   Island expeditions    Machine counts + tiered upgrades
                   ↓           ↓                      ↓
             Faster automation Research manuscripts   Specialize around bottlenecks
                               ↓                      ↓
                         Permanent knowledge    New waters → Lighthouse → Voyage
                               └──── Charts / Hexes ──┘
```

- Seconds: gain labels, machine motion, returning ships, and resource flights.
- Minutes: claim a goal, upgrade a machine family, send an expedition, and adjust specialization or cargo routes.
- Voyages: expand into new waters, discover islands, invest in permanent knowledge, and choose a hex.
- Long term: manuscript research, the island journal, chart multipliers, 28 hexes, and four families of resonance.

Every upgrade needs a visible change. Permanent systems must reduce repeated work on the next voyage. There is no failure state; expeditions use a dedicated explorer and never tie up the player's only cargo ship.

## 4. World, Art, and UI Principles

A bright floating miniature harbor with refined materials and an orthographic isometric view. Teal water, mint machine bodies, coral crane arms and roofs, ivory buildings, and brass rewards. Buildings and boats are independent sprites. The background contains only water and low-contrast islands; no characters, animals, or free pathfinding are required. HUD paper, metal frames, and enamel buttons use generated images, while DOM elements handle text, numbers, and controls.

The current player interface is in English, titled Tidal Workshop. The upper-left corner does not repeat the game title or region block. Navigation uses the short labels Build / Fleet / Voyage. The English presentation layer does not change save identifiers, internal state, or economic values.

The scene fills the frame. Persistent UI is limited to a compact resource bar, icon actions, the current goal, and brief feedback. Management starts collapsed; opening it reframes the scene on desktop and uses a scrollable overlay on mobile. New systems belong within the existing workshop, routes, voyages, and voyage goals rather than adding persistent panels.

## 5. Resources and Retention

| Resource / state | Source | Use | After a voyage |
| --- | --- | --- | --- |
| Scrap, parts, coins | Salvage, crafting, shipping, contracts, supplies, expeditions | Current harbor operations and expedition costs | Cleared, then starting supplies are granted |
| Current-run sales, runSales | Shipping and contract deliveries | Region unlocks and voyage reward thresholds | Reset; supplies and expedition loot do not increase sales |
| Available / lifetime charts | Voyages | Research / permanent sale-price multiplier | Retained; spending does not reduce the lifetime multiplier |
| Research manuscripts, blueprints | Voyage goals and island expeditions | Three permanent knowledge tracks | Retained |
| Hexes, island discoveries, claimed goals, knowledge levels | Exploration and management | Permanent growth and journals | Retained |
| Machine upgrades, specialization, active expedition | Investment during the current voyage | Current-run strategy | Reset; the active expedition is canceled when a voyage is confirmed |

Scrap, parts, and manuscripts are integers; coins may be fractional. UI uses K/M/B, while actual comparisons retain precision. Resources have no storage cap. Each reward must settle exactly once.

## 6. Opening and Automation

A new save starts with 0 scrap, 0 parts, and 0 coins, plus one manual workbench and one manual ship.

- Salvage: 1 scrap per action, capped at 4 actions per second for clicking and holding. Release, loss of focus, or opening a menu stops holding.
- Manual crafting: spend 4 scrap upfront to produce 1 part in 2 seconds; at most one job at a time.
- Starting shipment: spend 2 parts upfront and return with 16 coins after 8 seconds. Cargo, duration, and sale value lock at departure.
- Automatic salvager: the first costs 24 coins; cost is `ceil(24 × 1.17^n)`; baseline output is 1 scrap/second.
- Automatic press: the first costs 60 coins; cost is `ceil(60 × 1.18^n)`; baseline processing is one batch every 4 seconds, with inputs paid upfront.
- New cargo ship: the first costs 160 coins; cost is `ceil(160 × 1.20^n)`; gifted ships do not count toward the purchase exponent.
- Captain: 80 coins unlocks automatic departures. Machines stop without materials and resume when supplied; inventory never goes negative.
- ×1, ×10, and Max purchases add each unit's cost individually; each family is capped at 256.

The first-sale goal awards 24 coins, allowing the first earnings to establish a salvager. Later salvager, press, and captain rewards complete automation. Each is claimed once and is not granted again after a voyage.

## 7. Actual Production and Income

```text
rawRate = salvageCount × raw material multiplier
partRate = min(rawRate / (recipe cost - recovered scrap), pressCount / crafting cycle) × batch output
shippedPartsRate = captain ? min(partRate, boatCount × cargo / trip duration) : 0
coinRate = shippedPartsRate × trip sale value / cargo
permanent chart multiplier = 1 + 0.15 × lifetime charts
```

Modifiers combine in layers: hexes and resonance → machine upgrades → permanent knowledge → specialization → tide / tidal surge. The raw-material multiplier is not counted again in coin income. HUD rates estimate steady-state production under current conditions; manual actions, goal gifts, and expedition loot are excluded.

Without upgrades, specialization, permanent knowledge, or temporary effects, the Lighthouse Harbor snapshot with 8/6/6 machines still yields 24 coins/second, with next-unit prices of 85/162/399. Keep this snapshot as a baseline regression test.

## 8. Tiered Upgrades and Specialization

Each of the three machine families has 3 upgrade tiers. Owning 4 / 12 / 32 machines unlocks the corresponding tier; tiers must be purchased in order. Each tier doubles that family's automatic salvage output / crafting speed / cargo-ship speed, for a cumulative ×8 at tier three. Ship-speed upgrades apply only to future departures, and existing crafting jobs keep their completion times.

| Threshold | Salvager cost | Press cost | Ship cost | Label |
| --- | --- | --- | --- | --- |
| 4 machines | 180 | 260 | 420 | Boost |
| 12 machines | 1,400 | 1,800 | 2,600 | Linkage |
| 32 machines | 9,000 | 12,000 | 18,000 | Tidal core |

Upgrades appear in the existing machine rows. Before the count requirement is met, show only the next threshold. Tier emblems, brass markers, and motion communicate stronger machines in the scene without placing unlimited individual machines.

Specialization unlocks once salvagers, presses, and the captain are available. Only one is active at a time. Switching is free and changes only future production and departure parameters.

| Specialization | Benefit | Cost / characteristic |
| --- | --- | --- |
| Balanced | Baseline | No tradeoff |
| Deep dive | Salvage ×1.6 | Crafting speed ×0.85 |
| Industry | Crafting speed ×1.6 | Salvage ×0.85 |
| Trade | Sale price ×1.4, sailing speed ×1.2 | Salvage ×0.85 |
| Pioneer | Manual salvage +3, manual crafting speed ×1.8 | Benefits depend on active play |

Switching specialization does not alter prepaid recipes or batch output, preventing repeated switching from generating free resources.

## 9. Voyage Goals and Supplies

15 one-time goals unfold through manual actions, automation, upgrades, expeditions, contracts, regions, and voyages. Claimed rewards are recorded permanently. Goal rewards are supplies and do not increase runSales. Players claim completed goals manually; offline settlement does not buy anything or claim rewards.

| Goal | Requirement | Reward |
| --- | --- | --- |
| First salvage | 4 scrap, or later production has already begun | 8 scrap |
| First earnings | 16 sales | 24 coins |
| A working crane | 1 salvager | 40 coins |
| Press into service | 1 press | 60 coins |
| All hands free | Captain | 80 coins +2 manuscripts |
| Small fleet | 4 cargo ships | 160 coins |
| First upgrade | 1 upgrade | 200 coins +1 manuscript |
| Across the sea | 1 island discovered | 2 manuscripts |
| Trusted crafter | 3 contracts this run | 360 coins +2 manuscripts |
| Through the coral | Discover Coral Passage | 600 coins +2 manuscripts |
| Harbor humming | 12 presses | 1,000 coins +3 manuscripts |
| A lasting light | Discover Lighthouse Harbor | 1,600 coins +3 manuscripts |
| Wiser upon return | 1 voyage | 120 coins +4 manuscripts |
| Islands reunited | All 4 islands | 8 manuscripts |
| Beyond one sea | 3 voyages | 6 manuscripts |

The goal strip prioritizes claimable supplies. The goals dialog lists ready, unfinished, and claimed goals in that order to reduce mobile scrolling. Standard regional management goals still show progress. Old saves evaluate requirements from their actual current state, without asking players to repeat progress from zero.

## 10. Island Expeditions and Permanent Knowledge

A dedicated explorer unlocks at 96 sales in the current run. One explorer can carry out one task at a time. Dispatch spends all materials upfront, and each island requires its region and sales thresholds. There are no random failures or daily limits, and cargo ships remain available.

| Island | Region / sales | Cost: scrap / parts | Base duration | Loot: coins / scrap / parts | Manuscripts: repeat / first discovery |
| --- | --- | --- | --- | --- | --- |
| Driftwood Bay | Starting / 96 | 24 / 2 | 45 seconds | 72 / 48 / 0 | 1 / 3 |
| Gear Reef | Starting / 400 | 64 / 8 | 65 seconds | 200 / 0 / 12 | 2 / 5 |
| Sailwind Isles | Coral / 2,400 | 160 / 24 | 90 seconds | 700 / 160 / 12 | 3 / 8 |
| Beacon Ruins | Lighthouse / 14,000 | 400 / 64 | 120 seconds | 2,000 / 320 / 32 | 4 / 12 |

Repeat / first-discovery manuscript values are the total reward for that trip. Explorer duration uses the current ship-speed multiplier, with a minimum of 1/3 of the base duration. Duration, coin reward, and manuscript count lock at departure. Coin loot uses the chart and sale-price multipliers at departure, but does not count toward sales. Crafting and shipping continue during exploration. Return settles automatically; the first discovery enters the permanent journal and reveals a short story.

Permanent knowledge uses manuscripts. Each of the three tracks has 5 levels, costing 2 / 4 / 8 / 16 / 32 per upgrade.

- Engineering: each level multiplies automatic salvage, crafting speed, and sailing speed by ×1.12.
- Island alliance: each level multiplies shipping prices and contract rewards by ×1.15.
- Pioneer supplies: each level adds +1 manual salvage and 60 coins plus 16 scrap to future voyage openings.

Levels persist. Spending manuscripts does not affect other permanent multipliers. Knowledge appears on the voyage management page. Manuscripts do not enter the persistent top bar; their balance appears on the island and permanent-research pages.

## 11. Regions, Cargo Routes, Contracts, and Tides

- Coral Passage: requires 1,200 sales and costs 800 coins; standard trip value becomes 24 coins.
- Lighthouse Harbor: requires 12,000 sales and costs 6,000 coins; standard trip value becomes 32 coins.
- Cargo routes unlock at 32 sales: Coastal takes 8 seconds; Express takes 5 seconds at sale price ×0.85; Bulk takes 10 seconds and carries 2 extra parts; Premium takes 12 seconds at sale price ×1.7. Current modifiers also apply.
- Contracts unlock at 32 sales. Three material combinations pay once after their full cost is deducted. Completion generates a new set; seed, requirements, and rewards are saved. Contract coins count toward sales.
- Tides change every 60 seconds: Calm tide → Rising tide (salvage +25%) → Falling tide (sailing speed +25%).
- 16 manual salvage actions trigger a 40-second tidal surge: salvage, crafting, and sailing speed ×1.5, with related hexes able to strengthen it. Surge duration does not accumulate indefinitely and also expires offline.

## 12. Voyages, Hexes, and Chart Research

A restored lighthouse and sales ≥20,000 allow voyage confirmation. The chart reward is `floor(sqrt(runSales / 20000))`: 20K / 80K / 180K grant 1 / 2 / 3 respectively.

The confirmation dialog lists retained and reset progress. No state changes before confirmation. Confirmation cancels all active tasks, including expeditions, and grants rewards exactly once. The rebuilt harbor receives 1 salvager, 1 manual workbench, 1 ship, and 24 coins, plus Pioneer supplies bonuses.

Permanently retained: charts, the three chart technologies, hexes, region/island journals, goal records, manuscripts, knowledge, and preferences. Reset: current-run inventory, machines and upgrades, specialization, captain, sales, contracts, and active tasks.

Three chart technologies: Current studies costs 1 chart (salvage +20%); Veteran captain costs 2 charts (start voyages with a captain); Night beacon costs 3 charts (offline cap rises from 8h to 12h).

28 permanent hexes belong to Deep salvage / Precision workshop / Ocean traders / Tidal pioneers, with 7 in each family and Silver / Gold / Prismatic rarities. Each voyage draws up to 3 unowned candidates with one free reroll. Candidates and reroll usage are saved. Production freezes while a choice is pending, and the choice cannot be skipped. Supply gifts are granted only on selection. Owning 2 / 4 of a family triggers extra resonance. Voyages continue awarding charts after the full collection is complete.

## 13. Positive Feedback and Accessibility

All actual automatic output, including scrap immediately consumed by machines, triggers feedback. Do not infer gains solely from net inventory changes.

- Show each of the three resource icons and earned amount beside its corresponding facility, using a fixed 23px screen font that does not shrink with the harbor on mobile.
- Merge automatic gains of the same type roughly every 780ms and manual gains roughly every 240ms; closely spaced gains continue merging into existing labels.
- Small resource icons fly to the HUD and briefly light up the resource cell. Machines sway slightly, returning coins create brass particles, and purchases show the added quantity.
- First shipment, unlocks, surge, claimed goals, research, and first discoveries use brief reward markers. Avoid sustained full-screen white flashes or strong screen shake.
- Persistent gain labels are limited by resource type; cap flying icons at 12 and particles at 48. Prioritize and throttle sound effects; automatic salvage is quieter.
- Audio unlocks after the first input. Support mute and separate ambience/effect volumes. Actual listening quality needs device testing.
- Reduced motion keeps static gain and goal feedback while removing flights, particles, and swaying. Menus block game input; keyboard controls do not capture text fields.

## 14. Offline Progress, Saves, and Architecture

Production and expeditions share event-based time advancement. Offline settlement starts no manual jobs or expeditions and claims no goals. Expeditions already underway can complete within the offline cap; persisted results must not settle twice.

The base offline cap is 8 hours, increased to 12 hours by technology. Clamp elapsed time to 0–cap; a backward clock gives 0. Cache baseline modifiers. If inventory can pay all crafting and departure costs for an entire interval, batch it within one tide/surge phase. Complete cycles with matching production/tide phases and sufficient inventory can also be batched. Active manual jobs or expeditions use event advancement. Tasks started after phase boundaries use the new parameters, preserving online/offline equivalence.

Retain `tidal-workshop-save-v1` and schemaVersion=1. New fields in old saves default to: all refits 0, focus=balanced, empty milestones/islands, blueprints=0, all legacy levels 0, expedition=null. Validate upgrade/count thresholds, knowledge levels, discovery indices, duplicate claims, and expedition costs/rewards/time ranges.

Save every 10 seconds and after key actions. Import validates first, previews, then asks for confirmation. Reset requires a second confirmation. The economy module owns all savable state; Phaser presents the scene, and the HUD does not duplicate inventory.

## 15. Implementation and Acceptance Scope

This iteration implements playable voyage rewards, tiered upgrades for three families, five specializations, four island expeditions, and three five-level knowledge tracks while preserving hexes, tides, contracts, and voyages. Multiplayer, free construction, complex naval combat, a second prestige layer, and random disasters remain outside scope.

Acceptance requirements:

- Complete automation from zero using goal supplies. Rewards settle once, and old saves can claim goals they currently satisfy.
- Upgrade thresholds and costs are accurate; ×2 efficiency changes actual production. Switching specialization does not change payouts for ships at sea.
- Expeditions deduct the full cost upfront; insufficient materials leave state unchanged. Only one task runs at a time. Repeat/first-discovery rewards are accurate, and repeated offline loading does not duplicate them.
- Research and island discoveries survive voyages. Upgrades, specialization, and active expeditions reset. Pioneer supplies grant the correct opening resources.
- Automatic gain labels use real output. Frequent merging loses no income. Reduced motion and menus leave no lingering flights.
- Logic tests and production build pass. Real-input tests cover claiming, upgrades, specialization, expeditions, research, and voyages.
- Check screenshots, overflow, occlusion, controls, and loading errors at 320×568, 390×844, 768×1024, and 1440×900.
- First-voyage and multi-voyage timing remain future balance work. Accelerated bridge steps and simulated time do not establish human completion times.

Completed validation: 58 logic, English-text coverage, and asset-reference tests pass. Real input completed goal claims, upgrades, specialization switches, all four expeditions, permanent research, voyages, and hex selection. Nonempty scenes were checked at all four target sizes. A 12-hour simulation with 256 machines of each family, tier-three upgrades, level-five knowledge, and all hexes took approximately 0.63 seconds in one local stress check. This measures economic settlement performance, not player completion time.

Asset repairs: three six-cell source sheets for buildings, starter facilities, and the fleet were redrawn through image generation and integrated using native alpha. Cropping follows actual row and column gutters, preserving white walls, cabin roofs, rails, and the buoy's ivory stripe. Structural assets must not use white-background removal. Empty and loaded boats were inspected, and clicking the cabin completed departure and return. UI improvements include management input blocking, fixed dialog headers and close controls, keyboard scrolling of dialog bodies, and resetting scroll on tab changes. Generated sources, processing records, and runtime asset previews are in the [Visual and Asset Guidelines](tidal-workshop-art.md).

Downloadable example: obsolete source art and unused generated icons were removed, retained images were losslessly compressed to WebP without changing dimensions or visible pixels, and preview/provenance files were moved outside the published game. The English root README and `npm run example:pack` provide a self-contained source ZIP with the lockfile, tests, canvas, and referenced artwork, excluding installed dependencies, build output, and local editor records. ZIP extraction, a fresh npm install, all tests, the build, and both asset-preparation commands were verified independently. The production build was played from a nested path with touch salvage, goal claiming, crafting, and shipping; desktop/mobile screenshots retained the generated HUD materials and complete sprites.
