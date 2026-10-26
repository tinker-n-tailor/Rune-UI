// Tests the widget search (finder.lua) without the game: SearchWidgets sorts fake widgets by class, FindClass keeps only
// live ones with a matching path and gives their full names, and asks a widget for its name once per search (the
// parts call FindClass up to 5 times a second). Also the game's reports of new widgets (NewWidget, Compact) and the
// scan that uses them (FindAll). Runs finder.lua in a Lua made in JavaScript.
// Needs npm install once. Run: node tools/test-find.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'RuneUI', 'Scripts', 'finder.lua'), 'utf8');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const test = `
local names = 0   -- how often any widget was asked for its full name
local nextAddr = 100
local function Widget(cls, full, parent)
  local W = { valid = true, addr = nextAddr, parent = parent }
  nextAddr = nextAddr + 1
  function W:IsValid() return self.valid end
  function W:GetFullName() names = names + 1 return full end
  function W:GetParent() return self.parent end
  function W:GetAddress() return self.addr end
  function W:GetClass() return { GetAddress = function() return cls end, GetFName = function() return { ToString = function() return cls end } end } end
  return W
end
local wheel = Widget("Slice", "Slice /Engine/Transient.Root.WBP_Spellcasting_MainPanel_C_1.WidgetTree_2.SpellRadialWidget.WidgetTree_3.RadialSlice_4")
local book = Widget("Slice", "Slice /Engine/Transient.Root.WBP_SpellBook_C_1.WidgetTree_2.RadialSlice_4")
local template = Widget("Slice", "Slice /Game/UI/WBP_Slice.WBP_Slice_C.RadialSlice_4")
local chat = Widget("Chat", "Chat /Engine/Transient.Root.WBP_ClosedChat_C_7")
local box = Widget("Panel", "Panel /Engine/Transient.Root.Box_1")
local wheelIcon = Widget("Icon", "Icon /Engine/Transient.Root.Box_1.RadialKBM", box)
local all = { wheel, book, template, chat, wheelIcon, box }
FindAllOf = function() return all end
-- the file as main.lua loads it: F holds the functions and the state
local F = (function() ${code} end)()
local Reports, Arrivals, ARRIVALS_MAX = F.Reports, F.Arrivals, F.ARRIVALS_MAX
local SearchWidgets, FindClass, FindQuiet, AddInstance = F.SearchWidgets, F.FindClass, F.FindQuiet, F.AddInstance
local NewWidget, FindAll, TakeArrivals = F.NewWidget, F.FindAll, F.TakeArrivals
local PATH = { "WBP_Spellcasting_MainPanel_C_%d+%.WidgetTree_%d+%.SpellRadialWidget%.WidgetTree_%d+%.RadialSlice_%d+$" }
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end

