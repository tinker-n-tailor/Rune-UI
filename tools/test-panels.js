// Tests the four panels without the game: what they share (panels.lua: the links in the head, the lines of a list that
// fit, the order of the F9 list), the groups and the row names of elements.lua, the Rune Skin panel (skinpanel.lua) and
// the Rune Map panel (mappanel.lua). It also reads overlay.lua, keys.lua, editor.lua and modmenu.txt as text for the parts that need
// the game to run. The F6 panel is in test-camera.js.
// Needs npm install once. Run: node tools/test-panels.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'RuneUI');
const read = f => fs.readFileSync(path.join(dir, 'Scripts', f), 'utf8').replace(/\r\n/g, '\n');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const set = (name, text) => { lua.lua_pushstring(L, to_luastring(text)); lua.lua_setglobal(L, to_luastring(name)); };
for (const f of ['panels', 'elements', 'layout', 'skinpanel', 'mappanel', 'camerarules', 'overlay', 'keys', 'editor']) set(f.toUpperCase(), read(f + '.lua'));
set('MODMENU', fs.readFileSync(path.join(dir, 'modmenu.txt'), 'utf8'));
const editorCounts = read('editor.lua').match(/M\.ROWS, M\.BOXES, M\.KEYS, M\.CAPS = (\d+), (\d+), (\d+)/) || [];
const setNumber = (name, n) => { lua.lua_pushinteger(L, n); lua.lua_setglobal(L, to_luastring(name)); };
setNumber('EDROWS', Number(editorCounts[1]));   // list lines of a panel, and key cells
setNumber('EDKEYS', Number(editorCounts[3]));
setNumber('EDITROWS', Number((read('editor.lua').match(/M\.EDIT_ROWS = (\d+)/) || [])[1]));   // list lines of F9

