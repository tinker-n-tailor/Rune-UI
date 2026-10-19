# Changelog

This file lists all notable changes to Rune UI, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.14] - 2026-10-19

### Added

- A Rune Skin switch that hides the health bars over enemies.
- Numbers on the stamina bar.

### Changed

- "Health numbers" is now "Bar numbers", for the health and stamina bars.
- In immersive mode, the ammo counter shows on a swap, shot, cast or draw.
- The immersive camera moves slower between views and settles softly.
- The arrow name fades a few seconds after a swap, like the rune name.
- The crosshair setting also works with the immersive mode off.
- The install steps use the UE4SS file from Nexus.

### Fixed

- The pictures load again when the install left out the Art folder.
- A tool bar hidden on the HUD shows in the bag again.
- The tool bar goes back to its place as soon as the bag closes.
- The big map zooms one step per push of the gamepad stick.

## [1.13] - 2026-10-15

### Added

- A switch for the numbers on the health bar.
- A switch for the floating XP that game 1.0.1 added.

### Changed

- The quest tracker is the game's own tracker in the Rune UI look.
- Redesign of the wheels for game 1.0.1.
- Two more choices for "Crosshair in immersive mode": Aim + tools, and Nothing.

### Removed

- The XP numbers and Broken item warning rows in the editor (F9).

### Fixed

- Rune Map shows again in game 1.0.1.
- The immersive camera works again in game 1.0.1.
- Quest icons on the big map no longer hide under the fog.
- Fixes to the weapon aim mark.
- Fixes to the look of the death screen.
- Fixes to the health bars of nearby enemies when a world loads.
- Buff and debuff icons are easier to read by day and by night.
- A claimed bed's name no longer slows the game, worst at a crowded base.

## [1.12] - 2026-10-11

### Added

- Quest icons on the big map, coloured by the kind of quest.
- A grid in the editor (F9).
- Salvage piles on Rune Map and on the compass.

### Changed

- Redesign of the mouse pointer.
- Redesign of the buff and debuff icons.
- Redesign of the quest area marks on the big map and Rune Map.
- Small changes to the look of the spell wheel.
- The mark of an aimed spell is the gold diamond.
- The big map zooms in three steps: close, the zone and the whole map.
- Map icons show the game's pointer in place of the cross.
- In a dungeon, Rune Map is a radar with your arrow, creatures and resources.

### Fixed

- The circle of a quest area on the big map no longer blocks the mouse.
- The big map no longer slows over time while Rune Map is hidden or faded.
- The mod no longer takes more memory with every minute of play.
- The compass stutters less when it looks for creatures and resources.
- A new buff shows at once (by jonesing4space).
- Rune Map stutters less (by jonesing4space).
- A changed map setting no longer redraws the map (by jonesing4space).
- A map that fails no longer stays on the screen (by jonesing4space).
- The editor frame no longer sits too big or beside the selected part.
- Small visual fixes to the survival and buff rings.
- Small visual fixes.

## [1.11] - 2026-10-10

### Added

- A one-time notice after a fresh install: F9 moves, resizes and hides the HUD.
- A sun and moon icon for the day and night dial.

### Changed

- The mod is much lighter.
- A fresh install shows the game's combat key hints and tool wheel hint.
- Clearer names for some settings.

### Removed

- Support for old UE4SS builds: the mod needs the UE4SS experimental build.

### Fixed

- The hitches are gone.
- A long item name no longer runs out of the tool wheel.
- In immersive mode, the ring of a need at 0 no longer stays hidden.
- Small fixes.

## [1.10] - 2026-10-08

### Added

- Rune Skin panel on F5, with a switch for each redesigned part.

### Changed

- Redesign of the spell wheel.
- Redesign of the quick access wheel.
- Redesign of the emote wheel.
- Redesign of the notices.
- Redesign of the death screen.
- The F9 list is shorter and sorted into groups.
- The immersive mode settings move to the F6 panel, named Immersion mode.
- The immersive camera works with or without immersive mode.
- In immersive mode, a survival ring shows only when its need is critical.

