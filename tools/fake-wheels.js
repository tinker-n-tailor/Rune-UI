// A fake of the three radial wheels for the tests of wheels.lua and its helper files: widgets under the game's
// names that count every call, and the stand-ins for the UE4SS functions. run(scenario) runs a test written in
// Lua after this world is set up; the scenario uses World, Step, check, State and the rest as globals of its text.
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const scripts = path.join(__dirname, '..', 'RuneUI', 'Scripts');
const read = f => fs.readFileSync(path.join(scripts, f), 'utf8');
const cached = require('./fake-cachedtex');
const world = `
local writes, sweeps, sparkSearches, switchSearches, imports, clock, logs, missing = 0, 0, 0, 0, 0, 100, {}, {}
local walks = 0   -- calls to count or get the children or the content of a widget that the mod must not enter (noWalk), and reads of its .WidgetTree
-- a map of the engine as UE4SS gives it: ForEach hands out wrappers with get(), Add takes plain values
local function Map(pairs_)
    local m = { list = pairs_ or {} }
    function m:ForEach(fn) for _, e in ipairs(self.list) do fn({ get = function() return e[1] end }, { get = function() return e[2] end }) end end
    function m:Add(k, v) self.list[#self.list + 1] = { k, v } end
    return m
end
local api = {}
api.__index = function(o, k)
    if k == "WidgetTree" and rawget(o, "noWalk") then walks = walks + 1 end
    return api[k]
end
local function Rd(o) o.n = o.n + 1 end
local function Wr(o) o.n = o.n + 1 writes = writes + 1 end
function api:IsValid() Rd(self) return self.valid end
function api:GetFullName() Rd(self) return self.full end
function api:GetClass() return { GetFName = function() return { ToString = function() return self.cls end } end } end
function api:GetVisibility() Rd(self) if self.boom then error("the game refused the call") end return self.vis end
function api:SetVisibility(v) Wr(self) self.vis = v end
function api:SetBrushFromTexture(tex, match) Wr(self) local b = self.Brush or self.Background b.ResourceObject = tex self.match = match end
function api:SetBrush() Wr(self) end
function api:SetColorAndOpacity(c) Wr(self) self.ColorAndOpacity = c end
function api:SetBrushTintColor(t) Wr(self) self.Brush.TintColor = t end
function api:SetBrushColor(c) Wr(self) self.BrushColor = c end
function api:GetIsEnabled() Rd(self) return self.enabled end
function api:SetIsEnabled(v) Wr(self) self.enabled = v end
function api:SetRenderScale(v) Wr(self) if self.noScale then error("the game refused the call") end self.RenderTransform.Scale = v end
function api:SetFont(f) Wr(self) self.Font = { FontObject = f.FontObject, Size = f.Size } end
function api:SetText(t) Wr(self) self.text = t end
function api:SetJustification(v) Wr(self) self.justify = v end
function FText(s) return s end
function api:GetFName() return { ToString = function() return self.name end } end
function api:GetParent() Rd(self) return self.parent end
function api:GetChildrenCount() Rd(self) if self.noWalk then walks = walks + 1 end if not self.kids then error("not a panel") end return #self.kids end
function api:GetChildAt(i) if self.noWalk then walks = walks + 1 end return self.kids[i + 1] end
function api:GetContent() if self.noWalk then walks = walks + 1 end return self.content end
function api:GetDesiredSize() Rd(self) return { X = self.want or 0, Y = 20 } end
function api:SetScrollingEnabled(v) Wr(self) self.bIsScrollingEnabled = v end
function api:SetRenderTransformPivot(v) Wr(self) self.RenderTransformPivot = v end
function api:SetRenderTranslation(v) Wr(self) if self.noMove then error("the game refused the call") end self.RenderTransform.Translation = v end
function api:GetRenderOpacity() Rd(self) return self.op end
function api:SetRenderOpacity(v) Wr(self) self.op = v end
function api:SetWrapTextWidth(v) Wr(self) self.WrapTextAt = v end
function api:SetWidthOverride(v) Wr(self) self.WidthOverride, self.bOverride_WidthOverride = v, true end
function api:ClearWidthOverride() Wr(self) self.bOverride_WidthOverride = false end
function api:SetHeightOverride(v) Wr(self) self.HeightOverride = v end
function api:SetContent(c) Wr(self) self.content = c end
function api:SetClipping(v) Wr(self) self.clip = v end
function api:SetRenderTransformAngle(v) Wr(self) self.RenderTransform.Angle = v end
function api:GetOuter() Rd(self) return self.outer end
function api:GetActiveWidgetIndex() Rd(self) return self.idx end
function api:ActivateSystem(v) Wr(self) self.active = v end
function api:RemoveFromParent() Wr(self) self.removed = true end
local function Slot(o, child)
    local s = { child = child }
    for _, name in ipairs({ "SetHorizontalAlignment", "SetVerticalAlignment", "SetPadding", "SetAutoSize", "SetSize", "SetPosition" }) do
        s[name] = function(_, v) Wr(o) s[string.sub(name, 4)] = v end
    end
    o.added = o.added or {}
    o.added[#o.added + 1] = s
    return s
end
function api:AddChildToOverlay(c) return Slot(self, c) end
function api:AddChildToCanvas(c) return Slot(self, c) end
function api:K2_GetScalarParameterValue(n) Rd(self) return self.scalars[n] end
function api:SetScalarParameterValue(n, v) Wr(self) self.scalars[n] = v end
local function Obj(cls, full, o)
    o = o or {}
    o.cls, o.full, o.valid, o.n, o.name, o.op = cls, cls .. " " .. full, true, 0, string.match(full, "([%w_]+)$"), 1
    o.RenderTransform, o.RenderTransformPivot = { Scale = { X = 1, Y = 1 }, Translation = { X = 0, Y = 0 }, Angle = 0 }, { X = 0, Y = 0 }
    o.Slot = { Padding = { Left = 1, Top = 130, Right = 3, Bottom = 145 }, IsValid = function() return true end, SetPadding = function(slot, p) Wr(o) slot.Padding = p end }
    return setmetatable(o, api)
end

-- what outlives a world: the game's pictures, fonts and styles, found by their path
local assets = {}
local function Asset(cls, p) assets[p] = assets[p] or Obj(cls, p) return assets[p] end
local poppins, amiri = Asset("Font", "/Game/UI/Fonts/Poppins"), Asset("Font", "/Game/UI/Fonts/Amiri")
local krl = { ImportFileAsTexture2D = function(_, outer, file)
    imports = imports + 1
    local name = string.match(file, "([^/]+)$")
    if missing[name] then return nil end
    return Obj("Texture2D", "/Engine/Transient.Imported_" .. imports, { file = name, outer = outer })
end }
for _, p in ipairs({ "NS_UI_RadialLoop", "NS_UI_RadialLoop_Upper" }) do Asset("NiagaraSystem", "/Game/Art/VFX/UI/" .. p .. "." .. p) end
function StaticFindObject(p)
    if p == "/Script/Engine.Default__KismetRenderingLibrary" then return krl end
    if string.find(p, "^/Script/UMG%.") or p == "/Script/NiagaraUIRenderer.NiagaraSystemWidget" then return Asset("Class", p) end
    return assets[p]
end
-- the widgets that the mod makes, each under a name that must be new
local made, names = {}, {}
function StaticConstructObject(cls, outer, name)
    assert(not names[name], "a second object named " .. tostring(name))
    names[name] = true
    local o = Obj(string.match(cls.full, "([%w_]+)$"), "/Engine/Transient.Made." .. name, { outer = outer, vis = 4, Brush = { ImageSize = {} }, Font = { Size = 24 }, MaterialRemapList = Map() })
    made[#made + 1] = o
    return o
end
local function Made(cls, from)
    local list = {}
    for n = (from or 0) + 1, #made do if made[n].cls == cls then list[#list + 1] = made[n] end end
    return list
end
function FName(s) return s end
io.open = function(file) if not missing[string.match(file, "([^/]+)$")] then return { close = function() end } end end
os.clock = function() return clock end
local SQUARE = { "Background Opacity", "BackGround Shadows Opacity", "Background Grain Noise Opacity", "Background Texture Opacity", "Tint Opacity" }

-- A world: the three wheels with their parts under the game's names, and the spell book's wheel of the Q class.
local function World(n)
    local w = { all = {}, byClass = { Image = {}, Border = {}, TextBlock = {}, Spacer = {}, NiagaraSystemWidget = {}, WidgetSwitcher = {} }, wheels = {}, from = #made }
    local root = "/Engine/Transient.GameEngine_0:GameInstance_" .. n .. ".WBP_HUD_C_1.WidgetTree_0."
    local function Add(o, as) w.all[#w.all + 1] = o if w.byClass[as or o.cls] then table.insert(w.byClass[as or o.cls], o) end return o end
    local function Image(p, tex, alpha)
        return Add(Obj("Image", p, { vis = 4, enabled = true, ColorAndOpacity = { R = 0.9, G = 0.8, B = 0.7, A = alpha or 0.8 },
            Brush = { ResourceObject = tex and Asset("Texture2D", "/Game/UI/" .. tex), ImageSize = { X = 100, Y = 90 },
                TintColor = { SpecifiedColor = { R = 1, G = 1, B = 1, A = 0.3 }, ColorUseRule = 1 } } }))
    end
    local function Border(p, tex)
        return Add(Obj("Border", p, { BrushColor = { R = 0.1, G = 0.1, B = 0.1, A = 0.6 }, Background = { ResourceObject = tex and Asset("Texture2D", "/Game/UI/" .. tex) } }))
    end
    local function Text(p, size, want)
        return Add(Obj("WBP_DomTextBlock_C", p, { Font = { FontObject = amiri, Size = size }, bIsScrollingEnabled = true, want = want, vis = 4, WrapTextAt = string.find(p, "ItemName$") and 220 or 0,
            ColorAndOpacity = { SpecifiedColor = { R = 1, G = 0.2, B = 0.2, A = 1 }, ColorUseRule = 0 } }), "TextBlock")
    end
    local function Panel(p, kids, o)
        o = Add(Obj("Overlay", p, o or {}))
        o.kids = kids
        for _, k in ipairs(kids) do k.parent = o end
        return o
    end
    local function Wheel(key, cls, p, slice, count, parts, texts)
        -- Q and H keep visibility 4 closed or open: the panel tells (probe of 07-10-2026)
        local W = Add(Obj(cls, root .. p, { vis = key == "R" and 1 or 4, slices = {}, slots = {}, parts = {}, outer = key ~= "R" and w.panelTree or nil }))
        local at = root .. p .. ".WidgetTree_2."
        for i = 0, count - 1 do
            local s = at .. slice .. i .. ".WidgetTree_5."
            W.slices[i] = { Background = Image(s .. "Background", "T_Slice"), Highlight = Image(s .. "Highlight", "T_SliceOn"), SliceIcon = Image(s .. "SliceIcon", "T_Icon") }
            if key == "Q" then   -- the slot's own widget with the game's small cooldown counter
                W.slices[i].HighlightDisabled = Image(s .. "HighlightDisabled", "T_SliceOff")
                local c = s .. "CooldownWidget.WidgetTree_8."
                local cd = Add(Obj("WBP_SurvivalSorcery_Cooldown_C", s .. "CooldownWidget", { vis = 1, BackgroundRing = Image(c .. "BackgroundRing", "T_Ring"),
                    TimerRing = Image(c .. "TimerRing", "T_Ring"), IconImage = Image(c .. "IconImage", "T_Clock"), CooldownText = Text(c .. "CooldownText", 10) }))
                W[slice .. i] = Obj("WBP_SurvivalSorcery_RadialSlice_C", at .. slice .. i, { CooldownWidget = cd })
            end
            if key == "R" then
                local q = s .. "QuickAccessSlot.WidgetTree_9."
                W.slots[i] = { EquippedImage = Image(q .. "EquippedImage", "T_QuickAccess_Overlay"), ItemImage = Image(q .. "ItemImage", "T_Item") }
                W.slots[i].EquippedImage.vis = i == 2 and 4 or 1
                -- the slot's own widget: it is turned around the wheel, and its item box has the game's flat durability bar
                local bar = Add(Obj("WBP_DurabilityBar_C", q .. "DurabilityBar", { vis = i < 2 and 4 or 1, ProgressBar = Obj("ProgressBar", q .. "ProgressBar", { Percent = i == 0 and 0.9 or 0.2 }) }))
                W[slice .. i] = Obj("WBP_QuickAccess_RadialSlice_C", at .. slice .. i, { QuickAccessSlot = Obj("WBP_QuickAccessSlot_C", s .. "QuickAccessSlot", { DurabilityBar = bar }),
                    WidgetTree = { RootWidget = Obj("Overlay", s .. "Overlay_33") } })
                W[slice .. i].RenderTransform.Angle = 90 + 45 * i
                if i < 3 then   -- an item: the game draws it with its own material
                    local mid = Obj("MaterialInstanceDynamic", "/Engine/Transient.MID_" .. n .. "_" .. i, { scalars = {} })
                    for k, name in ipairs(SQUARE) do mid.scalars[name] = k == 1 and 1 or 0.5 end
                    W.slots[i].ItemImage.Brush.ResourceObject = mid
                end
            end
        end
        for _, name in ipairs(parts) do W.parts[name] = Image(at .. name, "T_" .. name) end
        W.tree, W.middle = { name = "tree of " .. key }, Obj("Overlay", at .. "Overlay_0")
        W.parts.CenterBg.outer, W.parts.CenterBg.parent = W.tree, W.middle
        for name, size in pairs(texts) do W[name] = Text(at .. name, size, 230) end
        w.wheels[key] = W
        return W, at
    end
    -- the panel of Q and H: collapsed with opacity 0 while both are closed; its switcher shows 0 spells or 1 emotes and keeps it
    local panelPath = root .. "WBP_Spellcasting_MainPanel_C_7"
    w.panel = Add(Obj("WBP_Spellcasting_MainPanel_C", panelPath, { vis = 1 }))
    w.panel.op = 0
    w.panelTree = Add(Obj("WidgetTree", panelPath .. ".WidgetTree_1", { outer = w.panel }))
    w.switcher = Add(Obj("WidgetSwitcher", panelPath .. ".WidgetTree_1.WidgetSwitcher", { idx = 0 }))
    w.panel.WidgetSwitcher = w.switcher
    local Q, at = Wheel("Q","WBP_SurvivalSorcery_RadialSelector_C", "WBP_Spellcasting_MainPanel_C_7.WidgetTree_1.SpellRadialWidget", "RadialSlice_", 12,
        { "RadialBase", "RadialLines", "Pointer", "CenterBg", "LineImage_Top", "LineImage_Middle", "LineImage_Bottom" }, { SpellName = 22, NoCostTextBlock = 18 })
    Q.parts.CenterBg.enabled = false
    -- the two page arrows: no variables of the wheel, so they are reached down its tree (seen in the game, 11-10-2026)
    -- inside each: an overlay with the arrow button, whose own tree holds the picture (seen in the game, 13-10-2026)
    local function Arrow(side)
        local b = at .. "BigArrow" .. side .. "." .. (side == "L" and "Left" or "Right") .. "Button"
        local pic = Obj("CommonLazyImage", b .. ".WidgetTree_4.LabelImage", { Brush = { ResourceObject = Asset("Texture2D", "/Game/UI/T_Arrow_Big"), ImageSize = { X = 64, Y = 64 } } })
        local inner = Obj("Overlay", b .. ".WidgetTree_4.Overlay_210", { kids = { Obj("WBP_DomTextBlock_C", b .. ".WidgetTree_4.LabelText"),
            Obj("ScaleBox", b .. ".WidgetTree_4.ImageScaleBox", { content = pic }) } })
        local button = Obj("WBP_DomButton_SelectorArrow_C", b, { WidgetTree = Obj("WidgetTree", b .. ".WidgetTree_4",
            { RootWidget = Obj("CommonButtonInternalBase", b .. ".WidgetTree_4.InternalRootButtonBase", { content = inner }) }) })
        button.op = 0.8
        local box = Obj("ScaleBox", at .. "BigArrow" .. side, { content = Obj("Overlay", at .. "BigArrow" .. side .. ".Overlay", { kids = { Obj("Image", at .. "BigArrow" .. side .. ".Shadow"), button } }) })
        box.button, box.pic = button, pic
        return box
    end
    Q.arrowL, Q.arrowR = Arrow("L"), Arrow("R")
    -- game 1.0.1: the key of each of the first eight slots, a box 285 units out on the slot's line, all eight in one
    -- overlay (seen 14-10-2026)
    Q.keyHost = Obj("Overlay", at .. "RadialSelectorOverlay", { outer = Q.tree })
    Q.keyHolder, Q.keys = Add(Obj("Overlay", at .. "QuickCastOverlay", { parent = Q.keyHost })), {}
    for i = 0, 7 do
        local box = Add(Obj("WBP_DomInputIconWidget_C", at .. "QuickCastInputPrompt" .. i, { parent = Q.keyHolder }))
        local a = i * math.pi / 6
        box.RenderTransform.Translation = { X = math.floor(285 * math.sin(a) + 0.5), Y = math.floor(-285 * math.cos(a) + 0.5) }
        Q["QuickCastInputPrompt" .. i] = box
        Q.keys[i + 1] = box
    end
    local content = Panel(at .. "RadialContentOverlay", { Obj("ScaleBox", at .. "RadialL"), Q.arrowL, Q.arrowR })
    local box = Obj("SizeBox", at .. "RadialSelectorSBox", { content = Panel(at .. "Overlay_0", { Panel(at .. "VerticalBox_1", { content }) }) })
    Q.WidgetTree = Obj("WidgetTree", at .. "WidgetTree_2", { RootWidget = box })
    -- the middle: the requirement texts are no variables of the wheel; the rune cost widget must not be read
    Q.label, Q.req = Text(at .. "RequirementDescription", 20, 100), Text(at .. "RequirementText", 15, 120)
    Q.cost = Obj("WBP_SpellItemCostContainer_C", at .. "ResourceCostWidget", { kids = {} })
    Q.amounts = { Text(at .. "ResourceCostWidget.WidgetTree_4.WBP_SpellItemCost.WidgetTree_6.AmountText", 14), Text(at .. "ResourceCostWidget.WidgetTree_4.WBP_SpellItemCost_1.WidgetTree_7.AmountText", 14) }
    -- under the wheel: the words "Cooldown 0s" and two spacers beside the spell's name
    Q.under = { Text(at .. "Cooldown", 14), Text(at .. "CooldownText", 14), Text(at .. "CooldownUnits", 14),
        Add(Obj("Spacer", at .. "Spacer_67", { vis = 4 })), Add(Obj("Spacer", at .. "Spacer_116", { vis = 4 })) }
    Q.otherSpacer = Add(Obj("Spacer", at .. "Spacer_5", { vis = 4 }))
    Q.nameBox = Panel(at .. "SizeBox_0", { Q.SpellName }, { WidthOverride = 175, bOverride_WidthOverride = true })
    Q.reqBox = Panel(at .. "SizeBox_4", { Panel(at .. "VerticalBox_0", { Panel(at .. "RequirementBox", { Q.parts.LineImage_Middle, Q.label, Q.req, Q.parts.LineImage_Bottom }) }) })
    -- CostBox is a HorizontalBox in the game; nothing in it, and nothing under it, may be walked
    Q.costBox = Panel(at .. "CostBox", { Q.cost, Q.NoCostTextBlock })
    for _, o in ipairs({ Q.costBox, Q.cost, Q.NoCostTextBlock, Q.amounts[1], Q.amounts[2] }) do o.noWalk = true end
    Q.CenterBox = Panel(at .. "CenterBox", { Q.costBox, Q.nameBox, Q.reqBox, Q.parts.LineImage_Top })
    Q.shade, Q.head = Border(at .. "BottomDescriptionBorder"), Border(at .. "SpellbookSelector.WidgetTree_3.CommonBorder_0", "T_Bar")
    Q.book = Image(at .. "SpellbookSelector.WidgetTree_3.BookIcon", "T_Book")
    -- the header: the overlay that holds the bar, and the four buttons, each with a Foreground that has visibility 0 on the
    -- book in use and 1 on the others. As in the game (probe of 07-10-2026), the numbers in the names are large and book 1
    -- has the highest; the buttons are made in another order, and the spell book has a header of its own.
    Q.headBox, Q.headTree = Obj("Overlay", at .. "SpellbookSelector.WidgetTree_3.Overlay_0"),Obj("WidgetTree", at .. "SpellbookSelector.WidgetTree_3")
    Q.head.parent, Q.head.outer = Q.headBox, Q.headTree
    Q.marks = {}
    local BOOK_NUMBER = { 2147470346, 2147470343, 2147470340, 2147470337 }   -- books 1 to 4
    for _, k in ipairs({ 2, 0, 3, 1 }) do
        local m = Image(at .. "SpellbookSelector.WidgetTree_3.WBP_DomSpellWheelNavButton_C_" .. BOOK_NUMBER[k + 1] .. ".WidgetTree_5.Foreground", "T_Highlight_Foreground")
        m.vis = k == 0 and 0 or 1
        Q.marks[k + 1] = m
    end
    w.bookMark = Image(root .. "WBP_SpellBook_C_3.WidgetTree_1.SpellRadialWidget.WidgetTree_2.SpellbookSelector.WidgetTree_3.WBP_DomSpellWheelNavButton_C_" .. BOOK_NUMBER[1] .. ".WidgetTree_5.Foreground", "T_Highlight_Foreground")
    -- the game's sparks around the middle ring, each with its list of HUD materials
    local function Sparks(name, system, list)
        return Add(Obj("NiagaraSystemWidget", at .. name, { vis = 3, MaterialRemapList = Map(list), NiagaraSystemReference = assets["/Game/Art/VFX/UI/" .. system .. "." .. system] }))
    end
    Q.sparks = Sparks("NS_UI_Radial_Loop", "NS_UI_RadialLoop", { { "M_VFX_UI_Embers", "M_VFX_UI_Embers_UI" } })
    Q.fuse = Sparks("NS_UI_Radial_Fuse", "NS_UI_RadialLoop_Upper", { { "M_VFX_UI_Embers", "M_VFX_UI_Embers_UI" }, { "M_VFX_UI_SmokeSubUV", "M_VFX_UI_SmokeSubUV_UI" } })
    Q.slotSparks = { Add(Obj("NiagaraSystemWidget", at .. "RadialSlice_0.WidgetTree_5.NS_UI_RadialPop", { vis = 3 })),
        Add(Obj("NiagaraSystemWidget", at .. "RadialSlice_0.WidgetTree_5.UnlockNotifyIcon.WidgetTree_6.NS_UI_NewUnseenUnlock", { vis = 3 })) }
    w.otherSparks = Add(Obj("NiagaraSystemWidget", root .. "WBP_LevelUp_C_1.WidgetTree_1.NS_UI_LevelUp", { vis = 3 }))
    Wheel("R", "WBP_QuickAccess_RadialSelector_C", "WBP_QuickAccess_RadialSelector_C_2147482", "RadialSlice", 8, { "RadialBase", "Pointer", "CenterBg" }, { ItemName = 24 })
    Wheel("H", "WBP_Emotes_RadialSelector_C", "WBP_Spellcasting_MainPanel_C_7.WidgetTree_1.EmoteRadialWidget", "RadialSlice", 6, { "RadialBase", "CenterBg" }, { EmoteName = 24 })
    -- the spell book's wheel: the Q class, another parent
    w.book = Obj("WBP_SurvivalSorcery_RadialSelector_C", root .. "WBP_SpellBook_C_3.WidgetTree_1.SpellRadialWidget", { vis = 1 })
    w.bookSlice = Image(root .. "WBP_SpellBook_C_3.WidgetTree_1.SpellRadialWidget.WidgetTree_2.RadialSlice_0.WidgetTree_5.Background", "T_Slice")
    return w
end

-- every value the mod may write, as one text per object
local function Col(c) return c and string.format("%.2f,%.2f,%.2f,%.2f", c.R, c.G, c.B, c.A) or "-" end
local function State(w)
    local out = {}
    for _, o in ipairs(w.all) do
        local b = o.Brush or o.Background
        local r = b and b.ResourceObject
        local t, p = o.RenderTransform, o.Slot.Padding
        local s = { o.full, r and r.full or "-", tostring(o.vis), tostring(o.enabled), Col(o.BrushColor), tostring(o.bIsScrollingEnabled), tostring(o.WidthOverride),
            o.op, t.Scale.X, t.Scale.Y, t.Translation.X, t.Translation.Y, o.RenderTransformPivot.X, p.Left, p.Top, p.Right, p.Bottom }
        if r and r.scalars then for _, name in ipairs(SQUARE) do s[#s + 1] = r.scalars[name] end end
        if o.Brush then s[#s + 1] = Col(b.TintColor.SpecifiedColor) .. b.TintColor.ColorUseRule .. " " .. b.ImageSize.X .. " " .. Col(o.ColorAndOpacity) end
        if o.Font then s[#s + 1] = o.Font.FontObject.full .. o.Font.Size .. Col(o.ColorAndOpacity.SpecifiedColor) end
        out[#out + 1] = table.concat(s, "|")
    end
    return table.concat(out, "\\n")
end
local function Calls(w) local n = 0 for _, o in ipairs(w.all) do n = n + o.n end return n end

local world, on, hidden, font, pad = World(1), true, {}, poppins, false   -- pad: a gamepad is the input in use
-- veil: a part of a full name; the widgets with it are not built yet. The search for spark widgets is counted
-- apart, and it finds the ones that the mod made in this world too.
function FindAllOf(cls)
    local list = {}
    for _, o in ipairs(world.byClass[cls]) do if not (world.veil and string.find(o.full, world.veil, 1, true)) then list[#list + 1] = o end end
    if cls == "NiagaraSystemWidget" then
        sparkSearches = sparkSearches + 1
        for _, o in ipairs(Made(cls, world.from)) do list[#list + 1] = o end
    elseif cls == "WidgetSwitcher" then switchSearches = switchSearches + 1
    else sweeps = sweeps + 1 end
    return list
end
${cached}
local Parts = load(PARTSTEXT)()
local M = load(SRCTEXT)()
local gnames = 0
local ctx = { Log = function(m) logs[#logs + 1] = m print(m) end, Font = function() return font end, CachedTex = CachedTex, Parts = Parts, Spells = load(SPELLSTEXT)(),
    Meters = load(METERSTEXT)(), Books = load(BOOKSTEXT)(), G = function(name) gnames = gnames + 1 return name .. "_" .. gnames end,
    On = function() return on end, Pad = function() return pad end,
    Find = function(cls, paths)   -- as finder.lua: live widgets of the class whose full name matches a path
        local list, keys = {}, {}
        for _, W in ipairs({ world.book, world.wheels.Q, world.wheels.R, world.wheels.H }) do
            local fits = not paths
            for _, p in ipairs(paths or {}) do if string.find(W.full, p) then fits = true end end
            if W.cls == cls and fits and not hidden[cls] then list[#list + 1], keys[#keys + 1] = W, W.full end
        end
        return list, keys
    end }
local function Step(dt) clock = clock + (dt or 0.6) M.Tick(ctx) end
-- a step that finds the wheels, and the fast steps after it: the search of the parts and the look of each wheel have a step each
local function Build(dt) Step(dt) for _ = 1, 4 do Step(0.11) end end
-- Q or H open or closed as the game does it: the wheel stays at visibility 4, the panel shows (opacity fades, so it is not
-- read), and the switcher keeps its last page when the wheel closes
function Open(key, on)
    local p = world.panel
    p.vis, p.op = on and 4 or 1, on and 1 or 0
    if on then world.switcher.idx = key == "Q" and 0 or 1 end
end
local function Logged(text) for _, m in ipairs(logs) do if string.find(m, text, 1, true) then return true end end return false end
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local function File(I) local r = (I.Brush or I.Background).ResourceObject return r and r.file end

`;
// Without more: the process ends with the result. keepGoing: the number of failed checks comes back, so a test file can run more than one scenario.
exports.run = function run(scenario, keepGoing) {
  const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
  for (const [name, file] of [['SRCTEXT', 'wheels.lua'], ['PARTSTEXT', 'wheelparts.lua'], ['SPELLSTEXT', 'wheelspells.lua'], ['METERSTEXT', 'wheelmeters.lua'], ['BOOKSTEXT', 'wheelbooks.lua']]) {
    lua.lua_pushstring(L, to_luastring(read(file))); lua.lua_setglobal(L, to_luastring(name));
  }
  const text = world + scenario + '\nprint(fails == 0 and "ALL PASS" or (fails .. " FAILED"))\nreturn fails\n';
  if (lauxlib.luaL_dostring(L, to_luastring(text)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
  const fails = lua.lua_tointeger(L, -1);
  if (keepGoing) return fails;
  process.exit(fails ? 1 : 0);
};
