<h1 align="center"><img src="docs/title.gif" alt="Rune UI"></h1>

A HUD overhaul for RuneScape: Dragonwilds, in the game's own style.

Move, resize, fade or hide 35 HUD parts, and switch between 3 layout profiles, all in the game. The minimap, bars, buffs, party panel, wheels and notices have a new look. Rune UI is a UE4SS Lua mod.

<p align="center"><img src="docs/before-after.gif" alt="A gold line slides across the same screenshot: the game's own HUD on the left, Rune UI on the right"></p>

Left of the line: the game's own HUD. Right of it: Rune UI.

## Install

The CurseForge app installs UE4SS 3.0.1 for Dragonwilds. That version does not start with the game, so no mod runs. Use the newer UE4SS build from Nexus:

1. Go to the files of [UE4SS for RSDragonwilds](https://www.nexusmods.com/runescapedragonwilds/mods/4?tab=files) on Nexus.
2. Download the file "UE4SS Steam (latest)". Do not use "UE4SS stable Steam": with Rune UI, the game crashes at the main menu.
3. Open the game folder: `Steam\steamapps\common\RSDragonwilds\RSDragonwilds\Binaries\Win64`
4. In the zip, open `RSDragonwilds\Binaries\Win64`. Copy `dwmapi.dll` and the `ue4ss` folder from there into `Win64`. Replace the old files.
5. Copy the `RuneUI` folder into `Win64\ue4ss\Mods`. Keep the name `RuneUI`.
6. Start the game and press F9.

The [UE4SS experimental release](https://github.com/UE4SS-RE/RE-UE4SS/releases/tag/experimental-latest) on GitHub also works. Download the zip whose name starts with `UE4SS_v3.0.1-`, not the `zDEV` zip. Its `dwmapi.dll` and `ue4ss` folder are at the top of the zip. Then do steps 3 to 6.

Other mods that change the HUD can conflict with Rune UI.

### Rune UI does not show?

Open `Win64\ue4ss\UE4SS.log`. If it says "Fatal Error", UE4SS is the old version: do steps 1 to 4 again. The CurseForge app can put the old UE4SS back when it installs or removes a mod.

## Usage

- **F9** opens the editor: move, resize, fade or hide a part. The mod saves your layout.
- **F7** in the editor saves the layout and goes to the next of three profiles.
- **F5** opens Rune Skin, with a switch for each redesigned part.
- **F8** opens the Rune Map settings.
- **F6** opens the immersive mode settings, with the camera.

Every key and setting is in [RuneUI/README.txt](RuneUI/README.txt), also in the mod folder. The changes in each version are in [CHANGELOG.md](CHANGELOG.md).

## Features

<table>
<tr>
<td width="50%" valign="top"><img src="docs/immersive-mode.jpg" alt="Immersive mode"><br><b>Immersive mode</b><br>The HUD fades when nothing happens and comes back when you need it.</td>
<td width="50%" valign="top"><img src="docs/immersive-camera.jpg" alt="Immersive camera"><br><b>Immersive camera</b><br>A closer, over-the-shoulder camera.</td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/combat.jpg" alt="Combat text, enemy and boss bars"><br><b>Combat text, enemy and boss bars</b></td>
<td width="50%" valign="top"><img src="docs/party.jpg" alt="Party panel"><br><b>Party panel</b><br>Have fun with your friends, even the ones who are scared of the dark.</td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/buffs-cooldowns.jpg" alt="Buffs, debuffs and spell cooldowns"><br><b>Buffs, debuffs and spell cooldowns</b></td>
<td width="50%" valign="top"><img src="docs/minimap-quests.jpg" alt="Minimap and quest log"><br><b>Minimap and quest log</b></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/wheel-spell.jpg" alt="Spell wheel"><br><b>Spell wheel</b></td>
<td width="50%" valign="top"><img src="docs/wheel-quick.jpg" alt="Quick access wheel"><br><b>Quick access wheel</b></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/wheel-emote.jpg" alt="Emote wheel"><br><b>Emote wheel</b></td>
<td width="50%" valign="top"><img src="docs/death-screen.jpg" alt="Death screen"><br><b>Death screen</b></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/notice-area.jpg" alt="New area notice"><br><b>New area notice</b></td>
<td width="50%" valign="top"><img src="docs/notice-quest.jpg" alt="Quest notice"><br><b>Quest notice</b></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/farming.jpg" alt="Farming and XP"><br><b>Farming and XP</b><br>Smaller farm plot icons and a new XP bar.</td>
<td width="50%" valign="top"><img src="docs/editor.jpg" alt="The editor, F9"><br><b>The editor</b><br>F9: move, resize, fade or hide a part.</td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/map-settings.jpg" alt="The map settings, F8"><br><b>The map settings</b><br>F8.</td>
<td width="50%" valign="top"><img src="docs/camera-settings.jpg" alt="The camera settings, F6"><br><b>The camera settings</b><br>F6.</td>
</tr>
</table>

## Gallery

<p align="center"><img src="docs/gallery-1.jpg" alt="Fishing with Rune UI"></p>
<p align="center"><img src="docs/gallery-2.jpg" alt="A fight with two critical hits"></p>
<p align="center"><img src="docs/gallery-3.jpg" alt="Rune UI in the morning fog"></p>
<p align="center"><img src="docs/gallery-4.jpg" alt="The immersive camera on a sunny day"></p>
<p align="center"><img src="docs/gallery-5.jpg" alt="Rune UI on a sunny day"></p>

## Thanks

- Eravex for [Move it Move it](https://www.nexusmods.com/runescapedragonwilds/mods/208) and Mathayus for [Mini Map](https://www.curseforge.com/runescape-dragonwilds/ue4ss-mods/mini-map). Their mods gave the idea for Rune UI.
- Taylor Powell (tcpowell) for the idea and the first code of the map setting "Player name".
- jonesing4space for fixes.

## Contributing

To send a change, fork the repository and open a pull request. If the author accepts it, the change becomes a part of Rune UI. The author names you in this README and as co-author of the commit.

## License

Rune UI is free to use, and its code is open to read. You may change it and send your change to the author. You may not upload it again, publish a changed version, or use parts of it in another mod without the written permission of the author. Versions 1.0 to 1.6 stay under the MIT licence. See [LICENSE](LICENSE).

Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy. This content is not endorsed by or affiliated with Jagex.