## [1.9.2] - 2026-10-07

### Added

- A "Fastest" choice for the map setting "Drawing".

### Changed

- Rune Map is more responsive with ore, herbs and other resources.

### Fixed

- The FPS no longer drops over time with Rune Map on.

## [1.9.1] - 2026-10-06

### Changed

- The tool bar sits in the open bag with a mouse and keyboard too.
- The lock-on view is the game's own again.

### Fixed

- In immersive mode, a hidden bar no longer shows gold dust when it fills.
- The camera no longer spins when a locked-on enemy comes very close.
- The name of an enemy shows above its health bar again.
- The quest tracker, party panel and spell cooldowns recover after a failed start.
- Compass marks show when the game starts from another folder.
- The Profile row in Mod Menu ignores values other than 1, 2 and 3.

## [1.9] - 2026-10-06

### Added

- An immersive camera: a closer camera with your character on the left.
- Camera settings panel on F6.
- A "Crosshair in immersive mode" setting that can hide the crosshair dot.
- A party panel with the health of your friends in co-op.
- A switch to put the spell cooldown tiles in a row.
- A "Player name" map setting, from the idea and first code of Taylor Powell (tcpowell).
- An editor part for the cosy and sheltered notices.
- Editor parts for other big notices, the hunger, thirst and rest warning, and tutorial tips.
- The editor shows a sample of the selected notice in its place.

### Changed

- Redesign of the enemy health bars.
- Redesign of the boss bar.
- Redesign of the combat text.
- Redesign of the status words, such as Poison and Burning.
- Redesign of the mining and woodcutting numbers.
- The F9, F8 and F6 panels show the keys of the other panels.
- The spell cooldown tiles start lower, to make room for the party panel.
- The licence explains how to send a change by pull request.
- The licence forbids the publication of a fork as a mod.

### Fixed

- A finished level up no longer returns under the bars after you close F9.
- The level up row no longer jumps in size when it meets an XP notice.
- The editor panel (F9) no longer jumps while you scroll the list.
- Pictures no longer fail to load on some computers, for example after a Vortex install.
- The mod works with a lower case scripts folder.

## [1.7] - 2026-10-04

### Added

- A quest tracker under the minimap with the main quest and your tracked quest.
- A slim level up notice under the bars, in place of the game's banner.
- A quest tracker switch to show up to three next steps.
- A map setting to keep the map or the compass in immersive mode.
- Compass marks for creatures and resources while the map is hidden.

### Changed

- Redesign of the compass.
- Map settings (F8) show the value of a row between < and >.
- In immersive mode, stamina that is not full no longer brings back the bars.
- In immersive mode, a debuff shows while it lasts and a buff shows briefly.
- A new licence: still free to use, but reuploads, changed versions and reuse need permission.
- Versions 1.0 to 1.6 stay under the MIT licence.

### Removed

- The time of day icon of immersive mode.

### Fixed

- The compass no longer loses its letters when it shows after a hidden start.
- A thin pale line no longer stays in the buff row after a buff ends.
- A buff without a timer, like the weight icon, no longer stays after it ends.

## [1.6] - 2026-10-03

### Added

- Rune XP: your XP gains show under the bars, with the skill's icon.

### Changed

- Clearer names for the parts in the editor.

### Fixed

- A gamepad moves between the bag and the tool bar again.
- The menu buttons show gamepad buttons, not keyboard keys, when you play with a gamepad.
- The tool bar highlight no longer stays on the wrong slot after you change items.
- The tool bar's gold edges no longer show while the tool wheel is open.
- In the editor, the tool bar's gold edges now dim with the bar.

## [1.5] - 2026-10-03

### Added

- A Rune UI page in Mod Menu, for players who have Mod Menu.
- An editor part for the item pick-ups, apart from the notifications.
- An editor part for the death screen.

### Changed

