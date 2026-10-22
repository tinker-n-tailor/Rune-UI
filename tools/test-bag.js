// Tests the rule that tells when the bag is open (BagOpen in apply.lua), without the game. While the bag is open,
// the tool bar sits at the game's place. The rule reads the bag's tab row, which is next to the bar in the same box:
// hidden (2) from the entry into a world until the first open, seen while open (4 with a mouse, 3 with a gamepad),
// collapsed (1) after a close (probes of 06-10-2026).
// Needs npm install once. Run: node tools/test-bag.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const apply = fs.readFileSync(path.join(__dirname, '..', 'RuneUI', 'Scripts', 'apply.lua'), 'utf8');
const START = '-- The bar in the bag.', END = '-- A gamepad is the input in use';
const code = apply.slice(apply.indexOf(START), apply.indexOf(END));
if (apply.indexOf(START) < 0 || apply.indexOf(END) < apply.indexOf(START)) { console.log('FAIL apply.lua: the bag rule was not found between its two comment lines'); process.exit(1); }
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const test = `
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local function Widget(name, vis)
  local W = { name = name, vis = vis, valid = true, kids = {}, op = 1 }
  function W:IsValid() return self.valid end
  function W:GetVisibility() return self.vis end
  function W:GetRenderOpacity() return self.op end
  function W:GetFName() return { ToString = function() return self.name end } end
  function W:GetParent() return self.parent end
  function W:GetChildrenCount() return #self.kids end
  function W:GetChildAt(i) return self.kids[i + 1] end
  return W
end
-- the bag's box as the game has it: the bar first, the tab row two places after it
local function Box(vis)
  local box, bar, tabs = Widget("VerticalBox_98", 4), Widget("QuickAccessBar", 4), Widget("TabGroupOverlay", vis)
  box.kids = { bar, Widget("WBP_ArmourDurabilityInfo", 4), tabs }
  bar.parent = box
  return bar, tabs
end
local Toolbar = { Instances = {} }
local function ById() return Toolbar end
${code}
check("no tool bar yet: the bag is not open", BagOpen() == false)
local bar, tabs = Box(2)
Toolbar.Instances[1] = bar
check("a new world, the tab row hidden: not open", BagOpen() == false)
tabs.vis = 4
check("the bag open with a mouse: open", BagOpen() == true)
tabs.op = 0.98
check("the close's fade starts, the tab row still seen: not open", BagOpen() == false)
tabs.op = 0.46
check("... and stays not open through the fade", BagOpen() == false)
tabs.op = 0.7
check("the bag opened again during the fade: open", BagOpen() == true)
tabs.op = 0.3
BagOpen()
tabs.vis, tabs.op = 1, 0
check("the bag closed: not open", BagOpen() == false)
tabs.vis, tabs.op = 3, 0.07
check("the bag open with a gamepad, fading in: open at once", BagOpen() == true)
tabs.op = 0.7
check("... and through its fade in", BagOpen() == true)
tabs.op = 1
check("... and when full", BagOpen() == true)
-- the game makes the HUD again: the old tab row is gone and the new box has its own
tabs.valid = false
local bar2, tabs2 = Box(1)
Toolbar.Instances[1] = bar2
check("a new HUD: the old tab row is not read", BagOpen() == false)
tabs2.vis = 4
check("... and the new one is found", BagOpen() == true)
bar2.valid = false
check("the tool bar gone: not open", BagOpen() == false)
if fails > 0 then error(fails .. " failed") end
`;
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL ' + lua.lua_tojsstring(L, -1)); process.exit(1); }
console.log('ALL PASS');
