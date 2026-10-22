// Tests Rune UI's side of the mod "Mod Menu" (modmenu.lua) without the game: the first values seen are not taken,
// only a row that changed with rev is, config.txt follows the mod's real values, the button, and the key names.
// Also: RuneUI/modmenu.txt is JSON that Mod Menu can read, its key defaults are keys the mod knows, and its map rows match
// menurows.lua's rows and mapsettings.lua's starting values, and its camera rows match camerarules.lua's rows (key, kind, default, range,
// and for a number row the tooltip is the F6 hint). The rows of Rune Skin have the names of the panel's rows.
// Needs npm install once. Run: node tools/test-modmenu.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const dir = path.join(__dirname, '..', 'RuneUI');
const src = fs.readFileSync(path.join(dir, 'Scripts', 'modmenu.lua'), 'utf8');

const page = JSON.parse(fs.readFileSync(path.join(dir, 'modmenu.txt'), 'utf8'));
const fail = m => { console.log('FAIL', m); process.exit(1); };
if (page.id !== 'RuneUI' || page.schema !== 1) fail('modmenu.txt: id must be RuneUI (the shared variables carry it) and schema 1');
const TYPES = ['header', 'toggle', 'slider', 'choice', 'key', 'button'], seen = new Set(), keyDefaults = [];
for (const s of page.settings) {
  if (!TYPES.includes(s.type)) fail('modmenu.txt: type ' + s.type);
  if (s.type === 'header') continue;
  if (s.type === 'button') { if (s.action !== 'open_editor') fail('modmenu.txt: the mod knows no action ' + s.action); continue; }
  if (!/^[\w.-]+$/.test(s.key || '') || seen.has(s.key)) fail('modmenu.txt: key ' + s.key);
  seen.add(s.key);
  if (s.type === 'key') { keyDefaults.push(s.default); if (!s.restart) fail('modmenu.txt: ' + s.key + ' needs restart, the keys are bound at the start'); }
  if (s.type === 'choice' && !s.options.includes(s.default)) fail('modmenu.txt: default of ' + s.key);
}

// every row of the page that is not a key or a map setting has a Row in menurows.lua, or the menu would show a switch that does nothing
const rowsLua = fs.readFileSync(path.join(dir, 'Scripts', 'menurows.lua'), 'utf8');
// the on/off rows of the layout are made by one loop over { row key, element id } pairs
const switchRows = { immersive: 'immersive', rune_xp: 'runexp', floating_xp: 'floatxp', enemy_bars: 'enemybars', slim_level_up: 'slimlevel', combat_text: 'combattext', horizontal_cooldowns: 'cdhoriz', party_panel: 'party', wheels: 'wheels',
  gold_crosshair: 'aim', day_night_icon: 'dialskin', bar_icons: 'baricons', health_numbers: 'barnumbers', party_numbers: 'partynumbers' };
if (!rowsLua.includes('Row(r[1], function() return El.Visible end, function(v) El.Visible = v == true Ed.Save = true end)')) fail('menurows.lua: the loop of the switch rows must read and write the element Visible and ask for a save');
for (const [key, id] of Object.entries(switchRows)) if (!rowsLua.includes('{ "' + key + '", "' + id + '" }')) fail('menurows.lua: the row ' + key + ' must read and write the switch ' + id);
for (const s of page.settings) {
  if (!s.key || /^(key|map|camera)_/.test(s.key)) continue;   // the camera rows are made by one loop, checked below
  if (!rowsLua.includes('Row("' + s.key + '"') && !(s.key in switchRows)) fail('menurows.lua has no Row for the page row ' + s.key);
}
const party = page.settings.find(s => s.key === 'party_panel');
if (!party || party.type !== 'toggle' || party.label !== 'Party panel' || party.default !== true) fail('modmenu.txt: party_panel is a toggle called Party panel, on at first');

