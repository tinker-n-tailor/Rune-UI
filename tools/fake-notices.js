// The fake widgets of the notice tests: a world of entries shaped as the game's, built by World(o), and Fresh(o) that
// loads noticelook.lua (SRCTEXT) against it. Lua source for test-noticelook.js; it runs nothing by itself.
// ctx.CachedTex is engine.lua's own function, cut out of its text (fake-cachedtex.js).
const cached = require('./fake-cachedtex');
module.exports = `
local deadCalls, writes, violations = 0, 0, 0
local all, loaded = {}, nil
local api = {}
api.__index = api
function api:IsValid() return not self.gone end
local function method(name, fn)
    api[name] = function(self, ...) if self.gone then deadCalls = deadCalls + 1 end return fn(self, ...) end
end
local function setter(name, fn)
    method(name, function(self, ...) writes = writes + 1 self.wrote = (self.wrote or 0) + 1 fn(self, ...) end)
end
local function copy(t)
    local c = {}
    for k, v in pairs(t) do c[k] = (type(v) == "table" and k ~= "ResourceObject") and copy(v) or v end
    return c
end
method("GetFName", function(self) return { ToString = function() return self.name end } end)
method("GetClass", function(self) return { GetFName = function() return { ToString = function() return self.cls end } end } end)
method("GetFullName", function(self) return "Transient." .. self.id .. "." .. self.name end)
method("GetChildrenCount", function(self) if not self.kids then error("not a panel") end return #self.kids end)
method("GetChildAt", function(self, i) return self.kids[i + 1] end)
method("GetContent", function() error("no content") end)
method("GetVisibility", function(self) return self.vis or 4 end)
method("GetDesiredSize", function(self) return self.want or { X = 0, Y = 0 } end)
method("GetParent", function(self) return self.parent end)
method("GetText", function(self) return { ToString = function() return self.text or "" end } end)
local breakAdd, adds   -- the number of the AddChildToOverlay call that throws
method("RemoveChild", function(self, c)
    for i, k in ipairs(self.kids) do if k == c then table.remove(self.kids, i) c.parent = nil return true end end
    return false
end)
method("AddChildToOverlay", function(self, c)
    adds = adds + 1
    if breakAdd == adds then error("add refused") end
    self.kids[#self.kids + 1] = c
    c.parent = self
    c.slot = {}
    function c.slot:SetHorizontalAlignment(a) self.h = a end
    function c.slot:SetVerticalAlignment(a) self.v = a end
    return c.slot
end)
setter("SetColorAndOpacity", function(self, c) self.ColorAndOpacity = c end)
setter("SetDefaultColorAndOpacity", function(self, c) self.DefaultColorAndOpacity = c end)
setter("SetFillColorAndOpacity", function(self, c) self.FillColorAndOpacity = c end)
setter("SetHeightOverride", function(self, h) self.height = h end)
setter("SetWidthOverride", function(self, w) self.width = w end)
setter("SetContent", function(self, c) self.content = c c.parent = self end)
setter("SetClipping", function(self, c) self.clipping = c end)
setter("SetRenderTransformAngle", function(self, a) self.angle = a end)
method("AddChildToCanvas", function(self, c)
    c.parent = self
    return { SetAutoSize = function() end, SetSize = function() end, SetPosition = function() end }
end)
setter("SetBrushColor", function(self, c) self.BrushColor = c end)
setter("SetFont", function(self, f) self.fontSet = f.FontObject self.Font = f end)
setter("SetDefaultFont", function(self, f) self.fontSet = f.FontObject self.fontSize = f.Size end)
setter("SetShadowOffset", function(self, o) self.shadowX = o.X end)
setter("SetShadowColorAndOpacity", function(self, c) self.shadowA = c.A end)
setter("SetRenderTranslation", function(self, v) self.RenderTransform.Translation = v end)
setter("SetRenderScale", function(self, v) self.RenderTransform.Scale = v end)
setter("SetRenderTransformPivot", function(self, v) self.pivot = v end)
setter("SetBrushFromTexture", function(self, t) self.Brush.ResourceObject = t end)
setter("SetBrushTintColor", function(self, c) self.Brush.TintColor = c end)
setter("SetBrush", function(self, b) self.lastBrush = copy(b) self.Brush = b end)
setter("SetVisibility", function(self, v) self.vis = v if self.entry then violations = violations + 1 end end)
setter("SetRenderOpacity", function(self, o) self.opacity = o if self.entry then violations = violations + 1 end end)

local ids, worldNo = 0, 0
local function Base(name, cls, kids)
    ids = ids + 1
    local w = setmetatable({ name = name, cls = cls, kids = kids, id = worldNo .. "_" .. ids, RenderTransform = { Translation = { X = 0, Y = 0 } } }, api)
    all[#all + 1] = w
    for _, k in ipairs(kids or {}) do k.parent = w end
    return w
end
local function Img(name, w, h, cls)
    local i = Base(name, cls or "Image")
    i.ColorAndOpacity = { R = 1, G = 1, B = 1, A = 1 }
    i.Brush = { ImageSize = { X = w or 10, Y = h or 10 }, DrawAs = 0, TintColor = { SpecifiedColor = { R = 1, G = 1, B = 1, A = 1 }, ColorUseRule = 0 }, UVRegion = { Min = { X = 0, Y = 0 }, Max = { X = 1, Y = 1 }, bIsValid = 0 } }
    return i
end
local function Txt(name, cls)
    local t = Base(name, cls or "WBP_DomTextBlock_C")
    t.ColorAndOpacity = { SpecifiedColor = { R = 0.9, G = 0.3, B = 0.2, A = 0.7 }, ColorUseRule = 0 }
    t.DefaultColorAndOpacity = { SpecifiedColor = { R = 0.9, G = 0.3, B = 0.2, A = 0.7 }, ColorUseRule = 0 }
    t.Font = { Size = 14 }
    t.DefaultTextStyle = { Font = { Size = 12 } }
    return t
end
local function Border(name) local b = Base(name, "Border") b.BrushColor = { R = 1, G = 1, B = 1, A = 1 } return b end
local function Box(name, cls, kids) return Base(name, cls, kids) end
local function Nested(name, cls, root, entry)
    local n = Base(name, cls)
    n.WidgetTree = setmetatable({ RootWidget = root }, api)
    n.entry = entry
    return n
end
local function Tex(name) return setmetatable({ name = name, cls = "Texture2D", id = "tex" }, api) end

local made, current = {}, nil   -- made: the gold lines' images; ringMade: everything else the mod makes (the warning's ring)
local ringMade = {}
local breakImage   -- the number of the made image whose SetBrush throws (a failure in the middle of a lines step)
local artTex = Tex("art")
local missingArt, importFails   -- a part of a path whose file is missing; true: the engine does not take a picture
local imports = 0   -- pictures decoded by the engine
local KRL = { ImportFileAsTexture2D = function(self, outer, p)
    if importFails or (missingArt and p:find(missingArt, 1, true)) then return nil end
    imports = imports + 1
    if artTex.gone then artTex = Tex("art") end   -- the engine freed the old picture
    loaded = { outer = outer, path = p }
    return artTex
end }
${cached}
function StaticFindObject(p)
    if p:find("KismetRenderingLibrary") then return KRL end
    local class = p:match("^/Script/UMG%.(%w+)$")
    if class then return { class = class } end
    if p:find("Item_Slot_C:WidgetTree.CommonLazyImage_83", 1, true) then return current and current.master end
end
function StaticConstructObject(cls, outer, name)
    local i = cls.class == "Image" and Img(name) or Base(name, cls.class, {})
    i.outer = outer
    if name:find("^RU_NoticeLines") then
        made[#made + 1] = i
        if breakImage == #made then i.SetBrush = function() error("boom") end end
    else
        ringMade[#ringMade + 1] = i
    end
    return i
end
function FName(s) return s end
RUNEUI_DIR = "RuneUI/"
io.open = function(p)
    if p:find("upkeep_") and not (missingArt and p:find(missingArt, 1, true)) then return { close = function() end } end
end

local PRIMARY = "WBP_PrimaryNotificationQueue_Item_C"
local function Entry(cls, root)
    local e = Nested("Item", cls, root, true)
    e.vis = 1   -- collapsed at rest
    return e
end

-- one world of fake entries; o: noPrimary, noVendor, noPanel, noShadow, statusParent, ringParent, twoWarnings
local function World(o)
    o = o or {}
    worldNo = worldNo + 1
    local w = { texBg = Tex("T_Primary_Bg"), texLines = Tex("T_Primary_Horizontal_Lines"), entries = {} }
    w.bg = Img("BgImage", 816, 422)
    w.bg.Brush.ResourceObject = w.texBg
    w.hl = Img("HighlightImage", 816, 62)
    w.hl.Brush.ResourceObject = w.texLines
    w.fx, w.sym, w.top, w.shadow = Img("FXImage"), Img("SymbolImage"), Img("TopTextureImage"), Img("ShadowImage")
    w.name, w.sub = Txt("NotificationTextBlock"), Txt("NotificationSubTextBlock")
    w.power = Nested("PowerLevelDisplay", "WBP_PowerLevel_C", Box("PRoot", "Overlay", {}))
    w.power.RenderTransform.Translation.Y = 5
    w.spark = Base("NS_Sparks", "NiagaraSystemWidget")
    local area = Nested("AchievementNotificationItem", "WBP_Area_C", Box("AreaRoot", "Overlay",
        { w.bg, w.hl, w.shadow, w.fx, w.sym, w.top, w.name, w.sub, w.power, w.spark }), true)
    if o.noShadow then table.remove(area.WidgetTree.RootWidget.kids, 3) end
    w.levelText = Txt("LevelTextBlock")
    local levelup = Nested("LevelUpNotificationItem", "WBP_LevelUp_C", Box("LvRoot", "Overlay", { w.levelText }), true)
    w.panel = Img("Panel", 816, 115)
    w.started, w.timer, w.completed = Txt("StartedTextBlock"), Txt("TimerTextBlock"), Txt("CompletedTextBlock")
    local arenaKids = { w.started, w.timer, w.completed }
    if not o.noPanel then table.insert(arenaKids, 1, w.panel) end
    local arena = Nested("ArenaNotificationItem", "WBP_Arena_C", Box("ArRoot", "Overlay", arenaKids), true)
    w.circle, w.repBar = Img("ReputationCircle"), Img("VendorStationReputationProgressBar")
    w.vName, w.vLevel = Txt("NameTextBlock"), Txt("LevelTextBlock")
    w.vLevel.RenderTransform.Translation = { X = 2, Y = 1 }
    local vendor = Nested("LevelUpVendorNotificationItem", "WBP_Vendor_C", Box("VRoot", "Overlay", { w.circle, w.repBar, w.vName, w.vLevel }), true)
    w.skillA, w.skillB, w.strip = Txt("A"), Txt("B"), Img("UnlockStrip")
    local skill = Nested("NewSkillNotificationItem", "WBP_Skill_C", Box("SkRoot", "Overlay", { w.strip, w.skillA, w.skillB }), true)
    w.mile = Txt("MilestoneText")
    local milestone = Nested("MilestoneMaterialNotificationItem", "WBP_Mile_C", Box("MiRoot", "Overlay", { w.mile }), true)
    w.fish = Txt("FishText")
    local fish = Nested("FishCaughtNotificationItem", "WBP_Fish_C", Box("FiRoot", "Overlay", { w.fish }), true)
    local pages = { area, levelup, arena, skill, milestone, fish }
    if not o.noVendor then table.insert(pages, 4, vendor) end
    w.primary = Entry(PRIMARY, Box("Switcher", "WidgetSwitcher", pages))
    if not o.noPrimary then w.entries[PRIMARY] = { w.primary } end

    w.tipShadow, w.tipBand, w.tipIcon = Img("BackgroundShadowImage"), Img("BackgroundImage", 628, 87), Img("IconImage")
    w.tipBand.Brush.DrawAs = 2
    w.tipTitle, w.tipBody = Txt("TitleTextBlock", "DomRichTextBlock"), Txt("BodyTextBlock", "DomRichTextBlock")
    w.bar = Base("ProgressBar", "ProgressBar")
    w.bar.FillColorAndOpacity = { R = 1, G = 0.98, B = 0.93, A = 1 }
    w.bar.Percent = 0.5
    w.barBox = Box("ProgressBarSizeBox", "SizeBox", { w.bar })
    w.barBox.height = 5
    w.barSlot = setmetatable({ Padding = { Left = 0, Top = 0, Right = 0, Bottom = -3 }, sets = 0 }, api)   -- the game's slot of the line: 3 units under the band
    function w.barSlot:SetPadding(p) self.Padding = p self.sets = self.sets + 1 end
    w.barBox.Slot = w.barSlot
    w.tip = Entry("WBP_TutorialNotifications_Item_C", Box("TipRoot", "Overlay", { w.tipShadow, w.tipBand, w.tipIcon, w.tipTitle, w.tipBody, w.barBox }))
    w.entries.WBP_TutorialNotifications_Item_C = { w.tip }

    w.q = {}
    for _, n in ipairs({ "CommonLazyImage_6", "CommonLazyImage_8", "CommonLazyImage_9" }) do w.q[#w.q + 1] = Img(n, 10, 10, "CommonLazyImage") end
    w.q[#w.q + 1] = Img("SymbolImage_2")
    w.qBorder, w.qTitle = Border("Border_3"), Txt("TitleText")
    w.rowBand, w.rowText = Img("CommonLazyImage_83", 10, 10, "CommonLazyImage"), Txt("SlotText")
    w.master = Img("CommonLazyImage_83", 10, 10, "CommonLazyImage")
    local row = Nested("Row_1", "WBP_QuestAndUnlocks_Item_Slot_C", Box("RowRoot", "Overlay", { w.rowBand, w.rowText }))
    w.qRoot = Box("QRoot", "VerticalBox", { w.q[1], w.q[2], w.q[3], w.q[4], w.qBorder, w.qTitle, row })
    w.quest = Entry("WBP_QuestAndUnlocks_Item_C", w.qRoot)
    w.entries.WBP_QuestAndUnlocks_Item_C = { w.quest }

    w.upBg, w.glow, w.ringBack = Img("Background", 775, 57), Img("RadialGlow"), Img("Background", 68, 68)
    w.ringBack.Brush.ResourceObject = Tex("game ring")
    w.glyph = Img("Icon")
    w.glyph.Brush.ResourceObject = Tex("game glyph")
    w.arc = Img("RadialImage")
    local ring = Nested("SegmentedRadialBar", "WBP_Ring_C", Box("RingRoot", o.ringParent or "Overlay", { w.ringBack, w.arc, w.glyph }))
    w.ring = ring
    w.upLabel = Txt("LabelText")
    w.upRoot = Box("UpRoot", "Overlay", { w.upBg, w.glow, ring, w.upLabel })
    w.upkeep = Entry("WBP_PlayerUpkeepNotification_Item_C", w.upRoot)
    w.entries.WBP_PlayerUpkeepNotification_Item_C = { w.upkeep }
    if o.twoWarnings then   -- a second warning entry, with a ring and a glyph of its own
        w.upBg2, w.glyph2 = Img("Background", 775, 57), Img("Icon")
        w.glyph2.Brush.ResourceObject = Tex("second glyph")
        local ring2 = Nested("SegmentedRadialBar", "WBP_Ring_C", Box("RingRoot", "Overlay", { Img("Background", 68, 68), Img("RadialImage"), w.glyph2 }))
        w.upkeep2 = Entry("WBP_PlayerUpkeepNotification_Item_C", Box("UpRoot2", "Overlay", { w.upBg2, Img("RadialGlow"), ring2, Txt("LabelText") }))
        w.entries.WBP_PlayerUpkeepNotification_Item_C[2] = w.upkeep2
    end

    w.stBg, w.stText = Img("Background", 700, 50), Txt("StatusText")
    w.stRoot = Box("StRoot", o.statusParent or "Overlay", { w.stBg, w.stText })
    w.status = Entry("WBP_EnvAndPlayerStatus_Item_C", w.stRoot)
    w.entries.WBP_EnvAndPlayerStatus_Item_C = { w.status }

    if o.oddColours then   -- fields that are objects, not numbers
        local odd = { R = {}, G = {}, B = {}, A = {} }
        w.fx.ColorAndOpacity = odd
        w.fx.Brush.TintColor = { SpecifiedColor = odd, ColorUseRule = 0 }
        w.tipTitle.DefaultColorAndOpacity = { SpecifiedColor = odd, ColorUseRule = 0 }
        w.power.RenderTransform.Translation = { X = {}, Y = {} }
    end
    return w
end

local clock, logs, fontOn = 0, {}, true
os.clock = function() return clock end
local fontObj = Tex("Poppins")
local Style
local fontCalls, uniqs = 0, 0
local function Fresh(o)
    writes, violations, deadCalls, made, logs, fontOn, loaded, fontCalls, uniqs = 0, 0, 0, {}, {}, true, nil, 0, 0
    ringMade = {}
    missingArt, importFails, imports, breakImage, breakAdd, adds = nil, nil, 0, nil, nil, 0
    clock = 0
    current = World(o)
    local M = load(SRCTEXT)()
    local hud = {}   -- the HUD rings as survival.lua keeps them, by index: the values are read (Value), the colours are survival.lua's own
    for i, n in ipairs({ "water", "food", "rest" }) do
        hud[i] = { Name = n, Value = 0.25 * i, Colour = { R = 0.1 * i, G = 0.5, B = 0.9, A = 1 }, Right = setmetatable({}, api), GameIcon = setmetatable({ Brush = { ResourceObject = Tex("hud " .. n) } }, api) }
    end
    local ctx = { Log = function(m) logs[#logs + 1] = m end, Style = Style, CachedTex = CachedTex,
        Survival = rawget(_G, "SURVTEXT") and load(SURVTEXT)() or nil,   -- the real file, when a test hands it over
        Font = function() fontCalls = fontCalls + 1 if fontOn then return fontObj end end,
        Uniq = function(n) uniqs = uniqs + 1 return n .. "_7_" .. uniqs end,
        Hud = function() return hud end,
        Find = function(cls)
            local list, keys = {}, {}
            for _, e in ipairs(current.entries[cls] or {}) do list[#list + 1], keys[#keys + 1] = e, e:GetFullName() end
            return list, keys
        end }
    return M, ctx
end
local function Step(M, ctx, dt) clock = clock + (dt or 0.6) M.Tick(ctx) end

`;