- Redesign of the tool bar.
- Redesign of the buffs.
- Redesign of the food and potion buffs, to match the drink buff.
- Redesign of the item pick-up list.
- Redesign of the quest and unlock notices.
- Redesign of the farm plot icons and clearing panel.
- Redesign of the Rune Map rare tree mark, time of day arrow and north mark.
- The line under the bars is the gold line of the loading screen.
- The editor part "Drink buff" moves the food and potion buffs too.
- The editor frame of Quests has the width of the panel.
- Quests and unlocks stay at the right edge and move only up and down.

### Removed

- The `[menuart]` part of `runeui.txt`.

### Fixed

- The game no longer hitches every 10 seconds, even while you stand still.
- The F9 and F8 panels now show the keys you set in `runeui.txt`.
- The F9 and F8 panels no longer stay empty after an error.
- `UE4SS.log` shows each different error once in each world.
- The lock-on diamond no longer sits off the centre of the staff's target mark.
- The sample spell cooldown tiles no longer show while the map settings (F8) are open.
- An ended buff, such as poison, no longer stays with an empty bar.
- Drink, food and potion buffs are no longer cut off when you move them far.
- The name of a claimed bed no longer misses a space: "Ann's Bed Roll".

## [1.4] - 2026-10-01

### Added

- One settings file, `runeui.txt`, next to the game, that you can read and edit.
- Settings from older files carry over once.
- Five keys that you can change in the `[keys]` part of `runeui.txt`.
- The F9 and F8 panels name a part that fails and point to `UE4SS.log`.
- The editor marks a part that you moved, resized or faded.
- The editor shows the X and Y of a part.
- A held arrow key keeps moving a part.
- Three layout profiles.
- A time of day icon in immersive mode.
- Each rune icon has the colour of its rune.
- The ammo name shows next to the count.

### Changed

- Redesign of the F9 editor, with a screen map and parts grouped by area.
- Redesign of the F8 map settings panel.
- Redesign of the rune and arrow count.
- Redesign of the drink buff.
- The editor panel moves aside only when it would cover the selected part.
- The staff's target ring is always a gold diamond.
- White text with a shadow on the pick-up prompt, build panel and repair mode.
- The keys under the menu buttons are white.
- The overeating icon is in the middle of its ring.

### Removed

- The dark shape behind the build panel title.

## [1.2] - 2026-09-30

### Added

- Support for 21:9 and wider screens.
- Support for the game's HUD scale setting.
- A layout keeps its shape on a screen of another shape.
- Gold aim marks for the bow, the staff and the lock-on.
- Spell cooldown tiles that show the seconds left.
- Immersive mode: the HUD fades when nothing happens.
- Ore, herbs, rune essence and rare trees on Rune Map.
- The bag's ring shows the weight of your bag and turns red near full.
- Rune Map settings panel on F8.
- Opacity for each part in the editor.

### Changed

- Redesign of the buffs.
- Redesign of the bars.
- Redesign of the menu buttons.
- Redesign of the pick-up prompt.
- Redesign of the F9 and F8 panels.
- A gold diamond replaces the lock-on orb.
- The health bar shows no numbers.
- The mod is lighter.
- The Rune Map Creatures setting can show enemies only.
- The F9 and F8 panels open each other.
- Rune Map shows while F8 is open, also when it is hidden.
- An old layout from a wide screen can move a little once.

### Fixed

- Rune Map no longer gets slower each time you open the big map (M).
- The game no longer hitches every 2 seconds.
- On a wide screen, the level badge and bar line no longer drift away.

## [1.0.1] - 2026-09-28

### Changed

- A hidden Rune Map no longer costs FPS.
- Rune Map is lighter, for about 10 more FPS.

### Fixed

- The game no longer stutters heavily, worst on older UE4SS builds.
- The game no longer crashes after you use the F9 editor for a while.
- A hidden Rune Map no longer leaves its gold rings on the screen.

## [1.0] - 2026-09-28

### Added

- An editor on F9 that moves, resizes and hides 27 parts of the HUD.
- Rune Map, a round minimap that turns with the camera.
- Rune Map marks enemies and animals, and its ring is a clock.
- Food, water and rest rings that warn when a value is low.
- Clean health and stamina bars.
- Round buffs that show the time left.
- The rune and arrow count moves away from the crosshair.