const test = `
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local P, Data, Layout = load(PANELS)(), load(ELEMENTS)(), load(LAYOUT)()
local Elements, Defaults, Groups = Data.List, Data.Defaults, Data.Groups
Layout.Init(Elements)
local ById = Layout.ById
-- as main.lua starts them
for _, E in ipairs(Elements) do E.Visible = (Defaults[E.Id] or {}).Visible ~= false end

---------------------------------------------------------------- the links in the head
local KEY = { editor = "F9", skin = "F5", map = "F8", camera = "F6" }
local function Links(mode) local out = {} for _, l in ipairs(P.Links({ Mode = mode }, KEY).Links) do out[#out + 1] = l[1] .. " " .. l[2] end return table.concat(out, ", ") end
check("F9 names Rune Skin and its key, then the other two", Links("edit") == "Rune Skin F5, Rune Map F8, Immersive mode F6")
check("F5 names the other three", Links("skin") == "Layout F9, Rune Map F8, Immersive mode F6")
check("F8 names the other three", Links("map") == "Layout F9, Rune Skin F5, Immersive mode F6")
check("F6 names the other three", Links("camera") == "Layout F9, Rune Skin F5, Rune Map F8")
KEY.skin = "F4"   -- a player changes it in the keys of runeui.txt
check("a changed key shows as bound", Links("edit") == "Rune Skin F4, Rune Map F8, Immersive mode F6")
KEY.skin, KEY.camera = "F5", nil
check("a panel that did not load has no key and no line", Links("edit") == "Rune Skin F5, Rune Map F8")
KEY.camera = "F6"
check("three lines at most, as editor.lua draws", EDITOR:find("for i = 1, 3 do U.Links[i]", 1, true) ~= nil and #P.LIST == 4)

---------------------------------------------------------------- the lines of a list that fit
local function Lines(n, sel, heads)
    local out = {}
    for i = 1, n do out[i] = { Text = "r" .. i, Sel = i == sel, Head = heads and heads[i] or nil } end
    return out
end
local function Shown(lines, max) local out = {} for _, l in ipairs(P.Window(lines, max)) do out[#out + 1] = l.Text end return table.concat(out, " ") end
check("a short list shows whole", Shown(Lines(4, 2), 10) == "r1 r2 r3 r4")
check("a long list starts at the top with the first row selected", Shown(Lines(14, 1), 5) == "r1 r2 r3 r4 r5")
check("the selected row is in the middle when it can be", Shown(Lines(14, 7), 5) == "r5 r6 r7 r8 r9")
check("the last row selected: the list ends on it", Shown(Lines(14, 14), 5) == "r10 r11 r12 r13 r14")
check("a group title on the last line is cut", Shown(Lines(14, 3, { [5] = true }), 5) == "r1 r2 r3 r4")
check("no selected row: from the top", Shown(Lines(14, 0), 5) == "r1 r2 r3 r4 r5")
check("an empty list is safe", #P.Window({}, 5) == 0)
check("overlay.lua shows every panel through it, with the links", OVERLAY:find("v.Rows = Panels.Window(v.Rows, v.Lines or Editor.ROWS)", 1, true) ~= nil
    and OVERLAY:find("Editor.Update(Panels.Links(v, KEY))", 1, true) ~= nil)
-- F9: Export, Import and the folder of the file come right before Save, close. The panel has a cell for each key. With a sixth line of keys its list is a line
-- shorter, as a screen of 1080 units does not hold more.
local legend = OVERLAY:match("local function EditKeys%(%).-\\nend")
local _, legendKeys = legend:gsub('{ { ', "")
check("F9 legend: O Export, I Import and U with the folder of the file come right before Save, close", legend:find('{ { "G" }, "Grid" }, { { "O" }, "Export" }, { { "I" }, "Import" },\\n        { { "U" }, "File: " .. Prof.PlaceLabel() }, { { KEY.editor }, "Save, close" }', 1, true) ~= nil)
check("F9 legend: the panel has a cell for every key, two to a line", legendKeys == 12 and EDKEYS >= legendKeys and EDKEYS % 2 == 0)
check("F9 list: a line shorter than the other panels", EDITROWS == EDROWS - 1 and OVERLAY:find("Lines = Editor.EDIT_ROWS", 1, true) ~= nil)
check("F9 list: the selected row stays in the shorter list", (function()
    for sel = 1, 14 do
        local seen = false
        for _, r in ipairs(P.Window(Lines(14, sel), EDITROWS)) do if r.Sel then seen = true end end
        if not seen then return false end
    end
    return true
end)())

---------------------------------------------------------------- the F9 list: groups and names
local order, groupOf = P.Order(Elements, Groups)
local function Rows(name) local out = {} for _, i in ipairs(order) do if groupOf[i] == name then out[#out + 1] = Elements[i].Name end end return table.concat(out, " | ") end
local names = {}
for _, g in ipairs(Groups) do names[#names + 1] = g.Name end
check("six groups, by what the part is", table.concat(names, " | ") == "Bars and status | Combat | Map and time | Quests and friends | Notices | Menus and prompts")
check("Bars and status", Rows("Bars and status") == "Health, stamina and shield bars | Level badge | Weapon effect | Area effects (Scorch, Imarus) | Survival rings | Food, water and potion buffs | Buffs and debuffs | Arrow and rune count | XP circle")
check("Combat", Rows("Combat") == "Tool bar | Spell cooldowns | Combat key hints | Tool wheel hint")
check("Map and time", Rows("Map and time") == "Rune Map | Compass | Day and night dial")
check("Quests and friends", Rows("Quests and friends") == "Quest tracker | Party panel")
check("Notices", Rows("Notices") == "Level up notice | New area notice | Other big notices | Quests and unlocks | Picked-up items | Tutorial tips | Status notices (cosy, sheltered) | Survival warning | Armor damage warning | Title banner | Saving icon | Death screen")
check("Menus and prompts", Rows("Menus and prompts") == "Menu icons | Menu shortcuts | Interaction prompts")
local listed, twice, switchInList, missing = {}, {}, {}, {}
for _, g in ipairs(Groups) do
    for _, id in ipairs(g.Ids) do
        if listed[id] then twice[#twice + 1] = id end
        listed[id] = true
        if not ById(id) then missing[#missing + 1] = id elseif Layout.IsSwitch(ById(id)) then switchInList[#switchInList + 1] = id end
    end
end
local noRow = {}
for _, E in ipairs(Elements) do if not Layout.IsSwitch(E) and not listed[E.Id] then noRow[#noRow + 1] = E.Id end end
check("every element with a place on the screen is in one group: " .. table.concat(noRow, " ") .. table.concat(twice, " ") .. table.concat(missing, " "), #noRow == 0 and #twice == 0 and #missing == 0)
check("no switch has a row in F9: " .. table.concat(switchInList, " "), #switchInList == 0)
check("the group of all notices has no row", (function() for _, i in ipairs(order) do if Elements[i].Id == "notify" then return false end end return true end)())
ById("notify").Visible = false
local hidden = P.Order(Elements, Groups)
check("a saved layout that hid the group: its row shows, first under Notices, so the player can show it again", #hidden == #order + 1
    and (function() for n, i in ipairs(hidden) do if Elements[i].Id == "notify" then return Elements[hidden[n + 1]].Id == "levelup" end end end)())
ById("notify").Visible = true
check("the group keeps its place in the settings file and its starting move", ById("notify") ~= nil and Defaults.notify.Y == -20)
check("overlay.lua builds the list from the groups when the editor opens", OVERLAY:find("M.Order, GroupOf = Panels.Order(Elements, Groups)", 1, true) ~= nil)

---------------------------------------------------------------- Rune Skin (F5)
local Skin = load(SKINPANEL)()
Skin.Attach(ById, Defaults)
local skinNames, notSwitch, inSkin = {}, {}, {}
for _, r in ipairs(Skin.ROWS) do
    skinNames[#skinNames + 1] = r.E and r.E.Name or "?"
    inSkin[r.Id] = true
    if not (r.E and Layout.IsSwitch(r.E)) then notSwitch[#notSwitch + 1] = r.Id end
end
check("the twelve rows, as decided", table.concat(skinNames, " | ") == "Wheels | Combat text | XP under the bars | Floating XP | Enemy health bars | Small level up notice | Gold crosshair and lock-on | Day and night icon | Game icons beside the bars | Bar numbers | Party numbers | Spell cooldowns in a row")
check("every row is a switch of the layout: " .. table.concat(notSwitch, " "), #notSwitch == 0)
local others = {}
for _, E in ipairs(Elements) do if Layout.IsSwitch(E) and not inSkin[E.Id] then others[#others + 1] = E.Id end end
table.sort(others)
check("the other two switches live in F8 (creatures) and F6 (immersive)", table.concat(others, " ") == "creatures immersive")
local v = Skin.View(KEY, nil)
check("the view: title, the name line, a value on every row, a hint", v.Mode == "skin" and v.Title == "RUNE SKIN" and v.Name == "Wheels:  On" and #v.Rows == 12
    and v.Rows[1].Sel and v.Rows[1].Note == "On" and v.Rows[4].Note == "Off" and v.Rows[5].Note == "On" and v.Rows[8].Note == "On" and v.Rows[9].Note == "Off" and v.Rows[10].Note == "Off" and v.Rows[11].Note == "Off" and v.Rows[12].Note == "Off" and v.Hint == Skin.ROWS[1].On)
check("the view: its keys name F9 and F5 and fit the panel", v.Keys[4][1][1] == "F9" and v.Keys[5][1][1] == "F5" and #v.Keys <= 8)
local before = Skin.State()
Skin.Change(1)
check("left or right switches the look off, in the layout's element", ById("wheels").Visible == false and Skin.LayoutDirty == true and Skin.State() ~= before)
check("the hint follows the value", Skin.View(KEY).Hint == Skin.ROWS[1].Off and Skin.View(KEY).Name == "Wheels:  Off")
Skin.Change(-1)
check("and on again", ById("wheels").Visible == true)
Skin.Pick(-1)
check("up from the first row goes to the last", Skin.Sel == 12)
Skin.Change(1) Skin.Pick(1)
check("down from the last goes to the first", Skin.Sel == 1 and ById("cdhoriz").Visible == true)
ById("combattext").Visible, ById("baricons").Visible, Skin.LayoutDirty = false, true, false
Skin.Reset()
check("Backspace: every row back to its starting value", ById("combattext").Visible == true and ById("baricons").Visible == false and ById("cdhoriz").Visible == false
    and ById("wheels").Visible == true and Skin.LayoutDirty == true)
check("a row touches nothing but the switch: the saved keys stay", ById("runexp").Id == "runexp" and ById("slimlevel").Id == "slimlevel" and ById("aim").Id == "aim")

---------------------------------------------------------------- Rune Map (F8)
local Map = load(MAPPANEL)()
local zooms, resets = 0, 0
local RuneMap = { Set = { Map = true, North = false, Mark = true, Name = true, Ore = true, Herbs = true, Essence = true, Trees = true, Salvage = true, Neutral = false, Immersive = "Nothing", Smooth = false, Fastest = false },
    ZoomLevel = function() return 2 end, ZoomBy = function() zooms = zooms + 1 end, Reset = function() resets = resets + 1 end, Dirty = false }
local C = ById("creatures")
check("with no map (runemap.lua did not load) the panel still draws", (function() local ok, view = pcall(Map.View, KEY, nil) return ok and #view.Rows == 15 end)())
Map.Change(1) Map.Reset()
check("and its keys do nothing", C.Visible == true)
Map.Attach({ RuneMap = RuneMap, Creatures = C, Stay = { "Nothing", "Map", "Compass" }, Drawing = { "Every frame", "Every 2nd frame", "Every 4th frame" } })
KEY.zoomin, KEY.zoomout = "]", "["
v = Map.View(KEY, nil)
local texts = {}
for _, r in ipairs(v.Rows) do texts[#texts + 1] = (r.Head and "[" .. r.Text .. "]" or r.Text) end
check("the rows and the two group titles", table.concat(texts, " | ") == "Rune Map | Faces north | North mark | Player name | [What the map shows] | Creatures | Ore | Herbs | Essence | Rare trees | Salvage | [Behaviour] | Keep in immersive mode | Zoom | Map refresh")
check("the view: title, name line, values", v.Mode == "map" and v.Title == "RUNE MAP" and v.Name == "Rune Map:  On" and v.Rows[1].Note == "On" and v.Rows[6].Note == "< Enemies only >"
    and v.Rows[11].Text == "Salvage" and v.Rows[11].Note == "On"
    and v.Rows[13].Note == "< Nothing >" and v.Rows[14].Note == "< 100% >" and v.Rows[15].Note == "Every 2nd frame")
Map.Change(1)
check("the first row switches the map", RuneMap.Set.Map == false and RuneMap.Dirty == true)
Map.Change(1)
Map.Sel = 5 Map.Change(1)
check("Creatures: Enemies only, then Off, in the layout's switch", C.Visible == false and Map.Value(5) == "Off")
Map.Change(1)
check("Creatures: then All", C.Visible == true and RuneMap.Set.Neutral == true and Map.Value(5) == "All")
Map.Change(-1) Map.Change(-1)
check("Creatures: and back", C.Visible == true and RuneMap.Set.Neutral == false)
Map.Sel = 10 Map.Change(1)
check("Salvage: the row switches its group off", RuneMap.Set.Salvage == false and Map.Value(10) == "Off")
Map.Change(1)
Map.Sel = 11 Map.Change(1) Map.Change(1)
check("Keep in immersive mode: Nothing, Map, Compass", RuneMap.Set.Immersive == "Compass" and Map.Hint(11, "Compass", KEY) ~= "")
Map.Sel = 12 Map.Change(1)
check("Zoom zooms", zooms == 1)
Map.Sel = 13 Map.Change(1)
check("Map refresh: Every 2nd frame, then Every 4th frame", RuneMap.Set.Fastest == true and Map.Value(13) == "Every 4th frame")
Map.Change(1)
check("Map refresh: then Every frame", RuneMap.Set.Smooth == true and RuneMap.Set.Fastest == false and Map.Value(13) == "Every frame")
Map.Change(1)
check("Map refresh: and back to Every 2nd frame", RuneMap.Set.Smooth == false and RuneMap.Set.Fastest == false and Map.Value(13) == "Every 2nd frame")
Map.Pick(1)
check("down from the last row goes to the first", Map.Sel == 1)
C.Visible = false
Map.Reset()
check("Backspace: the map's reset, and the creatures on", resets == 1 and C.Visible == true)

---------------------------------------------------------------- every panel in the panel's lines
local Cam = load(CAMERARULES)()
local function AlwaysSeen(Panel, n)
    for sel = 1, n do
        Panel.Sel = sel
        local rows, seen = P.Window(Panel.View(KEY, nil).Rows, EDROWS), false
        for _, r in ipairs(rows) do if r.Sel then seen = true end end
        if not seen or #rows > EDROWS then return false end
    end
    return true
end
check("F8: the selected row is always in the " .. EDROWS .. " lines", AlwaysSeen(Map, #Map.ROWS))
check("F6: the selected row is always in the " .. EDROWS .. " lines", AlwaysSeen(Cam, #Cam.PANEL))
check("F5: the selected row is always in the " .. EDROWS .. " lines", AlwaysSeen(Skin, #Skin.ROWS))

---------------------------------------------------------------- the words a player reads
local old = {}
local function NoOld(where, text)
    for _, word in ipairs({ "RuneMap", "Minimap", "minimap", "Rune XP", "Slim level up" }) do
        for s in text:gmatch('"([^"\\n]*)"') do if s:find(word, 1, true) and not s:find("WBP_", 1, true) and not s:find("/", 1, true) then old[#old + 1] = where .. ": " .. s end end
    end
end
NoOld("mappanel.lua", MAPPANEL) NoOld("skinpanel.lua", SKINPANEL) NoOld("camerarules.lua", CAMERARULES) NoOld("modmenu.txt", MODMENU)
for _, E in ipairs(Elements) do NoOld("elements.lua", '"' .. E.Name .. '"') end
check("no old name in a text of the panels or of the Mod Menu page: " .. table.concat(old, " ; "), #old == 0)
check("the new key is one named value, and the mod binds it", KEYS:find('skin = "F5" }', 1, true) ~= nil and KEYS:find('RegisterKeyBind(KeyCode("skin")', 1, true) ~= nil)

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);
