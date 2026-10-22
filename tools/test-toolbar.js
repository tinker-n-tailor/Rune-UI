// Tests the tool bar tiles (toolbar.lua) against fake widgets shaped like the game's bar (probes 12 and 13,
// 02-10-2026): the see-through square, the gold edge, the HUD font, the track behind the durability bar, the edge of the
// slot in use, and a slot the game builds new. It also counts the calls into the engine: a look at a known bar must stay
// cheap, because every call and every property read of UE4SS makes a wrapper that the Lua memory must clean up.
// Needs npm install once. Run: node tools/test-toolbar.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'toolbar.lua'), 'utf8');
const test = `
local addr = 100
local api = {}
local calls = 0   -- every call into the fake engine, and every read of a widget tree
local objects = 0   -- the calls and reads that give back an object: in the game each one makes a wrapper, which is garbage
local MAKES = { GetChildAt = true, GetParent = true, GetOuter = true, GetClass = true, GetFName = true }
api.__index = function(t, k)
    local v = api[k]
    if v ~= nil then return v end
    if k == "WidgetTree" then calls, objects = calls + 1, objects + 1 return rawget(t, "Tree") end
end
function api:IsValid() return self.valid end
function api:GetFName() return { ToString = function() return self.name end } end
function api:GetClass() return { GetFName = function() return { ToString = function() return self.cls end } end } end
function api:GetAddress() return self.addr end
function api:GetChildrenCount() return #self.kids end
function api:GetChildAt(i) return self.kids[i + 1] end
function api:GetVisibility() return self.vis end
function api:IsVisible() return self.shown ~= false end
function api:GetParent() return self.parent end
function api:GetOuter() return self.outer end
function api:GetRenderOpacity()
    if not self.valid then error("a call on a widget that is gone") end
    self.reads = (self.reads or 0) + 1
    return self.op or 1
end
function api:SetVisibility(v) if v ~= self.vis then self.draws = (self.draws or 0) + 1 end self.vis = v end   -- a change brings a new draw
function api:SetRenderOpacity(o) self.op = o end
function api:SetFont(f) self.font = f end
function api:SetColorAndOpacity(c) self.colour = c.SpecifiedColor end
function api:SetShadowOffset(o) self.shadow = o.X end
function api:SetShadowColorAndOpacity() end
function api:SetBrush(b) self.set = { Width = b.OutlineSettings.Width, Colour = b.OutlineSettings.Color.SpecifiedColor } end
function api:SetScalarParameterValue(n, v) self.values[n] = v self.writes = (self.writes or 0) + 1 end
function api:RemoveFromParent()
    for i, k in ipairs(self.parent.kids) do if k == self then table.remove(self.parent.kids, i) break end end
end
function api:AddChildToOverlay(w)
    self.kids[#self.kids + 1] = w
    w.parent = self
    local slot = {}
    function slot:SetHorizontalAlignment() end
    function slot:SetVerticalAlignment() end
    function slot:SetPadding(p) w.pad = p.Left end
    return slot
end
for name, f in pairs(api) do
    if type(f) == "function" and name ~= "__index" then api[name] = function(...)
        calls = calls + 1
        if MAKES[name] then objects = objects + 1 end
        return f(...)
    end end
end
local function W(name, cls, kids)
    addr = addr + 1
    local w = setmetatable({ name = name, cls = cls, kids = kids or {}, valid = true, addr = addr, vis = 4,
        Font = { Size = 12 }, Brush = { OutlineSettings = {} } }, api)
    for _, k in ipairs(w.kids) do k.parent = w end
    return w
end
-- a widget of the game with a tree of its own
local function User(name, cls, root)
    local w = W(name, cls)
    w.Tree = W("WidgetTree", "WidgetTree")
    w.Tree.RootWidget = root
    return w
end
local function Inner(item)
    local mat = W("MID", "MaterialInstanceDynamic")
    mat.values = {}
    local image = W("ItemImage", "Image")
    image.Brush.ResourceObject = mat
    local eq = W("EquippedImage", "Image")
    eq.vis = 1
    local pb = W("ProgressBar", "ProgressBar")
    pb.FillColorAndOpacity = { R = 0.46, G = 0.40, B = 0.29, A = 1 }   -- the game's own colour, read in the game
    pb.WidgetStyle = { BackgroundImage = {} }
    local bar = User("DurabilityBar", "WBP_Inventory_DurabilityBar_C", W("SizeBox", "SizeBox", { W("Border_0", "Border", { pb }) }))
    local count = W("StackSizeText", "WBP_DomTextBlock_C")
    local ov = W("Overlay_31", "Overlay", { image, eq, W("CompatibilityImage", "Image"), bar, count })
    local inv = User("InventorySlot", "WBP_Inventory_ItemSlot_C", W("InternalRootButtonBase", "CommonButtonInternalBase", { W("SizeBox_0", "SizeBox", { ov }) }))
    inv.t = { mat = mat, eq = eq, pb = pb, count = count, ov = ov, item = item }
    return inv
end
local function Slot(n, item)
    local inv, header = Inner(item), W("HeaderText", "WBP_DomTextBlock_C")
    local ov = W("Overlay_31", "Overlay", { inv, header })
    local s = User("Slot" .. n, "WBP_Inventory_QuickAccess_ItemSlot_C", W("SizeBox_0", "SizeBox", { ov }))
    s.ov, s.header = ov, header
    return s
end
local slots = {}
for n, item in ipairs({ "staff", "axe", "food", "bow", "arrows", "pick", "net", "rod" }) do slots[n] = Slot(n, item) end   -- the 8 of the game
local bar = User("QuickAccessBar", "WBP_Inventory_QuickAccesBar_C", W("SlotGridContainer", "UniformGridPanel", slots))
-- above the bar, as in the game: a box in the tree of the bag's content, and that in the main panel's tree
local function Hold(name, cls, kid)
    local box = W("Box", "VerticalBox", { kid })
    local w = User(name, cls, box)
    box.outer = w.WidgetTree
    w.WidgetTree.outer = w
    return w
end
local grid = bar.WidgetTree.RootWidget
local gridReads = 0   -- how often the bar's grid is asked for a slot
local gridChildAt = grid.GetChildAt
grid.GetChildAt = function(self, i) gridReads = gridReads + 1 return gridChildAt(self, i) end
local content = Hold("InventoryContent", "WBP_Inventory_VerticalNavigation_C", bar)
local panel = Hold("MainPanel", "WBP_Inventory_MainPanel_C", content)
local function T(i) return slots[i].ov.kids[1].t end   -- the inner slot's parts, as the game has them now
local function Edges(i)
    local out = {}
    for _, k in ipairs(T(i).ov.kids) do if string.find(k.name, "^RU_TbEdge") then out[#out + 1] = k end end
    return out
end

FName = function(s) return s end
StaticFindObject = function(p) return p end
StaticConstructObject = function(_, _, name) return W(name, "Image") end
local hud = W("Vitals", "WBP_Vitals_C")   -- the game's HUD: the bar is looked at only while it is on the screen
local clock, made, logs = 0, 0, {}
os.clock = function() return clock end
local M = load(SRCTEXT)()
local ctx = { Log = function(m) logs[#logs + 1] = m print(m) end, G = function(n) made = made + 1 return n .. "_" .. made end,
    Font = function() return "Poppins" end,
    ById = function(id) return { Instances = { id == "vitals" and hud or bar } } end }
local function Step(dt) clock = clock + (dt or 0.2) M.Tick(ctx) end
local function Second() for _ = 1, 7 do Step(0.16) end end   -- the looks of a second: every slot has had its turn
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local function near(a, b) return math.abs(a - b) < 0.01 end
local function said(what) local n = 0 for _, m in ipairs(logs) do if string.find(m, what, 1, true) then n = n + 1 end end return n end

T(2).eq.vis = 4   -- the axe is in the hand
Step()
check("the square is see-through on every slot", T(1).mat.values["Background Opacity"] == 0.32 and T(3).mat.values["Background Texture Opacity"] == 0)
check("one gold edge per slot, set in by the square's margin", #Edges(1) == 1 and #Edges(3) == 1 and Edges(1)[1].pad == 3.25)
check("the edge takes no clicks", Edges(1)[1].vis == 3)
check("the number in the HUD font, cream, with a shadow", slots[1].header.font.FontObject == "Poppins" and slots[1].header.font.Size == 11
    and near(slots[1].header.colour.R, 0.88) and slots[1].header.shadow == 1)
check("the stack count too", T(3).count.font.FontObject == "Poppins" and T(3).count.colour ~= nil)
check("the durability keeps the game's colour, on a dark track", T(1).pb.FillColorAndOpacity.G == 0.40 and T(1).pb.WidgetStyle.BackgroundImage.TintColor.SpecifiedColor.A == 0.5)
check("the orange frame is unseen on every slot", T(1).eq.op == 0 and T(2).eq.op == 0)
check("the slot in use: a bright edge, 2 wide", Edges(2)[1].set.Width == 2 and Edges(2)[1].set.Colour.A == 1)
check("the other slots: the thin edge", Edges(1)[1].set.Width == 1 and near(Edges(1)[1].set.Colour.A, 0.45))
check("the log: ready once, no failure", said("tool bar: tiles") == 1 and said("not ") == 0)

Step()
check("a second look adds no second edge", #Edges(1) == 1 and #Edges(2) == 1 and made == 8)
-- a known slot costs no walk over the children of its overlay: the inner slot is asked for where it was
local walks = 0
for _, sl in ipairs(slots) do
    local count = sl.ov.GetChildrenCount
    sl.ov.GetChildrenCount = function(self) walks = walks + 1 return count(self) end
end
Step()
check("a known slot is not walked by name", walks == 0 and made == 8)
for _, sl in ipairs(slots) do sl.ov.GetChildrenCount = nil end

-- an idle, known bar: the cost of the looks of one second
Second()
local MAXSECOND, MAXLOOK, MAXMADE = 580, 100, 40
local function Writes(i) return T(i).mat.writes end
local w0 = {}
for i = 1, 8 do w0[i] = Writes(i) end
local g0, r0, c0, m0, worst, total = gridReads, bar.reads or 0, calls, objects, 0, 0
for _ = 1, 7 do
    local before = calls
    Step(0.16)
    worst = math.max(worst, calls - before)
    total = calls - c0
end
local wrappers = objects - m0
print("engine calls in a second of 7 looks, idle: " .. total .. ", the most in one look: " .. worst .. ", objects made: " .. wrappers)
check("an idle bar costs few calls: " .. total .. " in a second", total <= MAXSECOND)
check("and no look costs many: " .. worst, worst <= MAXLOOK)
check("and few of the calls make an object: " .. wrappers .. " in a second", wrappers <= MAXMADE)
check("the structure is proved once a second: each slot asked for once", gridReads - g0 == 8)
check("the opacity above the bar is read 4 times a second, not on every look", (bar.reads or 0) - r0 >= 3 and (bar.reads or 0) - r0 <= 5)
local oncePerSlot = true
for i = 1, 8 do if Writes(i) - w0[i] ~= 2 then oncePerSlot = false end end
check("the square's values are written once a second, on each slot's turn", oncePerSlot)
local gv = gridReads
Step(0.16)
check("one look proves one or two slots, not all", gridReads - gv <= 2)

-- the game's HUD is off the screen (a menu, the big map): the bar is still looked at, as it sits in the bag while the bag is open
hud.shown = false
T(1).eq.vis, T(2).eq.vis = 4, 1
Step()
check("with the HUD off the screen the edge still follows the mark, in one look", Edges(1)[1].set.Width == 2 and Edges(2)[1].set.Width == 1)
hud.shown = true
T(1).eq.vis, T(2).eq.vis = 1, 4
Step()
T(2).eq.vis, T(1).eq.vis = 1, 4   -- the staff in the hand now
Step()
check("the bright edge follows the item in the hand", Edges(1)[1].set.Width == 2 and Edges(2)[1].set.Width == 1 and near(Edges(2)[1].set.Colour.A, 0.45))
local d1, d2, d3 = Edges(1)[1].draws, Edges(2)[1].draws, Edges(3)[1].draws
T(1).eq.vis, T(2).eq.vis = 1, 4
Step()
check("an edge that changes its look is drawn again, and stays seen", Edges(1)[1].draws > d1 and Edges(2)[1].draws > d2 and Edges(1)[1].vis == 3 and Edges(2)[1].vis == 3)
check("an edge that keeps its look is left alone", Edges(3)[1].draws == d3)
T(2).eq.vis, T(1).eq.vis = 1, 4
Step()

T(1).pb.FillColorAndOpacity = { R = 0.9, G = 0.1, B = 0.05, A = 1 }   -- the game: this item breaks soon
Step()
check("a colour the game writes on the durability stays", T(1).pb.FillColorAndOpacity.G == 0.1 and T(3).pb.FillColorAndOpacity.G == 0.40)

T(3).mat.values["Background Opacity"] = 1   -- the game wrote the square again
Second()
check("a square the game wrote again is see-through again", T(3).mat.values["Background Opacity"] == 0.32)

-- a new item in slot 3: the game builds the inner slot new
local old = slots[3].ov.kids[1]
local new = Inner("potion")
slots[3].ov.kids[1] = new
new.parent = slots[3].ov
Second()
check("a slot built new is painted again", #Edges(3) == 1 and T(3).item == "potion" and T(3).mat.values["Background Opacity"] == 0.32 and T(3).eq.op == 0)
check("and its count is styled", T(3).count.font.FontObject == "Poppins")

-- parts the game takes away while the slot itself stays
local n0 = made
T(1).eq.valid = false
Step()
check("a slot whose frame is gone is painted again, not called", made == n0 + 1 and #Edges(1) == 1)
T(1).eq.valid = true
local lost = Edges(2)[1]
lost:RemoveFromParent() lost.parent = nil   -- the game built the slot's parts new: our edge is out of it
Second()
check("a slot that lost its edge gets one again", #Edges(2) == 1 and Edges(2)[1] ~= lost)
local n1 = made
slots[1].ov.kids[1], slots[1].ov.kids[2] = slots[1].ov.kids[2], slots[1].ov.kids[1]   -- the number first, the item slot second
local function T1() return slots[1].ov.kids[2].t end
Second()
check("the inner slot is found by its name, not its place", made == n1 and T1().mat.values["Background Opacity"] == 0.32)
slots[1].ov.kids[1], slots[1].ov.kids[2] = slots[1].ov.kids[2], slots[1].ov.kids[1]
local outer = Slot(1, "bow")
slots[1] = outer
bar.WidgetTree.RootWidget.kids[1] = outer
Second()
check("a whole slot built new is painted", #Edges(1) == 1 and T(1).item == "bow" and slots[1].header.font.FontObject == "Poppins")

-- the tool wheel is open: the game sets the main panel to opacity 0, and an outline does not take that by itself
T(1).eq.vis = 4   -- the bow is in the hand
panel.op = 0
Step(0.3)
check("the wheel open: no edge is seen, the thin one and the bright one", Edges(1)[1].set.Colour.A == 0 and Edges(2)[1].set.Colour.A == 0 and Edges(3)[1].set.Colour.A == 0)
check("and every edge is hidden, not only see-through", Edges(1)[1].vis == 2 and Edges(2)[1].vis == 2 and Edges(3)[1].vis == 2)
panel.op = 1
Step(0.3)
check("the wheel closed: the edges are back", near(Edges(1)[1].set.Colour.A, 1) and near(Edges(3)[1].set.Colour.A, 0.45) and Edges(1)[1].vis == 3 and Edges(3)[1].vis == 3)
bar.op = 0.5   -- the render opacity that main.lua sets on a bar that is not selected in the editor
Step(0.3)
check("a dimmed bar: the edges are dimmed with it", near(Edges(3)[1].set.Colour.A, 0.225))
bar.op = 1
panel.valid = false   -- the game built the panel new, with the wheel open
local panel2 = Hold("MainPanel", "WBP_Inventory_MainPanel_C", content)
panel2.op = 0
Step(0.3)
Step(0.3)
check("a panel built new is found, and no call goes to the old one", Edges(3)[1].set.Colour.A == 0 and said("not ") == 0)
panel2.op = 1
Step(0.3)
check("and the edges are back with it", near(Edges(3)[1].set.Colour.A, 0.45))

-- the game frees the bar's grid while the bar stays: the grid is a handle from a property, and it reads invalid
local deadCalls = 0
for _, name in ipairs({ "GetChildAt", "GetChildrenCount", "GetAddress", "GetVisibility", "GetParent" }) do
    grid[name] = function() deadCalls = deadCalls + 1 error("a call on a grid that is gone") end
end
grid.valid = false
Step() Step() Step()
check("a grid that reads invalid gets no call, whatever the turn of the slots", deadCalls == 0 and said("not ") == 0)
local fresh = {}
for n, item in ipairs({ "staff", "axe", "food", "bow", "arrows", "pick", "net", "rod" }) do fresh[n] = Slot(n, item) end
local grid2 = W("SlotGridContainer", "UniformGridPanel", fresh)
bar.WidgetTree.RootWidget = grid2
local painted = made
Second()
for n = 1, 8 do slots[n] = fresh[n] end
check("a new grid is found, and its slots are painted", deadCalls == 0 and made == painted + 8 and #Edges(1) == 1 and #Edges(8) == 1)
T(5).eq.vis = 4
Step()
check("and the bar follows its slots again", Edges(5)[1].set.Width == 2)
T(5).eq.vis = 1
T(1).eq.vis = 4   -- the bow is in the hand again, as before the new grid
Step()

local before = made
clock = clock + 0.05 M.Tick(ctx)
check("no look before its time", made == before)
slots[2].valid = false
Step()
check("a slot that is gone stops nothing", #Edges(1) == 1 and said("not ") == 0)
M.Forget()
Step()
check("after a new world every slot is painted again, with one edge", #Edges(1) == 1 and made > before)

-- a call of the game fails between the two changes of visibility: the edge is collapsed for one look, not for good
local e = Edges(1)[1]
local throws = 1
e.SetVisibility = function(self, v)
    if v ~= 1 and throws > 0 then throws = throws - 1 error("the game refused the call") end
    api.SetVisibility(self, v)
end
bar.op = 0.5
Step(0.3)
check("an edge whose change failed is collapsed", e.vis == 1)
Step()
check("and the next look does the change again", e.vis == 3 and near(e.set.Colour.A, 0.5))
local d = e.draws
Step()
check("then the edge is left alone, and the log has the failure once", e.draws == d and said("a slot not painted") == 1)
bar.op = 1

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);
