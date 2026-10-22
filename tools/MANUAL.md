# Rune UI manual

Every key and setting of Rune UI. `tools/make-readme-txt.js` builds `RuneUI/README.txt` from Install, Keys and Files.

## Install

The CurseForge app installs UE4SS 3.0.1, which does not start with the game. Use the newer UE4SS build from GitHub:

1. Go to the UE4SS experimental release on GitHub: [https://github.com/UE4SS-RE/RE-UE4SS/releases/tag/experimental-latest](https://github.com/UE4SS-RE/RE-UE4SS/releases/tag/experimental-latest)
2. Download the zip whose name starts with `UE4SS_v3.0.1-`, not the `zDEV` zip.
3. Open the game folder: `Steam\steamapps\common\RSDragonwilds\RSDragonwilds\Binaries\Win64`
4. In the zip, copy `dwmapi.dll` and the `ue4ss` folder into `Win64`. They are at the top of the zip. Replace the old files.
5. Copy the `RuneUI` folder into `Win64\ue4ss\Mods`. Keep the name `RuneUI`.
6. Start the game and press F9. After a fresh install, a hint about F9 shows once, in the first world.

Mods that change the HUD can conflict with Rune UI.

If you used HudEditor before version 0.60, remove the `HudEditor` folder and the `HudEditor : 1` line in `mods.txt`.

**Rune UI does not show?**

Open `Win64\ue4ss\UE4SS.log`. If it says "Fatal Error" or "timer: old UE4SS", do steps 1 to 4 again. The CurseForge app can put the old UE4SS back when it changes a mod.

## Keys

F9 opens the layout editor. It moves, resizes and hides the parts of the HUD.

| Key | Action |
| --- | --- |
| PgUp, PgDn | select an element |
| Arrows | move it |
| Home, End | change the move step (1 to 100) |
| + / - | change the size by 5% |
| , / . | change the opacity by 10% (100% to 20%) |
| Delete, Insert | hide, show it |
| Backspace | reset it |
| G | hide, show the grid |
| O | export: save the layout of the profile in use to `runeui-layout.txt` |
| I | import: load `runeui-layout.txt` into the profile in use |
| U | pick the folder of `runeui-layout.txt`: Desktop, game folder or own folder |
| F7 | save, go to the next profile (1, 2, 3) |
| F5 | Rune Skin |
| F8 | Rune Map settings |
| F6 | immersive mode settings |
| F9 | save and close |
| ] / [ | zoom Rune Map in / out (also outside it) |

A layout that hid the group of all notices in an older version has the row "All notices (group)". Press Insert on it to show the notices again.

**Share a layout**

O makes `runeui-layout.txt` on your Desktop. It holds the layout of the profile in use: the place, size, opacity and switch of each part, and the immersive wait time. It holds no other setting. A message in the F9 panel says that it worked, and where the file is.

To use a layout from another player:

1. Put `runeui-layout.txt` on your Desktop.
2. Open F9 and pick the profile with F7. The import replaces the layout of this profile.
3. Press I.

The old layout of the profile goes to `runeui-layout-backup.txt`, in the same folder. To get it back, rename that file to `runeui-layout.txt` and press I again. A file that is not a Rune UI layout changes nothing.

U in F9 picks the folder for both files: Desktop (at first) or the game folder (`Win64`). To use a folder of your own, open `runeui.txt` and add a line under `[general]`, for example `layoutpath = D:\Games\Layouts`. Then U also offers Own folder.

Rune Skin (F5), Rune Map settings (F8) and immersive mode settings (F6):

| Key | Action |
| --- | --- |
| Up, Down | select a setting |
| Left, Right | change it |
| Backspace | reset the settings of the panel |
| ] / [ | zoom Rune Map |
| F9 | go to the layout editor |
| F5, F8, F6 | save and close |

| Rune Skin switch | What it does |
| --- | --- |
| Wheels | Spell, item and emote wheels as rings. Off: the game's wheels. On at first. |
| Combat text | Bigger damage numbers. On at first. |
| XP under the bars | XP bar under the bars. Off: the game's XP circle. On at first. |
| Floating XP | The game's XP over a hit enemy. Off at first. |
| Enemy health bars | The health bars over enemies. On at first. |
| Small level up notice | Level up under the bars. Off: the game's banner. On at first. |
| Gold crosshair and lock-on | Gold aim marks. On at first. |
| Day and night icon | The day and night dial as a sun and moon icon. Off: the game's dial. On at first. |
| Game icons beside the bars | Shows them. Off at first. |
| Bar numbers | Numbers on the health and stamina bars. Off at first. |
| Party numbers | Each friend's health in a taller party bar. A value that looks wrong shows as a percent. Off at first. |
| Spell cooldowns in a row | Tiles in a row. Off at first. |

| Rune Map setting | What it does |
| --- | --- |
| Rune Map | Off: no map. |
| Faces north | On: north stays at the top. |
| North mark | A mark shows north. |
| Player name | Off: hides your name on the maps. |
| Creatures | All, Enemies only (at first), Off. |
| Ore, Herbs, Essence, Rare trees, Salvage | A map mark for each. On at first. |
| Keep in immersive mode | What stays: Nothing (at first), Map or Compass. |
| Zoom | Same as [ and ]. |
| Map refresh | Every 2nd frame (at first). Every frame: smoother. Every 4th frame: lightest. |

| Immersive mode setting | What it does |
| --- | --- |
| Immersive mode | On: the HUD fades when nothing happens. Off at first. |
| Wait before the fade | 3 to 30 s, 8 at first. |
| Crosshair | Show (at first), Aim + tools (the dot while you aim, build or hold a tool), Aim only (the dot while you aim) or Nothing (no dot). |
| Immersive camera | On: a closer camera, with or without immersive mode. Off at first. |
| Walk distance | 100 to 1500 cm, 300 at first. |
| Side offset | 0 to 200 cm, 90 at first. |
| Sprint distance | 100 to 1500 cm, 900 at first. |
| Melee distance | 100 to 1500 cm, 200 at first. |
| Ranged distance | 100 to 1500 cm, 500 at first. |
| Hold after a fight | 0 to 30 s, 8 at first. |

In immersive mode, a survival ring shows while its need is orange or red, and for a moment when it fills.

Other parts:

| Part | What it does |
| --- | --- |
| Enemy and boss bars | One colour. Always on. |
| Quest tracker | The game's own tracker in the Rune UI look: no dark band, the quest in gold, the steps in white. Under Rune Map at first. |
| Day and night dial | Hidden at first, as the ring of Rune Map is the clock. Show it in F9 to see the time as an icon. |
| Party panel | Friends in co-op. On at first. |
| Arrow and rune count | The count only. The crosshair stays. |
| Level badge and avatar.png | Put `avatar.png` in the `RuneUI` folder for your picture. |
| Gamepad | Buttons in menus. |
| Mouse pointer | A gold arrow in the menus and on the big map. |
| Big map | A quest area is a faint circle with a shield. The mouse goes through the circle. The wheel zooms in three steps. |

Mod Menu page: press Esc, MODS, Rune UI. It holds the keys and the settings of the four panels.

## Files that the mod writes (in `Win64`)

- `runeui.txt`: Every setting; delete a line to get its default.
- `runeui-layout.txt`: The layout of one profile, written by O in F9 and read by I. On the Desktop at first (U).
- `runeui-layout-backup.txt`: The layout that the last I replaced, next to `runeui-layout.txt`.
- `ue4ss/Mods/RuneUI/Art`: The pictures, written when one is missing or changed.
- `ue4ss/Mods/RuneUI/config.txt`: With Mod Menu, the copy of the page settings; do not edit it.

Change seven keys in the `[keys]` part of `runeui.txt`: `editor` (F9), `skin` (F5), `map` (F8), `camera` (F6), `profile` (F7), `zoomin` (]) and `zoomout` ([). A key is F1 to F12, a letter, a digit, Insert, Delete, Home, End, PgUp, PgDn, [ or ]. A changed key works after a restart.

The mod does not use the network and does not start other programs.