for (const [key, id, label] of [['wheels', 'wheels', 'Wheels']]) {
  const row = page.settings.find(s => s.key === key);
  if (!row || row.type !== 'toggle' || row.label !== label || row.default !== true) fail('modmenu.txt: ' + key + ' is a toggle called ' + label + ', on at first');
  if (new RegExp(id + '=\\{[^}]*Visible=false').test(fs.readFileSync(path.join(dir, 'Scripts', 'elements.lua'), 'utf8'))) fail('elements.lua: the switch ' + id + ' is on at first, as the page says');
}

// the rows of Rune Skin: one toggle for each row of the F5 panel (skinpanel.lua), in its order, with the name the panel
// shows (the element's name) and the starting value of the element
const elementsLua = fs.readFileSync(path.join(dir, 'Scripts', 'elements.lua'), 'utf8');
const skinIds = [...fs.readFileSync(path.join(dir, 'Scripts', 'skinpanel.lua'), 'utf8').matchAll(/\{ Id = "(\w+)"/g)].map(m => m[1]);
const first = page.settings.findIndex(s => s.type === 'header' && s.label === 'Rune Skin');
if (first < 0 || skinIds.length !== 12) fail('modmenu.txt needs the header Rune Skin, and skinpanel.lua twelve rows');
skinIds.forEach((id, i) => {
  const s = page.settings[first + 1 + i];
  const name = (elementsLua.match(new RegExp('Id="' + id + '",\\s*Name="([^"]*)"')) || [])[1];
  const off = new RegExp('\\b' + id + '=\\{[^}]*Visible=false').test(elementsLua);
  if (!s || s.type !== 'toggle' || switchRows[s.key] !== id) fail('modmenu.txt: row ' + (i + 1) + ' under Rune Skin must be the toggle of ' + id);
  if (s.label !== name) fail('modmenu.txt: ' + s.key + ' is called "' + s.label + '", the panel calls it "' + name + '"');
  if (s.default !== !off) fail('modmenu.txt: the default of ' + s.key + ' differs from elements.lua');
});
if (page.settings[first + 1 + skinIds.length].type !== 'header') fail('modmenu.txt: a row under Rune Skin that the F5 panel does not have');

const imm = page.settings.find(s => s.key === 'map_immersive');
if (!imm || imm.type !== 'choice' || imm.options.join() !== 'Nothing,Map,Compass' || imm.default !== 'Nothing') fail('modmenu.txt: map_immersive is a choice of Nothing, Map and Compass, Nothing at first');
const draw = page.settings.find(s => s.key === 'map_drawing');
if (!draw || draw.type !== 'choice' || draw.label !== 'Map refresh' || draw.options.join() !== 'Every frame,Every 2nd frame,Every 4th frame' || draw.default !== 'Every 2nd frame') fail('modmenu.txt: map_drawing is the choice "Map refresh" of Every frame, Every 2nd frame and Every 4th frame, Every 2nd frame at first');
if (imm.label !== 'Keep in immersive mode') fail('modmenu.txt: map_immersive is called "Keep in immersive mode"');
const settingsLua = fs.readFileSync(path.join(dir, 'Scripts', 'settings.lua'), 'utf8');
const drawNames = (settingsLua.match(/M\.DRAWING = \{([^}]*)\}/) || [])[1];
if (!drawNames || JSON.stringify(drawNames.match(/"[^"]*"/g).map(k => k.slice(1, -1))) !== JSON.stringify(draw.options)) fail('modmenu.txt and settings.lua: the options of map_drawing differ from DRAWING');
if (!fs.readFileSync(path.join(dir, 'Scripts', 'menurows.lua'), 'utf8').includes('Settings.DrawingFrom(v)')) fail('menurows.lua: map_drawing must read a value through Settings.DrawingFrom, so an old config.txt with Smooth, Faster or Fastest still works');
if (page.settings.some(s => s.key === 'map_Immersive')) fail('modmenu.txt: the old on/off row map_Immersive is gone');

// the map's on/off rows: the same keys in modmenu.txt, in menurows.lua's rows and in mapsettings.lua's starting values, with the
// same defaults; "Player name" (map_Name) comes after the north mark and is on at first
const scripts = path.join(dir, 'Scripts');
const toggles = page.settings.filter(s => s.type === 'toggle' && s.key.startsWith('map_')).map(s => s.key.slice(4));
const rowsList = (fs.readFileSync(path.join(scripts, 'menurows.lua'), 'utf8').match(/for _, k in ipairs\(\{([^}]*)\}\) do\s*\n\s*Row\("map_"/) || [])[1];
if (!rowsList || JSON.stringify(rowsList.match(/"(\w+)"/g).map(k => k.slice(1, -1))) !== JSON.stringify(toggles)) fail('modmenu.txt and menurows.lua: the map rows differ: ' + toggles + ' | ' + rowsList);
const start = (fs.readFileSync(path.join(scripts, 'mapsettings.lua'), 'utf8').match(/local SETTING_START = \{([^}]*)\}/) || [])[1] || '';
for (const k of toggles) {
  const m = start.match(new RegExp('\\b' + k + ' = (true|false)'));
  const def = page.settings.find(s => s.key === 'map_' + k).default;
  if (!m || (m[1] === 'true') !== def) fail('modmenu.txt: map_' + k + ' default must match mapsettings.lua SETTING_START');
}
if (toggles.indexOf('Name') !== toggles.indexOf('Mark') + 1) fail('modmenu.txt: map_Name comes right after map_Mark');

// the camera rows: camera_<key> for each row of camerarules.lua, in its order; menurows.lua makes one Mod Menu row per
// camerarules row, and lists the camera's key with the other keys
const rowsText = fs.readFileSync(path.join(scripts, 'menurows.lua'), 'utf8');
if (!rowsText.includes('Row("camera_" .. r.Key')) fail('menurows.lua: no Mod Menu row per camera row');
if (!rowsText.includes('ipairs({ "editor", "skin", "map", "camera", "profile", "zoomin", "zoomout" })')) fail('menurows.lua: the camera or the skin key is not in the Mod Menu key rows');
if (!page.settings.some(s => s.key === 'key_camera' && s.default === 'F6')) fail('modmenu.txt: key_camera, F6 at first');
const skinKey = (fs.readFileSync(path.join(scripts, 'keys.lua'), 'utf8').match(/KEY_DEFAULT = \{[^}]*skin = "(\w+)"/) || [])[1];
if (!skinKey || !page.settings.some(s => s.key === 'key_skin' && s.default === skinKey)) fail('modmenu.txt: key_skin must start at the key of keys.lua KEY_DEFAULT (' + skinKey + ')');
const camRows = page.settings.filter(s => /^camera_/.test(s.key || ''));
const lstr = v => v === undefined ? 'nil' : typeof v === 'string' ? JSON.stringify(v) : String(v);
const camLua = '{' + camRows.map(r => '{' + ['key=' + lstr(r.key.slice(7)), 'type=' + lstr(r.type), 'default=' + lstr(r.default),
  'min=' + lstr(r.min), 'max=' + lstr(r.max), 'step=' + lstr(r.step), 'suffix=' + lstr(r.suffix || ''),
  'options=' + lstr((r.options || []).join(',')), 'tooltip=' + lstr(r.tooltip)].join(',') + '}').join(',') + '}';

const test = `
local M = load(SRCTEXT)()

-- the mod's real values, Mod Menu's shared variables, and its file
local real = { key_editor = "F9", immersive = false, immersive_wait = 8, map_Ore = false }
local sets, rows = {}, {}
for _, k in ipairs({ "key_editor", "immersive", "immersive_wait", "map_Ore" }) do
    rows[#rows + 1] = { Key = k, Get = function() return real[k] end,
        Set = function(v) if v == "bad" then error("no") end real[k] = v sets[#sets + 1] = k end }
end
local shared, file, writes, opened = {}, nil, 0, 0
local ctx = { Rows = rows, Log = function() end, Read = function(n) return shared[n] end,
    ReadFile = function() return file end, WriteFile = function(_, t) file = t writes = writes + 1 return true end,
    OpenEditor = function() opened = opened + 1 end }
local now = 0
local function Step() now = now + 1 M.Tick(ctx, now) end
local function Has(line) return string.find(file, "\\n" .. line .. "\\n", 1, true) ~= nil end

Step()
assert(writes == 0 and M.Rev == nil, "without Mod Menu nothing is read or written")

-- Mod Menu with the page's defaults (no config.txt yet): the player's values stay, the file gets them
shared = { rev = 0, key_editor = "F9", immersive = false, immersive_wait = 8.0, map_Ore = true, action = "open_editor#3" }
Step()
assert(#sets == 0 and real.map_Ore == false, "the first values seen are not taken")
assert(writes == 1 and file == M.Text(rows) and Has("map_Ore = false") and Has("immersive_wait = 8") and Has("key_editor = F9"), file)
assert(string.sub(file, 1, 1) == "#", "a comment line first")
assert(opened == 0, "a click of before the start is not a click")
Step()
assert(writes == 1, "the same values: no second write")
M.Tick(ctx, now + 0.5)
shared.rev = 5
M.Tick(ctx, now + 0.5)
assert(M.Rev == 0, "once a second")
shared.rev = 0

-- the menu opens: it gives the file's values again, without a new rev
shared.map_Ore = false
Step()
assert(#sets == 0)

-- the player turns the immersive mode on in the menu
shared.immersive, shared.rev = true, 1
Step()
assert(#sets == 1 and sets[1] == "immersive" and real.immersive == true, "only the row that changed")
assert(Has("immersive = true"))
-- Mod Menu's own save of the same values, with Windows line ends: the same text
file = string.gsub(file, "\\n", "\\r\\n")
local w = writes
Step()
assert(writes == w, "Windows line ends are not a difference")
file = string.gsub(file, "\\r", "")

-- a change in F8: the file follows, nothing is taken from the menu
real.map_Ore = true
Step()
assert(writes == w + 1 and Has("map_Ore = true") and #sets == 1)
-- the menu was open all the time and still holds the old Ore; the player changes the wait there
shared.immersive_wait, shared.rev = 12.0, 2
Step()
assert(real.immersive_wait == 12 and real.map_Ore == true, "a value the menu did not change is not taken")
-- then Mod Menu saves what it holds, the old Ore too: the file is made right again
file = string.gsub(file, "map_Ore = true", "map_Ore = false")
w = writes
Step()
assert(writes == w + 1 and Has("map_Ore = true") and Has("immersive_wait = 12"))

-- a row that cannot take the value: the others still do, and the file keeps the real value
shared.key_editor, shared.immersive, shared.rev = "bad", false, 3
Step()
assert(real.key_editor == "F9" and real.immersive == false and Has("key_editor = F9") and Has("immersive = false"))

-- the button
shared.action = "open_editor#4"
Step()
Step()
assert(opened == 1, "one click opens the editor once")

-- a file that cannot be written: said once, the step goes on
ctx.WriteFile = function() return false end
real.map_Ore = false
Step()
Step()
assert(M.WriteFailed == true)

-- key names: runeui.txt's (keys.lua's VK) and Mod Menu's
assert(M.KeyFromMenu("PAGE_UP") == "PgUp" and M.KeyFromMenu("RIGHT_BRACKET") == "]" and M.KeyFromMenu("F9") == "F9")
assert(M.KeyFromMenu("NINE") == "9" and M.KeyFromMenu("q") == "Q" and M.KeyFromMenu("home") == "Home")
assert(M.KeyFromMenu("THUMB_MOUSE_BUTTON") == nil and M.KeyFromMenu("none") == nil and M.KeyFromMenu("F13") == nil)
assert(M.KeyToMenu("f9") == "F9" and M.KeyToMenu("pgdn") == nil and M.KeyToMenu(nil) == nil)
for _, n in ipairs({ "Backspace", "PgUp", "PgDn", "End", "Home", "Left", "Up", "Right", "Down", "Insert", "Delete", "Plus", "Minus",
    "Equals", "Dash", "Comma", "Period", "[", "]", "F1", "F12", "0", "9", "A", "Z" }) do
    assert(M.KeyFromMenu(M.KeyToMenu(n)) == n, "key " .. n)
end
for name in string.gmatch(KEYDEFAULTS, "%S+") do assert(M.KeyFromMenu(name), "modmenu.txt: default key " .. name) end
-- the camera rows: the same keys, kinds, defaults and ranges as camerarules.lua
local Cam = load(CAMTEXT)()
local page = load("return " .. CAMLUA)()
assert(#page == #Cam.ROWS, "modmenu.txt: " .. #page .. " camera rows, camerarules.lua has " .. #Cam.ROWS)
local KIND = { switch = "toggle", number = "slider", choice = "choice" }
for i, r in ipairs(Cam.ROWS) do
    local p = page[i]
    local what = "modmenu.txt: camera_" .. r.Key
    assert(p.key == r.Key and p.type == KIND[r.Kind], what .. ": key or kind (or order) differs")
    assert(p.default == r.Default, what .. ": default differs")
    if r.Kind == "number" then
        assert(p.min == r.Min and p.max == r.Max and p.step == r.Step and p.suffix == (r.Unit and " " .. r.Unit or ""), what .. ": range, step or unit differs")
        local at
        for n, row in ipairs(Cam.PANEL) do if row == r then at = n end end
        assert(p.tooltip == Cam.Hint(at), what .. ": the tooltip is not the F6 hint")
    end
    if r.Kind == "choice" then
        assert(p.options == table.concat(r.Options, ","), what .. ": options differ")
        -- one tooltip for every value: it names each value as "<value>:", as F6 gives a hint for each
        for _, o in ipairs(r.Options) do assert(string.find(p.tooltip or "", o .. ":", 1, true), what .. ": the tooltip does not name " .. o) end
    end
end
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
lua.lua_pushstring(L, to_luastring(keyDefaults.join(' '))); lua.lua_setglobal(L, to_luastring('KEYDEFAULTS'));
lua.lua_pushstring(L, to_luastring(fs.readFileSync(path.join(scripts, 'camerarules.lua'), 'utf8'))); lua.lua_setglobal(L, to_luastring('CAMTEXT'));
lua.lua_pushstring(L, to_luastring(camLua)); lua.lua_setglobal(L, to_luastring('CAMLUA'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

// the "profile" row of menurows.lua: 1, 2 and 3 go to that profile; anything else leaves the profile and the saved layout alone
// (menurows.lua cannot be loaded here, so the setter's text is cut out and run with a stand-in for Prof)
const setterText = (fs.readFileSync(path.join(scripts, 'menurows.lua'), 'utf8').match(/Row\("profile", function\(\) return tostring\(Prof\.N\) end,\s*(function\(v\)[\s\S]*?\n {12}end)\)/) || [])[1];
if (!setterText) fail('menurows.lua: the setter of the profile row was not found');
const L2 = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L2);
const profileTest = `
local logs, steps = {}, 0
function Log(m) logs[#logs + 1] = m end
Prof = { N = 1 }
function Prof.Next() steps = steps + 1 Prof.N = Prof.N % 3 + 1 end
local set = ${setterText}
local function try(v, start)
    Prof.N, steps, logs = start, 0, {}
    set(v)
    return Prof.N, steps, #logs
end
local function check(v, start, n, st, lg, what)
    local gn, gst, glg = try(v, start)
    assert(gn == n and gst == st and glg == lg, what .. ": profile " .. gn .. " steps " .. gst .. " logs " .. glg)
end
check("2", 1, 2, 1, 0, "1 to 2")
check("3", 1, 3, 2, 0, "1 to 3")
check("1", 3, 1, 1, 0, "3 to 1")
check("2", 2, 2, 0, 0, "already there: no step, no save")
check(3, 1, 3, 2, 0, "a number")
check("0", 2, 2, 0, 1, "0")
check("4", 2, 2, 0, 1, "4")
check("1.5", 2, 2, 0, 1, "1.5")
check("abc", 2, 2, 0, 1, "text")
check(nil, 2, 2, 0, 1, "nothing")
check("", 2, 2, 0, 1, "empty")
print("ok   the profile row: 1, 2, 3 go there, nothing else moves the profile")
`;
if (lauxlib.luaL_dostring(L2, to_luastring(profileTest)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L2, -1)); process.exit(1); }