SearchWidgets()
check("sorted by class", #F.Found.Slice == 3 and #F.Found.Chat == 1 and F.Found.Nothing == nil)
local list, keys = FindClass("Slice", PATH)
check("the wheel's slice only, with its name", #list == 1 and list[1] == wheel and keys[1] == "Slice /Engine/Transient.Root.WBP_Spellcasting_MainPanel_C_1.WidgetTree_2.SpellRadialWidget.WidgetTree_3.RadialSlice_4")
check("one name read per candidate", names == 3)
list, keys = FindClass("Slice", PATH)
check("asked again: the same answer, no name read", #list == 1 and #keys == 1 and names == 3)
wheel.valid = false
list = FindClass("Slice", PATH)
check("a widget gone since drops out of the cached answer", #list == 0)
wheel.valid = true
list = FindClass("Chat")
check("every live one without a path", #list == 1 and list[1] == chat)
names = 0
list, keys = FindClass("Icon", { "Box_1%.RadialKBM$" }, 1)
check("climbs to the parent, named after it", list[1] == box and keys[1] == "Panel /Engine/Transient.Root.Box_1" and names == 2)
SearchWidgets()
names = 0
list = FindClass("Slice", PATH)
check("a new search reads the names again", #list == 1 and names == 3)
local E = { Instances = {}, Keys = {} }
names = 0
AddInstance(E, chat, "given")
check("an instance with its name given: no read", E.Keys[1] == "given" and names == 0)
AddInstance(E, chat)
check("an instance without: one read", E.Keys[2] == "Chat /Engine/Transient.Root.WBP_ClosedChat_C_7" and names == 1)

-- the game reports new widgets (Reports): no search between two worlds
check("before the first search no search is owed yet", Reports.Walk == "start")
SearchWidgets() Reports.Walk, Reports.Dropped = false, {}   -- as FindAll does after a search
list = FindClass("Chat")
check("a class asked for the first time: the search has it, no new search", #list == 1 and Reports.Wanted.Chat and Reports.Walk == false)
local chat2 = Widget("Chat", "Chat /Engine/Transient.Root.WBP_ClosedChat_C_8")
check("a report returns nothing", NewWidget(chat2) == nil)
check("a wanted widget is kept, and the parts are matched again", #F.Found.Chat == 2 and Reports.Kept == 1 and Reports.Retry == 3)
list = FindClass("Chat")
check("the cached answer waits for the next scan", #list == 1)
F.FindCache = {}   -- as FindAll does when it matches the parts again
list = FindClass("Chat")
check("then the new widget is in the answer", #list == 2 and list[2] == chat2)
NewWidget(chat2)
F.FindCache = {}
check("a widget reported twice is there once", #FindClass("Chat") == 2 and #F.Found.Chat == 2)
chat2.valid = false
F.FindCache = {}
check("a widget gone leaves the list", #FindClass("Chat") == 1 and #F.Found.Chat == 1)
local moved = Widget("Panel", "Panel /Engine/Transient.Root.Box_9")
F.Found.Chat[#F.Found.Chat + 1] = moved   -- a freed slot that now holds a widget of another class
F.FindCache = {}
check("a slot with another class leaves the list", #FindClass("Chat") == 1 and #F.Found.Chat == 1)
local seen = Reports.Seen
NewWidget(Widget("Tooltip", "Tooltip /Engine/Transient.Root.Tip_1"))
check("a class nobody asked for is counted, not kept", Reports.Seen == seen + 1 and F.Found.Tooltip == nil and Reports.Dropped.Tooltip)
FindClass("Tooltip")
check("asked for later: one new search is owed", Reports.Walk == "new class")
local broken = { GetClass = function() error("gone") end }
check("a widget that cannot be read stops nothing", pcall(NewWidget, broken) and Reports.Seen == seen + 2)

-- the scan (FindAll): one search, then the reports; what main.lua gives the file (Init) is made up here
local walks = 0
FindAllOf = function() walks = walks + 1 return all end
local chatE = { Id = "chat", Classes = { "Chat" }, Instances = {}, Keys = {} }
F.Init({ Elements = { chatE }, Log = function() end })
Reports.Walk, Reports.Retry, Reports.Wanted, Reports.Dropped = "start", 0, {}, {}
FindAll(false)
check("the first scan searches and finds the part", walks == 1 and #chatE.Instances == 1 and Reports.Walk == false)
FindAll(false)
check("the next scan does not search", walks == 1 and #chatE.Instances == 1)
local chat3 = Widget("Chat", "Chat /Engine/Transient.Root.WBP_ClosedChat_C_9")
NewWidget(chat3)
FindAll(false)
check("a reported widget is a part's on the next scan, with no search", walks == 1 and #chatE.Instances == 2 and chatE.Keys[2] == "Chat /Engine/Transient.Root.WBP_ClosedChat_C_9")
FindAll(false) FindAll(false)
check("the scans after it match again, then stop", Reports.Retry == 0 and #chatE.Instances == 2)
chat3.valid = false
FindAll(false)
check("a part's widget gone: matched again, with no search", walks == 1 and #chatE.Instances == 1)
NewWidget(Widget("Tooltip", "Tooltip /Engine/Transient.Root.Tip_2"))
FindClass("Tooltip")
FindAll(false)
check("a class asked for late, with a widget not kept: one search", walks == 2 and Reports.Walk == false and next(Reports.Dropped) == nil)
F.NextSearch = 0   -- the 10 s are over
check("after 10 s the parts are matched again, with no search", FindAll(false) == true and walks == 2)
check("and not before the next 10 s", FindAll(false) == false and walks == 2)
-- a class wanted quietly (the enemy bar): its new widgets are kept, with no early scan and no matching again, and the next call has them
Reports.Walk, Reports.Retry, Reports.Fresh, Reports.Wanted, Reports.Dropped = false, 0, false, {}, {}
SearchWidgets()
local bars0 = FindQuiet("Chat")
local bar = Widget("Chat", "Chat /Engine/Transient.Root.WBP_ClosedChat_C_20")
NewWidget(bar)
check("a quiet class: the new widget is kept, no early scan, no matching again", Reports.Quiet.Chat and Reports.Wanted.Chat and #F.Found.Chat == #bars0 + 1 and Reports.Retry == 0 and Reports.Fresh == false)
local bars1 = FindQuiet("Chat")
check("and the very next call has it, with no cache between", #bars1 == #bars0 + 1 and bars1[#bars1] == bar and next(F.FindCache) == nil)
local before = Reports.Retry
NewWidget(Widget("Tooltip", "Tooltip /Engine/Transient.Root.Tip_3"))
FindClass("Tooltip")
NewWidget(Widget("Tooltip", "Tooltip /Engine/Transient.Root.Tip_4"))
check("a normal class still brings the early scan", Reports.Retry == 3 and Reports.Fresh == true and before == 0)
-- the reported widgets of a class that a part takes (TakeArrivals): handed over once, kept class or not
check("arrivals: nothing before a part asks", TakeArrivals("Gauge") == nil)
local g1 = Widget("Gauge", "Gauge /Engine/Transient.Root.G_1")
NewWidget(g1)
local got = TakeArrivals("Gauge")
check("arrivals: a widget reported since is handed over, though its class is not kept", got and #got == 1 and got[1] == g1 and F.Found.Gauge == nil)
check("arrivals: only once", TakeArrivals("Gauge") == nil)
NewWidget(Widget("Dial", "Dial /Engine/Transient.Root.D_1"))
check("arrivals: another class is not collected", Arrivals.Dial == nil)
for i = 1, ARRIVALS_MAX + 5 do NewWidget(Widget("Gauge", "Gauge /Engine/Transient.Root.G_" .. i)) end
check("arrivals: a list that nobody takes stops growing", #TakeArrivals("Gauge") == ARRIVALS_MAX)
-- a new round: the handles go, the arrivals go, the search is due at once
NewWidget(Widget("Gauge", "Gauge /Engine/Transient.Root.G_9"))
F.ClassNames.Keep = "x"
F.NextSearch = 99999
F.Forget(true)
check("forget, same world: no handles, search at once, walk says restart", next(F.Found) == nil and next(F.FindCache) == nil and F.NextSearch == 0 and Reports.Walk == "restart")
check("forget, same world: the arrivals are emptied and the class names stay", TakeArrivals("Gauge") == nil and F.ClassNames.Keep == "x")
F.Forget(false)
check("forget, new world: the class names go and the walk says new world", next(F.ClassNames) == nil and Reports.Walk == "new world")
print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);
