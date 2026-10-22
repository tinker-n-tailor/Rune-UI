# Rune UI tools

The tests and the build tools of Rune UI. [MANUAL.md](MANUAL.md) lists every key and setting.

Run `npm install` once. Then `npm test` runs all the checks. GitHub runs it on every push and pull request. It runs these four commands:

1. `node tools/check-lua.js`: checks the Lua files without the game. It checks the syntax, that every global name is a Lua or UE4SS one, and that no top-level local name is declared twice. It also counts the top-level locals of each file. Lua allows 200, and a file with more does not load.
2. `node tools/check-art.js`: checks that the mod writes the pictures back byte for byte (see Art below).
3. `node tools/make-readme-txt.js --check`: fails when `RuneUI/README.txt` is out of date with the manual.
4. `node tools/run-tests.js`: runs every `tools/test-*.js` file.

## Build

- `node tools/make-readme-txt.js` writes `RuneUI/README.txt`, the README that players get inside the zip. It reads the Install, Keys and Files sections of `MANUAL.md`. Run it after you change the manual.
- `node tools/make-zip.js` builds the release zip, `RuneUI-<version>.zip`, in the repo root. The same zip goes to CurseForge and Nexus Mods. It adds `LICENSE` as `LICENSE.txt` and leaves out the `.png` files. It stops if the zip would hold a file type that CurseForge does not accept.

## Art

The pictures are in `RuneUI/Art`. `RuneUI/Art/readme.txt` keeps the folder in the zip.

CurseForge does not accept `.png` files in a Dragonwilds mod. So `RuneUI/Scripts/art.lua` holds all the pictures as base64 text, and the mod writes them back into `RuneUI/Art` when the game starts. Do not edit `art.lua` by hand. To change a picture, open an issue or send the new `.png` file.

## Mod folder

The mod finds its folder by the full path of `main.lua`, and keeps it in the global `RUNEUI_DIR`. If a file does not open through that path, the mod uses `ue4ss/Mods/RuneUI/`, counted from the folder where the game started. The log line `mod folder:` shows the path in use. `node tools/test-moddir.js` tests this.

## Tests without the game

Each `tools/test-*.js` file runs a part of the Lua against fake widgets. Run one with `node tools/test-<name>.js`.

- `test-camera.js` covers the camera rules and the crosshair; `test-cameraarm.js` the camera against a fake player.
- `test-settings.js` covers `runeui.txt` and the reading of old files. `test-profiles.js` covers loading a layout profile: a part without a row gets its starting layout. `test-layoutfile.js` covers the layout file of F9 (O and I): the export, the checks of a file from outside, and the backup. `test-layout.js` drives the position math on a 16:9 screen, a 21:9 screen and with the game's HUD scale. `test-opacity.js` covers how `apply.lua` saves and puts back the opacity of a widget that the editor or the immersive mode writes to, and that an idle step writes nothing. `test-perf.js` covers the cost by part in the perf lines.
- `test-modmenu.js` covers the Mod Menu page. It checks that the rows of `modmenu.txt` match `menurows.lua`, `mapsettings.lua`, `camerarules.lua` and `skinpanel.lua`, and that the profile row takes only 1, 2 or 3.
- `test-hints.js` fails when a hint under the selected row of F9, F5, F8 or F6 is longer than 84 characters, the room of two lines.
- `test-panels.js` covers what the four panels share (`panels.lua`), the groups and the row names of the F9 list, the Rune Skin panel and the Rune Map panel. `test-panelflow.js` loads `main.lua` and every part against stand-ins for the engine, presses the keys of the four panels, and reads the views and the saved file. It also starts once from a settings file of version 1.9.
- `test-wheels.js`, `test-wheelmeters.js`, `test-wheelbooks.js` and `test-wheelfiles.js` share one fake of the three wheels, `fake-wheels.js`. `test-wheelbooks.js` covers the spellbook diamonds in the header of Q. The last one runs the wheels with one helper file missing.
- `test-noticelook.js` covers the look of the notices against `fake-notices.js`. `fake-cachedtex.js` cuts the picture loader out of `engine.lua`'s own text for `fake-notices.js` and `fake-wheels.js`, so the tests run the real loader. `test-noticelines.js` covers the gold lines waiting for a band image with a size, and the read-only log step of the warning. `test-noticering.js` covers the ring in the warning (the ring of each need, the game's parts hidden, the fill and colours that follow the HUD ring, the cases with no HUD ring), and the see-through back and centre of every ring. `test-deathlook.js` covers the look of the death screen against a fake screen, with the real helpers of `combattext.lua`.
- Parts: each of the other `test-*.js` files covers the part of the same name, for example `test-aim.js`, `test-cooldowns.js`, `test-party.js` and `test-xp.js`.

## How a part is built

Each part of the mod is one file in `RuneUI/Scripts` with a `Tick(ctx)` or a `Scan(ctx)` and a `Forget(sameWorld)`. `main.lua` keeps them in one list (`AddPart`), and `wiring.lua` adds them to it in order, with what each one is handed. The step calls each `Tick` in that order, each widget scan calls `Scan`, and a new world calls `Forget`. A new part is one file and one `AddPart` line in `wiring.lua`.

The other files of the start (`engine.lua`, `profiles.lua`, `world.lua`, `step.lua`, `overlay.lua`, `keys.lua`) are built the same way. `main.lua` loads each one and gives it its names with `Init(ctx)`. They share the state of the editor in the table `Ed` of `main.lua`.
