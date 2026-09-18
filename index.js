import { ensureBundledStatusRegex, statusRegexRuntime } from './status-regex.js';
import { getRequestHeaders } from '/script.js';

(async () => {
  const VERSION = '0.2.30';
  const MODULE_NAME = 'st_paperdoll_wardrobe';
  const EXTENSION_ROOT = new URL('.', import.meta.url).href;
  const DEFAULT_IMAGE = new URL('./assets/body/base/body_base_001.png', import.meta.url).href;
  const GIF_ENCODER_URL = new URL('./vendor/gifenc.esm.js', import.meta.url).href;
  const INLINE_STATUS_DOLL_SCALE = 0.72;
  const STORAGE_KEY = 'xj-paperdoll-v21-eye-highlight';
  const BUILTIN_AI_PROMPT_ID = 'builtin-default';
  const PACK_FORMAT = 'st-paperdoll-pack';
  const PACK_FORMAT_VERSION = 1;
  const PACK_DB_NAME = 'xj-paperdoll-asset-packs-v1';
  const PACK_DB_STORE = 'files';
  const PACK_CLOTHING_SLOTS = Object.freeze(['top', 'bottom', 'dress', 'coat']);
  const PACK_LAYERED_HAIR_SLOTS = Object.freeze(['back_hair']);
  const PACK_POSITIONED_HAIR_SLOTS = Object.freeze(['braid_left', 'braid_right']);
  const PACK_BACK_VARIANT_SLOTS = Object.freeze([...PACK_CLOTHING_SLOTS, ...PACK_LAYERED_HAIR_SLOTS]);
  const AI_PROMPT_VARIABLES = Object.freeze([
    { token: '{{当前状态}}', label: '当前完整状态' },
    { token: '{{可用分类部件}}', label: '按区域分类的可用部件' },
    { token: '{{可用染色区}}', label: '剧情自动配色范围' },
    { token: '{{当前衣着}}', label: '当前衣着' },
    { token: '{{当前表情}}', label: '当前表情' },
    { token: '{{可用部件}}', label: '可用部件' },
    { token: '{{可用表情}}', label: '可用表情' },
  ]);
  const DEFAULT_AI_PROMPT_TEMPLATE = `[纸娃娃实时状态]
以下是 user 当前唯一有效的可见状态；若与 user 设定、世界书或历史描述冲突，以此为准，不得合并旧衣着。
{{当前状态}}

可用部件（括号栏目名只用于选择，不得写入状态）：
{{可用分类部件}}
可用表情：{{可用表情}}

规则：
1. 自然续写；状态是本轮结束后的完整结果。仅在剧情中明确穿脱、更换或表情变化时修改，否则保持原值。
2. 部件只能从同一区域的可用部件中选择，名称须完整，禁止跨区域、简称或编造；多件以顿号“、”分隔，没有部件写“无”。
3. 同一括号栏目最多选择一件；括号栏目名不得复制进状态。
4. 表情只能从可用表情中选择；无可用表情时保持原值。
5. 正文末尾必须且只能输出一次以下完整状态结构；若附加衣柜增量协议触发，先输出 <新衣服>，再输出本结构。字段与顺序不得改变：
<user状态>
头饰：部件或无
颈饰：部件或无
内衣：部件或无
内裤：部件或无
衣装：部件或无
外搭：部件或无
手饰：部件或无
袜子：部件或无
鞋子：部件或无
其他配饰：部件或无
表情：状态名
</user状态>
6. 状态块会显示为 user 可读的状态栏，同时供下一轮理解当前形象；正文无需重复解释。`;

  const AI_NEW_CLOTHES_PROMPT_TEMPLATE = `[衣柜增量协议]
用途：编码本轮正文已经成立的 user 衣着变化；不得因本协议新增、改写或推动换装情节。
触发：本轮确认 user 已获得、穿上或完成改色的新款，且外观可由现有部件仅通过染色实现。行为主体与成因不参与判定。
排除：未完成、假设、计划、询问、拒绝、单纯看见、不属于 user，或必须改变版型、结构、材质、图案才能表现的衣物。

存在有效新款时，在 <user状态> 之前输出：
<新衣服>
区域｜基底｜新名称｜染色配方
</新衣服>

约束：
- 标签内每行直接以真实区域名开头；不要写序号、项目符号、解释或“生成：”前缀。
- 基底与区域取自“可用部件”。剧情自动配色范围：{{可用染色区}}
- 未列出局部范围的基底，配方必须且只能包含一个“整体=#RRGGBB”。
- 花括号内列出局部范围的基底，默认只使用这些真实范围，不要自动追加“整体”；范围名必须逐字复制，多个染色项以半角分号分隔。
- 只有正文明确改变了整件基底的统一底色时，局部范围基底才使用“整体=#RRGGBB”；除非正文同时明确了整体底色与局部颜色，否则不要混用整体和局部。
- “区域”“基底”“新名称”“范围”“染色范围”均为说明词，不得作为字段值原样输出。
- 色值为六位 RGB，脚本会将其作为覆盖图层的颜色应用到黑白原稿；无需根据灰度底图预先提亮。每件一行；每轮至多三件；标签内不写解释。
- 新名称可以自然命名，但不得暗示基底不具备的材质、版型、长度、图案或结构。
- 仅穿上已有款：不输出 <新衣服>。
- 新款已穿上：随后 <user状态> 使用新名称；仅获得未穿：不改变穿戴状态。
- 无有效新款：省略整个标签。
- 无法由现有部件染色表现的衣物可以写入正文，但不得伪造结构化指令。`;

  const MAX_AI_GENERATED_WARDROBE_ITEMS = 3;
  const COLOR_BRIGHTNESS_MAX = 400;


  const EXTENSION_DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    showButton: true,
    blinkEnabled: true,
    aiStateEnabled: true,
    aiWardrobeGenerationEnabled: true,
    defaultGroup: '服装',
  });

  function getExtensionSettings() {
    const ctx = getSTContext();
    if (!ctx?.extensionSettings) {
      ST_WIN.__stPaperdollFallbackSettings = {
        ...EXTENSION_DEFAULT_SETTINGS,
        ...(ST_WIN.__stPaperdollFallbackSettings || {}),
      };
      return ST_WIN.__stPaperdollFallbackSettings;
    }
    if (!ctx.extensionSettings[MODULE_NAME] || typeof ctx.extensionSettings[MODULE_NAME] !== 'object') {
      ctx.extensionSettings[MODULE_NAME] = { ...EXTENSION_DEFAULT_SETTINGS };
    }
    for (const key of Object.keys(EXTENSION_DEFAULT_SETTINGS)) {
      if (!Object.hasOwn(ctx.extensionSettings[MODULE_NAME], key)) {
        ctx.extensionSettings[MODULE_NAME][key] = EXTENSION_DEFAULT_SETTINGS[key];
      }
    }
    return ctx.extensionSettings[MODULE_NAME];
  }

  function saveExtensionSettings() {
    try { getSTContext()?.saveSettingsDebounced?.(); } catch (_) {}
  }

  function isPaperdollEnabled() {
    return getExtensionSettings().enabled !== false;
  }

  const ATLAS = {
    w: 286,
    h: 222,
    full: { x: 0, y: 0, w: 125, h: 222 },
    bust: { x: 126, y: 0, w: 160, h: 222 },
  };

  const GROUPS = ['身体', '发型', '脸部', '服装', '配饰'];
  const LAYERS = [
    { key: 'body', label: '人模', group: '身体' },

    { key: 'back_hair_base', label: '后发（底）', group: '发型', hidden: true },
    { key: 'back_hair', label: '后发', group: '发型' },
    { key: 'braid_left_base', label: '左辫（底）', group: '发型', hidden: true },
    { key: 'braid_left', label: '左辫', group: '发型' },
    { key: 'braid_right_base', label: '右辫（底）', group: '发型', hidden: true },
    { key: 'braid_right', label: '右辫', group: '发型' },
    { key: 'side_hair', label: '鬓发', group: '发型' },
    { key: 'front_hair', label: '前发', group: '发型' },

    { key: 'eye_shape', label: '眼型/眼白', group: '脸部' },
    { key: 'pupil', label: '瞳孔', group: '脸部' },
    { key: 'eye_highlight', label: '眼睛高光', group: '脸部' },
    { key: 'eyelid', label: '眼皮', group: '脸部' },
    { key: 'eyebrow', label: '眉毛', group: '脸部' },
    { key: 'eyebrow_top', label: '眉毛（置顶）', group: '脸部', hidden: true },
    { key: 'mouth', label: '嘴巴', group: '脸部' },
    { key: 'face_mark', label: '面饰', group: '脸部' },
    { key: 'face_effect_base', label: '面部底效', group: '脸部' },
    { key: 'face_effect_top', label: '面部顶效', group: '脸部' },

    { key: 'panty', label: '内裤', group: '服装' },
    { key: 'underwear', label: '内衣', group: '服装' },
    { key: 'wrist_accessory', label: '手饰', group: '服装' },
    { key: 'socks', label: '袜子', group: '服装' },
    { key: 'shoes', label: '鞋子', group: '服装' },
    { key: 'bottom', label: '下装', group: '服装' },
    { key: 'top', label: '上衣', group: '服装' },
    { key: 'coat', label: '外套', group: '服装' },
    { key: 'dress', label: '连衣裙', group: '服装' },

    { key: 'accessory_back_2', label: '配饰-2', group: '配饰' },
    { key: 'accessory_back_1', label: '配饰-1', group: '配饰' },
    { key: 'neck_accessory', label: '颈饰', group: '配饰' },
    { key: 'hair_deco', label: '后发饰', group: '配饰' },
    { key: 'head_ears', label: '兽耳', group: '配饰' },
    { key: 'accessory1', label: '配饰1', group: '配饰' },
    { key: 'accessory2', label: '配饰2', group: '配饰' },
    { key: 'accessory3', label: '配饰3', group: '配饰' },
  ];

  const RENDER_ORDER = [
    'accessory_back_2',
    'accessory_back_1',
    'braid_left_base',
    'braid_right_base',
    'back_hair_base',
    'bottom_back',
    'top_back',
    'dress_back',
    'coat_back',
    'body',
    'face_mark',
    'panty',
    'underwear',
    'wrist_accessory',
    'socks',
    'shoes',
    'bottom',
    'top',
    'dress',
    'coat',
    'back_hair',
    'braid_left',
    'braid_right',
    'mouth',
    'eye_shape',
    'pupil',
    'eye_highlight',
    'eyelid',
    'eyebrow',
    'face_effect_base',
    'face_effect_top',
    'hair_deco',
    'side_hair',
    'neck_accessory',
    'head_ears',
    'front_hair',
    'eyebrow_top',
    'accessory1',
    'accessory2',
    'accessory3',
  ];

  const HAIR_LAYER_KEYS = ['back_hair_base', 'back_hair', 'braid_left_base', 'braid_left', 'braid_right_base', 'braid_right', 'side_hair', 'front_hair'];
  const EXPRESSION_LAYER_KEYS = ['pupil', 'eyebrow', 'mouth', 'face_effect_base', 'face_effect_top'];
  const CLOTHING_LAYER_KEYS = ['panty', 'underwear', 'wrist_accessory', 'socks', 'shoes', 'bottom', 'top', 'coat', 'dress'];
  const ACCESSORY_LAYER_KEYS = ['face_mark', 'accessory_back_2', 'accessory_back_1', 'neck_accessory', 'hair_deco', 'head_ears', 'accessory1', 'accessory2', 'accessory3'];
  const AI_WEARABLE_LAYER_KEYS = [
    'underwear', 'panty', 'socks', 'top', 'bottom', 'dress', 'coat', 'shoes',
    'wrist_accessory', 'neck_accessory', 'hair_deco', 'head_ears', 'face_mark',
    'accessory_back_2', 'accessory_back_1', 'accessory1', 'accessory2', 'accessory3',
  ];
  const DEFAULT_WARDROBE_ID = 'wardrobe_default';
  const WARDROBE_CATEGORY_DEFS = Object.freeze([
    { key: 'head', label: '头饰', layerKeys: ['hair_deco', 'head_ears'] },
    { key: 'neck', label: '颈饰', layerKeys: ['neck_accessory'] },
    { key: 'underwear', label: '内衣', layerKeys: ['underwear'] },
    { key: 'panty', label: '内裤', layerKeys: ['panty'] },
    { key: 'outfit', label: '衣装', layerKeys: ['top', 'bottom', 'dress'] },
    { key: 'outer', label: '外搭', layerKeys: ['coat'] },
    { key: 'hand', label: '手饰', layerKeys: ['wrist_accessory'] },
    { key: 'socks', label: '袜子', layerKeys: ['socks'] },
    { key: 'shoes', label: '鞋子', layerKeys: ['shoes'] },
    { key: 'other', label: '其他配饰', layerKeys: ['face_mark', 'accessory_back_2', 'accessory_back_1', 'accessory1', 'accessory2', 'accessory3'] },
  ]);
  const FLEXIBLE_ACCESSORY_LAYER_KEYS = Object.freeze([
    'accessory_back_2', 'accessory_back_1', 'accessory1', 'accessory2', 'accessory3',
  ]);
  const ACCESSORY_SHARED_SLOTS = Object.freeze(['accessory1', 'accessory2', 'accessory3']);
  const PACK_ALLOWED_SLOTS = Object.freeze(LAYERS.filter(layer => !layer.hidden).map(layer => layer.key));
  const AI_PROMPT_KEY = 'st_paperdoll_user_state';


const COLOR_DEFAULTS = {
    colorHex: '#d96b87',
    tintStrength: 0,
    saturation: 100,
    brightness: 100,
    contrast: 100,
    preserveLines: true,
    colorMapping: 'multiply',
  };

  function isHairLayer(layerKey) {
    return HAIR_LAYER_KEYS.includes(layerKey);
  }

  const defaultState = {
    visible: true,
    stageSide: 'right',
    scale: 0.72,
    yOffset: 0,
    bottomTrim: 0,
    activeGroup: '服装',
    activeLayer: 'dress',
    panelPage: 'wardrobe',
    wardrobeColumns: 'auto',
    wardrobes: [],
    activeWardrobeId: DEFAULT_WARDROBE_ID,
    wardrobeItems: [],
    wornWardrobeEntries: {},
    activeWardrobeCategory: 'outfit',
    wardrobeDataVersion: 0,
    importMenuLayer: null,
    currentPlanId: null,
    plans: [],
    userBindings: {},
    autoFollowUser: false,
    lastUserKey: null,
    manualUserSlot: '',
    manualUserSlots: [],
    aiNames: {},
    aiClothingPool: [],
    expressionPresets: [],
    currentExpressionId: null,
    expressionEditorOpen: false,
    editingExpressionId: null,
    aiPromptPresets: [],
    activeAiPromptPresetId: BUILTIN_AI_PROMPT_ID,
    assetPacks: [],
    dyeSettings: {},
    hairGroupColor: { ...COLOR_DEFAULTS },
    layerModes: {
      eyebrow: 'normal',
      braid_left: 'back',
      braid_right: 'back',
      outfitOrder: 'topOverBottom',
    },
    layers: {},
  };

  function blankLayers() {
    const layers = {};
    for (const layer of LAYERS) {
      layers[layer.key] = { visible: true, selectedId: null, items: [], ...COLOR_DEFAULTS, followHairGroup: isHairLayer(layer.key) };
    }
    return layers;
  }

  function defaultWardrobeRecord() {
    return { id: DEFAULT_WARDROBE_ID, name: '默认衣柜', createdAt: Date.now(), updatedAt: Date.now() };
  }

  function wardrobeCategoryForLayer(layerKey) {
    return WARDROBE_CATEGORY_DEFS.find(category => category.layerKeys.includes(layerKey))?.key || 'other';
  }

  function getWardrobeCategoryDef(categoryKey) {
    return WARDROBE_CATEGORY_DEFS.find(category => category.key === categoryKey) || WARDROBE_CATEGORY_DEFS.at(-1);
  }

  function allowedWardrobeCategoriesForLayer(layerKey) {
    return FLEXIBLE_ACCESSORY_LAYER_KEYS.includes(layerKey)
      ? ['head', 'neck', 'hand', 'other']
      : [wardrobeCategoryForLayer(layerKey)];
  }

  function normalizeWardrobeCollections(stateObj, saved) {
    stateObj.wardrobes = Array.isArray(saved.wardrobes)
      ? saved.wardrobes.filter(item => item && item.id && item.name).map(item => ({ ...item, name: String(item.name).trim().slice(0, 40) || '未命名衣柜' }))
      : [];
    if (!stateObj.wardrobes.length) stateObj.wardrobes.push(defaultWardrobeRecord());
    if (!stateObj.wardrobes.some(item => item.id === DEFAULT_WARDROBE_ID)) stateObj.wardrobes.unshift(defaultWardrobeRecord());
    stateObj.activeWardrobeId = stateObj.wardrobes.some(item => item.id === saved.activeWardrobeId)
      ? saved.activeWardrobeId
      : DEFAULT_WARDROBE_ID;
    stateObj.wardrobeItems = Array.isArray(saved.wardrobeItems)
      ? saved.wardrobeItems.filter(item => item && item.id && item.name && item.layerKey && item.sourceItemId).map(item => {
          const allowed = allowedWardrobeCategoriesForLayer(item.layerKey);
          return {
            ...item,
            wardrobeId: stateObj.wardrobes.some(wardrobe => wardrobe.id === item.wardrobeId) ? item.wardrobeId : DEFAULT_WARDROBE_ID,
            name: normalizeAiName(item.name),
            categoryKey: allowed.includes(item.categoryKey) ? item.categoryKey : allowed[0],
            recipe: normalizeWardrobeRecipe(item.recipe),
          };
        })
      : [];
    stateObj.wornWardrobeEntries = saved.wornWardrobeEntries && typeof saved.wornWardrobeEntries === 'object'
      ? { ...saved.wornWardrobeEntries }
      : {};
    const migratedActiveCategory = ({
      close: 'underwear',
      leg: 'socks',
      foot: 'shoes',
    })[saved.activeWardrobeCategory] || saved.activeWardrobeCategory;
    stateObj.activeWardrobeCategory = WARDROBE_CATEGORY_DEFS.some(category => category.key === migratedActiveCategory)
      ? migratedActiveCategory
      : 'outfit';
    stateObj.wardrobeDataVersion = Number(saved.wardrobeDataVersion || 0);
    for (const plan of stateObj.plans || []) {
      if (!stateObj.wardrobes.some(wardrobe => wardrobe.id === plan.wardrobeId)) plan.wardrobeId = DEFAULT_WARDROBE_ID;
    }
  }

  function migrateLegacyPoolToDefaultWardrobe(stateObj) {
    if (stateObj.wardrobeDataVersion >= 1) return;
    const existingIds = new Set(stateObj.wardrobeItems.map(item => item.id));
    const migratedIdentities = new Set();
    for (const key of stateObj.aiClothingPool || []) {
      const parsed = splitWearableKey(key);
      const layer = parsed ? stateObj.layers?.[parsed.layerKey] : null;
      const item = layer?.items?.find(entry => entry.id === parsed.itemId);
      if (!item) continue;
      const legacyIdentity = isSharedAccessorySlot(parsed.layerKey) ? `shared-accessory::${parsed.itemId}` : key;
      if (migratedIdentities.has(legacyIdentity)) continue;
      const id = `closet_legacy_${stableHash(key)}`;
      if (existingIds.has(id)) continue;
      const name = normalizeAiName(stateObj.aiNames?.[key] || item.name || '未命名部件');
      const categoryKey = wardrobeCategoryForLayer(parsed.layerKey);
      const usedNames = stateObj.wardrobeItems
        .filter(entry => entry.wardrobeId === DEFAULT_WARDROBE_ID && entry.categoryKey === categoryKey)
        .map(entry => entry.name);
      stateObj.wardrobeItems.push({
        id,
        wardrobeId: DEFAULT_WARDROBE_ID,
        name: nextWardrobeItemName(name, usedNames),
        categoryKey,
        layerKey: parsed.layerKey,
        sourceItemId: parsed.itemId,
        sourcePackId: item.packId || '',
        recipe: captureWardrobeRecipeFor(stateObj, parsed.layerKey, item),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        migratedFromPool: true,
      });
      existingIds.add(id);
      migratedIdentities.add(legacyIdentity);
    }
    stateObj.aiClothingPool = [];
    stateObj.wardrobeDataVersion = 1;
    for (const plan of stateObj.plans || []) {
      if (!plan.wardrobeId) plan.wardrobeId = DEFAULT_WARDROBE_ID;
    }
  }

  function ensureBuiltIns(stateObj) {
    const body = stateObj.layers.body;
    if (!body.items.some(item => item.id === 'builtin_body')) {
      body.items.unshift({ id: 'builtin_body', name: '默认人模', url: DEFAULT_IMAGE, source: 'builtin' });
    }
    if (!body.selectedId) body.selectedId = 'builtin_body';
  }

  function loadState() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) {}
    if (saved.layers && typeof saved.layers === 'object') {
      const legacyHandLayer = saved.layers['hand_' + 'accessory'];
      if (legacyHandLayer && !saved.layers.wrist_accessory) saved.layers.wrist_accessory = legacyHandLayer;

      // v0.1.2 恢复 PSD 的真实分层：后发自动绑定前/底；左辫、右辫分成两个栏目。
      if (saved.layers.braid && !saved.layers.braid_left && !saved.layers.braid_right) {
        const selected = String(saved.layers.braid.selectedId || '');
        if (selected.includes('right')) saved.layers.braid_right = saved.layers.braid;
        else saved.layers.braid_left = saved.layers.braid;
      }
    }
    if (saved.activeLayer === 'hand_' + 'accessory') saved.activeLayer = 'wrist_accessory';
    if (saved.activeLayer === 'braid') saved.activeLayer = 'braid_left';
    if (['braid_left_base', 'braid_base'].includes(saved.activeLayer)) saved.activeLayer = 'braid_left';
    if (saved.activeLayer === 'braid_right_base') saved.activeLayer = 'braid_right';
    if (saved.activeLayer === 'back_hair_base') saved.activeLayer = 'back_hair';
    const stateObj = { ...defaultState, ...saved };
    delete stateObj.planPanelOpen;
    delete stateObj.expressionPanelOpen;
    delete stateObj.previewMode;
    delete stateObj.wardrobeMode;
    if (!['left', 'right'].includes(stateObj.stageSide)) stateObj.stageSide = 'right';
    if (!['wardrobe', 'closet', 'expression', 'plans', 'settings'].includes(stateObj.panelPage)) stateObj.panelPage = 'wardrobe';
    if (!['auto', '3', '4', '5'].includes(String(stateObj.wardrobeColumns))) stateObj.wardrobeColumns = 'auto';
    stateObj.layerModes = { ...defaultState.layerModes, ...(saved.layerModes || {}) };
    if (!['back', 'front'].includes(stateObj.layerModes.braid_left)) stateObj.layerModes.braid_left = 'back';
    if (!['back', 'front'].includes(stateObj.layerModes.braid_right)) stateObj.layerModes.braid_right = 'back';
    if (!['topOverBottom', 'bottomOverTop'].includes(stateObj.layerModes.outfitOrder)) stateObj.layerModes.outfitOrder = 'topOverBottom';
    stateObj.plans = Array.isArray(saved.plans) ? saved.plans : [];
    stateObj.userBindings = saved.userBindings && typeof saved.userBindings === 'object' ? saved.userBindings : {};
    stateObj.autoFollowUser = false;
    stateObj.currentPlanId = saved.currentPlanId || null;
    stateObj.manualUserSlot = typeof saved.manualUserSlot === 'string' ? saved.manualUserSlot : '';
    stateObj.manualUserSlots = Array.isArray(saved.manualUserSlots) ? saved.manualUserSlots.filter(Boolean) : [];
    stateObj.aiNames = saved.aiNames && typeof saved.aiNames === 'object' ? saved.aiNames : {};
    stateObj.aiClothingPool = Array.isArray(saved.aiClothingPool) ? [...new Set(saved.aiClothingPool.filter(Boolean))] : [];
    normalizeWardrobeCollections(stateObj, saved);
    stateObj.expressionPresets = Array.isArray(saved.expressionPresets) ? saved.expressionPresets.filter(item => item && item.id && item.name) : [];
    stateObj.currentExpressionId = saved.currentExpressionId || null;
    stateObj.expressionEditorOpen = !!saved.expressionEditorOpen;
    stateObj.editingExpressionId = saved.editingExpressionId || null;
    stateObj.aiPromptPresets = Array.isArray(saved.aiPromptPresets)
      ? saved.aiPromptPresets.filter(item => item && item.id && item.name && typeof item.template === 'string')
      : [];
    stateObj.assetPacks = Array.isArray(saved.assetPacks)
      ? saved.assetPacks.filter(pack => pack && pack.id && pack.name)
      : [];
    stateObj.dyeSettings = saved.dyeSettings && typeof saved.dyeSettings === 'object'
      ? cloneDyeSettingsMap(saved.dyeSettings)
      : {};
    stateObj.activeAiPromptPresetId = typeof saved.activeAiPromptPresetId === 'string'
      ? saved.activeAiPromptPresetId
      : BUILTIN_AI_PROMPT_ID;
    if (stateObj.activeAiPromptPresetId !== BUILTIN_AI_PROMPT_ID
      && !stateObj.aiPromptPresets.some(item => item.id === stateObj.activeAiPromptPresetId)) {
      stateObj.activeAiPromptPresetId = BUILTIN_AI_PROMPT_ID;
    }
    stateObj.hairGroupColor = { ...COLOR_DEFAULTS, ...(saved.hairGroupColor || {}) };
    if (stateObj.currentPlanId && !stateObj.plans.some(plan => plan.id === stateObj.currentPlanId)) stateObj.currentPlanId = null;
    stateObj.layers = blankLayers();
    for (const key of Object.keys(stateObj.layers)) {
      stateObj.layers[key] = { ...stateObj.layers[key], ...(saved.layers?.[key] || {}) };
      if (!Array.isArray(stateObj.layers[key].items)) stateObj.layers[key].items = [];
      stateObj.layers[key] = { ...COLOR_DEFAULTS, ...stateObj.layers[key] };
      if (typeof stateObj.layers[key].followHairGroup !== 'boolean') stateObj.layers[key].followHairGroup = isHairLayer(key);
    }
    // v0.2.9 起辫子只使用主图切换渲染层级，旧版隐藏底图选择不再参与显示。
    stateObj.layers.braid_left_base.selectedId = null;
    stateObj.layers.braid_right_base.selectedId = null;
    ensureBuiltIns(stateObj);
    migrateLegacyPoolToDefaultWardrobe(stateObj);
    repairWornWardrobeEntries(stateObj);
    if (!GROUPS.includes(stateObj.activeGroup)) stateObj.activeGroup = '服装';
    if (!LAYERS.some(layer => layer.key === stateObj.activeLayer && !layer.hidden)) stateObj.activeLayer = groupedLayers(stateObj.activeGroup)[0]?.key || 'body';
    if (!groupedLayers(stateObj.activeGroup).some(layer => layer.key === stateObj.activeLayer)) {
      stateObj.activeLayer = groupedLayers(stateObj.activeGroup)[0]?.key || 'body';
    }
    return stateObj;
  }

  let state = loadState();

  let packDbPromise = null;
  let pendingPackImport = null;
  let zipReaderPromise = null;
  const packRuntimeUrls = new Map();

  function openPackDb() {
    if (packDbPromise) return packDbPromise;
    packDbPromise = new Promise((resolve, reject) => {
      const indexedDb = ST_WIN.indexedDB || globalThis.indexedDB;
      if (!indexedDb) return reject(new Error('当前浏览器不支持素材图包存储。'));
      const request = indexedDb.open(PACK_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PACK_DB_STORE)) db.createObjectStore(PACK_DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('无法打开素材图包存储。'));
    }).catch(error => {
      packDbPromise = null;
      throw error;
    });
    return packDbPromise;
  }

  function idbRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('素材图包存储失败。'));
    });
  }

  async function putPackFiles(entries) {
    if (!entries.length) return;
    const db = await openPackDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PACK_DB_STORE, 'readwrite');
      const store = tx.objectStore(PACK_DB_STORE);
      for (const entry of entries) store.put(entry.blob, entry.key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('图包图片写入失败。'));
      tx.onabort = () => reject(tx.error || new Error('图包图片写入已中止。'));
    });
  }

  async function getPackFile(storageKey) {
    const db = await openPackDb();
    const tx = db.transaction(PACK_DB_STORE, 'readonly');
    return idbRequest(tx.objectStore(PACK_DB_STORE).get(storageKey));
  }

  async function deleteStoredPackFiles(packId, keepKeys = null) {
    const db = await openPackDb();
    const prefix = `${packId}/`;
    const keep = keepKeys ? new Set(keepKeys) : null;
    const readTx = db.transaction(PACK_DB_STORE, 'readonly');
    const keys = await idbRequest(readTx.objectStore(PACK_DB_STORE).getAllKeys());
    const targets = keys.filter(key => String(key).startsWith(prefix) && !keep?.has(String(key)));
    if (!targets.length) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PACK_DB_STORE, 'readwrite');
      const store = tx.objectStore(PACK_DB_STORE);
      targets.forEach(key => store.delete(key));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('旧图包图片清理失败。'));
      tx.onabort = () => reject(tx.error || new Error('旧图包图片清理已中止。'));
    });
  }

  function revokePackRuntimeUrls(packId = '') {
    const prefix = packId ? `${packId}/` : '';
    for (const [key, url] of packRuntimeUrls) {
      if (prefix && !key.startsWith(prefix)) continue;
      try { (ST_WIN.URL || URL).revokeObjectURL(url); } catch (_) {}
      packRuntimeUrls.delete(key);
    }
  }

  async function ensurePackRuntimeUrl(storageKey) {
    if (!storageKey) return '';
    if (packRuntimeUrls.has(storageKey)) return packRuntimeUrls.get(storageKey);
    const blob = await getPackFile(storageKey);
    if (!blob) return '';
    const url = (ST_WIN.URL || URL).createObjectURL(blob);
    packRuntimeUrls.set(storageKey, url);
    return url;
  }

  function collectItemStorageKeys(item) {
    if (!item || item.source !== 'pack') return [];
    const keys = [item.frontStorageKey, item.backStorageKey];
    for (const region of item.dyeRegions || []) {
      keys.push(region.frontMaskStorageKey, region.backMaskStorageKey);
    }
    return keys.filter(Boolean);
  }

  async function hydratePackAssets(packId = '') {
    const items = Object.values(state.layers || {}).flatMap(layer => layer.items || [])
      .filter(item => item.source === 'pack' && (!packId || item.packId === packId));
    const keys = [...new Set(items.flatMap(collectItemStorageKeys))];
    await Promise.all(keys.map(async key => {
      try { await ensurePackRuntimeUrl(key); } catch (error) { console.warn('[纸娃娃] 图包图片读取失败：', key, error); }
    }));
  }

  function assetVariantUrl(item, variant = 'front') {
    if (!item) return '';
    if (item.source !== 'pack') return variant === 'front' ? (item.url || '') : (item.backUrl || '');
    const key = variant === 'back' ? item.backStorageKey : item.frontStorageKey;
    return key ? (packRuntimeUrls.get(key) || '') : '';
  }

  function dyeMaskUrl(region, variant = 'front') {
    const key = variant === 'back' ? region?.backMaskStorageKey : region?.frontMaskStorageKey;
    return key ? (packRuntimeUrls.get(key) || '') : '';
  }

  function dyeSettingKey(item, region) {
    return `${item?.packId || 'item'}::${item?.packItemId || item?.id || 'unknown'}::${region?.id || 'region'}`;
  }

  function clampSetting(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  }

  function dyeRegionDefaults(region) {
    return {
      colorHex: /^#[0-9a-f]{6}$/i.test(region?.defaultColor || '') ? region.defaultColor : '#ffffff',
      tintStrength: clampSetting(region?.tintStrength, 0, 100, 100),
      saturation: clampSetting(region?.saturation, 0, 200, 100),
      brightness: clampSetting(region?.brightness, 0, COLOR_BRIGHTNESS_MAX, 100),
      contrast: clampSetting(region?.contrast, 0, 200, 100),
      preserveLines: region?.preserveLines !== false,
      colorMapping: region?.colorMapping === 'target' ? 'target' : 'multiply',
    };
  }

  function normalizeDyeSettings(value, region) {
    const defaults = dyeRegionDefaults(region);
    const source = typeof value === 'string' ? { colorHex: value } : (value && typeof value === 'object' ? value : {});
    return {
      colorHex: /^#[0-9a-f]{6}$/i.test(source.colorHex || '') ? source.colorHex : defaults.colorHex,
      tintStrength: clampSetting(source.tintStrength, 0, 100, defaults.tintStrength),
      saturation: clampSetting(source.saturation, 0, 200, defaults.saturation),
      brightness: clampSetting(source.brightness, 0, COLOR_BRIGHTNESS_MAX, defaults.brightness),
      contrast: clampSetting(source.contrast, 0, 200, defaults.contrast),
      preserveLines: typeof source.preserveLines === 'boolean' ? source.preserveLines : defaults.preserveLines,
      colorMapping: source.colorMapping === 'overlay' ? 'overlay' : source.colorMapping === 'target' ? 'target' : defaults.colorMapping,
    };
  }

  function cloneDyeSettingsMap(settings) {
    if (!settings || typeof settings !== 'object') return {};
    return Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, value && typeof value === 'object' ? { ...value } : value]));
  }

  function cloneColorSettings(value = COLOR_DEFAULTS) {
    return {
      colorHex: /^#[0-9a-f]{6}$/i.test(value?.colorHex || '') ? value.colorHex : COLOR_DEFAULTS.colorHex,
      tintStrength: clampSetting(value?.tintStrength, 0, 100, COLOR_DEFAULTS.tintStrength),
      saturation: clampSetting(value?.saturation, 0, 200, COLOR_DEFAULTS.saturation),
      brightness: clampSetting(value?.brightness, 0, COLOR_BRIGHTNESS_MAX, COLOR_DEFAULTS.brightness),
      contrast: clampSetting(value?.contrast, 0, 200, COLOR_DEFAULTS.contrast),
      preserveLines: value?.preserveLines !== false,
      colorMapping: value?.colorMapping === 'overlay' ? 'overlay' : value?.colorMapping === 'target' ? 'target' : COLOR_DEFAULTS.colorMapping,
    };
  }

  function normalizeWardrobeRecipe(recipe) {
    const source = recipe && typeof recipe === 'object' ? recipe : {};
    const regions = source.regions && typeof source.regions === 'object'
      ? Object.fromEntries(Object.entries(source.regions).map(([key, value]) => [key, value && typeof value === 'object' ? { ...value } : value]))
      : {};
    return { whole: cloneColorSettings(source.whole || COLOR_DEFAULTS), regions };
  }

  function captureWardrobeRecipeFor(stateObj, layerKey, item) {
    const regions = {};
    for (const region of item?.dyeRegions || []) {
      const key = dyeSettingKey(item, region);
      if (!Object.hasOwn(stateObj.dyeSettings || {}, key)) continue;
      regions[region.id] = normalizeDyeSettings(stateObj.dyeSettings[key], region);
    }
    return {
      whole: cloneColorSettings(stateObj.layers?.[layerKey] || COLOR_DEFAULTS),
      regions,
    };
  }

  function nextWardrobeItemName(baseName, usedNames = []) {
    const fallback = normalizeAiName(baseName) || '未命名部件';
    const used = new Set((usedNames || []).map(name => normalizeAiName(name).toLocaleLowerCase()));
    if (!used.has(fallback.toLocaleLowerCase())) return fallback;
    const root = fallback.replace(/\d{2,}$/u, '') || fallback;
    for (let index = 1; index < 10000; index++) {
      const candidate = `${root}${String(index).padStart(2, '0')}`;
      if (!used.has(candidate.toLocaleLowerCase())) return candidate;
    }
    return `${root}${Date.now().toString(36)}`;
  }

  function repairWornWardrobeEntries(stateObj = state) {
    const worn = stateObj.wornWardrobeEntries && typeof stateObj.wornWardrobeEntries === 'object'
      ? stateObj.wornWardrobeEntries
      : {};
    for (const [layerKey, wardrobeItemId] of Object.entries(worn)) {
      const entry = stateObj.wardrobeItems?.find(item => item.id === wardrobeItemId);
      const selectedId = stateObj.layers?.[layerKey]?.selectedId;
      if (!entry || entry.layerKey !== layerKey || entry.sourceItemId !== selectedId) delete worn[layerKey];
    }
    stateObj.wornWardrobeEntries = worn;
  }

  function getDyeSettings(item, region) {
    return normalizeDyeSettings(state.dyeSettings[dyeSettingKey(item, region)], region);
  }

  function ensureDyeSettings(item, region) {
    const key = dyeSettingKey(item, region);
    const settings = getDyeSettings(item, region);
    state.dyeSettings[key] = settings;
    return settings;
  }

  function getDyeColor(item, region) {
    return getDyeSettings(item, region).colorHex;
  }

  function hasCustomDyeColor(item, region) {
    return Object.hasOwn(state.dyeSettings, dyeSettingKey(item, region));
  }


  let bundledAssetsLoaded = false;

  function getAssetBindKey(asset) {
    const key = String(asset?.key || asset?.path || '');
    if (!key) return '';
    if (/^back_hair_/.test(key)) return key.replace(/_(front|base)$/i, '');
    if (/^braid_/.test(key)) return key.replace(/_(front|base)$/i, '');
    return '';
  }

  function cleanBundleDisplayName(asset) {
    return String(asset?.display_name || asset?.key || asset?.path?.split('/')?.pop() || '')
      .replace(/（前）|（底）/g, '')
      .replace(/\s*\((front|base)\)\s*/ig, '')
      .trim();
  }

  function isSharedAccessorySlot(slot) {
    return ACCESSORY_SHARED_SLOTS.includes(slot);
  }

  function targetSlotsForBundledAsset(asset) {
    const slot = String(asset?.slot || '');
    if (isSharedAccessorySlot(slot)) return ACCESSORY_SHARED_SLOTS;
    return slot ? [slot] : [];
  }

  function slotsForImportedItem(slot) {
    return isSharedAccessorySlot(slot) ? ACCESSORY_SHARED_SLOTS : [slot];
  }

  async function loadBundledAssets() {
    if (bundledAssetsLoaded) return;
    bundledAssetsLoaded = true;
    try {
      const url = new URL('./data/asset-registry.json', import.meta.url);
      const registry = await fetch(url).then(r => r.ok ? r.json() : null);
      const assets = Array.isArray(registry?.assets) ? registry.assets : [];

      // 测试包更新时，刷新内置素材，避免旧版合成图或旧层级残留。
      for (const slot of Object.keys(state.layers || {})) {
        if (state.layers?.[slot]?.items) {
          state.layers[slot].items = state.layers[slot].items.filter(item => item.source !== 'bundle');
        }
      }
      for (const asset of assets) {
        // 辫子底图是旧版素材；v0.2.9 仅把主图切到隐藏渲染层，不再载入第二张辫子图。
        if (asset.slot === 'braid_left_base' || asset.slot === 'braid_right_base') continue;
        const targetSlots = targetSlotsForBundledAsset(asset);
        if (!targetSlots.length || !asset.path) continue;
        const id = 'bundle_' + String(asset.key || asset.path).replace(/[^a-z0-9_\-]/gi, '_');
        for (const slot of targetSlots) {
          const layer = state.layers?.[slot];
          if (!layer) continue;
          if (layer.items.some(item => item.id === id)) continue;
          layer.items.push({
            id,
            name: cleanBundleDisplayName(asset),
            url: new URL(asset.path, EXTENSION_ROOT).href,
            source: 'bundle',
            slot,
            bindKey: getAssetBindKey(asset),
          });
        }
      }
      const body = state.layers.body;
      const bundleBody = body?.items?.find(item => item.source === 'bundle');
      if (bundleBody && (!body.selectedId || body.selectedId === 'builtin_body')) {
        body.selectedId = bundleBody.id;
      }
      repairLegacySingleImageSelection('back_hair');
      repairLegacySingleImageSelection('braid_left');
      repairLegacySingleImageSelection('braid_right');
      syncLinkedSelections();
      saveState();
    } catch (err) {
      console.warn('[纸娃娃扩展] 默认素材包读取失败：', err);
    }
  }

  function normalizeSingleImageAssetId(id) {
    let safe = String(id || '');
    safe = safe.replace(/_(front|base)$/i, '');
    safe = safe.replace(/_(left|right)_(front|base)$/i, '_$1');
    return safe;
  }

  function repairLegacySingleImageSelection(layerKey) {
    const layer = state.layers?.[layerKey];
    if (!layer?.selectedId) return;
    if (layer.items.some(item => item.id === layer.selectedId)) return;
    const wanted = normalizeSingleImageAssetId(layer.selectedId);
    const matched = layer.items.find(item => item.id === wanted || normalizeSingleImageAssetId(item.id) === wanted);
    if (matched) layer.selectedId = matched.id;
  }

  function linkedSlotsForLayer(layerKey) {
    if (layerKey === 'back_hair') return ['back_hair_base'];
    if (layerKey === 'back_hair_base') return ['back_hair'];
    return [];
  }

  function syncLinkedSelections() {
    for (const slot of ['back_hair']) {
      const layer = state.layers?.[slot];
      if (layer?.selectedId) applyLinkedSelection(slot, layer.selectedId);
    }
  }

  function applyLinkedSelection(layerKey, itemId) {
    const layer = state.layers[layerKey];
    const item = layer?.items?.find(entry => entry.id === itemId);
    const slots = linkedSlotsForLayer(layerKey);
    if (!slots.length) return;
    for (const slot of slots) {
      const target = state.layers[slot];
      if (!target) continue;
      const matched = item?.bindKey ? target.items.find(entry => entry.bindKey === item.bindKey) : null;
      target.selectedId = matched?.id || null;
    }
  }

  function clearLinkedSelection(layerKey, itemId) {
    const layer = state.layers[layerKey];
    const item = layer?.items?.find(entry => entry.id === itemId);
    const slots = linkedSlotsForLayer(layerKey);
    if (!slots.length) return;
    for (const slot of slots) {
      const target = state.layers[slot];
      if (!target) continue;
      if (!item?.bindKey) {
        target.selectedId = null;
        continue;
      }
      const matched = target.items.find(entry => entry.bindKey === item.bindKey);
      if (matched && target.selectedId === matched.id) target.selectedId = null;
    }
  }

  const panelScrollMemory = {
    groups: 0,
    layers: 0,
    page: 0,
  };

  function rememberPanelScroll(panel) {
    if (!panel) return;
    panelScrollMemory.groups = panel.querySelector('.xj-pd-groups')?.scrollLeft || 0;
    panelScrollMemory.layers = panel.querySelector('.xj-pd-layers')?.scrollLeft || 0;
    panelScrollMemory.page = panel.querySelector('.xj-pd-page-frame')?.scrollTop || 0;
  }

  function restorePanelScroll(panel) {
    if (!panel) return;
    const apply = () => {
      const groups = panel.querySelector('.xj-pd-groups');
      const layers = panel.querySelector('.xj-pd-layers');
      const page = panel.querySelector('.xj-pd-page-frame');
      if (groups) groups.scrollLeft = panelScrollMemory.groups || 0;
      if (layers) layers.scrollLeft = panelScrollMemory.layers || 0;
      if (page) page.scrollTop = panelScrollMemory.page || 0;
    };
    apply();
    try {
      if (ST_WIN.requestAnimationFrame) ST_WIN.requestAnimationFrame(apply);
      else ST_WIN.setTimeout(apply, 0);
    } catch (_) {
      apply();
    }
  }

  function resetPanelPageScroll(panel) {
    panelScrollMemory.page = 0;
    const page = panel?.querySelector('.xj-pd-page-frame');
    if (page) page.scrollTop = 0;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      try { syncAiStatePrompt(); } catch (_) {}
      return true;
    } catch (err) {
      console.error('[纸娃娃] 保存失败：', err);
      alert('保存失败：图片可能太大，浏览器本地空间不够。请先试较小的 PNG/WebP。');
      return false;
    }
  }

  let saveTimer = null;
  function scheduleSave(delay = 350) {
    try {
      if (saveTimer) ST_WIN.clearTimeout(saveTimer);
      saveTimer = ST_WIN.setTimeout(() => {
        saveTimer = null;
        saveState();
      }, delay);
      return true;
    } catch (_) {
      return saveState();
    }
  }

  const ST_WIN = (() => {
    try {
      if (window.parent && window.parent.document && window.parent.document.querySelector('#chat')) return window.parent;
    } catch (_) {}
    try {
      if (window.top && window.top.document && window.top.document.querySelector('#chat')) return window.top;
    } catch (_) {}
    return window;
  })();
  const ST_DOC = ST_WIN.document;

  try {
    if (typeof ST_WIN.__xjPaperdollDestroy === 'function') ST_WIN.__xjPaperdollDestroy();
  } catch (_) {}
  try {
    ST_DOC.querySelector('#xj-paperdoll-dialog')?.remove();
    ST_DOC.querySelector('#xj-paperdoll-stage-main')?.remove();
  } catch (_) {}

  const ST_MODULES = {
    script: null,
    personas: null,
    powerUser: null,
  };

  async function importSTModule(paths) {
    const importers = [];
    try {
      if (ST_WIN && ST_WIN.Function) {
        importers.push(path => ST_WIN.Function('path', 'return import(path);')(path));
      }
    } catch (_) {}
    try {
      if (ST_WIN && ST_WIN.eval) {
        importers.push(path => ST_WIN.eval(`import(${JSON.stringify(path)})`));
      }
    } catch (_) {}
    importers.push(path => import(path));

    for (const path of paths) {
      for (const importer of importers) {
        try {
          const mod = await importer(path);
          if (mod) return mod;
        } catch (_) {}
      }
    }
    return null;
  }

  async function initSTModules() {
    const [scriptModule, personasModule, powerUserModule] = await Promise.all([
      importSTModule(['/script.js', './script.js']),
      importSTModule(['/scripts/personas.js', './scripts/personas.js']),
      importSTModule(['/scripts/power-user.js', './scripts/power-user.js']),
    ]);
    ST_MODULES.script = scriptModule;
    ST_MODULES.personas = personasModule;
    ST_MODULES.powerUser = powerUserModule;
    if (ST_MODULES.personas?.user_avatar) log('已读取 user_avatar：' + ST_MODULES.personas.user_avatar);
  }

  function extractPersonaAvatarId(value) {
    let raw = normalizeAvatarValue(value || '');
    if (!raw) return '';
    raw = raw.replace(/^User Avatars\//i, '');
    raw = raw.replace(/^user\/avatars\//i, '');
    raw = raw.replace(/^avatars\//i, '');
    raw = raw.split('/').pop() || raw;
    return raw.trim();
  }


  function extractAvatarIdFromUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, ST_WIN.location.href);
      const params = url.searchParams;
      for (const key of ['file', 'avatar', 'avatarId', 'id', 'name']) {
        const got = params.get(key);
        const id = extractPersonaAvatarId(got || '');
        if (id) return id;
      }
      const path = decodeURIComponent(url.pathname || '');
      const match = path.match(/(?:User Avatars|user\/avatars|avatars|persona)\/([^/?#]+)$/i);
      if (match?.[1]) return extractPersonaAvatarId(match[1]);
    } catch (_) {}
    return extractPersonaAvatarId(raw);
  }

  function findSelectedPersonaAvatarIdFromDom() {
    const selectors = [
      '#user_avatar_block .avatar-container.selected[data-avatar-id]',
      '#user_avatar_block .avatar-container.selected .avatar[data-avatar-id]',
      '#user_avatar_block .avatar-container.selected [data-avatar-id]',
      '#user_avatar_block .avatar-container.default_persona[data-avatar-id]',
      '#user_avatar_block .avatar-container.default_persona .avatar[data-avatar-id]'
    ];
    for (const selector of selectors) {
      const el = ST_DOC.querySelector(selector);
      const id = extractPersonaAvatarId(el?.getAttribute?.('data-avatar-id') || '');
      if (id) return id;
    }

    const imgSelectors = [
      '#user_avatar_block .avatar-container.selected img',
      '#persona-management-button img',
      '#user_avatar img',
      '#your_avatar img',
      '#avatar_div img'
    ];
    for (const selector of imgSelectors) {
      const img = ST_DOC.querySelector(selector);
      const id = extractAvatarIdFromUrl(img?.getAttribute?.('src') || img?.src || '');
      if (id) return id;
    }
    return '';
  }

  function log(msg) {
    console.log('[纸娃娃]', msg);
    try { if (typeof toastr !== 'undefined') toastr.info(msg); } catch (_) {}
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  function cssUrl(url) {
    return `url("${String(url).replace(/"/g, '%22')}")`;
  }

  function getHostEl() {
    return ST_DOC.querySelector('#send_form') || ST_DOC.querySelector('#send_form_wrapper') || ST_DOC.querySelector('#send_textarea');
  }

  function getAnchorTop() {
    const el = ST_DOC.querySelector('#form_sheld') || ST_DOC.querySelector('#send_form_wrapper') || getHostEl();
    if (!el) return 0;
    return el.getBoundingClientRect().top;
  }

  function getSTContext() {
    try { return ST_WIN.SillyTavern?.getContext?.(); } catch (_) {}
    try { return window.SillyTavern?.getContext?.(); } catch (_) {}
    return null;
  }

  let lastAiPromptValue = null;
  let transientAiBaseline = null;
  let aiStateMessageSequence = 0;
  let inlineStatusCardEligible = false;
  const aiPromptRuntime = {
    status: 'idle',
    message: '等待首次登记。',
    registered: false,
    lastAttemptAt: 0,
    lastSuccessAt: 0,
    lastSource: '',
    promptLength: 0,
    error: '',
    lastBuild: null,
  };

  function getExtensionPromptApi() {
    const ctx = getSTContext();
    const setter = ctx?.setExtensionPrompt || ST_MODULES.script?.setExtensionPrompt;
    if (typeof setter !== 'function') return null;
    return {
      setter,
      position: ST_MODULES.script?.extension_prompt_types?.IN_CHAT ?? 1,
      role: ST_MODULES.script?.extension_prompt_roles?.SYSTEM ?? 0,
    };
  }

  function getAiPromptPresets() {
    return [
      { id: BUILTIN_AI_PROMPT_ID, name: '系统默认', template: DEFAULT_AI_PROMPT_TEMPLATE, builtin: true },
      ...state.aiPromptPresets,
    ];
  }

  function getAiPromptPreset(id) {
    return getAiPromptPresets().find(preset => preset.id === id) || null;
  }

  function getActiveAiPromptPreset() {
    return getAiPromptPreset(state.activeAiPromptPresetId) || getAiPromptPreset(BUILTIN_AI_PROMPT_ID);
  }

  function validateAiPromptTemplate(template) {
    const value = String(template || '');
    if (!value.trim()) return '提示词不能为空。';
    if (value.length > 12000) return '提示词请控制在 12000 个字符以内。';
    const groupedRequired = ['{{当前状态}}', '{{可用分类部件}}', '{{可用表情}}'];
    const legacyRequired = ['{{当前衣着}}', '{{当前表情}}', '{{可用部件}}', '{{可用表情}}'];
    const hasGroupedVariables = groupedRequired.every(token => value.includes(token));
    const hasLegacyVariables = legacyRequired.every(token => value.includes(token));
    if (!hasGroupedVariables && !hasLegacyVariables) {
      return `缺少必要变量：请使用新版 ${groupedRequired.join('、')}，或保留旧版四个变量。`;
    }
    const statusMatch = value.match(/<user状态>\s*([\s\S]*?)\s*<\/user状态>/i);
    if (!statusMatch) return '提示词必须包含完整的 <user状态> 标签。';
    const requiredFields = [...WARDROBE_CATEGORY_DEFS.map(category => category.label), '表情'];
    const missingFields = requiredFields.filter(label => {
      const pattern = new RegExp(`(?:^|\\n)\\s*${label}\\s*[：:]`, 'i');
      return !pattern.test(statusMatch[1]);
    });
    if (missingFields.length) return `状态结构缺少栏目：${missingFields.join('、')}。请改用十一栏格式。`;
    const legacyFields = ['头部', '颈部', '贴身', '手部', '腿部', '脚部'];
    const foundLegacy = legacyFields.find(label => new RegExp(`(?:^|\\n)\\s*${label}\\s*[：:]`, 'i').test(statusMatch[1]));
    if (foundLegacy) return `状态结构仍含旧栏目“${foundLegacy}”，请改用十一栏格式。`;
    return '';
  }

  function uniqueAiNames(values) {
    const seen = new Set();
    const names = [];
    for (const raw of values || []) {
      const name = normalizeAiName(raw);
      const normalized = name.toLocaleLowerCase();
      if (!name || seen.has(normalized)) continue;
      seen.add(normalized);
      names.push(name);
    }
    return names;
  }

  function currentStateBlock(currentEntries = getCurrentWearableEntries()) {
    const lines = WARDROBE_CATEGORY_DEFS.map(category => {
      const names = uniqueAiNames(currentEntries.filter(entry => (entry.categoryKey || wardrobeCategoryForLayer(entry.layerKey)) === category.key).map(entry => entry.name));
      return `${category.label}：${names.length ? names.join('、') : '无'}`;
    });
    return `<user状态>\n${lines.join('\n')}\n表情：${getCurrentExpressionName()}\n</user状态>`;
  }

  function categorizedAvailablePool(poolEntries = getEffectiveAiPoolEntries()) {
    const lines = [];
    for (const category of WARDROBE_CATEGORY_DEFS) {
      const entries = poolEntries.filter(entry => (entry.categoryKey || wardrobeCategoryForLayer(entry.layerKey)) === category.key);
      if (!entries.length) continue;
      const values = [];
      const seen = new Set();
      for (const entry of entries) {
        const name = normalizeAiName(entry.name);
        const scoped = `${entry.layerKey}::${name.toLocaleLowerCase()}`;
        if (!name || seen.has(scoped)) continue;
        seen.add(scoped);
        const slotLabel = LAYERS.find(layer => layer.key === entry.layerKey)?.label || entry.layerKey;
        values.push(`${name}（${slotLabel}）`);
      }
      lines.push(`${category.label}：${values.join('｜')}`);
    }
    return lines.length ? lines.join('\n') : '无';
  }

  function getUnambiguousDyeRegions(item) {
    const grouped = new Map();
    for (const region of item?.dyeRegions || []) {
      const name = normalizeAiName(region?.name);
      if (!name || name === '整体' || /[|｜;；=＝<>\r\n]/.test(name)) continue;
      const key = name.toLocaleLowerCase();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(region);
    }
    return [...grouped.values()].filter(regions => regions.length === 1).map(regions => regions[0]);
  }

  function categorizedAvailableDyeRegions(poolEntries = getEffectiveAiPoolEntries()) {
    const lines = [];
    for (const category of WARDROBE_CATEGORY_DEFS) {
      const values = [];
      const seen = new Set();
      const entries = poolEntries.filter(entry => (entry.categoryKey || wardrobeCategoryForLayer(entry.layerKey)) === category.key);
      for (const entry of entries) {
        const regions = getUnambiguousDyeRegions(entry.item);
        if (!regions.length) continue;
        const name = normalizeAiName(entry.name);
        const identity = `${entry.layerKey}::${name.toLocaleLowerCase()}`;
        if (!name || seen.has(identity)) continue;
        seen.add(identity);
        const slotLabel = LAYERS.find(layer => layer.key === entry.layerKey)?.label || entry.layerKey;
        values.push(`${name}（${slotLabel}）{${regions.map(region => normalizeAiName(region.name)).join('、')}}`);
      }
      if (values.length) lines.push(`${category.label}：${values.join('；')}`);
    }
    return lines.length ? lines.join('\n') : '无（当前可用基底在剧情中默认使用整体）';
  }

  function getAiPromptRuntimeValues(poolEntries = getEffectiveAiPoolEntries()) {
    const currentEntries = getCurrentWearableEntries();
    const currentNames = uniqueAiNames(currentEntries.map(entry => entry.name));
    const availableNames = uniqueAiNames(poolEntries.map(entry => entry.name));
    const expressionNames = uniqueAiNames(state.expressionPresets.map(preset => preset.name));
    return {
      '{{当前状态}}': currentStateBlock(currentEntries),
      '{{可用分类部件}}': categorizedAvailablePool(poolEntries),
      '{{可用染色区}}': categorizedAvailableDyeRegions(poolEntries),
      '{{当前衣着}}': currentNames.length ? currentNames.join('｜') : '无',
      '{{当前表情}}': getCurrentExpressionName(),
      '{{可用部件}}': availableNames.length ? availableNames.join('｜') : '无',
      '{{可用表情}}': expressionNames.length ? expressionNames.join('｜') : '无（表情保持当前值）',
    };
  }

  function renderAiPromptTemplate(template, runtimeValues = getAiPromptRuntimeValues()) {
    let rendered = String(template || '');
    for (const variable of AI_PROMPT_VARIABLES) {
      rendered = rendered.split(variable.token).join(runtimeValues[variable.token] || '无');
    }
    return rendered;
  }

  function activateAiPromptPreset(id) {
    const preset = getAiPromptPreset(id) || getAiPromptPreset(BUILTIN_AI_PROMPT_ID);
    state.activeAiPromptPresetId = preset.id;
    lastAiPromptValue = null;
    saveState();
    syncAiStatePrompt();
    return preset;
  }

  function buildAiStatePromptResult() {
    const preset = getActiveAiPromptPreset();
    const result = {
      value: '',
      code: 'ready',
      reason: '',
      warning: '',
      duplicate: '',
      presetId: preset?.id || BUILTIN_AI_PROMPT_ID,
      presetName: preset?.name || '系统默认',
      usedFallback: false,
      newClothesProtocolAppended: false,
      runtimeValues: null,
    };

    if (!isPaperdollEnabled()) {
      result.code = 'disabled';
      result.reason = '纸娃娃扩展已关闭。';
      return result;
    }
    if (getExtensionSettings().aiStateEnabled === false) {
      result.code = 'disabled';
      result.reason = '“剧情状态与自动换装”已关闭。';
      return result;
    }

    const pool = getEffectiveAiPoolEntries();
    const usesGroupedPool = String(preset?.template || '').includes('{{可用分类部件}}');
    const duplicate = findDuplicateAiName(pool, usesGroupedPool);
    if (duplicate) {
      result.duplicate = duplicate;
      result.warning = `模型识别名「${duplicate}」属于不同部件：状态仍会注入，但有歧义的自动换装结果会暂停应用。`;
    }
    if (!pool.length && !state.expressionPresets.length) {
      result.code = 'empty';
      result.reason = '没有当前衣着、可用部件或可用表情。';
      return result;
    }

    const templateError = validateAiPromptTemplate(preset?.template);
    const template = templateError ? DEFAULT_AI_PROMPT_TEMPLATE : preset.template;
    result.usedFallback = !!templateError;
    if (templateError) {
      const fallbackWarning = `当前预设格式无效（${templateError}），本轮改用系统默认。`;
      result.warning = result.warning ? `${result.warning} ${fallbackWarning}` : fallbackWarning;
    }
    result.runtimeValues = getAiPromptRuntimeValues(pool);
    result.value = renderAiPromptTemplate(template, result.runtimeValues);
    if (getExtensionSettings().aiWardrobeGenerationEnabled !== false && pool.length) {
      result.value += `\n\n${renderAiPromptTemplate(AI_NEW_CLOTHES_PROMPT_TEMPLATE, result.runtimeValues)}`;
      result.newClothesProtocolAppended = true;
    }
    return result;
  }

  function setAiStatePrompt(value, buildResult = null, source = 'state') {
    const build = buildResult || buildAiStatePromptResult();
    aiPromptRuntime.lastAttemptAt = Date.now();
    aiPromptRuntime.lastSource = source;
    aiPromptRuntime.lastBuild = build;
    aiPromptRuntime.promptLength = String(value || '').length;
    const api = getExtensionPromptApi();
    if (!api) {
      aiPromptRuntime.status = 'error';
      aiPromptRuntime.message = 'SillyTavern 没有提供扩展提示词接口。';
      aiPromptRuntime.error = aiPromptRuntime.message;
      aiPromptRuntime.registered = false;
      refreshAiPromptDiagnostics();
      return false;
    }
    try {
      api.setter(AI_PROMPT_KEY, value, api.position, 0, false, api.role);
      lastAiPromptValue = value;
      aiPromptRuntime.status = value ? 'registered' : 'cleared';
      aiPromptRuntime.message = value ? '提示词已登记；正式生成前会再次强制刷新。' : (build.reason || '提示词已清除。');
      aiPromptRuntime.registered = !!value;
      aiPromptRuntime.lastSuccessAt = Date.now();
      aiPromptRuntime.error = '';
      refreshAiPromptDiagnostics();
      return true;
    } catch (err) {
      console.warn('[纸娃娃] 状态提示注入失败：', err);
      aiPromptRuntime.status = 'error';
      aiPromptRuntime.message = `注入失败：${err?.message || err}`;
      aiPromptRuntime.error = aiPromptRuntime.message;
      aiPromptRuntime.registered = false;
      refreshAiPromptDiagnostics();
      return false;
    }
  }

  function syncAiStatePrompt(options = {}) {
    const { force = false, source = 'state' } = options;
    const build = buildAiStatePromptResult();
    aiPromptRuntime.lastBuild = build;
    if (!force && build.value === lastAiPromptValue) return true;
    return setAiStatePrompt(build.value, build, source);
  }

  function clearAiStatePrompt(reason = '提示词已清除。') {
    const build = buildAiStatePromptResult();
    build.value = '';
    build.code = 'cleared';
    build.reason = reason;
    return setAiStatePrompt('', build, 'clear');
  }

  function formatAiPromptTime(timestamp) {
    if (!timestamp) return '尚未成功';
    const date = new Date(timestamp);
    return [date.getHours(), date.getMinutes(), date.getSeconds()]
      .map(value => String(value).padStart(2, '0'))
      .join(':');
  }

  function getAiPromptStatusView() {
    const build = buildAiStatePromptResult();
    let title = '等待登记';
    let detail = '状态或设置变化后会自动登记。';
    let tone = 'idle';
    if (!build.value) {
      title = '未注入';
      detail = build.reason || '当前没有可注入内容。';
    } else if (aiPromptRuntime.status === 'error') {
      title = '注入失败';
      detail = aiPromptRuntime.message;
      tone = 'error';
    } else if (aiPromptRuntime.registered) {
      title = build.warning ? '已登记（有提醒）' : '已登记';
      detail = aiPromptRuntime.message;
      tone = build.warning ? 'warning' : 'ok';
    }
    return {
      build,
      title,
      detail,
      tone,
      warning: build.warning || '',
      meta: `${build.presetName} · ${build.value.length} 字 · 新衣服协议${build.newClothesProtocolAppended ? '已附加' : '未附加'} · 最近成功 ${formatAiPromptTime(aiPromptRuntime.lastSuccessAt)}`,
      preview: build.value || `（未注入：${build.reason || '当前没有可注入内容'}）`,
    };
  }

  function refreshAiPromptDiagnostics() {
    const view = getAiPromptStatusView();
    ST_DOC.querySelectorAll('[data-ai-prompt-diagnostic]').forEach(element => {
      element.classList.remove('is-ok', 'is-warning', 'is-error', 'is-idle');
      element.classList.add(`is-${view.tone}`);
    });
    ST_DOC.querySelectorAll('[data-ai-prompt-status]').forEach(element => { element.textContent = view.title; });
    ST_DOC.querySelectorAll('[data-ai-prompt-detail]').forEach(element => { element.textContent = view.detail; });
    ST_DOC.querySelectorAll('[data-ai-prompt-meta]').forEach(element => { element.textContent = view.meta; });
    ST_DOC.querySelectorAll('[data-ai-prompt-warning]').forEach(element => {
      element.textContent = view.warning;
      element.hidden = !view.warning;
    });
    ST_DOC.querySelectorAll('[data-prompt-actual-preview]').forEach(element => { element.textContent = view.preview; });
  }

  function captureAiRuntimeSnapshot() {
    const layers = {};
    for (const layerKey of [...AI_WEARABLE_LAYER_KEYS, ...EXPRESSION_LAYER_KEYS]) {
      const layer = state.layers[layerKey];
      if (!layer) continue;
      layers[layerKey] = layerSnapshot(layer);
    }
    return {
      layers,
      dyeSettings: cloneDyeSettingsMap(state.dyeSettings),
      wornWardrobeEntries: { ...state.wornWardrobeEntries },
      currentExpressionId: state.currentExpressionId || null,
    };
  }

  function runtimeSnapshotFromPlan(plan) {
    if (!plan?.snapshot) return null;
    const layers = {};
    for (const layerKey of [...AI_WEARABLE_LAYER_KEYS, ...EXPRESSION_LAYER_KEYS]) {
      const saved = plan.snapshot.layers?.[layerKey];
      layers[layerKey] = saved ? { ...saved } : { selectedId: null, visible: true };
    }
    return {
      layers,
      dyeSettings: cloneDyeSettingsMap(plan.snapshot.dyeSettings),
      wornWardrobeEntries: { ...(plan.snapshot.wornWardrobeEntries || {}) },
      currentExpressionId: plan.snapshot.currentExpressionId || null,
    };
  }

  function getSavedBaselinePlan() {
    const user = getCurrentUserInfo();
    return getPlanById(state.userBindings[user.key]) || getCurrentPlan();
  }

  function applyAiRuntimeSnapshot(snapshot) {
    if (!snapshot?.layers) return false;
    for (const layerKey of [...AI_WEARABLE_LAYER_KEYS, ...EXPRESSION_LAYER_KEYS]) {
      const layer = state.layers[layerKey];
      const saved = snapshot.layers[layerKey];
      if (!layer || !saved) continue;
      const selectedId = saved.selectedId || null;
      layer.selectedId = selectedId && layer.items.some(item => item.id === selectedId) ? selectedId : null;
      layer.visible = saved.visible !== false;
      Object.assign(layer, cloneColorSettings(saved));
    }
    state.dyeSettings = cloneDyeSettingsMap(snapshot.dyeSettings);
    state.wornWardrobeEntries = { ...(snapshot.wornWardrobeEntries || {}) };
    repairWornWardrobeEntries();
    state.currentExpressionId = snapshot.currentExpressionId && state.expressionPresets.some(preset => preset.id === snapshot.currentExpressionId)
      ? snapshot.currentExpressionId
      : null;
    return true;
  }

  function ensureTransientAiBaseline() {
    if (transientAiBaseline) return;
    transientAiBaseline = runtimeSnapshotFromPlan(getSavedBaselinePlan()) || captureAiRuntimeSnapshot();
  }

  function restoreSavedPlanBaseline() {
    const snapshot = runtimeSnapshotFromPlan(getSavedBaselinePlan()) || transientAiBaseline;
    transientAiBaseline = null;
    if (!applyAiRuntimeSnapshot(snapshot)) return false;
    syncAiStatePrompt();
    refreshAll({ save: false });
    if (dialogEl()) renderDialogBody();
    return true;
  }

  function parseAiStateBlock(text) {
    const source = String(text || '');
    const pattern = /<user状态>\s*([\s\S]*?)\s*<\/user状态>/gi;
    const matches = Array.from(source.matchAll(pattern));
    if (!matches.length) return null;
    const content = matches[matches.length - 1][1] || '';
    const clothingMatch = content.match(/衣着\s*[：:]\s*([^\r\n<]*)/i);
    const expressionMatch = content.match(/(?:表情|心情(?:（[^\r\n）]*）)?)\s*[：:]\s*([^\r\n<]*)/i);
    if (!expressionMatch) return { error: '状态块缺少表情。' };
    if (clothingMatch) {
      const rawClothing = clothingMatch[1].trim();
      const clothingNames = /^(?:无|未穿|空)$/.test(rawClothing)
        ? []
        : rawClothing.split(/[|｜、，,]/).map(normalizeAiName).filter(Boolean);
      return {
        legacy: true,
        clothingNames,
        expressionName: normalizeAiName(expressionMatch[1]),
        raw: content,
      };
    }
    const regions = {};
    const missing = [];
    for (const category of WARDROBE_CATEGORY_DEFS) {
      const fieldPattern = new RegExp(`(?:^|\\n)\\s*${category.label}\\s*[：:]\\s*([^\\r\\n<]*)`, 'i');
      const match = content.match(fieldPattern);
      if (!match) {
        missing.push(category.label);
        continue;
      }
      const raw = match[1].trim();
      regions[category.key] = /^(?:无|未穿|空)$/.test(raw)
        ? []
        : raw.split(/[|｜、，,]/).map(normalizeAiName).filter(Boolean);
    }
    if (missing.length) return { error: `状态块缺少区域：${missing.join('、')}。` };
    return {
      legacy: false,
      regions,
      expressionName: normalizeAiName(expressionMatch[1]),
      raw: content,
    };
  }

  function parseAiGeneratedDyeAssignments(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return { error: '缺少染色配方。' };
    const segments = raw.split(/[;；]/);
    if (!segments.length || segments.some(segment => !segment.trim())) return { error: '染色配方含有空项。' };
    const assignments = [];
    const scopes = new Set();
    for (const segment of segments) {
      const match = segment.trim().match(/^([^=＝]+?)\s*[=＝]\s*(#[0-9a-f]{6})$/i);
      if (!match) return { error: `染色项格式无效：${segment.trim()}` };
      const scopeName = normalizeAiName(match[1]);
      const scopeKey = scopeName.toLocaleLowerCase();
      if (!scopeName) return { error: '染色范围不能为空。' };
      if (/^(?:范围|染色范围)$/i.test(scopeName)) return { error: `“${scopeName}”是格式占位词；请改用“整体”或该基底真实的局部染色区名称。` };
      if (scopes.has(scopeKey)) return { error: `染色范围「${scopeName}」重复。` };
      scopes.add(scopeKey);
      assignments.push({ scopeName, colorHex: match[2].toUpperCase() });
    }
    return { assignments };
  }

  function parseAiNewClothesBlock(text) {
    const source = String(text || '');
    const pattern = /<新衣服>\s*([\s\S]*?)\s*<\/新衣服>/gi;
    const matches = Array.from(source.matchAll(pattern));
    if (!matches.length) return { found: false, directives: [], errors: [] };
    if (matches.length !== 1) {
      return { found: true, directives: [], errors: ['同一回复只能包含一个 <新衣服> 标签。'] };
    }
    const lines = String(matches[0][1] || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) return { found: true, directives: [], errors: ['<新衣服> 不能为空。'] };
    const directives = [];
    const errors = [];
    if (lines.length > MAX_AI_GENERATED_WARDROBE_ITEMS) {
      errors.push(`超过每轮三件的上限，其余 ${lines.length - MAX_AI_GENERATED_WARDROBE_ITEMS} 行已忽略。`);
    }
    lines.slice(0, MAX_AI_GENERATED_WARDROBE_ITEMS).forEach((line, index) => {
      const lineNumber = index + 1;
      if (line.length > 500) {
        errors.push(`第 ${lineNumber} 行超过 500 个字符。`);
        return;
      }
      const body = line.replace(/^生成\s*[：:]\s*/, '').trim();
      const fields = body.split(/[|｜]/).map(value => value.trim());
      if (fields.length !== 4 || fields.some(value => !value)) {
        errors.push(`第 ${lineNumber} 行必须使用“区域｜基底｜新名称｜染色配方”四栏格式。`);
        return;
      }
      const dye = parseAiGeneratedDyeAssignments(fields[3]);
      if (dye.error) {
        errors.push(`第 ${lineNumber} 行：${dye.error}`);
        return;
      }
      directives.push({
        lineNumber,
        categoryLabel: normalizeAiName(fields[0]),
        baseName: normalizeAiName(fields[1]),
        requestedName: normalizeAiName(fields[2]),
        assignments: dye.assignments,
      });
    });
    return { found: true, directives, errors };
  }

  function validateAiGeneratedWardrobeName(name) {
    const value = normalizeAiName(name);
    const commonError = validateAiName(value);
    if (commonError) return commonError;
    if (/[;；=＝]/.test(value)) return '新名称不能包含 ;、；、= 或 ＝。';
    if (/^(?:无|未穿|空)$/i.test(value)) return `“${value}”是状态保留字，不能用作新名称。`;
    return '';
  }

  function aiGeneratedRecipeColorSignature(settings, region = null) {
    const value = region ? normalizeDyeSettings(settings, region) : cloneColorSettings(settings);
    return [
      String(value.colorHex || '').toUpperCase(),
      Number(value.tintStrength),
      Number(value.saturation),
      Number(value.brightness),
      Number(value.contrast),
      value.preserveLines !== false,
      value.colorMapping,
    ];
  }

  function aiGeneratedRecipeFingerprint(layerKey, item, recipe) {
    const value = normalizeWardrobeRecipe(recipe);
    const regions = (item?.dyeRegions || []).map(region => [
      region.id,
      Object.hasOwn(value.regions, region.id) ? aiGeneratedRecipeColorSignature(value.regions[region.id], region) : null,
    ]);
    return JSON.stringify([layerKey, item?.id || '', aiGeneratedRecipeColorSignature(value.whole), regions]);
  }

  function buildAiGeneratedWardrobeRecipe(baseEntry, assignments) {
    const item = baseEntry?.item;
    if (!item) return { error: '基底素材不存在。' };
    // Each generated color starts from the original gray asset, without stacked legacy tints.
    const recipe = { whole: cloneColorSettings(COLOR_DEFAULTS), regions: {} };
    const availableRegions = getUnambiguousDyeRegions(item);
    const resolvedAssignments = [];
    for (const assignment of assignments || []) {
      if (assignment.scopeName === '整体') {
        resolvedAssignments.push({ assignment, region: null });
        continue;
      }
      const wanted = assignment.scopeName.toLocaleLowerCase();
      const region = availableRegions.find(value => normalizeAiName(value.name).toLocaleLowerCase() === wanted);
      if (!region) return { error: `基底「${baseEntry.name}」没有唯一的染色范围「${assignment.scopeName}」。` };
      resolvedAssignments.push({ assignment, region });
    }
    resolvedAssignments.sort((left, right) => {
      if (!left.region && !right.region) return 0;
      if (!left.region) return -1;
      if (!right.region) return 1;
      return (item.dyeRegions || []).findIndex(value => value.id === left.region.id)
        - (item.dyeRegions || []).findIndex(value => value.id === right.region.id);
    });
    for (const { assignment, region } of resolvedAssignments) {
      const color = { ...COLOR_DEFAULTS, colorHex: assignment.colorHex, tintStrength: 100, colorMapping: 'overlay' };
      if (region) recipe.regions[region.id] = color;
      else recipe.whole = color;
    }
    return { recipe: normalizeWardrobeRecipe(recipe) };
  }

  function findEquivalentAiGeneratedWardrobeItem(categoryKey, baseEntry, recipe) {
    const wanted = aiGeneratedRecipeFingerprint(baseEntry.layerKey, baseEntry.item, recipe);
    return state.wardrobeItems.find(entry => {
      if (entry.wardrobeId !== state.activeWardrobeId
        || entry.categoryKey !== categoryKey
        || entry.layerKey !== baseEntry.layerKey
        || entry.sourceItemId !== baseEntry.itemId) return false;
      return aiGeneratedRecipeFingerprint(entry.layerKey, baseEntry.item, entry.recipe) === wanted;
    }) || null;
  }

  function saveAiGeneratedWardrobeChanges() {
    if (!transientAiBaseline?.layers) return saveState();
    const currentRuntime = captureAiRuntimeSnapshot();
    let baselineApplied = false;
    try {
      baselineApplied = applyAiRuntimeSnapshot(transientAiBaseline);
      return saveState();
    } finally {
      if (baselineApplied) applyAiRuntimeSnapshot(currentRuntime);
    }
  }

  async function applyAiGeneratedWardrobeDirectives(parsedBlock, isCancelled = () => false) {
    const result = { aliases: [], created: [], reused: [], errors: [...(parsedBlock?.errors || [])] };
    if (!parsedBlock?.found || !parsedBlock.directives?.length) return result;
    const rollbackCancelled = () => {
      const createdIds = new Set(result.created.map(entry => entry.id));
      if (createdIds.size) {
        state.wardrobeItems = state.wardrobeItems.filter(entry => !createdIds.has(entry.id));
        result.aliases = result.aliases.filter(alias => !createdIds.has(alias.entryId));
        result.created = [];
      }
      return result;
    };
    const pool = getEffectiveAiPoolEntries();
    for (const directive of parsedBlock.directives) {
      if (isCancelled()) return rollbackCancelled();
      const prefix = `第 ${directive.lineNumber} 行`;
      const category = WARDROBE_CATEGORY_DEFS.find(value => value.label === directive.categoryLabel);
      if (!category) {
        result.errors.push(`${prefix}：未知区域「${directive.categoryLabel}」。`);
        continue;
      }
      const categoryPool = pool.filter(entry => (entry.categoryKey || wardrobeCategoryForLayer(entry.layerKey)) === category.key);
      const found = findPoolEntryByReturnedName(categoryPool, directive.baseName);
      if (!found.entry) {
        result.errors.push(`${prefix}：${found.error}`);
        continue;
      }
      const nameError = validateAiGeneratedWardrobeName(directive.requestedName);
      if (nameError) {
        result.errors.push(`${prefix}：${nameError}`);
        continue;
      }
      const requestedKey = directive.requestedName.toLocaleLowerCase();
      if (result.aliases.some(alias => alias.categoryKey === category.key && alias.requestedName === requestedKey)) {
        result.errors.push(`${prefix}：区域「${category.label}」中的新名称「${directive.requestedName}」重复。`);
        continue;
      }
      const built = await buildAiGeneratedWardrobeRecipe(found.entry, directive.assignments);
      if (isCancelled()) return rollbackCancelled();
      if (!built.recipe) {
        result.errors.push(`${prefix}：${built.error}`);
        continue;
      }
      let wardrobeEntry = findEquivalentAiGeneratedWardrobeItem(category.key, found.entry, built.recipe);
      if (wardrobeEntry) {
        result.reused.push(wardrobeEntry);
      } else {
        const name = nextWardrobeItemName(
          directive.requestedName,
          wardrobeNamesInCategory(state.activeWardrobeId, category.key),
        );
        wardrobeEntry = {
          id: `closet_${generateId()}`,
          wardrobeId: state.activeWardrobeId,
          name,
          categoryKey: category.key,
          layerKey: found.entry.layerKey,
          sourceItemId: found.entry.itemId,
          sourcePackId: found.entry.item?.packId || '',
          recipe: built.recipe,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          generatedBy: 'ai-new-clothes-overlay-v1',
          generatedFrom: {
            wardrobeItemId: found.entry.wardrobeItemId || '',
            name: found.entry.name,
          },
        };
        state.wardrobeItems.push(wardrobeEntry);
        result.created.push(wardrobeEntry);
      }
      result.aliases.push({ categoryKey: category.key, requestedName: requestedKey, entryId: wardrobeEntry.id });
    }
    if (isCancelled()) return rollbackCancelled();
    if (result.created.length) {
      saveAiGeneratedWardrobeChanges();
      if (dialogEl()) renderDialogBody();
      log(`剧情新增衣柜款式：${result.created.map(entry => entry.name).join('、')}`);
    }
    return result;
  }

  function findAiGeneratedAliasEntry(aliases, categoryKey, rawName) {
    const wanted = normalizeAiName(rawName).toLocaleLowerCase();
    const matches = (aliases || []).filter(alias => alias.requestedName === wanted && (!categoryKey || alias.categoryKey === categoryKey));
    const ids = [...new Set(matches.map(alias => alias.entryId))];
    if (ids.length !== 1) return null;
    const entry = getWardrobeItemById(ids[0]);
    return entry ? wardrobeEntryToWearable(entry) : null;
  }

  function findPoolEntryByReturnedName(entries, rawName) {
    const wanted = normalizeAiName(rawName).toLocaleLowerCase();
    let matches = entries.filter(entry => normalizeAiName(entry.name).toLocaleLowerCase() === wanted);
    if (!matches.length) {
      const withoutAnnotation = normalizeAiName(rawName).replace(/[（(][^（）()]*[）)]\s*$/u, '').trim().toLocaleLowerCase();
      matches = entries.filter(entry => normalizeAiName(entry.name).toLocaleLowerCase() === withoutAnnotation);
    }
    return matches.length === 1 ? { entry: matches[0] } : matches.length > 1 ? { error: `部件「${rawName}」存在歧义。` } : { error: `部件「${rawName}」不在当前衣柜中。` };
  }

  function applyAiStateSnapshot(parsed, options = {}) {
    if (!parsed || parsed.error) return { ok: false, error: parsed?.error || '状态为空。' };
    const pool = getEffectiveAiPoolEntries();
    const duplicate = findDuplicateAiName(pool, !parsed.legacy);
    if (duplicate) return { ok: false, error: `模型识别名「${duplicate}」重复。` };
    const targets = new Map();
    const selectedByRegion = parsed.legacy
      ? [{ categoryKey: '', names: parsed.clothingNames || [] }]
      : WARDROBE_CATEGORY_DEFS.map(category => ({ categoryKey: category.key, names: parsed.regions?.[category.key] || [] }));
    for (const selection of selectedByRegion) {
      const regionPool = selection.categoryKey
        ? pool.filter(entry => (entry.categoryKey || wardrobeCategoryForLayer(entry.layerKey)) === selection.categoryKey)
        : pool;
      for (const name of selection.names) {
        const aliasEntry = findAiGeneratedAliasEntry(options.generatedAliases, selection.categoryKey, name);
        const found = aliasEntry ? { entry: aliasEntry } : findPoolEntryByReturnedName(regionPool, name);
        if (!found.entry) return { ok: false, error: found.error };
        const entry = found.entry;
        if (targets.has(entry.layerKey) && wearableIdentity(targets.get(entry.layerKey)) !== wearableIdentity(entry)) {
          return { ok: false, error: `同一栏目出现了多个部件：${name}。` };
        }
        targets.set(entry.layerKey, entry);
      }
    }
    for (const entry of targets.values()) {
      if (!findWardrobeSourceItem(entry.wardrobeItemId ? getWardrobeItemById(entry.wardrobeItemId) : { layerKey: entry.layerKey, sourceItemId: entry.itemId })) {
        return { ok: false, error: `部件「${entry.name}」的原始素材已不存在。` };
      }
    }
    let expression = null;
    if (parsed.expressionName && parsed.expressionName !== getCurrentExpressionName()) {
      expression = state.expressionPresets.find(preset => preset.name.toLocaleLowerCase() === parsed.expressionName.toLocaleLowerCase());
      if (!expression) return { ok: false, error: `表情「${parsed.expressionName}」不在可使用状态中。` };
    }
    ensureTransientAiBaseline();
    for (const layerKey of AI_WEARABLE_LAYER_KEYS) {
      const layer = state.layers[layerKey];
      if (!layer) continue;
      layer.selectedId = null;
      delete state.wornWardrobeEntries[layerKey];
    }
    for (const [layerKey, entry] of targets) {
      if (entry.wardrobeItemId) {
        const wardrobeEntry = getWardrobeItemById(entry.wardrobeItemId);
        if (!wardrobeEntry || !applyWardrobeRecipe(wardrobeEntry)) return { ok: false, error: `无法穿上「${entry.name}」。` };
      } else {
        const layer = state.layers[layerKey];
        if (!layer?.items?.some(item => item.id === entry.itemId)) return { ok: false, error: `无法穿上「${entry.name}」。` };
        layer.selectedId = entry.itemId;
        layer.visible = true;
        applyLinkedSelection(layerKey, entry.itemId);
      }
    }
    if (expression) applyExpressionPreset(expression, { save: false, refresh: false });
    syncAiStatePrompt();
    refreshAll({ save: false });
    if (dialogEl()) renderDialogBody();
    return { ok: true };
  }

  function resolveReceivedMessage(args) {
    const ctx = getSTContext();
    const chat = ctx?.chat;
    if (!Array.isArray(chat) || !chat.length) return null;
    for (const arg of args || []) {
      if (Number.isInteger(arg) && chat[arg] && !chat[arg].is_user) return chat[arg];
      if (Number.isInteger(arg?.messageId) && chat[arg.messageId] && !chat[arg.messageId].is_user) return chat[arg.messageId];
      if (arg && typeof arg === 'object' && typeof arg.mes === 'string' && !arg.is_user) return arg;
    }
    for (let index = chat.length - 1; index >= 0; index--) {
      if (!chat[index]?.is_user && typeof chat[index]?.mes === 'string') return chat[index];
    }
    return null;
  }

  async function handleAiStateMessage(...args) {
    const sequence = ++aiStateMessageSequence;
    inlineStatusCardEligible = false;
    try {
      if (stopIfScriptDisabled() || getExtensionSettings().aiStateEnabled === false) return;
      const message = resolveReceivedMessage(args);
      if (!message) return;
      let generated = { aliases: [], created: [], reused: [], errors: [] };
      if (getExtensionSettings().aiWardrobeGenerationEnabled !== false) {
        generated = await applyAiGeneratedWardrobeDirectives(
          parseAiNewClothesBlock(message.mes),
          () => sequence !== aiStateMessageSequence || stopIfScriptDisabled(),
        );
        if (sequence !== aiStateMessageSequence || stopIfScriptDisabled()) return;
        if (generated.errors.length) {
          const detail = generated.errors.join(' ');
          const visibleDetail = detail.length > 600 ? `${detail.slice(0, 600)}…` : detail;
          console.warn('[纸娃娃] 部分新衣服指令未应用：' + detail);
          try { if (typeof toastr !== 'undefined') toastr.warning('部分新衣服指令未应用：' + visibleDetail); } catch (_) {}
        }
      }
      const parsed = parseAiStateBlock(message.mes);
      if (!parsed) {
        restoreSavedPlanBaseline();
        return;
      }
      // 正则已经完整识别出十一栏时，这张最新状态卡就可以承载当前真实纸娃娃。
      // 即使模型返回了不存在的衣物名，扩展也会恢复保存方案，并在卡片中显示实际造型，
      // 而不是让整个小人槽位消失。
      inlineStatusCardEligible = parsed.legacy === false && !parsed.error;
      const result = applyAiStateSnapshot(parsed, { generatedAliases: generated.aliases });
      if (!result.ok) {
        restoreSavedPlanBaseline();
        console.warn('[纸娃娃] 回复状态未应用：' + result.error);
        try { if (typeof toastr !== 'undefined') toastr.warning('纸娃娃状态未应用，已恢复保存方案：' + result.error); } catch (_) {}
      }
      scheduleInlineStatusRefresh(0);
    } catch (error) {
      inlineStatusCardEligible = false;
      clearInlineStatusDollMounts();
      console.warn('[纸娃娃] 状态回复处理失败：', error);
      try { if (typeof toastr !== 'undefined') toastr.warning('纸娃娃状态处理失败：' + (error?.message || error)); } catch (_) {}
    }
  }

  function registerAiStateWatcher() {
    const ctx = getSTContext();
    const eventSource = ST_MODULES.script?.eventSource || ctx?.eventSource;
    const eventTypes = ST_MODULES.script?.event_types || ctx?.event_types || ctx?.eventTypes;
    const messageTypes = [
      eventTypes?.MESSAGE_RECEIVED || 'MESSAGE_RECEIVED',
      eventTypes?.MESSAGE_EDITED,
      eventTypes?.MESSAGE_UPDATED,
      eventTypes?.MESSAGE_SWIPED,
    ].filter((value, index, list) => value && list.indexOf(value) === index);
    const inlineTypes = [
      eventTypes?.CHARACTER_MESSAGE_RENDERED,
      eventTypes?.MESSAGE_EDITED,
      eventTypes?.MESSAGE_UPDATED,
      eventTypes?.MESSAGE_SWIPED,
      eventTypes?.GENERATION_ENDED,
    ].filter((value, index, list) => value && list.indexOf(value) === index);
    const chatType = eventTypes?.CHAT_CHANGED || 'CHAT_CHANGED';
    const generationType = eventTypes?.GENERATION_AFTER_COMMANDS || 'GENERATION_AFTER_COMMANDS';
    const fallbackSendType = eventTypes?.GENERATION_AFTER_COMMANDS ? '' : (eventTypes?.MESSAGE_SENT || 'MESSAGE_SENT');
    if (!eventSource?.on) return false;
    try {
      const handleBeforeGeneration = () => {
        if (ST_WIN.__xjPaperdollDestroy !== cleanup || stopIfScriptDisabled()) return;
        syncAiStatePrompt({ force: true, source: 'generation' });
        refreshAiPromptDiagnostics();
      };
      const handleInlineRender = () => scheduleInlineStatusRefresh(0);
      const handleChatChanged = () => {
        aiStateMessageSequence++;
        transientAiBaseline = null;
        inlineStatusCardEligible = false;
        clearInlineStatusDollMounts();
        lastAiPromptValue = null;
        if (ST_WIN.__xjPaperdollChatTimer) ST_WIN.clearTimeout(ST_WIN.__xjPaperdollChatTimer);
        ST_WIN.__xjPaperdollChatTimer = ST_WIN.setTimeout(async () => {
          ST_WIN.__xjPaperdollChatTimer = null;
          if (ST_WIN.__xjPaperdollDestroy !== cleanup || stopIfScriptDisabled()) return;
          applyBindingForCurrentPersona({ silent: true });
          if (!restoreSavedPlanBaseline()) {
            syncAiStatePrompt();
            refreshAll({ save: false });
            if (dialogEl()) renderDialogBody();
          }
          await handleAiStateMessage();
          scheduleInlineStatusRefresh(0);
        }, 0);
      };
      messageTypes.forEach(type => eventSource.on(type, handleAiStateMessage));
      inlineTypes.forEach(type => eventSource.on(type, handleInlineRender));
      eventSource.on(chatType, handleChatChanged);
      eventSource.on(generationType, handleBeforeGeneration);
      if (fallbackSendType && fallbackSendType !== generationType) eventSource.on(fallbackSendType, handleBeforeGeneration);
      ST_WIN.__xjPaperdollAiEventSource = eventSource;
      ST_WIN.__xjPaperdollAiMessageTypes = messageTypes;
      ST_WIN.__xjPaperdollInlineEventTypes = inlineTypes;
      ST_WIN.__xjPaperdollAiChatType = chatType;
      ST_WIN.__xjPaperdollAiGenerationType = generationType;
      ST_WIN.__xjPaperdollAiFallbackSendType = fallbackSendType;
      ST_WIN.__xjPaperdollAiHandler = handleAiStateMessage;
      ST_WIN.__xjPaperdollInlineHandler = handleInlineRender;
      ST_WIN.__xjPaperdollAiChatHandler = handleChatChanged;
      ST_WIN.__xjPaperdollAiGenerationHandler = handleBeforeGeneration;
      return true;
    } catch (err) {
      console.warn('[纸娃娃] 状态回复监听失败：', err);
      return false;
    }
  }

  function stableHash(text) {
    const str = String(text || '');
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function cleanUserPart(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  }

  function normalizeAvatarValue(value) {
    let raw = String(value || '').trim();
    if (!raw) return '';
    raw = raw.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
    try { raw = decodeURIComponent(raw); } catch (_) {}
    raw = raw.replace(/[?#].*$/, '');
    raw = raw.replace(/^.*\/User Avatars\//i, 'User Avatars/');
    raw = raw.replace(/^.*\/user\/avatars\//i, 'user/avatars/');
    raw = raw.replace(/^.*\/avatars\//i, 'avatars/');
    return raw.trim();
  }

  function readDomAvatarValue(el) {
    if (!el) return '';
    const styleBg = (() => {
      try { return ST_WIN.getComputedStyle?.(el)?.backgroundImage || ''; } catch (_) { return ''; }
    })();
    return normalizeAvatarValue(
      el.currentSrc || el.src ||
      el.getAttribute?.('src') ||
      el.getAttribute?.('data-src') ||
      el.getAttribute?.('data-avatar') ||
      el.getAttribute?.('data-user-avatar') ||
      el.dataset?.avatar ||
      el.dataset?.userAvatar ||
      styleBg ||
      ''
    );
  }

  function firstDomAvatar(selectors) {
    for (const selector of selectors) {
      try {
        const nodes = Array.from(ST_DOC.querySelectorAll(selector));
        for (const node of nodes) {
          const direct = readDomAvatarValue(node);
          if (direct) return direct;
          const img = node.querySelector?.('img');
          const nested = readDomAvatarValue(img);
          if (nested) return nested;
        }
      } catch (_) {}
    }
    return '';
  }

  function lastDomAvatar(selectors) {
    for (const selector of selectors) {
      try {
        const nodes = Array.from(ST_DOC.querySelectorAll(selector));
        for (let i = nodes.length - 1; i >= 0; i--) {
          const node = nodes[i];
          const direct = readDomAvatarValue(node);
          if (direct) return direct;
          const img = node.querySelector?.('img');
          const nested = readDomAvatarValue(img);
          if (nested) return nested;
        }
      } catch (_) {}
    }
    return '';
  }

  function getAutoUserInfo() {
    const ctx = getSTContext();
    const scriptModule = ST_MODULES.script || {};
    const personasModule = ST_MODULES.personas || {};
    const powerModule = ST_MODULES.powerUser || {};
    const powerUser = powerModule.power_user || ctx?.power_user || {};

    const eventAvatar = runtimePersonaEventInfo?.avatar || '';
    const domAvatar = findSelectedPersonaAvatarIdFromDom();
    const avatarId = extractPersonaAvatarId(
      personasModule.user_avatar ||
      scriptModule.user_avatar ||
      eventAvatar ||
      ctx?.user_avatar ||
      ctx?.persona_avatar ||
      ctx?.power_user?.user_avatar ||
      domAvatar ||
      ST_WIN.user_avatar ||
      ''
    );

    const globalName = (() => { try { return ST_WIN.name1 || window.name1; } catch (_) { return ''; } })();
    const personaName = avatarId ? (powerUser.personas?.[avatarId] || '') : '';
    const title = avatarId ? (powerUser.persona_descriptions?.[avatarId]?.title || '') : '';
    const name = personaName || scriptModule.name1 || ctx?.name1 || ctx?.userName || ctx?.user_name || globalName || '当前user';
    const label = cleanUserPart(name || '当前user');

    if (avatarId) {
      return {
        key: `persona-avatar:${avatarId}`,
        label,
        title: cleanUserPart(title),
        avatar: avatarId,
        avatarId,
        keyLabel: avatarId,
        source: 'user_avatar',
      };
    }

    return {
      key: `persona-name:${stableHash(label || 'default-user')}`,
      label,
      title: '',
      avatar: '',
      avatarId: '',
      keyLabel: '未读取到 user_avatar',
      source: 'name-fallback',
    };
  }

  let runtimePersonaEventInfo = null;

  function extractPersonaEventInfo(args) {
    const first = Array.isArray(args) ? args[0] : args;
    const avatar = extractPersonaAvatarId(first?.avatarId || first?.avatar || first?.user_avatar || first);
    const name = cleanUserPart(first?.name || first?.display_name || '');
    if (!avatar && !name) return null;
    return { avatar, name, time: Date.now() };
  }

  function getCurrentUserInfo() {
    return getAutoUserInfo();
  }


  function layerSnapshot(layer) {
    return {
      selectedId: layer.selectedId || null,
      visible: layer.visible !== false,
      colorHex: layer.colorHex || COLOR_DEFAULTS.colorHex,
      tintStrength: Number(layer.tintStrength ?? COLOR_DEFAULTS.tintStrength),
      saturation: Number(layer.saturation ?? COLOR_DEFAULTS.saturation),
      brightness: Number(layer.brightness ?? COLOR_DEFAULTS.brightness),
      contrast: Number(layer.contrast ?? COLOR_DEFAULTS.contrast),
      preserveLines: layer.preserveLines !== false,
      colorMapping: layer.colorMapping === 'overlay' ? 'overlay' : layer.colorMapping === 'target' ? 'target' : COLOR_DEFAULTS.colorMapping,
      followHairGroup: !!layer.followHairGroup,
    };
  }

  function createPlanSnapshot() {
    const layers = {};
    for (const key of Object.keys(state.layers)) {
      layers[key] = layerSnapshot(state.layers[key]);
    }
    return {
      layers,
      layerModes: { ...state.layerModes },
      hairGroupColor: { ...state.hairGroupColor },
      activeWardrobeId: state.activeWardrobeId,
      wornWardrobeEntries: { ...state.wornWardrobeEntries },
      aiNames: { ...state.aiNames },
      aiClothingPool: [...state.aiClothingPool],
      dyeSettings: cloneDyeSettingsMap(state.dyeSettings),
      expressionPresets: state.expressionPresets.map(preset => ({ ...preset })),
      currentExpressionId: state.currentExpressionId || null,
    };
  }

  function applyPlanSnapshot(snapshot) {
    if (!snapshot) return;
    const snapLayers = snapshot.layers || {};
    for (const key of Object.keys(state.layers)) {
      const snap = snapLayers[key];
      if (!snap) continue;
      Object.assign(state.layers[key], {
        selectedId: snap.selectedId || null,
        visible: snap.visible !== false,
        colorHex: snap.colorHex || COLOR_DEFAULTS.colorHex,
        tintStrength: Number(snap.tintStrength ?? COLOR_DEFAULTS.tintStrength),
        saturation: Number(snap.saturation ?? COLOR_DEFAULTS.saturation),
        brightness: Number(snap.brightness ?? COLOR_DEFAULTS.brightness),
        contrast: Number(snap.contrast ?? COLOR_DEFAULTS.contrast),
        preserveLines: snap.preserveLines !== false,
        colorMapping: snap.colorMapping === 'overlay' ? 'overlay' : snap.colorMapping === 'target' ? 'target' : COLOR_DEFAULTS.colorMapping,
        followHairGroup: typeof snap.followHairGroup === 'boolean' ? snap.followHairGroup : isHairLayer(key),
      });
    }
    state.layerModes = { ...defaultState.layerModes, ...(snapshot.layerModes || {}) };
    state.hairGroupColor = { ...COLOR_DEFAULTS, ...(snapshot.hairGroupColor || state.hairGroupColor || {}) };
    if (getWardrobeById(snapshot.activeWardrobeId)) state.activeWardrobeId = snapshot.activeWardrobeId;
    state.wornWardrobeEntries = { ...(snapshot.wornWardrobeEntries || {}) };
    state.aiNames = snapshot.aiNames && typeof snapshot.aiNames === 'object' ? { ...snapshot.aiNames } : state.aiNames;
    state.aiClothingPool = Array.isArray(snapshot.aiClothingPool) ? [...new Set(snapshot.aiClothingPool)] : state.aiClothingPool;
    state.dyeSettings = snapshot.dyeSettings && typeof snapshot.dyeSettings === 'object'
      ? cloneDyeSettingsMap(snapshot.dyeSettings)
      : state.dyeSettings;
    state.expressionPresets = Array.isArray(snapshot.expressionPresets)
      ? snapshot.expressionPresets.map(preset => ({ ...preset }))
      : state.expressionPresets;
    state.currentExpressionId = snapshot.currentExpressionId || null;
    if (state.currentExpressionId && !state.expressionPresets.some(preset => preset.id === state.currentExpressionId)) {
      state.currentExpressionId = null;
    }
    repairWornWardrobeEntries();
    syncBlinkRuntime();
  }

  function getPlanById(id) {
    return state.plans.find(plan => plan.id === id) || null;
  }

  function getCurrentPlan() {
    return getPlanById(state.currentPlanId);
  }

  function defaultPlanName() {
    const user = getCurrentUserInfo();
    const count = state.plans.filter(plan => (plan.wardrobeId || DEFAULT_WARDROBE_ID) === state.activeWardrobeId).length;
    return `${user.label}-方案${count + 1}`;
  }

  function saveAsNewPlan() {
    const name = ST_WIN.prompt('给这套纸娃娃方案取个名字', defaultPlanName());
    if (!name) return false;
    const plan = {
      id: generateId(),
      name: name.trim(),
      wardrobeId: state.activeWardrobeId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      snapshot: createPlanSnapshot(),
    };
    state.plans.push(plan);
    state.currentPlanId = plan.id;
    transientAiBaseline = null;
    saveState();
    log('已保存新方案：' + plan.name);
    return true;
  }

  function overwriteCurrentPlan() {
    let plan = getCurrentPlan();
    if (!plan) return saveAsNewPlan();
    plan.wardrobeId = state.activeWardrobeId;
    plan.snapshot = createPlanSnapshot();
    plan.updatedAt = Date.now();
    transientAiBaseline = null;
    saveState();
    log('已覆盖方案：' + plan.name);
    return true;
  }

  function loadCurrentPlan() {
    const plan = getCurrentPlan();
    if (!plan) {
      alert('还没有选中方案。');
      return false;
    }
    if (getWardrobeById(plan.wardrobeId)) state.activeWardrobeId = plan.wardrobeId;
    applyPlanSnapshot(plan.snapshot);
    transientAiBaseline = null;
    saveState();
    log('已读取方案：' + plan.name);
    return true;
  }

  function deleteCurrentPlan() {
    const plan = getCurrentPlan();
    if (!plan) {
      alert('还没有选中方案。');
      return false;
    }
    if (!ST_WIN.confirm(`删除方案「${plan.name}」？`)) return false;
    state.plans = state.plans.filter(item => item.id !== plan.id);
    for (const key of Object.keys(state.userBindings)) {
      if (state.userBindings[key] === plan.id) delete state.userBindings[key];
    }
    state.currentPlanId = state.plans.find(item => (item.wardrobeId || DEFAULT_WARDROBE_ID) === state.activeWardrobeId)?.id || null;
    if (state.currentPlanId) applyPlanSnapshot(getCurrentPlan()?.snapshot);
    transientAiBaseline = null;
    saveState();
    log('已删除方案：' + plan.name);
    return true;
  }

  function bindCurrentPlanToUser() {
    let plan = getCurrentPlan();
    if (!plan) {
      const ok = saveAsNewPlan();
      if (!ok) return false;
      plan = getCurrentPlan();
    }
    const user = getCurrentUserInfo();
    if (user.source !== 'user_avatar' || !user.avatarId) {
      alert('还没有读到当前 persona 的 user_avatar，不能安全绑定同名 user。这个版本会优先从酒馆顶层模块读取；如果这里仍出现，请打开 Persona 面板一次后再试，或把截图发给我继续定位。');
      return false;
    }
    for (const key of Object.keys(state.userBindings)) {
      if (state.userBindings[key] === plan.id) delete state.userBindings[key];
    }
    state.userBindings[user.key] = plan.id;
    state.lastUserKey = user.key;
    saveState();
    log(`已绑定：${user.keyLabel} → ${plan.name}`);
    return true;
  }

  function unbindCurrentUser() {
    const user = getCurrentUserInfo();
    delete state.userBindings[user.key];
    saveState();
    log('已解除当前 user 绑定');
    return true;
  }

  function applyBindingForCurrentPersona(options = {}) {
    const { refreshPanel = false, silent = false } = options;
    const user = getCurrentUserInfo();
    state.lastUserKey = user.key;
    const planId = state.userBindings[user.key];
    const plan = getPlanById(planId);
    if (plan) {
      if (getWardrobeById(plan.wardrobeId)) state.activeWardrobeId = plan.wardrobeId;
      state.currentPlanId = plan.id;
      applyPlanSnapshot(plan.snapshot);
      saveState();
      refreshAll({ save: false });
      if (refreshPanel && dialogEl()) renderDialogBody();
      if (!silent) log(`已按当前 user 绑定读取方案：${plan.name}`);
      return true;
    }
    saveState();
    if (refreshPanel && dialogEl()) renderDialogBody();
    return false;
  }


  function isThisScriptEnabled() {
    return isPaperdollEnabled();
  }

  function stopIfScriptDisabled() {
    if (isThisScriptEnabled()) return false;
    try { cleanup(); } catch (_) {}
    return true;
  }

  function registerIframeLifecycleCleanup() {
    const old = window.__xjPaperdollIframeUnloadCleanup;
    if (old) {
      try { window.removeEventListener('pagehide', old); } catch (_) {}
      try { window.removeEventListener('beforeunload', old); } catch (_) {}
      try { window.removeEventListener('unload', old); } catch (_) {}
    }
    const handler = () => {
      try { cleanup(); } catch (_) {}
    };
    window.__xjPaperdollIframeUnloadCleanup = handler;
    window.addEventListener('pagehide', handler);
    window.addEventListener('beforeunload', handler);
    window.addEventListener('unload', handler);
  }


  
function clampByte(value) {
    return Math.max(0, Math.min(255, value));
  }

  function getLayerColorSettings(layerKey) {
    const layer = state.layers[layerKey] || {};
    const source = isHairLayer(layerKey) && layer.followHairGroup ? (state.hairGroupColor || COLOR_DEFAULTS) : layer;
    return {
      colorHex: source.colorHex || COLOR_DEFAULTS.colorHex,
      tintStrength: Number(source.tintStrength ?? COLOR_DEFAULTS.tintStrength),
      saturation: Number(source.saturation ?? COLOR_DEFAULTS.saturation),
      brightness: Number(source.brightness ?? COLOR_DEFAULTS.brightness),
      contrast: Number(source.contrast ?? COLOR_DEFAULTS.contrast),
      preserveLines: source.preserveLines !== false,
      colorMapping: source.colorMapping === 'overlay' ? 'overlay' : source.colorMapping === 'target' ? 'target' : COLOR_DEFAULTS.colorMapping,
    };
  }

  function shouldProcessColor(layerKey) {
    const settings = getLayerColorSettings(layerKey);
    return settings.tintStrength > 0 || settings.saturation !== 100 || settings.brightness !== 100 || settings.contrast !== 100;
  }

  function hexToRgb(hex) {
    const safe = (hex || '#d96b87').replace('#', '');
    const value = safe.length === 3 ? safe.split('').map(ch => ch + ch).join('') : safe.padEnd(6, '0').slice(0, 6);
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }

  const processedImageCache = new Map();

  function buildColorCacheKey(assetUrl, layerKey) {
    const s = getLayerColorSettings(layerKey);
    return JSON.stringify([assetUrl, layerKey, s.colorHex, s.tintStrength, s.saturation, s.brightness, s.contrast, s.preserveLines, s.colorMapping]);
  }

  function visibleLuminanceAnchor(imageData, maskData = null) {
    const data = imageData?.data;
    if (!data?.length) return 0.5;
    const mask = maskData?.data;
    const histogram = new Float64Array(256);
    let totalWeight = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = (data[i + 3] || 0) / 255;
      if (alpha <= 0.01) continue;
      const maskAlpha = mask ? (mask[i + 3] || 0) / 255 : 1;
      const weight = alpha * maskAlpha;
      if (weight <= 0.01) continue;
      const luminance = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      histogram[Math.max(0, Math.min(255, luminance))] += weight;
      totalWeight += weight;
    }
    if (totalWeight <= 0) return 0.5;
    const upperMidtone = totalWeight * 0.70;
    let cumulative = 0;
    for (let value = 0; value < histogram.length; value++) {
      cumulative += histogram[value];
      if (cumulative >= upperMidtone) return Math.max(0.05, Math.min(1, value / 255));
    }
    return 0.5;
  }

  function mapTargetColorChannel(channel, luminance, anchor) {
    return channel + (luminance - anchor) * 255;
  }

  function processAiOverlayPixels(imageData, colorHex) {
    const color = hexToRgb(colorHex);
    const data = imageData.data;
    // Keep a small amount of light in near-black channels so folds remain visible.
    const channels = [color.r, color.g, color.b].map(value => Math.max(48, value));
    for (let i = 0; i < data.length; i += 4) {
      if (!data[i + 3]) continue;
      for (let channel = 0; channel < 3; channel++) {
        const base = data[i + channel];
        const tint = channels[channel];
        data[i + channel] = base <= 127.5
          ? 2 * base * tint / 255
          : 255 - 2 * (255 - base) * (255 - tint) / 255;
      }
    }
    return imageData;
  }

  function processCanvasPixels(imageData, settings, maskData = null) {
    if (settings.colorMapping === 'overlay') return processAiOverlayPixels(imageData, settings.colorHex);
    const data = imageData.data;
    const target = hexToRgb(settings.colorHex);
    const tintStrength = Math.max(0, Math.min(100, settings.tintStrength)) / 100;
    const saturation = Math.max(0, settings.saturation) / 100;
    const brightness = Math.max(0, settings.brightness) / 100;
    const contrast = Math.max(0, settings.contrast) / 100;
    const preserveLines = settings.preserveLines !== false;
    const targetColorMode = settings.colorMapping === 'target';
    const luminanceAnchor = targetColorMode ? visibleLuminanceAnchor(imageData, maskData) : 1;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const tintedR = targetColorMode ? mapTargetColorChannel(target.r, lum, luminanceAnchor) : target.r * lum;
      const tintedG = targetColorMode ? mapTargetColorChannel(target.g, lum, luminanceAnchor) : target.g * lum;
      const tintedB = targetColorMode ? mapTargetColorChannel(target.b, lum, luminanceAnchor) : target.b * lum;

      let pixelStrength = tintStrength;
      if (preserveLines) {
        const protect = targetColorMode
          ? Math.max(0, Math.min(1, ((lum / luminanceAnchor) - 0.18) / 0.52))
          : Math.max(0, Math.min(1, (lum - 0.10) / 0.35));
        pixelStrength *= protect;
      }

      let nr = r * (1 - pixelStrength) + tintedR * pixelStrength;
      let ng = g * (1 - pixelStrength) + tintedG * pixelStrength;
      let nb = b * (1 - pixelStrength) + tintedB * pixelStrength;

      const gray = 0.299 * nr + 0.587 * ng + 0.114 * nb;
      nr = gray + (nr - gray) * saturation;
      ng = gray + (ng - gray) * saturation;
      nb = gray + (nb - gray) * saturation;

      nr *= brightness;
      ng *= brightness;
      nb *= brightness;

      nr = (nr - 128) * contrast + 128;
      ng = (ng - 128) * contrast + 128;
      nb = (nb - 128) * contrast + 128;

      data[i] = clampByte(nr);
      data[i + 1] = clampByte(ng);
      data[i + 2] = clampByte(nb);
    }
    return imageData;
  }

  function getProcessedAssetUrl(assetUrl, layerKey) {
    if (!shouldProcessColor(layerKey)) return Promise.resolve(assetUrl);
    const cacheKey = buildColorCacheKey(assetUrl, layerKey);
    if (processedImageCache.has(cacheKey)) return processedImageCache.get(cacheKey);
    const promise = new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = ST_DOC.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const processed = processCanvasPixels(imageData, getLayerColorSettings(layerKey));
          ctx.putImageData(processed, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (err) {
          console.error('[纸娃娃] 高级调色失败：', err);
          resolve(assetUrl);
        }
      };
      img.onerror = () => resolve(assetUrl);
      img.src = assetUrl;
    });
    processedImageCache.set(cacheKey, promise);
    if (processedImageCache.size > 60) {
      const oldestKey = processedImageCache.keys().next().value;
      if (oldestKey) processedImageCache.delete(oldestKey);
    }
    return promise;
  }

  function loadImageForCanvas(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片读取失败：' + url));
      img.src = url;
    });
  }

  function activeDyeRegions(item, variant) {
    return (item?.dyeRegions || []).map(region => ({
      region,
      maskUrl: dyeMaskUrl(region, variant),
    })).filter(entry => entry.maskUrl && hasCustomDyeColor(item, entry.region));
  }

  function applyMaskedTint(baseData, maskData, settings) {
    const original = new Uint8ClampedArray(baseData.data);
    const tinted = { data: new Uint8ClampedArray(baseData.data) };
    processCanvasPixels(tinted, settings, maskData);
    for (let i = 0; i < baseData.data.length; i += 4) {
      const maskAlpha = (maskData.data[i + 3] || 0) / 255;
      if (maskAlpha <= 0) continue;
      baseData.data[i] = clampByte(original[i] * (1 - maskAlpha) + tinted.data[i] * maskAlpha);
      baseData.data[i + 1] = clampByte(original[i + 1] * (1 - maskAlpha) + tinted.data[i + 1] * maskAlpha);
      baseData.data[i + 2] = clampByte(original[i + 2] * (1 - maskAlpha) + tinted.data[i + 2] * maskAlpha);
    }
    return baseData;
  }

  function buildRenderedAssetCacheKey(item, layerKey, variant, assetUrl, regions) {
    const general = getLayerColorSettings(layerKey);
    const dyes = regions.map(({ region, maskUrl }) => {
      const settings = getDyeSettings(item, region);
      return [region.id, maskUrl, settings.colorHex, settings.tintStrength, settings.saturation, settings.brightness, settings.contrast, settings.preserveLines, settings.colorMapping];
    });
    return 'render:' + JSON.stringify([assetUrl, layerKey, variant, general, dyes]);
  }

  function getRenderedAssetUrl(item, layerKey, variant = 'front') {
    const assetUrl = assetVariantUrl(item, variant);
    if (!assetUrl) return Promise.resolve('');
    const regions = activeDyeRegions(item, variant);
    if (!regions.length) return getProcessedAssetUrl(assetUrl, layerKey);
    const cacheKey = buildRenderedAssetCacheKey(item, layerKey, variant, assetUrl, regions);
    if (processedImageCache.has(cacheKey)) return processedImageCache.get(cacheKey);
    const promise = (async () => {
      try {
        const generalUrl = await getProcessedAssetUrl(assetUrl, layerKey);
        const [baseImage, ...maskImages] = await Promise.all([
          loadImageForCanvas(generalUrl),
          ...regions.map(entry => loadImageForCanvas(entry.maskUrl)),
        ]);
        const canvas = ST_DOC.createElement('canvas');
        canvas.width = baseImage.naturalWidth || baseImage.width;
        canvas.height = baseImage.naturalHeight || baseImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(baseImage, 0, 0);
        const baseData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        regions.forEach((entry, index) => {
          const mask = maskImages[index];
          if ((mask.naturalWidth || mask.width) !== canvas.width || (mask.naturalHeight || mask.height) !== canvas.height) return;
          const maskCanvas = ST_DOC.createElement('canvas');
          maskCanvas.width = canvas.width;
          maskCanvas.height = canvas.height;
          const maskCtx = maskCanvas.getContext('2d');
          maskCtx.drawImage(mask, 0, 0);
          const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
          applyMaskedTint(baseData, maskData, getDyeSettings(item, entry.region));
        });
        ctx.putImageData(baseData, 0, 0);
        return canvas.toDataURL('image/png');
      } catch (error) {
        console.warn('[纸娃娃] 分区染色失败，已显示原图：', error);
        return assetUrl;
      }
    })();
    processedImageCache.set(cacheKey, promise);
    if (processedImageCache.size > 80) {
      const oldestKey = processedImageCache.keys().next().value;
      if (oldestKey) processedImageCache.delete(oldestKey);
    }
    return promise;
  }

  function colorSettingsAreActive(settings) {
    const value = cloneColorSettings(settings);
    return value.tintStrength > 0 || value.saturation !== 100 || value.brightness !== 100 || value.contrast !== 100;
  }

  function wardrobeEntryHasDye(entry) {
    const recipe = normalizeWardrobeRecipe(entry?.recipe);
    return colorSettingsAreActive(recipe.whole) || Object.keys(recipe.regions).length > 0;
  }

  function getWardrobeThumbnailUrl(entry) {
    const item = findWardrobeSourceItem(entry);
    const assetUrl = assetVariantUrl(item, 'front');
    if (!item || !assetUrl) return Promise.resolve('');
    const recipe = normalizeWardrobeRecipe(entry.recipe);
    const regions = (item.dyeRegions || []).map(region => ({
      region,
      maskUrl: dyeMaskUrl(region, 'front'),
      settings: recipe.regions[region.id],
    })).filter(value => value.maskUrl && value.settings);
    if (!colorSettingsAreActive(recipe.whole) && !regions.length) return Promise.resolve(assetUrl);
    const cacheKey = `closet-thumb:${JSON.stringify([assetUrl, recipe])}`;
    if (processedImageCache.has(cacheKey)) return processedImageCache.get(cacheKey);
    const promise = (async () => {
      try {
        const [baseImage, ...maskImages] = await Promise.all([
          loadImageForCanvas(assetUrl),
          ...regions.map(value => loadImageForCanvas(value.maskUrl)),
        ]);
        const canvas = ST_DOC.createElement('canvas');
        canvas.width = baseImage.naturalWidth || baseImage.width;
        canvas.height = baseImage.naturalHeight || baseImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(baseImage, 0, 0);
        const baseData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (colorSettingsAreActive(recipe.whole)) processCanvasPixels(baseData, recipe.whole);
        regions.forEach((value, index) => {
          const mask = maskImages[index];
          if ((mask.naturalWidth || mask.width) !== canvas.width || (mask.naturalHeight || mask.height) !== canvas.height) return;
          const maskCanvas = ST_DOC.createElement('canvas');
          maskCanvas.width = canvas.width;
          maskCanvas.height = canvas.height;
          const maskCtx = maskCanvas.getContext('2d');
          maskCtx.drawImage(mask, 0, 0);
          applyMaskedTint(baseData, maskCtx.getImageData(0, 0, canvas.width, canvas.height), normalizeDyeSettings(value.settings, value.region));
        });
        ctx.putImageData(baseData, 0, 0);
        return canvas.toDataURL('image/png');
      } catch (error) {
        console.warn('[纸娃娃] 衣柜缩略图生成失败，已显示原图：', error);
        return assetUrl;
      }
    })();
    processedImageCache.set(cacheKey, promise);
    if (processedImageCache.size > 120) {
      const oldestKey = processedImageCache.keys().next().value;
      if (oldestKey) processedImageCache.delete(oldestKey);
    }
    return promise;
  }

  function hydrateWardrobeThumbnails(root = dialogEl()) {
    root?.querySelectorAll?.('[data-wardrobe-thumb]').forEach(image => {
      const entry = getWardrobeItemById(image.dataset.wardrobeThumb);
      if (!entry) return;
      getWardrobeThumbnailUrl(entry).then(url => {
        if (url && image.isConnected && image.dataset.wardrobeThumb === entry.id) image.src = url;
      });
    });
  }

  function applyLayerBackgroundLayout(div, assetUrl, region, scale, frameConfig = null, orientationOverride = null) {
    let bgWidth = ATLAS.w;
    let bgHeight = ATLAS.h;
    let posX = region.x;
    let posY = region.y;

    if (frameConfig && frameConfig.frameCount > 1) {
      const orientation = orientationOverride || frameConfig.orientation || 'horizontal';
      if (orientation === 'vertical') {
        bgHeight = ATLAS.h * frameConfig.frameCount;
        posY = region.y + (ATLAS.h * frameConfig.frameIndex);
      } else {
        bgWidth = ATLAS.w * frameConfig.frameCount;
        posX = region.x + (ATLAS.w * frameConfig.frameIndex);
      }
    }

    div.style.backgroundImage = cssUrl(assetUrl);
    div.style.backgroundSize = `${bgWidth * scale}px ${bgHeight * scale}px`;
    div.style.backgroundPosition = `-${posX * scale}px -${posY * scale}px`;
  }

  function makeLayerDiv(item, region, scale, layerKey, frameConfig = null, variant = 'front', renderKey = layerKey) {
    const assetUrl = assetVariantUrl(item, variant);
    const div = ST_DOC.createElement('div');
    div.className = 'xj-pd-layer';
    div.dataset.pdLayer = renderKey;
    div.dataset.pdSourceLayer = layerKey;
    div.dataset.pdVariant = variant;
    div.style.width = `${region.w * scale}px`;
    div.style.height = `${region.h * scale}px`;

    if (frameConfig && layerKey === 'eyelid') {
      div.dataset.pdBlinkLayer = '1';
      div.dataset.pdRegionX = String(region.x);
      div.dataset.pdRegionY = String(region.y);
      div.dataset.pdScale = String(scale);
      div.dataset.pdFrameCount = String(frameConfig.frameCount || 3);
    }

    applyLayerBackgroundLayout(div, assetUrl, region, scale, frameConfig, 'horizontal');

    getRenderedAssetUrl(item, layerKey, variant).then(url => {
      if (!div.isConnected) return;
      if (!url) return;
      div.style.backgroundImage = cssUrl(url);
    });
    return div;
  }

  const BLINK_FRAME_MS = Math.round(1000 / 7);
  const BLINK_REST_MS = 5000;

  const blinkRuntime = {
    frame: 0,
    timers: [],
    paused: false,
    resumeTimer: null,
  };

  function clearBlinkTimers() {
    for (const timer of blinkRuntime.timers) {
      try { clearTimeout(timer); } catch (_) {}
    }
    blinkRuntime.timers = [];
  }

  function clearBlinkResumeTimer() {
    try {
      if (blinkRuntime.resumeTimer) ST_WIN.clearTimeout(blinkRuntime.resumeTimer);
    } catch (_) {}
    blinkRuntime.resumeTimer = null;
  }

  function eyelidBlinkReady() {
    if (getExtensionSettings().blinkEnabled === false) return false;
    const layer = state.layers.eyelid;
    return !!(layer && layer.visible && layer.selectedId);
  }

  function setEyelidFrameOnDiv(div, frameIndex) {
    const scale = Number(div.dataset.pdScale || 1);
    const regionX = Number(div.dataset.pdRegionX || 0);
    const regionY = Number(div.dataset.pdRegionY || 0);
    const frameCount = Number(div.dataset.pdFrameCount || 3);
    const safeFrame = Math.max(0, Math.min(frameCount - 1, Number(frameIndex) || 0));
    const posX = regionX + ATLAS.w * safeFrame;
    div.style.backgroundSize = `${ATLAS.w * frameCount * scale}px ${ATLAS.h * scale}px`;
    div.style.backgroundPosition = `-${posX * scale}px -${regionY * scale}px`;
  }

  function updateEyelidFrameOnly() {
    const frame = blinkRuntime.frame;
    ST_DOC.querySelectorAll('[data-pd-blink-layer="1"]').forEach(div => {
      setEyelidFrameOnDiv(div, frame);
    });
  }

  function refreshBlinkVisuals() {
    updateEyelidFrameOnly();
  }

  function queueBlinkStep(frame, delay) {
    const timer = ST_WIN.setTimeout(() => {
      if (stopIfScriptDisabled()) return;
      if (blinkRuntime.paused) return;
      blinkRuntime.frame = frame;
      refreshBlinkVisuals();
    }, delay);
    blinkRuntime.timers.push(timer);
  }

  function scheduleNextBlink(restFirst = false) {
    if (stopIfScriptDisabled()) return;
    if (blinkRuntime.paused) return;
    clearBlinkTimers();
    blinkRuntime.frame = 0;
    refreshBlinkVisuals();
    if (!eyelidBlinkReady()) {
      return;
    }
    if (restFirst) {
      const restTimer = ST_WIN.setTimeout(() => scheduleNextBlink(false), BLINK_REST_MS);
      blinkRuntime.timers.push(restTimer);
      return;
    }
    // 当前已经停在第 0 帧（睁眼），这里只播放闭合再回开的四步。
    // 实际视觉顺序：0 睁眼 → 1 半闭 → 2 闭眼 → 1 半闭 → 0 睁眼，然后停 5 秒。
    const sequence = [1, 2, 1, 0];
    sequence.forEach((frame, index) => {
      queueBlinkStep(frame, (index + 1) * BLINK_FRAME_MS);
    });
    const nextTimer = ST_WIN.setTimeout(() => scheduleNextBlink(false), sequence.length * BLINK_FRAME_MS + BLINK_REST_MS);
    blinkRuntime.timers.push(nextTimer);
  }

  function pauseBlinkForColorInteraction() {
    clearBlinkResumeTimer();
    blinkRuntime.paused = true;
    clearBlinkTimers();
    blinkRuntime.frame = 0;
    refreshBlinkVisuals();
  }

  function resumeBlinkAfterColorInteraction(delay = 800) {
    clearBlinkResumeTimer();
    blinkRuntime.resumeTimer = ST_WIN.setTimeout(() => {
      blinkRuntime.resumeTimer = null;
      if (stopIfScriptDisabled()) return;
      blinkRuntime.paused = false;
      scheduleNextBlink(true);
    }, delay);
  }

  function syncBlinkRuntime() {
    clearBlinkTimers();
    clearBlinkResumeTimer();
    blinkRuntime.paused = false;
    blinkRuntime.frame = 0;
    scheduleNextBlink();
  }

  function ensureBlinkRuntime() {
    if (stopIfScriptDisabled()) return;
    if (blinkRuntime.paused) {
      refreshBlinkVisuals();
      return;
    }
    if (!eyelidBlinkReady()) {
      clearBlinkTimers();
      clearBlinkResumeTimer();
      blinkRuntime.frame = 0;
      refreshBlinkVisuals();
      return;
    }
    if (!blinkRuntime.timers.length && !blinkRuntime.resumeTimer) {
      scheduleNextBlink(true);
      return;
    }
    refreshBlinkVisuals();
  }

  function getEyelidFrameConfig(layerKey) {
    if (layerKey !== 'eyelid') return null;
    return {
      frameCount: 3,
      orientation: 'horizontal',
      frameIndex: blinkRuntime.frame,
    };
  }

  function getSelectedAsset(layerKey) {

    const layer = state.layers[layerKey];
    if (!layer || !layer.selectedId) return null;
    return layer.items.find(item => item.id === layer.selectedId) || null;
  }

  function getCurrentRenderOrder() {
    const order = [...RENDER_ORDER];
    if (state.layerModes.outfitOrder === 'bottomOverTop') {
      for (const suffix of ['', '_back']) {
        const topKey = `top${suffix}`;
        const bottomKey = `bottom${suffix}`;
        const topIndex = order.indexOf(topKey);
        const bottomIndex = order.indexOf(bottomKey);
        if (topIndex >= 0 && bottomIndex >= 0) {
          order[topIndex] = bottomKey;
          order[bottomIndex] = topKey;
        }
      }
    }
    return order;
  }

  function getRenderConfig(key) {
    const modeBraidLeft = state.layerModes.braid_left || 'back';
    const modeBraidRight = state.layerModes.braid_right || 'back';

    if (/_back$/.test(key) && PACK_CLOTHING_SLOTS.includes(key.replace(/_back$/, ''))) {
      const sourceKey = key.replace(/_back$/, '');
      const source = state.layers[sourceKey];
      const item = getSelectedAsset(sourceKey);
      if (!source || !source.visible || !assetVariantUrl(item, 'back')) return null;
      return { sourceKey, variant: 'back', renderKey: key };
    }

    if (key === 'back_hair_base') {
      const logicalSource = state.layers.back_hair;
      const logicalItem = getSelectedAsset('back_hair');
      if (!logicalSource || !logicalSource.visible) return null;
      if (assetVariantUrl(logicalItem, 'back')) return { sourceKey: 'back_hair', variant: 'back', renderKey: 'back_hair_base' };
      const source = state.layers.back_hair_base;
      if (!source || !source.visible) return null;
      return { sourceKey: 'back_hair_base' };
    }
    if (key === 'braid_left_base') {
      const logicalSource = state.layers.braid_left;
      const logicalItem = getSelectedAsset('braid_left');
      if (!logicalSource || !logicalSource.visible || modeBraidLeft !== 'back') return null;
      if (!assetVariantUrl(logicalItem, 'front')) return null;
      return { sourceKey: 'braid_left', variant: 'front', renderKey: 'braid_left_base' };
    }
    if (key === 'braid_right_base') {
      const logicalSource = state.layers.braid_right;
      const logicalItem = getSelectedAsset('braid_right');
      if (!logicalSource || !logicalSource.visible || modeBraidRight !== 'back') return null;
      if (!assetVariantUrl(logicalItem, 'front')) return null;
      return { sourceKey: 'braid_right', variant: 'front', renderKey: 'braid_right_base' };
    }
    if (key === 'braid_left') {
      const source = state.layers.braid_left;
      if (!source || !source.visible || modeBraidLeft !== 'front') return null;
      return { sourceKey: 'braid_left' };
    }
    if (key === 'braid_right') {
      const source = state.layers.braid_right;
      if (!source || !source.visible || modeBraidRight !== 'front') return null;
      return { sourceKey: 'braid_right' };
    }

    if (key === 'eyebrow') {
      const source = state.layers.eyebrow;
      if (!source || !source.visible) return null;
      if (state.layerModes.eyebrow !== 'normal') return null;
      return { sourceKey: 'eyebrow' };
    }
    if (key === 'eyebrow_top') {
      const source = state.layers.eyebrow;
      if (!source || !source.visible) return null;
      if (state.layerModes.eyebrow !== 'top') return null;
      return { sourceKey: 'eyebrow' };
    }
    const layer = state.layers[key];
    if (!layer || !layer.visible) return null;
    return { sourceKey: key, variant: 'front', renderKey: key, frameConfig: getEyelidFrameConfig(key) };
  }

  const gifExportRuntime = {
    busy: false,
    encoderModulePromise: null,
  };

  function loadGifEncoderModule() {
    if (!gifExportRuntime.encoderModulePromise) {
      gifExportRuntime.encoderModulePromise = import(GIF_ENCODER_URL).catch(error => {
        gifExportRuntime.encoderModulePromise = null;
        throw error;
      });
    }
    return gifExportRuntime.encoderModulePromise;
  }

  async function prepareCurrentRenderLayersForExport() {
    const pendingLayers = [];
    for (const key of getCurrentRenderOrder()) {
      const conf = getRenderConfig(key);
      if (!conf) continue;
      const asset = getSelectedAsset(conf.sourceKey);
      if (!asset) continue;
      const variant = conf.variant || 'front';
      if (!assetVariantUrl(asset, variant)) continue;
      pendingLayers.push((async () => {
        const renderedUrl = await getRenderedAssetUrl(asset, conf.sourceKey, variant);
        if (!renderedUrl) return null;
        try {
          const image = await loadImageForCanvas(renderedUrl);
          return { conf, image };
        } catch (error) {
          const itemName = asset.name || LAYERS.find(layer => layer.key === conf.sourceKey)?.label || key;
          throw new Error(`无法读取「${itemName}」。如果它来自图片网址，请改用相册或 ZIP 图包导入。`);
        }
      })());
    }
    return (await Promise.all(pendingLayers)).filter(Boolean);
  }

  function drawExportLayer(ctx, layer, region, eyelidFrame) {
    const { conf, image } = layer;
    const sourceWidth = Number(image.naturalWidth || image.width || 0);
    const sourceHeight = Number(image.naturalHeight || image.height || 0);
    if (!sourceWidth || !sourceHeight) return;

    if (conf.sourceKey === 'eyelid') {
      const frameCount = Math.max(1, Number(conf.frameConfig?.frameCount || 3));
      const safeFrame = Math.max(0, Math.min(frameCount - 1, Number(eyelidFrame) || 0));
      const frameWidth = sourceWidth / frameCount;
      ctx.drawImage(
        image,
        frameWidth * safeFrame,
        0,
        frameWidth,
        sourceHeight,
        -region.x,
        -region.y,
        ATLAS.w,
        ATLAS.h,
      );
      return;
    }

    ctx.drawImage(
      image,
      0,
      0,
      sourceWidth,
      sourceHeight,
      -region.x,
      -region.y,
      ATLAS.w,
      ATLAS.h,
    );
  }

  function renderCurrentBustFrameForExport(layers, eyelidFrame) {
    const region = ATLAS.bust;
    const canvas = ST_DOC.createElement('canvas');
    canvas.width = region.w;
    canvas.height = region.h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('当前浏览器无法创建 GIF 画布。');
    ctx.clearRect(0, 0, region.w, region.h);
    for (const layer of layers) drawExportLayer(ctx, layer, region, eyelidFrame);
    try {
      const imageData = ctx.getImageData(0, 0, region.w, region.h);
      return { data: new Uint8ClampedArray(imageData.data) };
    } catch (error) {
      throw new Error('有图片网址禁止读取像素，无法导出。请把该素材改用相册或 ZIP 图包导入。');
    }
  }

  function encodeTransparentBustGif(frameData, encoderModule) {
    const { GIFEncoder, quantize, applyPalette } = encoderModule;
    if (!GIFEncoder || !quantize || !applyPalette) throw new Error('GIF 编码模块不完整。');

    const region = ATLAS.bust;
    const allPixels = new Uint8Array(frameData.reduce((sum, frame) => sum + frame.data.byteLength, 0));
    let offset = 0;
    for (const frame of frameData) {
      allPixels.set(frame.data, offset);
      offset += frame.data.byteLength;
    }

    const paletteFormat = 'rgba4444';
    const palette = quantize(allPixels, 255, {
      format: paletteFormat,
      oneBitAlpha: 127,
      clearAlpha: true,
      clearAlphaThreshold: 127,
      clearAlphaColor: 0,
    });
    let transparentIndex = palette.findIndex(color => Number(color?.[3]) === 0);
    if (transparentIndex < 0) {
      palette.push([0, 0, 0, 0]);
      transparentIndex = palette.length - 1;
    }

    const indexedFrames = frameData.map(frame => applyPalette(frame.data, palette, paletteFormat));
    const gif = GIFEncoder();
    const sequence = [0, 1, 2, 1, 0];
    const delays = [BLINK_REST_MS, BLINK_FRAME_MS, BLINK_FRAME_MS, BLINK_FRAME_MS, BLINK_FRAME_MS];
    sequence.forEach((frameIndex, index) => {
      gif.writeFrame(indexedFrames[frameIndex], region.w, region.h, {
        palette: index === 0 ? palette : null,
        transparent: true,
        transparentIndex,
        delay: delays[index],
        repeat: 0,
        dispose: 2,
      });
    });
    gif.finish();
    return new ST_WIN.Blob([gif.bytes()], { type: 'image/gif' });
  }

  function gifExportFilename() {
    const now = new Date();
    const two = value => String(value).padStart(2, '0');
    const stamp = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`;
    return `纸娃娃特写-${stamp}.gif`;
  }

  function downloadExportBlob(blob, filename) {
    const objectUrl = ST_WIN.URL.createObjectURL(blob);
    const link = ST_DOC.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.style.display = 'none';
    ST_DOC.body.appendChild(link);
    link.click();
    link.remove();
    ST_WIN.setTimeout(() => ST_WIN.URL.revokeObjectURL(objectUrl), 30000);
  }

  function setGifExportButtons(label, disabled) {
    ST_DOC.querySelectorAll('[data-export-gif]').forEach(button => {
      button.disabled = !!disabled;
      button.textContent = label;
    });
  }

  async function exportCurrentBustGif() {
    if (gifExportRuntime.busy) return;
    const eyelidLayer = state.layers.eyelid;
    const eyelidItem = getSelectedAsset('eyelid');
    if (!eyelidLayer?.visible || !eyelidItem || !assetVariantUrl(eyelidItem, 'front')) {
      ST_WIN.alert('请先在“脸部 → 眼皮”中选择并显示三帧眼皮。');
      return;
    }

    gifExportRuntime.busy = true;
    setGifExportButtons('正在生成 GIF…', true);
    let exported = false;
    try {
      const [encoderModule, layers] = await Promise.all([
        loadGifEncoderModule(),
        prepareCurrentRenderLayersForExport(),
      ]);
      const frames = [0, 1, 2].map(frameIndex => renderCurrentBustFrameForExport(layers, frameIndex));
      const blob = encodeTransparentBustGif(frames, encoderModule);
      downloadExportBlob(blob, gifExportFilename());
      exported = true;
    } catch (error) {
      console.error('[纸娃娃] GIF 导出失败：', error);
      ST_WIN.alert(`GIF 导出失败：${error?.message || '未知错误'}`);
    } finally {
      gifExportRuntime.busy = false;
      setGifExportButtons(exported ? '已开始下载' : '导出透明特写 GIF', false);
      if (exported) {
        ST_WIN.setTimeout(() => {
          if (!gifExportRuntime.busy) setGifExportButtons('导出透明特写 GIF', false);
        }, 1400);
      }
    }
  }

  function renderStage(regionName, scaleOverride = null) {
    const region = ATLAS[regionName];
    const scale = scaleOverride ?? state.scale;
    const wrap = ST_DOC.createElement('div');
    wrap.className = 'xj-pd-scale-wrap';
    wrap.style.width = `${region.w * scale}px`;
    wrap.style.height = `${region.h * scale}px`;

    const stage = ST_DOC.createElement('div');
    stage.className = 'xj-pd-crop';
    stage.style.width = `${region.w}px`;
    stage.style.height = `${region.h}px`;
    stage.style.transform = `scale(${scale})`;

    for (const key of getCurrentRenderOrder()) {
      const conf = getRenderConfig(key);
      if (!conf) continue;
      const asset = getSelectedAsset(conf.sourceKey);
      if (!asset) continue;
      if (!assetVariantUrl(asset, conf.variant || 'front')) continue;
      stage.appendChild(makeLayerDiv(asset, region, 1, conf.sourceKey, conf.frameConfig || null, conf.variant || 'front', conf.renderKey || key));
    }
    wrap.appendChild(stage);
    return wrap;
  }

  let inlineStatusRefreshTimer = null;

  function clearInlineStatusDollMounts() {
    try {
      ST_DOC.querySelectorAll('[data-stpd-inline-doll]').forEach(mount => {
        mount.querySelectorAll('[data-stpd-inline-render]').forEach(render => render.remove());
        mount.removeAttribute('data-stpd-live');
        delete mount.dataset.stpdRenderSignature;
      });
    } catch (_) {}
  }

  function inlineStatusRenderSignature() {
    const layers = getCurrentRenderOrder().map(key => {
      const conf = getRenderConfig(key);
      if (!conf) return null;
      const layer = state.layers[conf.sourceKey];
      const item = getSelectedAsset(conf.sourceKey);
      if (!layer || !item) return null;
      return [
        key,
        conf.sourceKey,
        conf.variant || 'front',
        layer.selectedId || '',
        layer.visible !== false,
        cloneColorSettings(getLayerColorSettings(conf.sourceKey)),
      ];
    }).filter(Boolean);
    return stableHash(JSON.stringify([layers, state.dyeSettings, state.layerModes, state.wornWardrobeEntries]));
  }

  function getLatestVisibleInlineStatus(cards) {
    for (let index = cards.length - 1; index >= 0; index--) {
      const card = cards[index];
      const message = card.closest('.mes');
      if (!message || message.offsetParent !== null || message.getClientRects?.().length) return card;
    }
    return cards.at(-1) || null;
  }

  function refreshInlineStatusBars() {
    if (stopIfScriptDisabled()) return;
    const chatRoot = ST_DOC.querySelector('#chat') || ST_DOC;
    const cards = Array.from(chatRoot.querySelectorAll('[data-stpd-status-version="5"] [data-stpd-ui="status"]'));
    if (!cards.length) return;
    const latest = inlineStatusCardEligible && getExtensionSettings().aiStateEnabled !== false
      ? getLatestVisibleInlineStatus(cards)
      : null;
    const signature = inlineStatusRenderSignature();
    cards.forEach(card => {
      const mount = card.querySelector('[data-stpd-inline-doll]');
      if (!mount) return;
      const isCurrent = card === latest;
      if (!isCurrent) {
        mount.querySelectorAll('[data-stpd-inline-render]').forEach(render => render.remove());
        mount.removeAttribute('data-stpd-live');
        delete mount.dataset.stpdRenderSignature;
        return;
      }
      mount.setAttribute('data-stpd-live', 'true');
      if (mount.dataset.stpdRenderSignature === signature && mount.querySelector('[data-stpd-inline-render]')) return;
      mount.querySelectorAll('[data-stpd-inline-render]').forEach(render => render.remove());
      const render = renderStage('full', INLINE_STATUS_DOLL_SCALE);
      render.setAttribute('data-stpd-inline-render', '');
      render.setAttribute('data-stpd-ui', 'doll-render');
      mount.appendChild(render);
      mount.dataset.stpdRenderSignature = signature;
    });
    ensureBlinkRuntime();
  }

  function registerInlineStatusInteraction() {
    try {
      const previous = ST_WIN.__xjPaperdollInlineClickHandler;
      if (previous) ST_DOC.removeEventListener('click', previous, true);
      const handler = event => {
        const target = event.target;
        if (!(target instanceof ST_WIN.Element)) return;
        const dock = target.closest('[data-stpd-status-version]');
        if (!dock || !target.closest('summary')) return;
        scheduleInlineStatusRefresh(0);
      };
      ST_DOC.addEventListener('click', handler, true);
      ST_WIN.__xjPaperdollInlineClickHandler = handler;
    } catch (_) {}
  }

  function scheduleInlineStatusRefresh(delay = 0) {
    try {
      if (inlineStatusRefreshTimer) ST_WIN.clearTimeout(inlineStatusRefreshTimer);
      inlineStatusRefreshTimer = ST_WIN.setTimeout(() => {
        inlineStatusRefreshTimer = null;
        if (ST_WIN.__xjPaperdollDestroy !== cleanup || stopIfScriptDisabled()) return;
        refreshInlineStatusBars();
      }, Math.max(0, Number(delay) || 0));
    } catch (_) {}
  }

  function removeMainStage() {
    ST_DOC.querySelector('#xj-paperdoll-stage-main')?.remove();
  }

  function ensureMainStage() {
    if (stopIfScriptDisabled()) return;
    removeMainStage();
    if (!state.visible) return;
    const host = getHostEl();
    if (!host) return;
    if (!host.style.position) host.style.position = 'relative';
    const region = ATLAS.bust;
    const height = region.h * state.scale;
    const hostRect = host.getBoundingClientRect();
    const top = (getAnchorTop() - hostRect.top) - height + state.bottomTrim + state.yOffset;
    const wrap = ST_DOC.createElement('div');
    wrap.id = 'xj-paperdoll-stage-main';
    wrap.className = `xj-pd-stage ${state.stageSide === 'left' ? 'is-left' : 'is-right'}`;
    wrap.dataset.pdVersion = VERSION;
    wrap.style.top = `${top}px`;
    wrap.appendChild(renderStage('bust'));
    host.appendChild(wrap);
  }

  function refreshAll(options = {}) {
    if (stopIfScriptDisabled()) return;
    const { save = true } = options;
    ensureMainStage();
    refreshInlineStatusBars();
    if (save) scheduleSave();
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function generateId() {
    return 'pd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function addImportedItemToSlots(layerKey, item) {
    const slots = slotsForImportedItem(layerKey);
    for (const slot of slots) {
      const layer = state.layers?.[slot];
      if (!layer) continue;
      if (!layer.items.some(entry => entry.id === item.id)) {
        layer.items.push({ ...item, slot });
      }
      if (slot === layerKey) {
        layer.selectedId = item.id;
        delete state.wornWardrobeEntries[slot];
      }
    }
  }

  function deleteItemFromSlots(layerKey, itemId) {
    const slots = slotsForImportedItem(layerKey);
    const removedWardrobeIds = new Set(state.wardrobeItems
      .filter(entry => slots.includes(entry.layerKey) && entry.sourceItemId === itemId)
      .map(entry => entry.id));
    state.wardrobeItems = state.wardrobeItems.filter(entry => !removedWardrobeIds.has(entry.id));
    for (const [slot, entryId] of Object.entries(state.wornWardrobeEntries)) {
      if (removedWardrobeIds.has(entryId)) delete state.wornWardrobeEntries[slot];
    }
    for (const slot of slots) {
      const layer = state.layers?.[slot];
      if (!layer) continue;
      layer.items = layer.items.filter(item => item.id !== itemId);
      if (layer.selectedId === itemId) layer.selectedId = null;
      const key = wearableKey(slot, itemId);
      delete state.aiNames[key];
      state.aiClothingPool = state.aiClothingPool.filter(entry => entry !== key);
    }
    const presetField = {
      pupil: 'pupilId',
      eyebrow: 'eyebrowId',
      mouth: 'mouthId',
      face_effect_base: 'faceEffectBaseId',
      face_effect_top: 'faceEffectTopId',
    }[layerKey];
    if (presetField) {
      state.expressionPresets.forEach(preset => {
        if (preset[presetField] === itemId) preset[presetField] = null;
      });
    }
  }

  async function importFromAlbum(layerKey) {
    const input = ST_DOC.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/webp,image/jpeg';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    ST_DOC.body.appendChild(input);
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return;
        const url = await readFileAsDataURL(file);
        const item = { id: generateId(), name: file.name || '相册素材', url, source: 'album' };
        addImportedItemToSlots(layerKey, item);
        state.importMenuLayer = null;
        if (saveState()) {
          renderDialogBody();
          refreshAll();
        }
      } catch (err) {
        console.error('[纸娃娃] 相册导入失败：', err);
        alert('相册导入失败。可能是图片太大，或浏览器阻止读取。');
      } finally {
        input.remove();
      }
    };
    input.click();
  }

  function importFromUrl(layerKey) {
    const url = prompt('请输入图片网址');
    if (!url) return;
    const item = { id: generateId(), name: '网址素材', url: url.trim(), source: 'url' };
    addImportedItemToSlots(layerKey, item);
    state.importMenuLayer = null;
    saveState();
    renderDialogBody();
    refreshAll();
  }

  function loadZipReader() {
    if (ST_WIN.fflate?.unzipSync) return Promise.resolve(ST_WIN.fflate);
    if (zipReaderPromise) return zipReaderPromise;
    zipReaderPromise = new Promise((resolve, reject) => {
      const script = ST_DOC.createElement('script');
      script.src = new URL('./vendor/fflate.min.js', EXTENSION_ROOT).href;
      script.async = true;
      script.onload = () => ST_WIN.fflate?.unzipSync ? resolve(ST_WIN.fflate) : reject(new Error('ZIP 读取组件没有正确加载。'));
      script.onerror = () => reject(new Error('ZIP 读取组件加载失败。'));
      ST_DOC.head.appendChild(script);
    }).catch(error => {
      zipReaderPromise = null;
      throw error;
    });
    return zipReaderPromise;
  }

  function normalizePackPath(path) {
    const value = String(path || '').replace(/\\/g, '/').replace(/^\.\//, '');
    if (!value || value.startsWith('/') || value.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error(`图包路径不安全或格式错误：${path}`);
    }
    return value;
  }

  function resolvePackPath(root, path) {
    return root + normalizePackPath(path);
  }

  function mimeForImagePath(path) {
    const lower = String(path || '').toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    return '';
  }

  function safePackToken(value, label) {
    const token = String(value || '').trim();
    if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(token)) throw new Error(`${label}只能使用英文字母、数字、点、短横线或下划线。`);
    return token;
  }

  async function readImageSize(blob) {
    const urlApi = ST_WIN.URL || URL;
    const url = urlApi.createObjectURL(blob);
    try {
      const image = await loadImageForCanvas(url);
      return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
    } finally {
      try { urlApi.revokeObjectURL(url); } catch (_) {}
    }
  }

  async function parseAssetPackFile(file) {
    if (!file || !/\.zip$/i.test(file.name || '')) throw new Error('请选择 .zip 格式的纸娃娃图包。');
    if (Number(file.size || 0) > 80 * 1024 * 1024) throw new Error('压缩包请控制在 80MB 以内。');
    const fflate = await loadZipReader();
    let declaredSize = 0;
    const archive = fflate.unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter(entry) {
        declaredSize += Number(entry.originalSize || 0);
        if (declaredSize > 180 * 1024 * 1024) throw new Error('图包解压后超过 180MB，已停止导入。');
        return true;
      },
    });
    const names = Object.keys(archive).filter(name => !name.endsWith('/') && !name.includes('__MACOSX'));
    const uncompressedSize = names.reduce((sum, name) => sum + (archive[name]?.byteLength || 0), 0);
    if (uncompressedSize > 180 * 1024 * 1024) throw new Error('图包解压后超过 180MB，已停止导入。');
    const manifestName = names.filter(name => /(^|\/)pack\.json$/i.test(name)).sort((a, b) => a.length - b.length)[0];
    if (!manifestName) throw new Error('图包中没有找到 pack.json。');
    normalizePackPath(manifestName);
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let manifest;
    try { manifest = JSON.parse(decoder.decode(archive[manifestName])); }
    catch (_) { throw new Error('pack.json 不是有效的 UTF-8 JSON 文件。'); }
    if (manifest.format !== PACK_FORMAT) throw new Error(`图包类型不正确，应为 ${PACK_FORMAT}。`);
    if (Number(manifest.formatVersion) !== PACK_FORMAT_VERSION) throw new Error(`暂不支持图包格式版本 ${manifest.formatVersion}。`);
    const id = safePackToken(manifest.id, '图包编号');
    const name = String(manifest.name || '').trim().slice(0, 80);
    if (!name) throw new Error('图包缺少中文显示名。');
    const version = String(manifest.version || '1.0.0').trim().slice(0, 30);
    const canvas = {
      width: Number(manifest.canvas?.width || ATLAS.w),
      height: Number(manifest.canvas?.height || ATLAS.h),
    };
    if (!Number.isInteger(canvas.width) || !Number.isInteger(canvas.height) || canvas.width < 1 || canvas.height < 1 || canvas.width > 4096 || canvas.height > 4096) {
      throw new Error('图包画布尺寸无效。');
    }
    const manifestRoot = manifestName.slice(0, manifestName.length - 'pack.json'.length);
    const rawItems = Array.isArray(manifest.items) ? manifest.items : [];
    if (!rawItems.length) throw new Error('图包中没有任何部件。');
    if (rawItems.length > 200) throw new Error('单个图包最多包含 200 个逻辑部件。');
    const itemIds = new Set();
    const normalizedItems = [];
    const usedPaths = new Set();
    let ignoredBraidBackCount = 0;

    for (const raw of rawItems) {
      const itemId = safePackToken(raw?.id, '部件编号');
      if (itemIds.has(itemId)) throw new Error(`部件编号重复：${itemId}`);
      itemIds.add(itemId);
      const itemName = String(raw?.name || '').trim().slice(0, 80);
      if (!itemName) throw new Error(`部件 ${itemId} 缺少显示名。`);
      const slot = String(raw?.slot || '').trim();
      if (!PACK_ALLOWED_SLOTS.includes(slot)) throw new Error(`部件「${itemName}」使用了未知栏目：${slot}`);
      const frontPath = resolvePackPath(manifestRoot, raw.front || raw.image || '');
      const dyeRegions = Array.isArray(raw.dyeRegions) ? raw.dyeRegions : [];
      const isPositionedBraid = PACK_POSITIONED_HAIR_SLOTS.includes(slot);
      const declaredBackPath = raw.back ? resolvePackPath(manifestRoot, raw.back) : '';
      const backPath = isPositionedBraid ? '' : declaredBackPath;
      if (declaredBackPath && !isPositionedBraid && !PACK_BACK_VARIANT_SLOTS.includes(slot)) throw new Error(`只有上衣、下装、连衣裙、外套和后发可以使用后片／底层图：${itemName}`);
      if (isPositionedBraid && (declaredBackPath || dyeRegions.some(region => region?.backMask))) ignoredBraidBackCount++;
      if (dyeRegions.length > 12) throw new Error(`部件「${itemName}」的染色区超过 12 个。`);
      const regionIds = new Set();
      const normalizedRegions = dyeRegions.map(region => {
        const regionId = safePackToken(region?.id, `部件「${itemName}」的染色区编号`);
        if (regionIds.has(regionId)) throw new Error(`部件「${itemName}」的染色区编号重复：${regionId}`);
        regionIds.add(regionId);
        const regionName = String(region?.name || '').trim().slice(0, 40);
        if (!regionName) throw new Error(`染色区 ${regionId} 缺少显示名。`);
        const frontMaskPath = region.frontMask ? resolvePackPath(manifestRoot, region.frontMask) : '';
        const declaredBackMaskPath = region.backMask ? resolvePackPath(manifestRoot, region.backMask) : '';
        const backMaskPath = isPositionedBraid ? '' : declaredBackMaskPath;
        if (!frontMaskPath && !backMaskPath) {
          if (isPositionedBraid && declaredBackMaskPath) return null;
          throw new Error(`染色区「${regionName}」没有任何蒙版。`);
        }
        if (backMaskPath && !backPath) throw new Error(`染色区「${regionName}」提供了后片蒙版，但部件没有后片。`);
        for (const maskPath of [frontMaskPath, backMaskPath].filter(Boolean)) {
          if (!/\.png$/i.test(maskPath)) throw new Error(`染色蒙版必须使用透明 PNG：${maskPath}`);
          usedPaths.add(maskPath);
        }
        return {
          id: regionId,
          name: regionName,
          defaultColor: /^#[0-9a-f]{6}$/i.test(region.defaultColor || '') ? region.defaultColor : '#ffffff',
          tintStrength: clampSetting(region.tintStrength, 0, 100, 100),
          saturation: clampSetting(region.saturation, 0, 200, 100),
          brightness: clampSetting(region.brightness, 0, COLOR_BRIGHTNESS_MAX, 100),
          contrast: clampSetting(region.contrast, 0, 200, 100),
          preserveLines: region.preserveLines !== false,
          frontMaskPath,
          backMaskPath,
        };
      }).filter(Boolean);
      usedPaths.add(frontPath);
      if (backPath) usedPaths.add(backPath);
      normalizedItems.push({ id: itemId, name: itemName, slot, frontPath, backPath, dyeRegions: normalizedRegions });
    }

    const blobsByPath = new Map();
    for (const imagePath of usedPaths) {
      const bytes = archive[imagePath];
      if (!bytes) throw new Error(`图包缺少图片：${imagePath}`);
      const mime = mimeForImagePath(imagePath);
      if (!mime) throw new Error(`不支持的图片格式：${imagePath}`);
      if (bytes.byteLength > 24 * 1024 * 1024) throw new Error(`单张图片超过 24MB：${imagePath}`);
      const blob = new Blob([bytes], { type: mime });
      const size = await readImageSize(blob);
      if (size.width !== canvas.width || size.height !== canvas.height) {
        throw new Error(`图片尺寸不一致：${imagePath} 是 ${size.width}×${size.height}，图包要求 ${canvas.width}×${canvas.height}。`);
      }
      blobsByPath.set(imagePath, blob);
    }

    return {
      id,
      name,
      version,
      author: String(manifest.author || '').trim().slice(0, 80),
      canvas,
      items: normalizedItems,
      blobsByPath,
      ignoredBraidBackCount,
      sourceFileName: file.name || `${name}.zip`,
    };
  }

  async function chooseAssetPackZip() {
    const input = ST_DOC.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    ST_DOC.body.appendChild(input);
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return input.remove();
      try {
        pendingPackImport = { status: 'reading', sourceFileName: file.name || '图包.zip' };
        if (dialogEl()) renderDialogBody();
        const parsed = await parseAssetPackFile(file);
        pendingPackImport = { status: 'ready', pack: parsed, existing: state.assetPacks.some(pack => pack.id === parsed.id) };
        state.importMenuLayer = null;
        if (dialogEl()) renderDialogBody();
        else {
          state.panelPage = 'wardrobe';
          openSettingsDialog();
        }
      } catch (error) {
        pendingPackImport = null;
        console.error('[纸娃娃] 图包读取失败：', error);
        alert('图包无法导入：' + (error?.message || error));
        if (dialogEl()) renderDialogBody();
      } finally {
        input.remove();
      }
    };
    input.click();
  }

  function stablePackItemId(packId, itemId) {
    return `pack_${stableHash(packId)}_${String(itemId).replace(/[^a-z0-9_.-]/gi, '_')}`;
  }

  function removePackItemsFromState(packId) {
    const removedIds = new Set();
    for (const [slot, layer] of Object.entries(state.layers || {})) {
      const removed = (layer.items || []).filter(item => item.source === 'pack' && item.packId === packId);
      removed.forEach(item => removedIds.add(item.id));
      layer.items = (layer.items || []).filter(item => !(item.source === 'pack' && item.packId === packId));
      if (removed.some(item => item.id === layer.selectedId)) layer.selectedId = null;
      for (const item of removed) {
        delete state.aiNames[wearableKey(slot, item.id)];
        state.aiClothingPool = state.aiClothingPool.filter(entry => entry !== wearableKey(slot, item.id));
      }
    }
    state.assetPacks = state.assetPacks.filter(pack => pack.id !== packId);
    return removedIds;
  }

  function removeWardrobeEntriesBySourceIds(sourceIds) {
    const ids = sourceIds instanceof Set ? sourceIds : new Set(sourceIds || []);
    if (!ids.size) return;
    const removedEntryIds = new Set(state.wardrobeItems.filter(entry => ids.has(entry.sourceItemId)).map(entry => entry.id));
    state.wardrobeItems = state.wardrobeItems.filter(entry => !removedEntryIds.has(entry.id));
    for (const [layerKey, entryId] of Object.entries(state.wornWardrobeEntries)) {
      if (removedEntryIds.has(entryId)) delete state.wornWardrobeEntries[layerKey];
    }
  }

  function repairPlanItemReferences() {
    for (const plan of state.plans) {
      for (const [slot, saved] of Object.entries(plan.snapshot?.layers || {})) {
        if (saved?.selectedId && !state.layers[slot]?.items?.some(item => item.id === saved.selectedId)) saved.selectedId = null;
      }
      if (plan.snapshot?.aiNames) {
        for (const key of Object.keys(plan.snapshot.aiNames)) {
          const { layerKey, itemId } = splitWearableKey(key);
          if (!state.layers[layerKey]?.items?.some(item => item.id === itemId)) delete plan.snapshot.aiNames[key];
        }
      }
      if (Array.isArray(plan.snapshot?.aiClothingPool)) {
        plan.snapshot.aiClothingPool = plan.snapshot.aiClothingPool.filter(key => {
          const { layerKey, itemId } = splitWearableKey(key);
          return state.layers[layerKey]?.items?.some(item => item.id === itemId);
        });
      }
    }
  }

  async function commitPendingPackImport(mode = 'install') {
    const parsed = pendingPackImport?.pack;
    if (!parsed) return false;
    const isCopy = mode === 'copy';
    const targetId = isCopy ? `${parsed.id}-copy-${Date.now().toString(36)}` : parsed.id;
    const targetName = isCopy ? `${parsed.name}（副本）` : parsed.name;
    const wasUpdate = !isCopy && state.assetPacks.some(pack => pack.id === targetId);
    const preservedAiNames = {};
    const preservedPool = new Set();
    if (!isCopy) {
      for (const [slot, layer] of Object.entries(state.layers || {})) {
        for (const item of layer.items || []) {
          if (item.source !== 'pack' || item.packId !== targetId) continue;
          const key = wearableKey(slot, item.id);
          if (state.aiNames[key]) preservedAiNames[key] = state.aiNames[key];
          if (state.aiClothingPool.includes(key)) preservedPool.add(key);
        }
      }
    }
    const storageEntries = [];
    const storageKeys = new Set();
    for (const [path, blob] of parsed.blobsByPath) {
      const key = `${targetId}/${path}`;
      storageEntries.push({ key, blob });
      storageKeys.add(key);
    }
    try {
      await putPackFiles(storageEntries);
      if (!isCopy) removePackItemsFromState(targetId);
      revokePackRuntimeUrls(targetId);
      for (const source of parsed.items) {
        const item = {
          id: stablePackItemId(targetId, source.id),
          name: source.name,
          url: '',
          source: 'pack',
          packId: targetId,
          packItemId: source.id,
          frontStorageKey: `${targetId}/${source.frontPath}`,
          backStorageKey: source.backPath ? `${targetId}/${source.backPath}` : '',
          dyeRegions: source.dyeRegions.map(region => ({
            id: region.id,
            name: region.name,
            defaultColor: region.defaultColor,
            tintStrength: region.tintStrength,
            saturation: region.saturation,
            brightness: region.brightness,
            contrast: region.contrast,
            preserveLines: region.preserveLines,
            frontMaskStorageKey: region.frontMaskPath ? `${targetId}/${region.frontMaskPath}` : '',
            backMaskStorageKey: region.backMaskPath ? `${targetId}/${region.backMaskPath}` : '',
          })),
        };
        for (const slot of slotsForImportedItem(source.slot)) {
          const layer = state.layers[slot];
          if (!layer) continue;
          layer.items.push({ ...item, slot });
          layer.selectedId = item.id;
          layer.visible = true;
          delete state.wornWardrobeEntries[slot];
        }
        state.activeGroup = LAYERS.find(layer => layer.key === source.slot)?.group || state.activeGroup;
        state.activeLayer = source.slot;
      }
      state.assetPacks.push({
        id: targetId,
        name: targetName,
        version: parsed.version,
        author: parsed.author,
        itemCount: parsed.items.length,
        canvas: parsed.canvas,
        sourceFileName: parsed.sourceFileName,
        installedAt: Date.now(),
      });
      for (const [key, value] of Object.entries(preservedAiNames)) {
        const { layerKey, itemId } = splitWearableKey(key);
        if (state.layers[layerKey]?.items?.some(item => item.id === itemId)) state.aiNames[key] = value;
      }
      for (const key of preservedPool) {
        const { layerKey, itemId } = splitWearableKey(key);
        if (state.layers[layerKey]?.items?.some(item => item.id === itemId) && !state.aiClothingPool.includes(key)) state.aiClothingPool.push(key);
      }
      repairPlanItemReferences();
      await deleteStoredPackFiles(targetId, storageKeys);
      await hydratePackAssets(targetId);
      pendingPackImport = null;
      processedImageCache.clear();
      saveState();
      renderDialogBody();
      refreshAll({ save: false });
      log(`${isCopy ? '已作为副本导入' : wasUpdate ? '已更新并试穿' : '已导入并试穿'}图包：${targetName}`);
      return true;
    } catch (error) {
      console.error('[纸娃娃] 图包写入失败：', error);
      alert('图包写入失败：' + (error?.message || error));
      return false;
    }
  }

  async function installAssetPackFile(file, mode = 'install') {
    const parsed = await parseAssetPackFile(file);
    pendingPackImport = { status: 'ready', pack: parsed, existing: state.assetPacks.some(pack => pack.id === parsed.id) };
    return commitPendingPackImport(mode === 'copy' ? 'copy' : 'install');
  }

  async function deleteAssetPack(packId) {
    const pack = state.assetPacks.find(entry => entry.id === packId);
    if (!pack || !ST_WIN.confirm(`删除图包「${pack.name}」？\n会移除这个图包的素材及衣柜中引用它们的款式，但不会删除其他图包。`)) return;
    try {
      await deleteStoredPackFiles(packId);
      const removedIds = removePackItemsFromState(packId);
      removeWardrobeEntriesBySourceIds(removedIds);
      for (const key of Object.keys(state.dyeSettings)) {
        if (key.startsWith(`${packId}::`)) delete state.dyeSettings[key];
      }
      revokePackRuntimeUrls(packId);
      repairPlanItemReferences();
      processedImageCache.clear();
      saveState();
      renderDialogBody();
      refreshAll({ save: false });
      log('已删除图包：' + pack.name);
    } catch (error) {
      console.error('[纸娃娃] 图包删除失败：', error);
      alert('图包删除失败：' + (error?.message || error));
    }
  }

  function pendingPackImportHtml() {
    if (!pendingPackImport) return '';
    if (pendingPackImport.status === 'reading') {
      return `<div class="xj-pd-pack-preview is-reading"><b>正在检查图包</b><span>${escapeHtml(pendingPackImport.sourceFileName)}</span><em>正在核对图片尺寸和关联关系……</em></div>`;
    }
    const pack = pendingPackImport.pack;
    const backs = pack.items.filter(item => item.backPath).length;
    const regions = pack.items.reduce((sum, item) => sum + item.dyeRegions.length, 0);
    return `
      <div class="xj-pd-pack-preview">
        <div class="xj-pd-pack-preview-head"><span>图包检查通过</span><b>${escapeHtml(pack.name)}</b><em>v${escapeHtml(pack.version)}</em></div>
        <div class="xj-pd-pack-facts">
          <span>${pack.items.length} 个部件</span><span>${backs} 个双图部件</span><span>${regions} 个染色区</span><span>${pack.canvas.width}×${pack.canvas.height}</span>
        </div>
        ${pack.ignoredBraidBackCount ? `<div class="xj-pd-note">检测到 ${pack.ignoredBraidBackCount} 个旧版双图辫子：置后图片及其蒙版会被忽略，改用主图切换前后层级。</div>` : ''}
        <div class="xj-pd-note">${pendingPackImport.existing ? '检测到相同图包编号。选择更新会替换该图包素材并保留稳定的部件编号。' : '导入后会立即试穿；图包图片会独立保存，不占用普通设置容量。'}</div>
        <div class="xj-pd-pack-actions">
          <button type="button" class="xj-pd-pixel-btn is-accent" data-pack-import="${pendingPackImport.existing ? 'update' : 'install'}">${pendingPackImport.existing ? '更新现有图包' : '导入并试穿'}</button>
          ${pendingPackImport.existing ? '<button type="button" class="xj-pd-pixel-btn" data-pack-import="copy">作为副本导入</button>' : ''}
          <button type="button" class="xj-pd-pixel-btn" data-pack-import="cancel">取消</button>
        </div>
      </div>`;
  }

  function currentLayerDef() {
    return LAYERS.find(layer => layer.key === state.activeLayer) || LAYERS[0];
  }

  function currentLayerState() {
    return state.layers[state.activeLayer];
  }

  function groupedLayers(group) {
    return LAYERS.filter(layer => layer.group === group && !layer.hidden);
  }

  function isAiWearableLayer(layerKey) {
    return AI_WEARABLE_LAYER_KEYS.includes(layerKey);
  }

  function wearableKey(layerKey, itemId) {
    return `${layerKey}::${itemId}`;
  }

  function splitWearableKey(key) {
    const index = String(key || '').indexOf('::');
    if (index < 1) return null;
    return { layerKey: key.slice(0, index), itemId: key.slice(index + 2) };
  }

  function getWardrobeById(id) {
    return state.wardrobes.find(wardrobe => wardrobe.id === id) || null;
  }

  function getActiveWardrobe() {
    return getWardrobeById(state.activeWardrobeId) || state.wardrobes[0] || null;
  }

  function getWardrobeItemById(id) {
    return state.wardrobeItems.find(item => item.id === id) || null;
  }

  function getActiveWardrobeItems() {
    return state.wardrobeItems.filter(item => item.wardrobeId === state.activeWardrobeId);
  }

  function findWardrobeSourceItem(entry) {
    return state.layers?.[entry?.layerKey]?.items?.find(item => item.id === entry.sourceItemId) || null;
  }

  function wardrobeEntryKey(entryOrId) {
    const id = typeof entryOrId === 'string' ? entryOrId : entryOrId?.id;
    return id ? `closet::${id}` : '';
  }

  function wardrobeEntryToWearable(entry) {
    const item = findWardrobeSourceItem(entry);
    if (!entry || !item) return null;
    return {
      key: wardrobeEntryKey(entry),
      layerKey: entry.layerKey,
      itemId: entry.sourceItemId,
      wardrobeItemId: entry.id,
      categoryKey: entry.categoryKey || wardrobeCategoryForLayer(entry.layerKey),
      item,
      name: normalizeAiName(entry.name),
    };
  }

  function currentWornWardrobeEntry(layerKey) {
    const entry = getWardrobeItemById(state.wornWardrobeEntries?.[layerKey]);
    if (!entry || entry.layerKey !== layerKey || entry.sourceItemId !== state.layers?.[layerKey]?.selectedId) return null;
    return entry;
  }

  function wardrobeNamesInCategory(wardrobeId, categoryKey, exceptId = '') {
    return state.wardrobeItems
      .filter(item => item.wardrobeId === wardrobeId && item.categoryKey === categoryKey && item.id !== exceptId)
      .map(item => item.name);
  }

  function applyWardrobeRecipe(entry) {
    const item = findWardrobeSourceItem(entry);
    const layer = state.layers?.[entry?.layerKey];
    if (!entry || !item || !layer) return false;
    const recipe = normalizeWardrobeRecipe(entry.recipe);
    Object.assign(layer, cloneColorSettings(recipe.whole));
    if (isHairLayer(entry.layerKey) && (recipe.whole.colorMapping === 'overlay'
      || Object.values(recipe.regions).some(value => value?.colorMapping === 'overlay'))) {
      layer.followHairGroup = false;
    }
    for (const region of item.dyeRegions || []) {
      const key = dyeSettingKey(item, region);
      delete state.dyeSettings[key];
      if (Object.hasOwn(recipe.regions, region.id)) {
        state.dyeSettings[key] = normalizeDyeSettings(recipe.regions[region.id], region);
      }
    }
    layer.selectedId = item.id;
    layer.visible = true;
    state.wornWardrobeEntries[entry.layerKey] = entry.id;
    setActiveColorScope(entry.layerKey, item, 'whole');
    applyLinkedSelection(entry.layerKey, item.id);
    return true;
  }

  function wearWardrobeItem(entryOrId, options = {}) {
    const entry = typeof entryOrId === 'string' ? getWardrobeItemById(entryOrId) : entryOrId;
    if (!entry) return false;
    const layer = state.layers?.[entry.layerKey];
    if (!layer || !findWardrobeSourceItem(entry)) {
      if (!options.silent) alert(`衣柜条目「${entry.name}」的原始素材已不存在。请重新导入对应图包。`);
      return false;
    }
    const isSame = state.wornWardrobeEntries?.[entry.layerKey] === entry.id && layer.selectedId === entry.sourceItemId;
    if (isSame && options.toggle !== false) {
      clearLinkedSelection(entry.layerKey, layer.selectedId);
      layer.selectedId = null;
      delete state.wornWardrobeEntries[entry.layerKey];
    } else {
      applyWardrobeRecipe(entry);
    }
    if (options.save !== false) saveState();
    if (options.refresh !== false) {
      if (dialogEl()) renderDialogBody();
      refreshAll({ save: false });
    }
    return true;
  }

  function saveCurrentAssetToWardrobe() {
    const layerKey = state.activeLayer;
    if (!isAiWearableLayer(layerKey)) return alert('当前栏目不是可保存到衣柜的服装或配饰。');
    const item = getSelectedAsset(layerKey);
    if (!item) return alert('请先试穿一个部件，再保存到衣柜。');
    const currentEntry = currentWornWardrobeEntry(layerKey);
    const allowed = allowedWardrobeCategoriesForLayer(layerKey);
    const categoryKey = currentEntry && allowed.includes(currentEntry.categoryKey) ? currentEntry.categoryKey : allowed[0];
    const baseName = currentEntry?.name || item.name || LAYERS.find(layer => layer.key === layerKey)?.label || '未命名部件';
    const name = nextWardrobeItemName(baseName, wardrobeNamesInCategory(state.activeWardrobeId, categoryKey));
    const entry = {
      id: `closet_${generateId()}`,
      wardrobeId: state.activeWardrobeId,
      name,
      categoryKey,
      layerKey,
      sourceItemId: item.id,
      sourcePackId: item.packId || '',
      recipe: captureWardrobeRecipeFor(state, layerKey, item),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.wardrobeItems.push(entry);
    state.wornWardrobeEntries[layerKey] = entry.id;
    state.activeWardrobeCategory = categoryKey;
    saveState();
    renderDialogBody();
    log(`已放入「${getActiveWardrobe()?.name || '衣柜'}」：${name}`);
    return entry;
  }

  function overwriteCurrentWardrobeItem() {
    const entry = currentWornWardrobeEntry(state.activeLayer);
    const item = entry && findWardrobeSourceItem(entry);
    if (!entry || !item) return alert('当前穿着不是衣柜条目，请使用“保存到衣柜”。');
    entry.recipe = captureWardrobeRecipeFor(state, entry.layerKey, item);
    entry.updatedAt = Date.now();
    saveState();
    renderDialogBody();
    log(`已更新配色：${entry.name}`);
    return true;
  }

  function renameWardrobeItem(entryId) {
    const entry = getWardrobeItemById(entryId);
    if (!entry) return false;
    const next = ST_WIN.prompt('给这件衣服重新命名', entry.name);
    if (next === null) return false;
    const value = normalizeAiName(next);
    const error = validateAiName(value);
    if (error) return alert(error);
    const duplicate = wardrobeNamesInCategory(entry.wardrobeId, entry.categoryKey, entry.id)
      .some(name => normalizeAiName(name).toLocaleLowerCase() === value.toLocaleLowerCase());
    if (duplicate) return alert(`「${getWardrobeCategoryDef(entry.categoryKey).label}」中已经有一件叫「${value}」的部件。`);
    entry.name = value;
    entry.updatedAt = Date.now();
    saveState();
    renderDialogBody();
    return true;
  }

  function duplicateWardrobeItem(entryId) {
    const source = getWardrobeItemById(entryId);
    if (!source) return false;
    const copy = {
      ...source,
      id: `closet_${generateId()}`,
      name: nextWardrobeItemName(source.name, wardrobeNamesInCategory(source.wardrobeId, source.categoryKey)),
      recipe: normalizeWardrobeRecipe(source.recipe),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.wardrobeItems.push(copy);
    saveState();
    renderDialogBody();
    log(`已复制：${copy.name}`);
    return copy;
  }

  function deleteWardrobeItem(entryId) {
    const entry = getWardrobeItemById(entryId);
    if (!entry || !ST_WIN.confirm(`从衣柜移除「${entry.name}」？\n原始素材不会被删除。`)) return false;
    state.wardrobeItems = state.wardrobeItems.filter(item => item.id !== entry.id);
    for (const [layerKey, wornId] of Object.entries(state.wornWardrobeEntries)) {
      if (wornId === entry.id) delete state.wornWardrobeEntries[layerKey];
    }
    saveState();
    renderDialogBody();
    return true;
  }

  function changeWardrobeItemCategory(entryId, categoryKey) {
    const entry = getWardrobeItemById(entryId);
    if (!entry) return false;
    const allowed = allowedWardrobeCategoriesForLayer(entry.layerKey);
    if (!allowed.includes(categoryKey) || entry.categoryKey === categoryKey) return false;
    const nextName = nextWardrobeItemName(entry.name, wardrobeNamesInCategory(entry.wardrobeId, categoryKey, entry.id));
    entry.categoryKey = categoryKey;
    entry.name = nextName;
    entry.updatedAt = Date.now();
    state.activeWardrobeCategory = categoryKey;
    saveState();
    renderDialogBody();
    return true;
  }

  function createWardrobe() {
    const used = state.wardrobes.map(item => item.name);
    const suggested = nextWardrobeItemName('新衣柜', used);
    const next = ST_WIN.prompt('给新衣柜取个名字', suggested);
    if (next === null) return false;
    const name = normalizeAiName(next);
    const error = validateAiName(name);
    if (error) return alert(error);
    if (used.some(value => normalizeAiName(value).toLocaleLowerCase() === name.toLocaleLowerCase())) return alert(`衣柜「${name}」已经存在。`);
    const wardrobe = { id: `wardrobe_${generateId()}`, name, createdAt: Date.now(), updatedAt: Date.now() };
    state.wardrobes.push(wardrobe);
    state.activeWardrobeId = wardrobe.id;
    state.currentPlanId = null;
    saveState();
    renderDialogBody();
    return wardrobe;
  }

  function renameActiveWardrobe() {
    const wardrobe = getActiveWardrobe();
    if (!wardrobe) return false;
    const next = ST_WIN.prompt('重命名当前衣柜', wardrobe.name);
    if (next === null) return false;
    const name = normalizeAiName(next);
    const error = validateAiName(name);
    if (error) return alert(error);
    if (state.wardrobes.some(item => item.id !== wardrobe.id && normalizeAiName(item.name).toLocaleLowerCase() === name.toLocaleLowerCase())) return alert(`衣柜「${name}」已经存在。`);
    wardrobe.name = name;
    wardrobe.updatedAt = Date.now();
    saveState();
    renderDialogBody();
    return true;
  }

  function deleteActiveWardrobe() {
    const wardrobe = getActiveWardrobe();
    if (!wardrobe || wardrobe.id === DEFAULT_WARDROBE_ID) return alert('默认衣柜不能删除，可以重命名。');
    const itemCount = state.wardrobeItems.filter(item => item.wardrobeId === wardrobe.id).length;
    const planIds = new Set(state.plans.filter(plan => plan.wardrobeId === wardrobe.id).map(plan => plan.id));
    if (!ST_WIN.confirm(`删除衣柜「${wardrobe.name}」？\n将同时移除其中 ${itemCount} 件衣物和该衣柜的穿搭方案；原始素材不会删除。`)) return false;
    const removedEntryIds = new Set(state.wardrobeItems.filter(item => item.wardrobeId === wardrobe.id).map(item => item.id));
    state.wardrobeItems = state.wardrobeItems.filter(item => item.wardrobeId !== wardrobe.id);
    state.plans = state.plans.filter(plan => plan.wardrobeId !== wardrobe.id);
    state.wardrobes = state.wardrobes.filter(item => item.id !== wardrobe.id);
    for (const [key, planId] of Object.entries(state.userBindings)) if (planIds.has(planId)) delete state.userBindings[key];
    for (const [layerKey, entryId] of Object.entries(state.wornWardrobeEntries)) if (removedEntryIds.has(entryId)) delete state.wornWardrobeEntries[layerKey];
    state.activeWardrobeId = DEFAULT_WARDROBE_ID;
    if (planIds.has(state.currentPlanId)) state.currentPlanId = null;
    saveState();
    renderDialogBody();
    return true;
  }

  function activateWardrobe(wardrobeId) {
    if (!getWardrobeById(wardrobeId)) return false;
    state.activeWardrobeId = wardrobeId;
    const currentPlan = getCurrentPlan();
    if (currentPlan && (currentPlan.wardrobeId || DEFAULT_WARDROBE_ID) !== wardrobeId) state.currentPlanId = null;
    saveState();
    renderDialogBody();
    return true;
  }

  function getWearableEntry(key) {
    const parsed = splitWearableKey(key);
    if (!parsed || !isAiWearableLayer(parsed.layerKey)) return null;
    const layer = state.layers[parsed.layerKey];
    const item = layer?.items?.find(entry => entry.id === parsed.itemId);
    if (!item) return null;
    return {
      key,
      layerKey: parsed.layerKey,
      itemId: parsed.itemId,
      categoryKey: wardrobeCategoryForLayer(parsed.layerKey),
      item,
      name: getAiName(parsed.layerKey, item),
    };
  }

  function getAiName(layerKey, item) {
    const itemId = item?.id || '';
    if (isSharedAccessorySlot(layerKey) && itemId) {
      for (const slot of ACCESSORY_SHARED_SLOTS) {
        const sharedName = state.aiNames[wearableKey(slot, itemId)];
        if (sharedName) return String(sharedName).trim();
      }
    }
    const key = wearableKey(layerKey, itemId);
    return String(state.aiNames[key] || item?.name || '').trim();
  }

  function wearableIdentity(entry) {
    if (entry?.wardrobeItemId) return wardrobeEntryKey(entry.wardrobeItemId);
    if (isSharedAccessorySlot(entry?.layerKey)) return `shared-accessory::${entry.itemId}`;
    return entry?.key || '';
  }

  function normalizeAiName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ');
  }

  function validateAiName(name) {
    const value = normalizeAiName(name);
    if (!value) return '名称不能为空。';
    if (value.length > 40) return '名称请控制在 40 个字以内。';
    if (/[|｜、，,<>\r\n]/.test(value)) return '名称中不能使用 ｜、顿号、逗号、<、>或换行。';
    return '';
  }

  function getCurrentWearableEntries() {
    const entries = [];
    for (const layerKey of AI_WEARABLE_LAYER_KEYS) {
      const layer = state.layers[layerKey];
      if (!layer || layer.visible === false || !layer.selectedId) continue;
      const wardrobeEntry = currentWornWardrobeEntry(layerKey);
      const entry = wardrobeEntry
        ? wardrobeEntryToWearable(wardrobeEntry)
        : getWearableEntry(wearableKey(layerKey, layer.selectedId));
      if (entry) entries.push(entry);
    }
    return entries;
  }

  function quickClearWearables(target) {
    const layerKeys = target === 'clothing'
      ? CLOTHING_LAYER_KEYS
      : target === 'accessories'
        ? ACCESSORY_LAYER_KEYS
        : [...CLOTHING_LAYER_KEYS, ...ACCESSORY_LAYER_KEYS];
    let cleared = 0;
    for (const layerKey of layerKeys) {
      const layer = state.layers[layerKey];
      if (!layer?.selectedId) continue;
      layer.selectedId = null;
      delete state.wornWardrobeEntries[layerKey];
      cleared += 1;
    }
    if (!cleared) {
      log(target === 'clothing' ? '当前没有可脱下的服装。' : target === 'accessories' ? '当前没有可清空的配饰。' : '当前服装与配饰已经是空的。');
      return false;
    }
    transientAiBaseline = null;
    saveState();
    renderDialogBody();
    refreshAll({ save: false });
    log(target === 'clothing' ? '已脱下当前服装。' : target === 'accessories' ? '已清空当前配饰。' : '已清空当前服装与配饰。');
    return true;
  }

  function getEffectiveAiPoolEntries() {
    const currentEntries = getCurrentWearableEntries();
    const wardrobeEntries = getActiveWardrobeItems().map(wardrobeEntryToWearable).filter(Boolean);
    const additionalCurrent = currentEntries.filter(current => current.wardrobeItemId || !wardrobeEntries.some(entry => (
      entry.layerKey === current.layerKey
      && entry.itemId === current.itemId
      && normalizeAiName(entry.name).toLocaleLowerCase() === normalizeAiName(current.name).toLocaleLowerCase()
    )));
    const entries = [
      ...wardrobeEntries,
      ...additionalCurrent,
    ];
    const currentIdentities = new Set(currentEntries.map(wearableIdentity));
    const result = [];
    const indexes = new Map();
    for (const entry of entries) {
      const identity = wearableIdentity(entry);
      if (!identity) continue;
      if (!indexes.has(identity)) {
        indexes.set(identity, result.length);
        result.push(entry);
        continue;
      }
      if (currentIdentities.has(identity) && currentEntries.some(current => current.key === entry.key)) {
        result[indexes.get(identity)] = entry;
      }
    }
    return result;
  }

  function findDuplicateAiName(entries, scopedByCategory = true) {
    const seen = new Map();
    for (const entry of entries) {
      const normalized = normalizeAiName(entry.name).toLocaleLowerCase();
      if (!normalized) continue;
      const identity = wearableIdentity(entry);
      const scopedName = scopedByCategory ? `${entry.categoryKey || wardrobeCategoryForLayer(entry.layerKey)}::${normalized}` : normalized;
      if (seen.has(scopedName) && seen.get(scopedName) !== identity) return entry.name;
      seen.set(scopedName, identity);
    }
    return '';
  }

  function getExpressionPreset(id) {
    return state.expressionPresets.find(preset => preset.id === id) || null;
  }

  function getCurrentExpressionName() {
    return getExpressionPreset(state.currentExpressionId)?.name || '自定义';
  }

  function applyExpressionPreset(presetOrId, options = {}) {
    const preset = typeof presetOrId === 'string' ? getExpressionPreset(presetOrId) : presetOrId;
    if (!preset) return false;
    const mapping = {
      pupil: preset.pupilId,
      eyebrow: preset.eyebrowId,
      mouth: preset.mouthId,
      face_effect_base: preset.faceEffectBaseId,
      face_effect_top: preset.faceEffectTopId,
    };
    for (const [layerKey, itemId] of Object.entries(mapping)) {
      const layer = state.layers[layerKey];
      if (!layer) continue;
      layer.selectedId = itemId && layer.items.some(item => item.id === itemId) ? itemId : null;
      if (layer.selectedId) layer.visible = true;
    }
    state.currentExpressionId = preset.id;
    if (options.save !== false) saveState();
    if (options.refresh !== false) refreshAll({ save: false });
    return true;
  }

  function expressionOptionsHtml(layerKey, selectedId) {
    const items = state.layers[layerKey]?.items || [];
    return `<option value="">无</option>${items.map(item => `<option value="${escapeHtml(item.id)}" ${selectedId === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}`;
  }

  function expressionEditorHtml() {
    if (!state.expressionEditorOpen) return '';
    const editing = getExpressionPreset(state.editingExpressionId);
    const draft = editing || {
      name: '',
      pupilId: state.layers.pupil?.selectedId || '',
      eyebrowId: state.layers.eyebrow?.selectedId || '',
      mouthId: state.layers.mouth?.selectedId || '',
      faceEffectBaseId: state.layers.face_effect_base?.selectedId || '',
      faceEffectTopId: state.layers.face_effect_top?.selectedId || '',
    };
    return `
      <div class="xj-pd-expression-editor">
        <label>状态名称<input class="xj-pd-slot-input" data-expression-field="name" value="${escapeHtml(draft.name || '')}" placeholder="例如：害羞"></label>
        <label>瞳孔<select class="xj-pd-select" data-expression-field="pupilId">${expressionOptionsHtml('pupil', draft.pupilId)}</select></label>
        <label>眉毛<select class="xj-pd-select" data-expression-field="eyebrowId">${expressionOptionsHtml('eyebrow', draft.eyebrowId)}</select></label>
        <label>嘴巴<select class="xj-pd-select" data-expression-field="mouthId">${expressionOptionsHtml('mouth', draft.mouthId)}</select></label>
        <label>面部底效<select class="xj-pd-select" data-expression-field="faceEffectBaseId">${expressionOptionsHtml('face_effect_base', draft.faceEffectBaseId)}</select></label>
        <label>面部顶效<select class="xj-pd-select" data-expression-field="faceEffectTopId">${expressionOptionsHtml('face_effect_top', draft.faceEffectTopId)}</select></label>
        <div class="xj-pd-plan-row">
          <button type="button" class="xj-pd-btn" data-expression-action="save">${editing ? '保存修改' : '创建并使用'}</button>
          <button type="button" class="xj-pd-btn" data-expression-action="cancel">取消</button>
        </div>
      </div>`;
  }

  function saveExpressionFromEditor(panel) {
    const read = key => panel.querySelector(`[data-expression-field="${key}"]`)?.value || '';
    const name = normalizeAiName(read('name'));
    const error = validateAiName(name);
    if (error) return alert(error);
    const editing = getExpressionPreset(state.editingExpressionId);
    const duplicate = state.expressionPresets.find(preset => preset.id !== editing?.id && preset.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (duplicate) return alert(`状态名「${name}」已经存在。`);
    const preset = editing || { id: generateId(), createdAt: Date.now() };
    Object.assign(preset, {
      name,
      pupilId: read('pupilId') || null,
      eyebrowId: read('eyebrowId') || null,
      mouthId: read('mouthId') || null,
      faceEffectBaseId: read('faceEffectBaseId') || null,
      faceEffectTopId: read('faceEffectTopId') || null,
      updatedAt: Date.now(),
    });
    if (!editing) state.expressionPresets.push(preset);
    state.expressionEditorOpen = false;
    state.editingExpressionId = null;
    applyExpressionPreset(preset, { save: false, refresh: false });
    saveState();
    renderDialogBody();
    refreshAll({ save: false });
  }

  function itemPreviewHtml(item, layerKey) {
    const isActive = state.layers[layerKey].selectedId === item.id;
    const active = isActive ? ' active' : '';
    const frontUrl = assetVariantUrl(item, 'front');
    const isPositionedBraid = PACK_POSITIONED_HAIR_SLOTS.includes(layerKey);
    const pairBadge = layerKey === 'back_hair' ? '前层＋底层' : '前后片';
    const featureBadges = [
      isPositionedBraid ? '<span>单图切层级</span>' : '',
      assetVariantUrl(item, 'back') ? `<span>${pairBadge}</span>` : '',
      item.dyeRegions?.length ? `<span>${item.dyeRegions.length}区染色</span>` : '',
    ].filter(Boolean).join('');
    return `
      <div class="xj-pd-item${active} is-wear-item" data-item-card="${escapeHtml(item.id)}" title="${isActive ? '再点一次脱下' : '点一下穿上'}">
        <div class="xj-pd-item-preview">
          <img class="xj-pd-thumb-img" loading="lazy" decoding="async" src="${escapeHtml(frontUrl)}" alt="${escapeHtml(item.name)}">
          ${['album', 'url'].includes(item.source) ? `<button type="button" class="xj-pd-item-delete" data-action="delete" data-item-id="${escapeHtml(item.id)}" title="删除这个单张素材">×</button>` : ''}
          ${featureBadges ? `<div class="xj-pd-item-badges">${featureBadges}</div>` : ''}
        </div>
        <div class="xj-pd-item-name">${escapeHtml(item.name)}${isActive ? '<span>✓</span>' : ''}</div>
      </div>`;
  }

  function wardrobeItemCardHtml(entry) {
    const source = findWardrobeSourceItem(entry);
    const active = state.wornWardrobeEntries?.[entry.layerKey] === entry.id
      && state.layers?.[entry.layerKey]?.selectedId === entry.sourceItemId;
    const slotLabel = LAYERS.find(layer => layer.key === entry.layerKey)?.label || entry.layerKey;
    const initialUrl = source ? assetVariantUrl(source, 'front') : '';
    const allowedCategories = allowedWardrobeCategoriesForLayer(entry.layerKey);
    const categoryControl = allowedCategories.length > 1 ? `
      <label class="xj-pd-closet-category">归类
        <select data-wardrobe-category="${escapeHtml(entry.id)}">
          ${allowedCategories.map(key => `<option value="${escapeHtml(key)}" ${entry.categoryKey === key ? 'selected' : ''}>${escapeHtml(getWardrobeCategoryDef(key).label)}</option>`).join('')}
        </select>
      </label>` : '';
    return `
      <article class="xj-pd-item xj-pd-closet-item${active ? ' active' : ''}${source ? '' : ' is-missing'}" data-wardrobe-wear="${escapeHtml(entry.id)}" title="${source ? (active ? '再点一次脱下' : '穿上这件衣服') : '原始素材已不存在'}">
        <div class="xj-pd-item-preview">
          ${source ? `<img class="xj-pd-thumb-img" loading="lazy" decoding="async" src="${escapeHtml(initialUrl)}" data-wardrobe-thumb="${escapeHtml(entry.id)}" alt="${escapeHtml(entry.name)}">` : '<div class="xj-pd-closet-missing">素材缺失</div>'}
          <div class="xj-pd-item-badges"><span>${escapeHtml(slotLabel)}</span><span>${String(entry.generatedBy || '').startsWith('ai-new-clothes-') ? '剧情款' : wardrobeEntryHasDye(entry) ? '配色款' : '原色款'}</span></div>
        </div>
        <div class="xj-pd-item-name" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}${active ? '<span>✓</span>' : ''}</div>
        ${categoryControl}
        <div class="xj-pd-closet-actions">
          <button type="button" class="xj-pd-mini" data-wardrobe-item-action="rename" data-entry-id="${escapeHtml(entry.id)}">改名</button>
          <button type="button" class="xj-pd-mini" data-wardrobe-item-action="duplicate" data-entry-id="${escapeHtml(entry.id)}">复制</button>
          <button type="button" class="xj-pd-mini is-danger" data-wardrobe-item-action="delete" data-entry-id="${escapeHtml(entry.id)}">移除</button>
        </div>
      </article>`;
  }

  function wardrobeCategoryContentHtml(categoryKey) {
    const entries = getActiveWardrobeItems().filter(item => item.categoryKey === categoryKey);
    if (!entries.length) return '<div class="xj-pd-closet-empty"><b>这里还是空的</b><span>去“换装”页试穿素材，染色或保持原色后保存到衣柜。</span></div>';
    const category = getWardrobeCategoryDef(categoryKey);
    const orderedLayers = [...category.layerKeys, ...entries.map(item => item.layerKey)];
    const uniqueLayers = [...new Set(orderedLayers)].filter(layerKey => entries.some(item => item.layerKey === layerKey));
    return uniqueLayers.map(layerKey => {
      const layerEntries = entries.filter(item => item.layerKey === layerKey);
      const label = LAYERS.find(layer => layer.key === layerKey)?.label || layerKey;
      return `<section class="xj-pd-closet-shelf">
        <div class="xj-pd-closet-shelf-head"><b>${escapeHtml(label)}</b><span>${layerEntries.length} 件</span></div>
        <div class="xj-pd-grid xj-pd-closet-grid cols-${escapeHtml(String(state.wardrobeColumns || 'auto'))}">${layerEntries.map(wardrobeItemCardHtml).join('')}</div>
      </section>`;
    }).join('');
  }

  function dialogEl() {
    return ST_DOC.querySelector('#xj-paperdoll-dialog');
  }

  const colorScopeRuntime = new Map();

  function colorScopeItemId(item) {
    return String(item?.id || item?.packItemId || 'none');
  }

  function getActiveColorScope(layerKey, item = getSelectedAsset(layerKey)) {
    const entry = colorScopeRuntime.get(layerKey);
    const itemId = colorScopeItemId(item);
    if (!entry || entry.itemId !== itemId) return 'whole';
    if (entry.scope === 'whole') return 'whole';
    if (entry.scope.startsWith('region:') && item?.dyeRegions?.some(region => `region:${region.id}` === entry.scope)) return entry.scope;
    return 'whole';
  }

  function setActiveColorScope(layerKey, item, scope) {
    const safeScope = scope === 'whole' || item?.dyeRegions?.some(region => `region:${region.id}` === scope) ? scope : 'whole';
    colorScopeRuntime.set(layerKey, { itemId: colorScopeItemId(item), scope: safeScope });
  }

  function currentColorScopeContext(layerKey = state.activeLayer) {
    const layer = state.layers[layerKey] || {};
    const item = getSelectedAsset(layerKey);
    const scope = getActiveColorScope(layerKey, item);
    const regionId = scope.startsWith('region:') ? scope.slice('region:'.length) : '';
    const region = regionId ? item?.dyeRegions?.find(entry => entry.id === regionId) || null : null;
    return { layerKey, layer, item, scope: region ? scope : 'whole', region, settings: region ? getDyeSettings(item, region) : layer };
  }

  function writableColorScopeSettings(context = currentColorScopeContext()) {
    const settings = context.region ? ensureDyeSettings(context.item, context.region) : context.layer;
    // Editing through the manual controls switches this scope back to manual dyeing.
    if (settings.colorMapping === 'overlay') settings.colorMapping = COLOR_DEFAULTS.colorMapping;
    return settings;
  }

  function colorScopeSelectorHtml(context) {
    const regions = context.item?.dyeRegions || [];
    if (!regions.length) return '';
    const isPositionedBraid = PACK_POSITIONED_HAIR_SLOTS.includes(context.layerKey);
    const frontLabel = context.layerKey === 'back_hair' ? '前层' : (isPositionedBraid ? '主图（前后通用）' : '前片');
    const backLabel = context.layerKey === 'back_hair' ? '底层' : '后片';
    const options = [
      `<option value="whole" ${context.scope === 'whole' ? 'selected' : ''}>整体（整张部件）</option>`,
      ...regions.map(region => {
        const coverage = [region.frontMaskStorageKey ? frontLabel : '', region.backMaskStorageKey ? backLabel : ''].filter(Boolean).join('＋') || '无蒙版';
        const value = `region:${region.id}`;
        return `<option value="${escapeHtml(value)}" ${context.scope === value ? 'selected' : ''}>${escapeHtml(region.name)}（${escapeHtml(coverage)}）</option>`;
      }),
    ];
    return `
      <label class="xj-pd-color-scope">
        <span>作用范围</span>
        <select data-color-scope aria-label="高级染色作用范围">${options.join('')}</select>
      </label>`;
  }

  
function renderDialogBody() {
  if (stopIfScriptDisabled()) return;
  const dialog = dialogEl();
  if (!dialog) return;
  const panel = dialog.querySelector('#xj-pd-panel-body');
  const layerDef = currentLayerDef();
  const layerState = currentLayerState();
  const layersInGroup = groupedLayers(state.activeGroup);
  const importOpen = state.importMenuLayer === layerDef.key;
  const eyebrowMode = state.layerModes.eyebrow;
  const braidLeftMode = state.layerModes.braid_left || 'back';
  const braidRightMode = state.layerModes.braid_right || 'back';
  const outfitOrder = state.layerModes.outfitOrder || 'topOverBottom';
  const isHairCurrentLayer = isHairLayer(layerDef.key);
  const isEyelidCurrentLayer = layerDef.key === 'eyelid';
  const followHairGroup = !!layerState.followHairGroup;
  const hairColor = state.hairGroupColor || COLOR_DEFAULTS;
  const colorContext = currentColorScopeContext(layerDef.key);
  const colorSettings = colorContext.settings || COLOR_DEFAULTS;
  const hasDyeRegions = !!colorContext.item?.dyeRegions?.length;
  const colorScopeHtml = colorScopeSelectorHtml(colorContext);
  const regionColorActive = !!colorContext.region && hasCustomDyeColor(colorContext.item, colorContext.region);
  const hideScopedControls = isHairCurrentLayer && followHairGroup && !colorContext.region;
  const currentUser = getCurrentUserInfo();
  const activePlan = getCurrentPlan();
  const boundPlanId = state.userBindings[currentUser.key] || null;
  const boundPlan = getPlanById(boundPlanId);
  const expressionListHtml = state.expressionPresets.length
    ? state.expressionPresets.map(preset => `
        <div class="xj-pd-expression-row${state.currentExpressionId === preset.id ? ' active' : ''}">
          <span>${escapeHtml(preset.name)}</span>
          <button type="button" class="xj-pd-mini" data-expression-action="apply" data-expression-id="${escapeHtml(preset.id)}">使用</button>
          <button type="button" class="xj-pd-mini" data-expression-action="edit" data-expression-id="${escapeHtml(preset.id)}">编辑</button>
          <button type="button" class="xj-pd-mini" data-expression-action="delete" data-expression-id="${escapeHtml(preset.id)}">删除</button>
        </div>`).join('')
    : '<div class="xj-pd-plan-line">还没有可使用状态。</div>';

  rememberPanelScroll(panel);

  let specialModeHtml = '';
  if (layerDef.key === 'eyebrow') {
    specialModeHtml = `
      <div class="xj-pd-submode">
        <div class="xj-pd-submode-title">眉毛层级</div>
        <div class="xj-pd-submode-row">
          <button type="button" class="xj-pd-chip${eyebrowMode === 'normal' ? ' active' : ''}" data-mode="eyebrow" data-value="normal">原本层</button>
          <button type="button" class="xj-pd-chip${eyebrowMode === 'top' ? ' active' : ''}" data-mode="eyebrow" data-value="top">最上层</button>
        </div>
      </div>`;
  }
  if (layerDef.key === 'back_hair') {
    specialModeHtml += `
      <div class="xj-pd-submode">
        <div class="xj-pd-submode-title">后发自动前后绑定</div>
        <div class="xj-pd-note" style="margin-top:6px;">后发（底）固定在身后，后发（前）固定在身前。内置素材按同名自动绑定；图包素材把前／底两张保存在同一个后发部件里。缺哪一层就只显示已有素材。</div>
      </div>`;
  }
  if (layerDef.key === 'braid_left') {
    specialModeHtml += `
      <div class="xj-pd-submode">
        <div class="xj-pd-submode-title">左辫放置位置</div>
        <div class="xj-pd-submode-row">
          <button type="button" class="xj-pd-chip${braidLeftMode === 'back' ? ' active' : ''}" data-mode="braid_left" data-value="back">放到身后</button>
          <button type="button" class="xj-pd-chip${braidLeftMode === 'front' ? ' active' : ''}" data-mode="braid_left" data-value="front">放到身前</button>
        </div>
        <div class="xj-pd-note" style="margin-top:6px;">左辫只控制左侧，不会自动穿右辫。同一张辫子图会随设置切换到人物前层或后层，不需要准备置后图片。</div>
      </div>`;
  }
  if (layerDef.key === 'braid_right') {
    specialModeHtml += `
      <div class="xj-pd-submode">
        <div class="xj-pd-submode-title">右辫放置位置</div>
        <div class="xj-pd-submode-row">
          <button type="button" class="xj-pd-chip${braidRightMode === 'back' ? ' active' : ''}" data-mode="braid_right" data-value="back">放到身后</button>
          <button type="button" class="xj-pd-chip${braidRightMode === 'front' ? ' active' : ''}" data-mode="braid_right" data-value="front">放到身前</button>
        </div>
        <div class="xj-pd-note" style="margin-top:6px;">右辫只控制右侧，不会自动穿左辫。同一张辫子图会随设置切换到人物前层或后层，不需要准备置后图片。</div>
      </div>`;
  }
  if (layerDef.key === 'top' || layerDef.key === 'bottom') {
    specialModeHtml += `
      <div class="xj-pd-submode">
        <div class="xj-pd-submode-title">上衣 / 下装层级</div>
        <div class="xj-pd-submode-row">
          <button type="button" class="xj-pd-chip${outfitOrder === 'topOverBottom' ? ' active' : ''}" data-mode="outfitOrder" data-value="topOverBottom">上衣盖住下装</button>
          <button type="button" class="xj-pd-chip${outfitOrder === 'bottomOverTop' ? ' active' : ''}" data-mode="outfitOrder" data-value="bottomOverTop">下装盖住上衣</button>
        </div>
      </div>`;
  }
  if (isSharedAccessorySlot(layerDef.key)) {
    specialModeHtml += `
      <div class="xj-pd-submode">
        <div class="xj-pd-submode-title">通用配饰池</div>
        <div class="xj-pd-note" style="margin-top:6px;">配饰1、配饰2、配饰3共用同一批素材。区别只在显示层级；在任意一个配饰层导入或删除，三个层都会同步。</div>
      </div>`;
  }
  if (isEyelidCurrentLayer) {
    specialModeHtml += `
      <div class="xj-pd-submode">
        <div class="xj-pd-submode-title">三帧眨眼</div>
        <div class="xj-pd-note" style="margin-top:6px;">眼皮素材固定读取横向三帧：睁眼 → 半闭 → 闭眼。播放顺序固定为：睁眼 → 半闭 → 闭眼 → 半闭 → 睁眼，然后停约5秒。实际只使用横向三帧，回程复用半闭帧；眨眼时只移动眼皮帧，不重绘全身。高光已放在眼皮下层。</div>
      </div>`;
  }
  if (isHairCurrentLayer) {
    specialModeHtml += `
      <div class="xj-pd-submode">
        <div class="xj-pd-submode-title">头发统一染色</div>
        <div class="xj-pd-submode-row">
          <button type="button" class="xj-pd-chip${followHairGroup ? ' active' : ''}" data-hair-follow="on">跟随统一染色</button>
          <button type="button" class="xj-pd-chip${!followHairGroup ? ' active' : ''}" data-hair-follow="off">单独染色</button>
        </div>
        <div class="xj-pd-color-panel">
          <div class="xj-pd-color-top">
            <input type="color" class="xj-pd-color-picker" data-hair-color-input value="${escapeHtml(hairColor.colorHex || COLOR_DEFAULTS.colorHex)}">
            <button type="button" class="xj-pd-btn xj-pd-color-reset" data-toolbar="resetHairColor">重置头发染色</button>
          </div>
          <div class="xj-pd-slider-row">
            <label>染色</label>
            <input type="range" min="0" max="100" step="1" value="${Number(hairColor.tintStrength ?? 0)}" data-hair-range="tintStrength">
            <span>${Number(hairColor.tintStrength ?? 0)}</span>
          </div>
          <div class="xj-pd-slider-row">
            <label>饱和</label>
            <input type="range" min="0" max="200" step="1" value="${Number(hairColor.saturation ?? 100)}" data-hair-range="saturation">
            <span>${Number(hairColor.saturation ?? 100)}</span>
          </div>
          <div class="xj-pd-slider-row">
            <label>明度</label>
            <input type="range" min="0" max="${COLOR_BRIGHTNESS_MAX}" step="1" value="${Number(hairColor.brightness ?? 100)}" data-hair-range="brightness">
            <span>${Number(hairColor.brightness ?? 100)}</span>
          </div>
          <div class="xj-pd-slider-row">
            <label>对比</label>
            <input type="range" min="0" max="200" step="1" value="${Number(hairColor.contrast ?? 100)}" data-hair-range="contrast">
            <span>${Number(hairColor.contrast ?? 100)}</span>
          </div>
          <label class="xj-pd-checkbox-row"><input type="checkbox" data-hair-checkbox="preserveLines" ${hairColor.preserveLines !== false ? 'checked' : ''}>保留暗线</label>
        </div>
        ${followHairGroup ? '<div class="xj-pd-note" style="margin-top:6px;">当前层正在跟随头发统一染色。若要只改这一层，请切到「单独染色」。</div>' : ''}
      </div>`;
  }

  const wornNames = getCurrentWearableEntries().map(entry => entry.name);
  const wardrobeColumns = String(state.wardrobeColumns || 'auto');
  const activeWardrobe = getActiveWardrobe();
  const activeWardrobeItems = getActiveWardrobeItems();
  const activeWardrobePlans = state.plans.filter(plan => (plan.wardrobeId || DEFAULT_WARDROBE_ID) === state.activeWardrobeId);
  const currentClosetEntry = currentWornWardrobeEntry(layerDef.key);
  const canSaveCurrentToWardrobe = isAiWearableLayer(layerDef.key) && !!getSelectedAsset(layerDef.key);
  const wardrobeSaveBarHtml = isAiWearableLayer(layerDef.key) ? `
    <div class="xj-pd-closet-savebar">
      <div><span>保存当前 ${escapeHtml(layerDef.label)}</span><b>${escapeHtml(currentClosetEntry?.name || getSelectedAsset(layerDef.key)?.name || '尚未试穿')}</b><em>原色和染色款都可以保存</em></div>
      <div>
        ${currentClosetEntry ? '<button type="button" class="xj-pd-pixel-btn" data-closet-save="overwrite">覆盖当前款</button>' : ''}
        <button type="button" class="xj-pd-pixel-btn is-accent" data-closet-save="new" ${canSaveCurrentToWardrobe ? '' : 'disabled'}>${currentClosetEntry ? '另存新款' : '保存到衣柜'}</button>
      </div>
    </div>` : '';
  const pageTabs = [
    ['wardrobe', '▦', '换装'],
    ['closet', '▤', '衣柜'],
    ['expression', '◉', '表情'],
    ['plans', '▣', '方案'],
    ['settings', '◆', '设置'],
  ];
  const wardrobePageHtml = `
    <section class="xj-pd-page xj-pd-wardrobe-page">
      <div class="xj-pd-page-head">
        <div><span>素材试穿</span><b>${escapeHtml(state.activeGroup)} / ${escapeHtml(layerDef.label)}</b></div>
        <em class="xj-pd-page-kicker">选素材 → 调色 → 存衣柜</em>
      </div>
      <div class="xj-pd-clear-bar" aria-label="快捷脱衣">
        <button type="button" data-quick-clear="clothing" title="脱下全部服装，但不删除素材">脱服装</button>
        <button type="button" data-quick-clear="accessories" title="清空全部配饰，但不删除素材">清配饰</button>
        <button type="button" data-quick-clear="all" title="清空当前服装与配饰，但不覆盖方案">全部清空</button>
      </div>
      <div class="xj-pd-groups">
        ${GROUPS.map(group => `<button type="button" class="xj-pd-tab${state.activeGroup === group ? ' active' : ''}" data-group="${escapeHtml(group)}">${escapeHtml(group)}</button>`).join('')}
      </div>
      <div class="xj-pd-layers">
        ${layersInGroup.map(layer => `<button type="button" class="xj-pd-layer-tab${state.activeLayer === layer.key ? ' active' : ''}" data-layer="${escapeHtml(layer.key)}">${escapeHtml(layer.label)}</button>`).join('')}
      </div>
      <div class="xj-pd-layer-command">
        <span>${escapeHtml(layerDef.label)}</span>
        <div class="xj-pd-layer-actions">
          <button type="button" class="xj-pd-pixel-key is-pack" data-pack-picker>▣ 导入图包</button>
          <button type="button" class="xj-pd-pixel-key" data-toolbar="plusImport">＋ 导入</button>
          <button type="button" class="xj-pd-pixel-key" data-toolbar="toggleVisible">${layerState.visible ? '隐藏图层' : '显示图层'}</button>
        </div>
      </div>
      ${importOpen ? `<div class="xj-pd-import-choice"><span>单张导入到：${escapeHtml(layerDef.label)}</span><button type="button" class="xj-pd-pixel-key" data-import="url">图片网址</button><button type="button" class="xj-pd-pixel-key" data-import="album">手机相册</button><button type="button" class="xj-pd-pixel-key" data-import="cancel">取消</button></div>` : ''}
      ${pendingPackImportHtml()}
      <div class="xj-pd-grid-label">
        <div><span>选择 ${escapeHtml(layerDef.label)}</span><em>${layerState.items.length} 件</em></div>
        <label class="xj-pd-density">每行
          <select data-grid-columns aria-label="每行显示部件数量">
            <option value="auto" ${wardrobeColumns === 'auto' ? 'selected' : ''}>自动</option>
            <option value="3" ${wardrobeColumns === '3' ? 'selected' : ''}>3</option>
            <option value="4" ${wardrobeColumns === '4' ? 'selected' : ''}>4</option>
            <option value="5" ${wardrobeColumns === '5' ? 'selected' : ''}>5</option>
          </select>
        </label>
      </div>
      <div class="xj-pd-grid is-wear cols-${wardrobeColumns}">
        ${layerState.items.map(item => itemPreviewHtml(item, layerDef.key)).join('')}
      </div>
      ${specialModeHtml}
      ${(!isHairCurrentLayer || !followHairGroup || hasDyeRegions) ? `
      <details class="xj-pd-submode xj-pd-color-details" ${hasDyeRegions ? 'open' : ''}>
        <summary>${colorContext.region ? `分区高级调色 · ${escapeHtml(colorContext.region.name)}` : (isHairCurrentLayer ? '当前层单独调色' : '当前部件高级调色')}</summary>
        ${colorScopeHtml}
        ${hideScopedControls ? '<div class="xj-pd-note" style="margin-top:7px;">整体当前跟随“头发统一染色”；选择一个染色区后，可以在这里单独进行高级调色。</div>' : `
        <div class="xj-pd-color-panel xj-pd-scoped-color-panel">
          <div class="xj-pd-color-top">
            <input type="color" class="xj-pd-color-picker" data-scope-color value="${escapeHtml(colorSettings.colorHex || COLOR_DEFAULTS.colorHex)}">
            <button type="button" class="xj-pd-pixel-key" data-scope-reset ${colorContext.region && !regionColorActive ? 'disabled' : ''}>重置当前范围</button>
          </div>
          <div class="xj-pd-slider-row"><label>染色</label><input type="range" min="0" max="100" step="1" value="${Number(colorSettings.tintStrength ?? 0)}" data-scope-range="tintStrength"><span>${Number(colorSettings.tintStrength ?? 0)}</span></div>
          <div class="xj-pd-slider-row"><label>饱和</label><input type="range" min="0" max="200" step="1" value="${Number(colorSettings.saturation ?? 100)}" data-scope-range="saturation"><span>${Number(colorSettings.saturation ?? 100)}</span></div>
          <div class="xj-pd-slider-row"><label>明度</label><input type="range" min="0" max="${COLOR_BRIGHTNESS_MAX}" step="1" value="${Number(colorSettings.brightness ?? 100)}" data-scope-range="brightness"><span>${Number(colorSettings.brightness ?? 100)}</span></div>
          <div class="xj-pd-slider-row"><label>对比</label><input type="range" min="0" max="200" step="1" value="${Number(colorSettings.contrast ?? 100)}" data-scope-range="contrast"><span>${Number(colorSettings.contrast ?? 100)}</span></div>
          <label class="xj-pd-checkbox-row"><input type="checkbox" data-scope-checkbox="preserveLines" ${colorSettings.preserveLines !== false ? 'checked' : ''}>保留暗线</label>
        </div>
        ${hasDyeRegions ? '<div class="xj-pd-note" style="margin-top:7px;">整体调色先作用于整张部件；分区调色随后只作用于蒙版范围。同一区域会同时控制对应的前片与后片。</div>' : ''}`}
      </details>` : ''}
      ${wardrobeSaveBarHtml}
    </section>`;
  const closetPageHtml = `
    <section class="xj-pd-page xj-pd-closet-page">
      <div class="xj-pd-page-head">
        <div><span>我的衣柜</span><b>${escapeHtml(activeWardrobe?.name || '默认衣柜')} · ${activeWardrobeItems.length} 件</b></div>
        <label class="xj-pd-density">每行
          <select data-grid-columns aria-label="衣柜每行显示数量">
            <option value="auto" ${wardrobeColumns === 'auto' ? 'selected' : ''}>自动</option>
            <option value="3" ${wardrobeColumns === '3' ? 'selected' : ''}>3</option>
            <option value="4" ${wardrobeColumns === '4' ? 'selected' : ''}>4</option>
            <option value="5" ${wardrobeColumns === '5' ? 'selected' : ''}>5</option>
          </select>
        </label>
      </div>
      <div class="xj-pd-closet-manager">
        <select class="xj-pd-select" data-wardrobe-select aria-label="选择衣柜">
          ${state.wardrobes.map(wardrobe => `<option value="${escapeHtml(wardrobe.id)}" ${wardrobe.id === state.activeWardrobeId ? 'selected' : ''}>${escapeHtml(wardrobe.name)}</option>`).join('')}
        </select>
        <button type="button" class="xj-pd-pixel-btn is-accent" data-wardrobe-action="new">＋ 新衣柜</button>
        <button type="button" class="xj-pd-pixel-btn" data-wardrobe-action="rename">改名</button>
        <button type="button" class="xj-pd-pixel-btn is-danger" data-wardrobe-action="delete" ${activeWardrobe?.id === DEFAULT_WARDROBE_ID ? 'disabled' : ''}>删除</button>
      </div>
      <div class="xj-pd-closet-categories" aria-label="衣柜分类">
        ${WARDROBE_CATEGORY_DEFS.map(category => {
          const count = activeWardrobeItems.filter(item => item.categoryKey === category.key).length;
          return `<button type="button" class="${state.activeWardrobeCategory === category.key ? 'active' : ''}" data-wardrobe-category-tab="${escapeHtml(category.key)}"><span>${escapeHtml(category.label)}</span><em>${count}</em></button>`;
        }).join('')}
      </div>
      <div class="xj-pd-closet-content">${wardrobeCategoryContentHtml(state.activeWardrobeCategory)}</div>
      <div class="xj-pd-help-panel">当前衣柜中的可用条目会进入 AI 部件池；只发送你起的名称，不发送色号或染色参数。穿搭组合请到“方案”页保存。</div>
    </section>`;
  const expressionPageHtml = `
    <section class="xj-pd-page xj-pd-expression-box">
      <div class="xj-pd-page-head"><div><span>表情档案</span><b>当前：${escapeHtml(getCurrentExpressionName())}</b></div><button type="button" class="xj-pd-pixel-btn is-accent" data-expression-action="new">＋ 新建状态</button></div>
      <div class="xj-pd-expression-list">${expressionListHtml}</div>
      ${expressionEditorHtml()}
      <div class="xj-pd-help-panel">每个状态可组合瞳孔、眉毛、嘴巴、面部底效和面部顶效；保存后立即进入模型可用表情池。</div>
    </section>`;
  const plansPageHtml = `
    <section class="xj-pd-page xj-pd-user-plan-box">
      <div class="xj-pd-page-head"><div><span>存档与绑定</span><b>${escapeHtml(currentUser.label)}</b></div><div class="xj-pd-user-sigil">USER</div></div>
      <div class="xj-pd-save-card">
        <div><span>所属衣柜</span><b>${escapeHtml(activeWardrobe?.name || '默认衣柜')}</b></div>
        <div><span>当前识别码</span><b>${escapeHtml(currentUser.keyLabel || currentUser.key)}</b></div>
        <div><span>正在编辑</span><b>${escapeHtml(activePlan?.name || '未选择')}</b></div>
        <div><span>user 绑定</span><b>${escapeHtml(boundPlan?.name || '未绑定')}</b></div>
      </div>
      <label class="xj-pd-field-label">选择方案
        <select class="xj-pd-select" data-plan-select><option value="">选择方案</option>${activeWardrobePlans.map(plan => `<option value="${escapeHtml(plan.id)}" ${state.currentPlanId === plan.id ? 'selected' : ''}>${escapeHtml(plan.name)}</option>`).join('')}</select>
      </label>
      <div class="xj-pd-action-grid">
        <button type="button" class="xj-pd-pixel-btn is-accent" data-plan-action="saveNew">另存新方案</button>
        <button type="button" class="xj-pd-pixel-btn" data-plan-action="overwrite">覆盖方案</button>
        <button type="button" class="xj-pd-pixel-btn" data-plan-action="load">读取方案</button>
        <button type="button" class="xj-pd-pixel-btn is-danger" data-plan-action="delete">删除方案</button>
        <button type="button" class="xj-pd-pixel-btn xj-pd-wide-action" data-plan-action="bind">绑定到当前 user</button>
        <button type="button" class="xj-pd-pixel-btn xj-pd-wide-action" data-plan-action="unbind">解除当前绑定</button>
      </div>
    </section>`;
  const assetPackListHtml = state.assetPacks.length
    ? state.assetPacks.map(pack => `
        <div class="xj-pd-pack-row">
          <div><b>${escapeHtml(pack.name)}</b><span>v${escapeHtml(pack.version || '1.0.0')} · ${Number(pack.itemCount || 0)}个部件</span></div>
          <button type="button" class="xj-pd-mini" data-pack-delete="${escapeHtml(pack.id)}">删除</button>
        </div>`).join('')
    : '<div class="xj-pd-plan-line">还没有导入图包。普通内置素材不受这里影响。</div>';
  const settingsPageHtml = `
    <section class="xj-pd-page xj-pd-settings-page">
      <div class="xj-pd-page-head"><div><span>显示校准</span><b>悬浮特写设置</b></div></div>
      <div class="xj-pd-setting-block">
        <label class="xj-pd-toggle"><input type="checkbox" data-game-visible ${state.visible !== false ? 'checked' : ''}><span>显示悬浮特写</span></label>
        <label class="xj-pd-toggle"><input type="checkbox" data-game-ext="blinkEnabled" ${getExtensionSettings().blinkEnabled !== false ? 'checked' : ''}><span>启用眨眼</span></label>
        <label class="xj-pd-toggle"><input type="checkbox" data-game-ext="aiStateEnabled" ${getExtensionSettings().aiStateEnabled !== false ? 'checked' : ''}><span>启用剧情状态</span></label>
        <label class="xj-pd-toggle"><input type="checkbox" data-game-ext="aiWardrobeGenerationEnabled" ${getExtensionSettings().aiWardrobeGenerationEnabled !== false ? 'checked' : ''}><span>允许剧情新增配色款</span></label>
      </div>
      <div class="xj-pd-setting-block">
        <div class="xj-pd-setting-title">特写停靠位置</div>
        <div class="xj-pd-side-switch">
          <button type="button" class="${state.stageSide === 'left' ? 'active' : ''}" data-stage-side="left">◀ 左侧</button>
          <button type="button" class="${state.stageSide === 'right' ? 'active' : ''}" data-stage-side="right">右侧 ▶</button>
        </div>
      </div>
      <div class="xj-pd-setting-block xj-pd-calibration">
        <label><span>特写大小</span><input type="range" min="0.42" max="1.2" step="0.02" value="${Number(state.scale || 0.72)}" data-game-range="scale"><em>${Number(state.scale || 0.72).toFixed(2)}</em></label>
        <label><span>上下位置</span><input type="range" min="-160" max="160" step="2" value="${Number(state.yOffset || 0)}" data-game-range="yOffset"><em>${Number(state.yOffset || 0)}</em></label>
        <label><span>底部修正</span><input type="range" min="-80" max="80" step="2" value="${Number(state.bottomTrim || 0)}" data-game-range="bottomTrim"><em>${Number(state.bottomTrim || 0)}</em></label>
      </div>
      <div class="xj-pd-action-grid">
        <button type="button" class="xj-pd-pixel-btn" data-toolbar="reset">恢复默认位置</button>
        <button type="button" class="xj-pd-pixel-btn is-danger" data-toolbar="cleanup">关闭并清理特写</button>
      </div>
      <div class="xj-pd-setting-block xj-pd-gif-export-block">
        <div class="xj-pd-setting-title">透明特写 GIF</div>
        <button type="button" class="xj-pd-pixel-btn is-accent xj-pd-export-gif" data-export-gif>导出透明特写 GIF</button>
        <div class="xj-pd-note" style="margin-top:7px;">按当前穿搭、染色、表情和图层顺序导出右侧特写；眨眼后停约 5 秒再循环。编码器只在点击时临时加载。</div>
      </div>
      <div class="xj-pd-setting-block xj-pd-pack-manager">
        <div class="xj-pd-setting-title">素材图包</div>
        <button type="button" class="xj-pd-pixel-btn is-accent" data-pack-picker>导入 ZIP 图包</button>
        <div class="xj-pd-pack-list">${assetPackListHtml}</div>
        ${pendingPackImportHtml()}
      </div>
      <div class="xj-pd-help-panel">配套 ❃ 状态栏正则会随扩展自动同步，只美化显示，不修改回复原文。剧情款保存到当前衣柜；无有效状态时，纸娃娃恢复当前 user 的绑定方案。</div>
    </section>`;
  const activePageHtml = {
    wardrobe: wardrobePageHtml,
    closet: closetPageHtml,
    expression: expressionPageHtml,
    plans: plansPageHtml,
    settings: settingsPageHtml,
  }[state.panelPage] || wardrobePageHtml;
  const showLivePreview = ['wardrobe', 'closet', 'expression'].includes(state.panelPage);
  const currentPlanName = boundPlan?.name || activePlan?.name || '未绑定';
  const currentClothingTitle = wornNames.length ? wornNames.join('｜') : '无';
  const previewDockHtml = `
    <aside class="xj-pd-preview-dock">
      <div class="xj-pd-viewport">
        <div class="xj-pd-viewport-grid"></div>
        <div class="xj-pd-preview-pair" aria-label="纸娃娃全身与特写预览">
          <figure class="xj-pd-preview-figure">
            <div id="xj-pd-preview-full"></div>
            <figcaption>全身</figcaption>
          </figure>
          <figure class="xj-pd-preview-figure">
            <div id="xj-pd-preview-bust"></div>
            <figcaption>特写</figcaption>
          </figure>
        </div>
      </div>
      <div class="xj-pd-live-status" title="衣着：${escapeHtml(currentClothingTitle)}">
        <strong>${escapeHtml(currentUser.label)}</strong>
        <span>${escapeHtml(getCurrentExpressionName())} · ${wornNames.length}件</span>
        <em>${escapeHtml(currentPlanName)}</em>
      </div>
      <button type="button" class="xj-pd-pixel-btn xj-pd-export-gif" data-export-gif>导出透明特写 GIF</button>
    </aside>`;

  panel.innerHTML = `
    <div class="xj-pd-game-ui">
      <nav class="xj-pd-game-nav">
        ${pageTabs.map(([key, icon, label]) => `<button type="button" class="${state.panelPage === key ? 'active' : ''}" data-panel-page="${key}"><i>${icon}</i><span>${label}</span></button>`).join('')}
      </nav>
      <section class="xj-pd-workspace ${showLivePreview ? 'is-live' : 'is-full'}">
        ${showLivePreview ? previewDockHtml : ''}
        <main class="xj-pd-page-frame">${activePageHtml}</main>
      </section>
    </div>`;

  refreshDialogPreviews();
  hydrateWardrobeThumbnails(panel);
  bindPanelEvents(panel);
  restorePanelScroll(panel);
  ensureBlinkRuntime();
}

function refreshDialogPreviews() {
  const dialog = dialogEl();
  if (!dialog) return;
  const full = dialog.querySelector('#xj-pd-preview-full');
  const bust = dialog.querySelector('#xj-pd-preview-bust');
  const compact = Number(ST_WIN.innerWidth || 0) <= 600;
  const shortMobile = compact && Number(ST_WIN.innerHeight || 0) > 0 && Number(ST_WIN.innerHeight) <= 650;
  const previewScale = shortMobile ? 0.58 : compact ? 0.7 : 0.82;
  if (full) {
    full.innerHTML = '';
    full.appendChild(renderStage('full', previewScale));
  }
  if (bust) {
    bust.innerHTML = '';
    bust.appendChild(renderStage('bust', previewScale));
  }
}

const colorRefreshRuntime = {
  raf: 0,
  pendingKeys: new Set(),
  tokens: new Map(),
};

function getHairFollowerLayerKeys() {
  return HAIR_LAYER_KEYS.filter(key => state.layers[key]?.followHairGroup);
}

function queueLayerVisualRefresh(layerKeys) {
  const keys = Array.from(new Set((layerKeys || []).filter(Boolean)));
  if (!keys.length) return;
  for (const key of keys) colorRefreshRuntime.pendingKeys.add(key);
  if (colorRefreshRuntime.raf) return;
  const runner = ST_WIN.requestAnimationFrame ? ST_WIN.requestAnimationFrame.bind(ST_WIN) : (fn => ST_WIN.setTimeout(fn, 16));
  colorRefreshRuntime.raf = runner(() => {
    colorRefreshRuntime.raf = 0;
    const pending = Array.from(colorRefreshRuntime.pendingKeys);
    colorRefreshRuntime.pendingKeys.clear();
    pending.forEach(layerKey => {
      const asset = getSelectedAsset(layerKey);
      if (!asset) return;
      const token = (colorRefreshRuntime.tokens.get(layerKey) || 0) + 1;
      colorRefreshRuntime.tokens.set(layerKey, token);
      for (const variant of ['front', 'back']) {
        if (!assetVariantUrl(asset, variant)) continue;
        getRenderedAssetUrl(asset, layerKey, variant).then(url => {
          if (stopIfScriptDisabled() || !url) return;
          if (colorRefreshRuntime.tokens.get(layerKey) !== token) return;
          const currentAsset = getSelectedAsset(layerKey);
          if (!currentAsset || currentAsset.id !== asset.id) return;
          ST_DOC.querySelectorAll(`[data-pd-source-layer="${layerKey}"][data-pd-variant="${variant}"]`).forEach(div => {
            div.style.backgroundImage = cssUrl(url);
          });
        });
      }
    });
  });
}

function refreshPreviewAndMain(options = {}) {
  const { mode = 'full', layerKeys = [] } = options;
  if (mode === 'color') {
    queueLayerVisualRefresh(layerKeys.length ? layerKeys : [state.activeLayer]);
    return;
  }
  refreshDialogPreviews();
  refreshAll();
}

function bindColorInteractionPause(panel) {
  const controls = panel.querySelectorAll('[data-scope-color], [data-scope-range], [data-hair-color-input], [data-hair-range]');
  controls.forEach(input => {
    const pause = () => pauseBlinkForColorInteraction();
    const resumeSoon = () => resumeBlinkAfterColorInteraction(800);
    input.addEventListener('pointerdown', pause, { passive: true });
    input.addEventListener('mousedown', pause, { passive: true });
    input.addEventListener('touchstart', pause, { passive: true });
    input.addEventListener('input', () => {
      pauseBlinkForColorInteraction();
      resumeBlinkAfterColorInteraction(900);
    }, { passive: true });
    input.addEventListener('pointerup', resumeSoon, { passive: true });
    input.addEventListener('mouseup', resumeSoon, { passive: true });
    input.addEventListener('touchend', resumeSoon, { passive: true });
    input.addEventListener('change', resumeSoon, { passive: true });
  });
}

function bindPanelEvents(panel) {
  bindColorInteractionPause(panel);

  panel.querySelectorAll('[data-export-gif]').forEach(button => {
    button.onclick = () => exportCurrentBustGif();
  });

  panel.querySelectorAll('[data-pack-picker]').forEach(button => {
    button.onclick = () => chooseAssetPackZip();
  });

  panel.querySelectorAll('[data-pack-import]').forEach(button => {
    button.onclick = async () => {
      const action = button.dataset.packImport;
      if (action === 'cancel') {
        pendingPackImport = null;
        renderDialogBody();
        return;
      }
      button.disabled = true;
      await commitPendingPackImport(action === 'copy' ? 'copy' : 'install');
    };
  });

  panel.querySelectorAll('[data-pack-delete]').forEach(button => {
    button.onclick = () => deleteAssetPack(button.dataset.packDelete);
  });

  panel.querySelectorAll('[data-panel-page]').forEach(button => {
    button.onclick = () => {
      state.panelPage = button.dataset.panelPage;
      resetPanelPageScroll(panel);
      saveState();
      renderDialogBody();
    };
  });

  panel.querySelectorAll('[data-closet-save]').forEach(button => {
    button.onclick = () => {
      if (button.dataset.closetSave === 'overwrite') overwriteCurrentWardrobeItem();
      else saveCurrentAssetToWardrobe();
    };
  });

  panel.querySelectorAll('[data-wardrobe-select]').forEach(select => {
    select.onchange = () => activateWardrobe(select.value);
  });

  panel.querySelectorAll('[data-wardrobe-action]').forEach(button => {
    button.onclick = () => {
      const action = button.dataset.wardrobeAction;
      if (action === 'new') createWardrobe();
      if (action === 'rename') renameActiveWardrobe();
      if (action === 'delete') deleteActiveWardrobe();
    };
  });

  panel.querySelectorAll('[data-wardrobe-category-tab]').forEach(button => {
    button.onclick = () => {
      const categoryKey = button.dataset.wardrobeCategoryTab;
      if (!WARDROBE_CATEGORY_DEFS.some(category => category.key === categoryKey)) return;
      state.activeWardrobeCategory = categoryKey;
      saveState();
      renderDialogBody();
    };
  });

  panel.querySelectorAll('[data-wardrobe-wear]').forEach(card => {
    card.onclick = event => {
      if (event.target.closest('button, select, label')) return;
      wearWardrobeItem(card.dataset.wardrobeWear);
    };
  });

  panel.querySelectorAll('[data-wardrobe-item-action]').forEach(button => {
    button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.wardrobeItemAction;
      const entryId = button.dataset.entryId;
      if (action === 'rename') renameWardrobeItem(entryId);
      if (action === 'duplicate') duplicateWardrobeItem(entryId);
      if (action === 'delete') deleteWardrobeItem(entryId);
    };
  });

  panel.querySelectorAll('[data-wardrobe-category]').forEach(select => {
    select.onclick = event => event.stopPropagation();
    select.onchange = event => {
      event.stopPropagation();
      changeWardrobeItemCategory(select.dataset.wardrobeCategory, select.value);
    };
  });

  panel.querySelectorAll('[data-grid-columns]').forEach(select => {
    select.onchange = () => {
      const value = String(select.value || 'auto');
      state.wardrobeColumns = ['3', '4', '5'].includes(value) ? value : 'auto';
      saveState();
      renderDialogBody();
    };
  });

  panel.querySelectorAll('[data-quick-clear]').forEach(button => {
    button.onclick = () => quickClearWearables(button.dataset.quickClear);
  });

  panel.querySelectorAll('[data-game-range]').forEach(input => {
    input.oninput = () => {
      const key = input.dataset.gameRange;
      state[key] = Number(input.value);
      const valueEl = input.parentElement?.querySelector('em');
      if (valueEl) valueEl.textContent = key === 'scale' ? Number(input.value).toFixed(2) : input.value;
      scheduleSave();
      refreshAll({ save: false });
    };
  });

  panel.querySelectorAll('[data-game-visible]').forEach(input => {
    input.onchange = () => {
      state.visible = !!input.checked;
      saveState();
      refreshAll({ save: false });
    };
  });

  panel.querySelectorAll('[data-game-ext]').forEach(input => {
    input.onchange = async () => {
      const key = input.dataset.gameExt;
      const ext = getExtensionSettings();
      ext[key] = !!input.checked;
      saveExtensionSettings();
      if (key === 'blinkEnabled') {
        if (input.checked) syncBlinkRuntime();
        else { clearBlinkTimers(); clearBlinkResumeTimer(); blinkRuntime.frame = 0; refreshBlinkVisuals(); }
      }
      if (key === 'aiStateEnabled') {
        if (input.checked) {
          syncAiStatePrompt();
          await handleAiStateMessage();
        } else {
          inlineStatusCardEligible = false;
          clearInlineStatusDollMounts();
          clearAiStatePrompt();
        }
      }
      if (key === 'aiWardrobeGenerationEnabled') {
        lastAiPromptValue = null;
        syncAiStatePrompt({ force: true, source: 'setting' });
      }
      renderExtensionSettingsPanel();
    };
  });

  panel.querySelectorAll('[data-plan-select]').forEach(select => {
    select.onchange = () => {
      state.currentPlanId = select.value || null;
      const plan = getCurrentPlan();
      if (plan) applyPlanSnapshot(plan.snapshot);
      saveState();
      renderDialogBody();
      refreshAll();
    };
  });

  panel.querySelectorAll('[data-expression-action]').forEach(btn => {
    btn.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      const action = btn.dataset.expressionAction;
      const id = btn.dataset.expressionId;
      if (action === 'new') {
        state.expressionEditorOpen = true;
        state.editingExpressionId = null;
        renderDialogBody();
        return;
      }
      if (action === 'edit') {
        state.expressionEditorOpen = true;
        state.editingExpressionId = id;
        renderDialogBody();
        return;
      }
      if (action === 'cancel') {
        state.expressionEditorOpen = false;
        state.editingExpressionId = null;
        renderDialogBody();
        return;
      }
      if (action === 'save') {
        saveExpressionFromEditor(panel);
        return;
      }
      if (action === 'apply') {
        applyExpressionPreset(id);
        renderDialogBody();
        return;
      }
      if (action === 'delete') {
        const preset = getExpressionPreset(id);
        if (!preset || !ST_WIN.confirm(`删除状态「${preset.name}」？`)) return;
        state.expressionPresets = state.expressionPresets.filter(item => item.id !== id);
        if (state.currentExpressionId === id) state.currentExpressionId = null;
        if (state.editingExpressionId === id) {
          state.editingExpressionId = null;
          state.expressionEditorOpen = false;
        }
        saveState();
        renderDialogBody();
      }
    };
  });

  panel.querySelectorAll('[data-plan-action]').forEach(btn => {
    btn.onclick = () => {
      const action = btn.dataset.planAction;
      if (action === 'saveNew') saveAsNewPlan();
      if (action === 'overwrite') overwriteCurrentPlan();
      if (action === 'load') loadCurrentPlan();
      if (action === 'delete') deleteCurrentPlan();
      if (action === 'bind') bindCurrentPlanToUser();
      if (action === 'unbind') unbindCurrentUser();
      renderDialogBody();
      refreshAll();
    };
  });

  panel.querySelectorAll('[data-group]').forEach(btn => {
    btn.onclick = () => {
      state.activeGroup = btn.dataset.group;
      const first = groupedLayers(state.activeGroup)[0];
      if (first) state.activeLayer = first.key;
      state.importMenuLayer = null;
      resetPanelPageScroll(panel);
      saveState();
      renderDialogBody();
    };
  });

  panel.querySelectorAll('[data-layer]').forEach(btn => {
    btn.onclick = () => {
      state.activeLayer = btn.dataset.layer;
      state.importMenuLayer = null;
      resetPanelPageScroll(panel);
      saveState();
      renderDialogBody();
    };
  });

  panel.querySelectorAll('[data-mode]').forEach(btn => {
    btn.onclick = () => {
      const mode = btn.dataset.mode;
      const value = btn.dataset.value;
      if (mode === 'eyebrow') state.layerModes.eyebrow = value;
      if (mode === 'braid_left') state.layerModes.braid_left = value;
      if (mode === 'braid_right') state.layerModes.braid_right = value;
      if (mode === 'outfitOrder') state.layerModes.outfitOrder = value;
      saveState();
      renderDialogBody();
      refreshAll();
    };
  });

  panel.querySelectorAll('[data-color-scope]').forEach(select => {
    select.onchange = () => {
      const item = getSelectedAsset(state.activeLayer);
      setActiveColorScope(state.activeLayer, item, select.value || 'whole');
      renderDialogBody();
    };
  });

  panel.querySelectorAll('[data-scope-color]').forEach(input => {
    input.oninput = () => {
      const settings = writableColorScopeSettings();
      settings.colorHex = input.value || COLOR_DEFAULTS.colorHex;
      scheduleSave();
      refreshPreviewAndMain({ mode: 'color', layerKeys: [state.activeLayer] });
    };
    input.onchange = () => renderDialogBody();
  });

  panel.querySelectorAll('[data-scope-range]').forEach(input => {
    input.oninput = () => {
      const settings = writableColorScopeSettings();
      const key = input.dataset.scopeRange;
      settings[key] = Number(input.value);
      const valueEl = input.parentElement?.querySelector('span');
      if (valueEl) valueEl.textContent = input.value;
      scheduleSave();
      refreshPreviewAndMain({ mode: 'color', layerKeys: [state.activeLayer] });
    };
  });

  panel.querySelectorAll('[data-scope-checkbox]').forEach(input => {
    input.onchange = () => {
      const settings = writableColorScopeSettings();
      settings[input.dataset.scopeCheckbox] = !!input.checked;
      scheduleSave();
      refreshPreviewAndMain({ mode: 'color', layerKeys: [state.activeLayer] });
    };
  });

  panel.querySelectorAll('[data-scope-reset]').forEach(button => {
    button.onclick = () => {
      const context = currentColorScopeContext();
      if (context.region) delete state.dyeSettings[dyeSettingKey(context.item, context.region)];
      else Object.assign(context.layer, COLOR_DEFAULTS);
      saveState();
      renderDialogBody();
      refreshPreviewAndMain({ mode: 'color', layerKeys: [state.activeLayer] });
    };
  });

  panel.querySelectorAll('[data-hair-follow]').forEach(btn => {
    btn.onclick = () => {
      const layer = currentLayerState();
      layer.followHairGroup = btn.dataset.hairFollow === 'on';
      saveState();
      renderDialogBody();
      refreshPreviewAndMain();
    };
  });

  panel.querySelectorAll('[data-hair-color-input]').forEach(input => {
    input.oninput = () => {
      state.hairGroupColor.colorHex = input.value || COLOR_DEFAULTS.colorHex;
      scheduleSave();
      refreshPreviewAndMain({ mode: 'color', layerKeys: getHairFollowerLayerKeys() });
    };
  });

  panel.querySelectorAll('[data-hair-range]').forEach(input => {
    input.oninput = () => {
      const key = input.dataset.hairRange;
      state.hairGroupColor[key] = Number(input.value);
      const valueEl = input.parentElement?.querySelector('span');
      if (valueEl) valueEl.textContent = input.value;
      scheduleSave();
      refreshPreviewAndMain({ mode: 'color', layerKeys: getHairFollowerLayerKeys() });
    };
  });

  panel.querySelectorAll('[data-hair-checkbox]').forEach(input => {
    input.onchange = () => {
      const key = input.dataset.hairCheckbox;
      state.hairGroupColor[key] = !!input.checked;
      scheduleSave();
      refreshPreviewAndMain({ mode: 'color', layerKeys: getHairFollowerLayerKeys() });
    };
  });

  panel.querySelectorAll('[data-toolbar]').forEach(btn => {
    btn.onclick = () => {
      const action = btn.dataset.toolbar;
      const layer = currentLayerState();
      if (action === 'plusImport') {
        state.importMenuLayer = state.importMenuLayer === state.activeLayer ? null : state.activeLayer;
        renderDialogBody();
        return;
      }
      if (action === 'cleanup') {
        state.visible = false;
        saveState();
        cleanup();
        return;
      }
      if (action === 'toggleVisible') layer.visible = !layer.visible;
      if (action === 'clearCurrent') { clearLinkedSelection(state.activeLayer, layer.selectedId); layer.selectedId = null; }
      if (action === 'show') state.visible = true;
      if (action === 'hide') state.visible = false;
      if (action === 'small') state.scale = Math.max(0.42, state.scale - 0.06);
      if (action === 'big') state.scale = Math.min(1.2, state.scale + 0.06);
      if (action === 'up') state.yOffset -= 6;
      if (action === 'down') state.yOffset += 6;
      if (action === 'trimPlus') state.bottomTrim += 2;
      if (action === 'trimMinus') state.bottomTrim -= 2;
      if (action === 'reset') { state.visible = true; state.stageSide = 'right'; state.scale = 1; state.yOffset = 0; state.bottomTrim = 0; }
      if (action === 'resetColor') { Object.assign(layer, COLOR_DEFAULTS); }
      if (action === 'resetHairColor') { Object.assign(state.hairGroupColor, COLOR_DEFAULTS); }
      saveState();
      renderDialogBody();
      refreshAll();
    };
  });

  panel.querySelectorAll('[data-stage-side]').forEach(btn => {
    btn.onclick = () => {
      state.stageSide = btn.dataset.stageSide === 'left' ? 'left' : 'right';
      saveState();
      renderDialogBody();
      refreshAll();
    };
  });

  panel.querySelectorAll('[data-import]').forEach(btn => {
    btn.onclick = () => {
      const type = btn.dataset.import;
      const layerKey = state.activeLayer;
      if (type === 'url') importFromUrl(layerKey);
      if (type === 'album') importFromAlbum(layerKey);
      if (type === 'cancel') { state.importMenuLayer = null; renderDialogBody(); }
    };
  });

  panel.querySelectorAll('[data-item-card]').forEach(card => {
    card.onclick = event => {
      if (event.target.closest('[data-action]')) return;
      const layer = state.layers[state.activeLayer];
      const id = card.dataset.itemCard;
      if (layer.selectedId === id) {
        clearLinkedSelection(state.activeLayer, id);
        layer.selectedId = null;
      } else {
        layer.selectedId = id;
        applyLinkedSelection(state.activeLayer, id);
      }
      delete state.wornWardrobeEntries[state.activeLayer];
      if (EXPRESSION_LAYER_KEYS.includes(state.activeLayer)) state.currentExpressionId = null;
      saveState();
      renderDialogBody();
      refreshAll();
    };
  });

  panel.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.onclick = event => {
      event.stopPropagation();
      deleteItemFromSlots(state.activeLayer, btn.dataset.itemId);
      if (EXPRESSION_LAYER_KEYS.includes(state.activeLayer)) state.currentExpressionId = null;
      saveState();
      renderDialogBody();
      refreshAll();
    };
  });
}


function handlePersonaEvent(...args) {
  if (stopIfScriptDisabled()) return;
  transientAiBaseline = null;
  lastAiPromptValue = null;
  runtimePersonaEventInfo = extractPersonaEventInfo(args);
  if (ST_WIN.__xjPaperdollPersonaTimer) ST_WIN.clearTimeout(ST_WIN.__xjPaperdollPersonaTimer);
  ST_WIN.__xjPaperdollPersonaTimer = ST_WIN.setTimeout(() => {
    ST_WIN.__xjPaperdollPersonaTimer = null;
    if (ST_WIN.__xjPaperdollDestroy !== cleanup || stopIfScriptDisabled()) return;
    applyBindingForCurrentPersona({ refreshPanel: false });
    if (!restoreSavedPlanBaseline()) {
      syncAiStatePrompt();
      refreshAll({ save: false });
      if (dialogEl()) renderDialogBody();
    }
  }, 120);
}

function registerPersonaWatcher() {
  if (stopIfScriptDisabled()) return false;
  const scriptModule = ST_MODULES.script || {};
  const ctx = getSTContext();
  const eventSource = scriptModule.eventSource || ctx?.eventSource;
  const eventTypes = scriptModule.event_types || ctx?.event_types || ctx?.eventTypes;
  const personaChanged = eventTypes?.PERSONA_CHANGED || 'PERSONA_CHANGED';
  if (!eventSource?.on || !personaChanged) return false;
  try {
    eventSource.on(personaChanged, handlePersonaEvent);
    ST_WIN.__xjPaperdollPersonaEventSource = eventSource;
    ST_WIN.__xjPaperdollPersonaEventType = personaChanged;
    ST_WIN.__xjPaperdollPersonaHandler = handlePersonaEvent;
    return true;
  } catch (err) {
    console.warn('[纸娃娃] PERSONA_CHANGED 监听失败：', err);
    return false;
  }
}

function createAiPromptPreset(name, template) {
  const cleanName = normalizeAiName(name);
  const nameError = validateAiName(cleanName);
  if (nameError) return { ok: false, error: nameError };
  if (getAiPromptPresets().some(preset => preset.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
    return { ok: false, error: `预设名「${cleanName}」已经存在。` };
  }
  const templateError = validateAiPromptTemplate(template);
  if (templateError) return { ok: false, error: templateError };
  const preset = {
    id: generateId(),
    name: cleanName,
    template: String(template),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  state.aiPromptPresets.push(preset);
  state.activeAiPromptPresetId = preset.id;
  lastAiPromptValue = null;
  saveState();
  renderExtensionSettingsPanel();
  return { ok: true, preset };
}

function promptPresetOptionsHtml(selectedId) {
  return getAiPromptPresets().map(preset => `
    <option value="${escapeHtml(preset.id)}" ${preset.id === selectedId ? 'selected' : ''}>${escapeHtml(preset.name)}${preset.builtin ? '（内置）' : ''}</option>`).join('');
}

function renderAiPromptEditor(selectedId = state.activeAiPromptPresetId) {
  const dialog = ST_DOC.querySelector('#xj-paperdoll-prompt-dialog');
  const body = dialog?.querySelector('#xj-pd-prompt-body');
  if (!body) return;
  const preset = getAiPromptPreset(selectedId) || getActiveAiPromptPreset();
  const isBuiltin = !!preset.builtin;
  body.innerHTML = `
    <div class="xj-pd-prompt-toolbar">
      <label>当前预设
        <select class="xj-pd-pixel-select" data-prompt-preset>${promptPresetOptionsHtml(preset.id)}</select>
      </label>
      <label>预设名称
        <input class="xj-pd-pixel-input" data-prompt-name value="${escapeHtml(preset.name)}" ${isBuiltin ? 'disabled' : ''} maxlength="40">
      </label>
    </div>
    <div class="xj-pd-prompt-runtime" data-ai-prompt-diagnostic>
      <div class="xj-pd-prompt-runtime-head">
        <b data-ai-prompt-status>检查中</b>
        <span data-ai-prompt-meta></span>
      </div>
      <p data-ai-prompt-detail></p>
      <p class="xj-pd-prompt-runtime-warning" data-ai-prompt-warning hidden></p>
      <button type="button" class="xj-pd-pixel-btn" data-prompt-action="reinject">重新注入并检查</button>
    </div>
    <textarea class="xj-pd-prompt-textarea" data-prompt-template spellcheck="false">${escapeHtml(preset.template)}</textarea>
    <div class="xj-pd-variable-bar">
      <span>插入变量</span>
      ${AI_PROMPT_VARIABLES.map(variable => `<button type="button" class="xj-pd-pixel-key" data-prompt-variable="${escapeHtml(variable.token)}">${escapeHtml(variable.label)}</button>`).join('')}
    </div>
    <div class="xj-pd-prompt-meta">
      <span data-prompt-count>${preset.template.length} 字符</span>
      <span data-prompt-validation></span>
    </div>
    <div class="xj-pd-prompt-actions">
      <button type="button" class="xj-pd-pixel-btn" data-prompt-action="new">新建</button>
      <button type="button" class="xj-pd-pixel-btn" data-prompt-action="saveAs">另存为</button>
      <button type="button" class="xj-pd-pixel-btn is-accent" data-prompt-action="save" ${isBuiltin ? 'disabled' : ''}>保存修改</button>
      <button type="button" class="xj-pd-pixel-btn" data-prompt-action="restore">载入系统默认</button>
      <button type="button" class="xj-pd-pixel-btn is-danger" data-prompt-action="delete" ${isBuiltin ? 'disabled' : ''}>删除预设</button>
    </div>
    <details class="xj-pd-prompt-preview-box">
      <summary>编辑内容预览（未保存）</summary>
      <pre data-prompt-preview></pre>
    </details>
    <details class="xj-pd-prompt-preview-box">
      <summary>独立的新衣服协议（${getExtensionSettings().aiWardrobeGenerationEnabled !== false ? '已启用' : '已关闭'}）</summary>
      <pre>${escapeHtml(renderAiPromptTemplate(AI_NEW_CLOTHES_PROMPT_TEMPLATE))}</pre>
    </details>
    <details class="xj-pd-prompt-preview-box">
      <summary>查看当前正式注入内容</summary>
      <pre data-prompt-actual-preview></pre>
    </details>`;

  const textarea = body.querySelector('[data-prompt-template]');
  const count = body.querySelector('[data-prompt-count]');
  const validation = body.querySelector('[data-prompt-validation]');
  const preview = body.querySelector('[data-prompt-preview]');
  const updateFeedback = () => {
    const value = textarea.value;
    const error = validateAiPromptTemplate(value);
    count.textContent = `${value.length} 字符`;
    validation.textContent = error || '格式有效';
    validation.classList.toggle('is-error', !!error);
    validation.classList.toggle('is-valid', !error);
    preview.textContent = renderAiPromptTemplate(value);
  };
  textarea.addEventListener('input', updateFeedback);
  updateFeedback();
  refreshAiPromptDiagnostics();

  body.querySelector('[data-prompt-preset]').onchange = event => {
    activateAiPromptPreset(event.target.value);
    renderExtensionSettingsPanel();
    renderAiPromptEditor(event.target.value);
  };

  body.querySelectorAll('[data-prompt-variable]').forEach(button => {
    button.onclick = () => {
      const token = button.dataset.promptVariable;
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? start;
      textarea.setRangeText(token, start, end, 'end');
      textarea.focus();
      updateFeedback();
    };
  });

  body.querySelectorAll('[data-prompt-action]').forEach(button => {
    button.onclick = () => {
      const action = button.dataset.promptAction;
      if (action === 'reinject') {
        syncAiStatePrompt({ force: true, source: 'manual' });
        refreshAiPromptDiagnostics();
        return;
      }
      if (action === 'restore') {
        textarea.value = DEFAULT_AI_PROMPT_TEMPLATE;
        updateFeedback();
        return;
      }
      if (action === 'new') {
        const name = ST_WIN.prompt('新预设名称', `自定义提示词${state.aiPromptPresets.length + 1}`);
        if (name === null) return;
        const result = createAiPromptPreset(name, DEFAULT_AI_PROMPT_TEMPLATE);
        if (!result.ok) return ST_WIN.alert(result.error);
        renderAiPromptEditor(result.preset.id);
        return;
      }
      if (action === 'saveAs') {
        const name = ST_WIN.prompt('另存为预设', `${preset.name}-副本`);
        if (name === null) return;
        const result = createAiPromptPreset(name, textarea.value);
        if (!result.ok) return ST_WIN.alert(result.error);
        renderAiPromptEditor(result.preset.id);
        return;
      }
      if (action === 'save') {
        const target = state.aiPromptPresets.find(item => item.id === preset.id);
        if (!target) return;
        const name = normalizeAiName(body.querySelector('[data-prompt-name]')?.value || '');
        const nameError = validateAiName(name);
        if (nameError) return ST_WIN.alert(nameError);
        const duplicate = getAiPromptPresets().find(item => item.id !== target.id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
        if (duplicate) return ST_WIN.alert(`预设名「${name}」已经存在。`);
        const templateError = validateAiPromptTemplate(textarea.value);
        if (templateError) return ST_WIN.alert(templateError);
        target.name = name;
        target.template = textarea.value;
        target.updatedAt = Date.now();
        state.activeAiPromptPresetId = target.id;
        lastAiPromptValue = null;
        saveState();
        renderExtensionSettingsPanel();
        renderAiPromptEditor(target.id);
        return;
      }
      if (action === 'delete') {
        if (preset.builtin || !ST_WIN.confirm(`删除提示词预设「${preset.name}」？`)) return;
        state.aiPromptPresets = state.aiPromptPresets.filter(item => item.id !== preset.id);
        activateAiPromptPreset(BUILTIN_AI_PROMPT_ID);
        renderExtensionSettingsPanel();
        renderAiPromptEditor(BUILTIN_AI_PROMPT_ID);
      }
    };
  });
}

function openAiPromptEditor() {
  ST_DOC.querySelector('#xj-paperdoll-prompt-dialog')?.remove();
  const dialog = ST_DOC.createElement('dialog');
  dialog.id = 'xj-paperdoll-prompt-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="xj-pd-prompt-card">
      <div class="xj-pd-prompt-head">
        <div><b>状态提示词工作台</b><span>变量会在每轮生成前替换为纸娃娃的实时数据</span></div>
        <button class="xj-pd-pixel-close" value="close" aria-label="关闭">×</button>
      </div>
      <div id="xj-pd-prompt-body"></div>
    </form>`;
  ST_DOC.body.appendChild(dialog);
  renderAiPromptEditor();
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
}

function openSettingsDialog() {
    if (stopIfScriptDisabled()) return;
    ST_DOC.querySelector('#xj-paperdoll-dialog')?.remove();
    const dialog = ST_DOC.createElement('dialog');
    dialog.id = 'xj-paperdoll-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="xj-pd-card">
        <div class="xj-pd-head">
          <div class="xj-pd-title-lockup"><span>PAPERDOLL ATELIER</span><b>纸娃娃衣橱</b></div>
          <em>v${VERSION.replace('-local-test', '')}</em>
          <button class="xj-pd-close" value="close">×</button>
        </div>
        <div id="xj-pd-panel-body"></div>
      </form>`;
    ST_DOC.body.appendChild(dialog);
    renderDialogBody();
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
  }

  function cleanup() {
    aiStateMessageSequence++;
    transientAiBaseline = null;
    inlineStatusCardEligible = false;
    try {
      const old = window.__xjPaperdollIframeUnloadCleanup;
      if (old) {
        window.removeEventListener('pagehide', old);
        window.removeEventListener('beforeunload', old);
        window.removeEventListener('unload', old);
      }
      window.__xjPaperdollIframeUnloadCleanup = null;
    } catch (_) {}
    try { if (saveTimer) ST_WIN.clearTimeout(saveTimer); saveTimer = null; } catch (_) {}
    try { colorRefreshRuntime.pendingKeys.clear(); colorRefreshRuntime.tokens.clear(); colorRefreshRuntime.raf = 0; } catch (_) {}
    try { if (ST_WIN.__xjPaperdollLayoutTimer) ST_WIN.clearTimeout(ST_WIN.__xjPaperdollLayoutTimer); ST_WIN.__xjPaperdollLayoutTimer = null; } catch (_) {}
    try { if (ST_WIN.__xjPaperdollSettingsTimer) ST_WIN.clearTimeout(ST_WIN.__xjPaperdollSettingsTimer); ST_WIN.__xjPaperdollSettingsTimer = null; } catch (_) {}
    try { if (ST_WIN.__xjPaperdollButtonTimer) ST_WIN.clearTimeout(ST_WIN.__xjPaperdollButtonTimer); ST_WIN.__xjPaperdollButtonTimer = null; } catch (_) {}
    try { if (ST_WIN.__xjPaperdollChatTimer) ST_WIN.clearTimeout(ST_WIN.__xjPaperdollChatTimer); ST_WIN.__xjPaperdollChatTimer = null; } catch (_) {}
    try { if (ST_WIN.__xjPaperdollPersonaTimer) ST_WIN.clearTimeout(ST_WIN.__xjPaperdollPersonaTimer); ST_WIN.__xjPaperdollPersonaTimer = null; } catch (_) {}
    try { if (inlineStatusRefreshTimer) ST_WIN.clearTimeout(inlineStatusRefreshTimer); inlineStatusRefreshTimer = null; } catch (_) {}
    try { clearInlineStatusDollMounts(); } catch (_) {}
    try {
      const inlineClickHandler = ST_WIN.__xjPaperdollInlineClickHandler;
      if (inlineClickHandler) ST_DOC.removeEventListener('click', inlineClickHandler, true);
      ST_WIN.__xjPaperdollInlineClickHandler = null;
    } catch (_) {}
    try { clearBlinkTimers(); clearBlinkResumeTimer(); } catch (_) {}
    try { clearAiStatePrompt(); } catch (_) {}
    try { revokePackRuntimeUrls(); } catch (_) {}
    try { processedImageCache.clear(); } catch (_) {}
    try {
      const src = ST_WIN.__xjPaperdollPersonaEventSource;
      const type = ST_WIN.__xjPaperdollPersonaEventType;
      const handler = ST_WIN.__xjPaperdollPersonaHandler;
      if (src && type && handler) {
        if (typeof src.removeListener === 'function') src.removeListener(type, handler);
        else if (typeof src.off === 'function') src.off(type, handler);
      }
      ST_WIN.__xjPaperdollPersonaEventSource = null;
      ST_WIN.__xjPaperdollPersonaEventType = null;
      ST_WIN.__xjPaperdollPersonaHandler = null;
    } catch (_) {}
    try {
      const src = ST_WIN.__xjPaperdollAiEventSource;
      const messageTypes = [
        ...(ST_WIN.__xjPaperdollAiMessageTypes || []),
        ST_WIN.__xjPaperdollAiMessageType,
      ].filter((value, index, list) => value && list.indexOf(value) === index);
      const inlineTypes = ST_WIN.__xjPaperdollInlineEventTypes || [];
      const chatType = ST_WIN.__xjPaperdollAiChatType;
      const generationType = ST_WIN.__xjPaperdollAiGenerationType;
      const fallbackSendType = ST_WIN.__xjPaperdollAiFallbackSendType;
      const handler = ST_WIN.__xjPaperdollAiHandler;
      const inlineHandler = ST_WIN.__xjPaperdollInlineHandler;
      const chatHandler = ST_WIN.__xjPaperdollAiChatHandler;
      const generationHandler = ST_WIN.__xjPaperdollAiGenerationHandler;
      messageTypes.forEach(type => {
        if (!src || !type || !handler) return;
        if (typeof src.removeListener === 'function') src.removeListener(type, handler);
        else if (typeof src.off === 'function') src.off(type, handler);
      });
      inlineTypes.forEach(type => {
        if (!src || !type || !inlineHandler) return;
        if (typeof src.removeListener === 'function') src.removeListener(type, inlineHandler);
        else if (typeof src.off === 'function') src.off(type, inlineHandler);
      });
      if (src && chatType && chatHandler) {
        if (typeof src.removeListener === 'function') src.removeListener(chatType, chatHandler);
        else if (typeof src.off === 'function') src.off(chatType, chatHandler);
      }
      if (src && generationType && generationHandler) {
        if (typeof src.removeListener === 'function') src.removeListener(generationType, generationHandler);
        else if (typeof src.off === 'function') src.off(generationType, generationHandler);
      }
      if (src && fallbackSendType && fallbackSendType !== generationType && generationHandler) {
        if (typeof src.removeListener === 'function') src.removeListener(fallbackSendType, generationHandler);
        else if (typeof src.off === 'function') src.off(fallbackSendType, generationHandler);
      }
      ST_WIN.__xjPaperdollAiEventSource = null;
      ST_WIN.__xjPaperdollAiMessageTypes = null;
      ST_WIN.__xjPaperdollAiMessageType = null;
      ST_WIN.__xjPaperdollInlineEventTypes = null;
      ST_WIN.__xjPaperdollAiChatType = null;
      ST_WIN.__xjPaperdollAiGenerationType = null;
      ST_WIN.__xjPaperdollAiFallbackSendType = null;
      ST_WIN.__xjPaperdollAiHandler = null;
      ST_WIN.__xjPaperdollInlineHandler = null;
      ST_WIN.__xjPaperdollAiChatHandler = null;
      ST_WIN.__xjPaperdollAiGenerationHandler = null;
    } catch (_) {}
    try {
      const resizeHandler = ST_WIN.__xjPaperdollResizeHandler;
      if (resizeHandler) ST_WIN.removeEventListener('resize', resizeHandler);
      const orientationHandler = ST_WIN.__xjPaperdollOrientationHandler;
      if (orientationHandler) ST_WIN.removeEventListener('orientationchange', orientationHandler);
      ST_WIN.__xjPaperdollResizeHandler = null;
      ST_WIN.__xjPaperdollOrientationHandler = null;
    } catch (_) {}
    ST_DOC.querySelector('#xj-paperdoll-dialog')?.remove();
    ST_DOC.querySelector('#xj-paperdoll-prompt-dialog')?.remove();
    ST_DOC.querySelector('#xj-paperdoll-stage-main')?.remove();
    ST_DOC.querySelector('#st-paperdoll-open-button')?.remove();
    if (ST_WIN.__xjPaperdollDestroy === cleanup) ST_WIN.__xjPaperdollDestroy = null;
  }

  function registerWindowEvents() {
    if (stopIfScriptDisabled()) return;
    try {
      const oldResize = ST_WIN.__xjPaperdollResizeHandler;
      if (oldResize) ST_WIN.removeEventListener('resize', oldResize);
      const oldOrientation = ST_WIN.__xjPaperdollOrientationHandler;
      if (oldOrientation) ST_WIN.removeEventListener('orientationchange', oldOrientation);
      if (ST_WIN.__xjPaperdollLayoutTimer) ST_WIN.clearTimeout(ST_WIN.__xjPaperdollLayoutTimer);
    } catch (_) {}
    const scheduleLayout = (delay = 220) => {
      try { if (ST_WIN.__xjPaperdollLayoutTimer) ST_WIN.clearTimeout(ST_WIN.__xjPaperdollLayoutTimer); } catch (_) {}
      ST_WIN.__xjPaperdollLayoutTimer = ST_WIN.setTimeout(() => {
        ST_WIN.__xjPaperdollLayoutTimer = null;
        if (stopIfScriptDisabled()) return;
        bindButton();
        refreshAll({ save: false });
      }, delay);
    };
    const resizeHandler = () => scheduleLayout(220);
    const orientationHandler = () => scheduleLayout(320);
    ST_WIN.__xjPaperdollResizeHandler = resizeHandler;
    ST_WIN.__xjPaperdollOrientationHandler = orientationHandler;
    ST_WIN.addEventListener('resize', resizeHandler);
    ST_WIN.addEventListener('orientationchange', orientationHandler);
  }


  function ensureExtensionSettingsPanel(retryCount = 0) {
    const parent = ST_DOC.querySelector('#extensions_settings2') || ST_DOC.querySelector('#extensions_settings');
    if (!parent) {
      if (retryCount < 12) {
        ST_WIN.__xjPaperdollSettingsTimer = ST_WIN.setTimeout(() => {
          ST_WIN.__xjPaperdollSettingsTimer = null;
          if (ST_WIN.__xjPaperdollDestroy !== cleanup) return;
          ensureExtensionSettingsPanel(retryCount + 1);
        }, 800);
      } else {
        console.warn('[纸娃娃] 未找到扩展设置容器，已停止重试。');
      }
      return;
    }
    if (!ST_DOC.querySelector('#st-paperdoll-settings')) {
      const box = ST_DOC.createElement('div');
      box.id = 'st-paperdoll-settings';
      box.className = 'stpd-settings';
      parent.appendChild(box);
    }
    renderExtensionSettingsPanel();
  }

  function renderExtensionSettingsPanel() {
    const box = ST_DOC.querySelector('#st-paperdoll-settings');
    if (!box) return;
    const ext = getExtensionSettings();
    const promptStatus = getAiPromptStatusView();
    box.innerHTML = `
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>纸娃娃换装</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <label class="checkbox_label"><input type="checkbox" data-stpd-ext="enabled" ${ext.enabled !== false ? 'checked' : ''}> 启用纸娃娃</label>
          <label class="checkbox_label"><input type="checkbox" data-stpd-ext="showButton" ${ext.showButton !== false ? 'checked' : ''}> 显示底栏衣服按钮</label>
          <label class="checkbox_label"><input type="checkbox" data-stpd-state="visible" ${state.visible !== false ? 'checked' : ''}> 显示特写</label>
          <label class="checkbox_label"><input type="checkbox" data-stpd-ext="blinkEnabled" ${ext.blinkEnabled !== false ? 'checked' : ''}> 启用眨眼</label>
          <label class="checkbox_label"><input type="checkbox" data-stpd-ext="aiStateEnabled" ${ext.aiStateEnabled !== false ? 'checked' : ''}> 启用剧情状态与自动换装</label>
          <label class="checkbox_label"><input type="checkbox" data-stpd-ext="aiWardrobeGenerationEnabled" ${ext.aiWardrobeGenerationEnabled !== false ? 'checked' : ''}> 允许剧情新增配色款</label>

          <div class="stpd-prompt-entry">
            <label class="stpd-select-line">状态提示词
              <select data-stpd-prompt-preset>${promptPresetOptionsHtml(state.activeAiPromptPresetId)}</select>
            </label>
            <div class="stpd-actions">
              <button type="button" class="menu_button" data-stpd-action="editPrompt">编辑提示词</button>
              <button type="button" class="menu_button" data-stpd-action="defaultPrompt">使用系统默认</button>
            </div>
            <div class="stpd-prompt-status is-${escapeHtml(promptStatus.tone)}" data-ai-prompt-diagnostic>
              <div><b data-ai-prompt-status>${escapeHtml(promptStatus.title)}</b><span data-ai-prompt-meta>${escapeHtml(promptStatus.meta)}</span></div>
              <small data-ai-prompt-detail>${escapeHtml(promptStatus.detail)}</small>
              <small class="stpd-prompt-warning" data-ai-prompt-warning ${promptStatus.warning ? '' : 'hidden'}>${escapeHtml(promptStatus.warning)}</small>
              <button type="button" class="menu_button" data-stpd-action="reinjectPrompt">重新注入并检查</button>
            </div>
          </div>

          <div class="stpd-prompt-entry">
            <div class="stpd-prompt-status is-${statusRegexRuntime.status === 'error' ? 'error' : statusRegexRuntime.status === 'ready' ? 'ok' : 'warning'}">
              <div><b>❃ 配套状态栏</b><span>${escapeHtml(statusRegexRuntime.status === 'ready' ? '已同步' : statusRegexRuntime.status === 'error' ? '同步失败' : '等待同步')}</span></div>
              <small>${escapeHtml(statusRegexRuntime.message)}</small>
              <button type="button" class="menu_button" data-stpd-action="resyncStatusRegex">重新同步状态栏正则</button>
            </div>
          </div>

          <div class="stpd-row"><span>特写大小</span><input type="range" min="0.42" max="1.2" step="0.02" value="${Number(state.scale || 0.72)}" data-stpd-state-range="scale"><em>${Number(state.scale || 0.72).toFixed(2)}</em></div>
          <div class="stpd-row"><span>上下位置</span><input type="range" min="-160" max="160" step="2" value="${Number(state.yOffset || 0)}" data-stpd-state-range="yOffset"><em>${Number(state.yOffset || 0)}</em></div>
          <div class="stpd-row"><span>底部裁切</span><input type="range" min="-80" max="80" step="2" value="${Number(state.bottomTrim || 0)}" data-stpd-state-range="bottomTrim"><em>${Number(state.bottomTrim || 0)}</em></div>

          <label class="stpd-select-line">默认打开分组
            <select data-stpd-ext-select="defaultGroup">
              ${GROUPS.map(group => `<option value="${escapeHtml(group)}" ${ext.defaultGroup === group ? 'selected' : ''}>${escapeHtml(group)}</option>`).join('')}
            </select>
          </label>
          <small>后发、辫子/马尾的身前身后位置，放在更衣室对应栏目里调整。</small>
          <div class="stpd-actions">
            <button type="button" class="menu_button" data-stpd-action="openPanel">打开更衣室</button>
            <button type="button" class="menu_button" data-stpd-action="importPack">导入素材图包</button>
            <button type="button" class="menu_button" data-stpd-action="checkUpdate">检查更新</button>
            <button type="button" class="menu_button" data-stpd-action="cleanup">清理界面</button>
          </div>
        </div>
      </div>`;
    bindExtensionSettingsPanel(box);
  }

  async function checkAndUpdateFramework(button) {
    if (button.disabled) return;
    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = '正在检查…';
    try {
      const folder = new URL(EXTENSION_ROOT).pathname.split('/').filter(Boolean).pop();
      if (folder !== 'paperdoll-wardrobe') throw new Error('当前扩展不是从 paperdoll-wardrobe 仓库安装的。');

      const discovery = await ST_WIN.fetch('/api/extensions/discover');
      if (!discovery.ok) throw new Error('无法读取酒馆中的扩展列表。');
      const installed = (await discovery.json()).find(entry => entry.name === 'third-party/paperdoll-wardrobe');
      if (!installed || !['local', 'global'].includes(installed.type)) throw new Error('酒馆中找不到纸娃娃仓库版扩展。');

      const request = { extensionName: folder, global: installed.type === 'global' };
      const callEndpoint = async endpoint => {
        const response = await ST_WIN.fetch(`/api/extensions/${endpoint}`, {
          method: 'POST',
          headers: getRequestHeaders(),
          body: JSON.stringify(request),
        });
        if (!response.ok) {
          if (response.status === 403) throw new Error('当前账户没有更新此扩展的权限。');
          throw new Error(`酒馆更新接口返回错误（${response.status}）。`);
        }
        return response.json();
      };

      const version = await callEndpoint('version');
      const remote = String(version.remoteUrl || '').replace(/\.git\/?$/i, '').replace(/\/$/, '');
      if (remote !== 'https://github.com/gqing714-lang/paperdoll-wardrobe') {
        throw new Error('此扩展的 Git 仓库地址与纸娃娃正式仓库不一致，已停止更新。');
      }
      if (version.isUpToDate) {
        ST_WIN.alert(`纸娃娃换装 v${VERSION} 已是仓库最新版本。`);
        return;
      }

      button.textContent = '正在更新…';
      const result = await callEndpoint('update');
      if (result.isUpToDate) {
        ST_WIN.alert('纸娃娃换装已是仓库最新版本。');
      } else if (ST_WIN.confirm(`纸娃娃换装已更新到提交 ${result.shortCommitHash || '最新版本'}。现在刷新页面使更新生效吗？`)) {
        ST_WIN.location.reload();
      }
    } catch (error) {
      console.error('[纸娃娃] 更新失败：', error);
      ST_WIN.alert(`纸娃娃换装更新失败：${error.message || '请查看酒馆终端日志。'}`);
    } finally {
      button.disabled = false;
      button.textContent = previousText;
    }
  }

  function bindExtensionSettingsPanel(box) {
    box.querySelectorAll('[data-stpd-ext]').forEach(input => {
      input.onchange = async () => {
        const ext = getExtensionSettings();
        ext[input.dataset.stpdExt] = !!input.checked;
        saveExtensionSettings();
        if (input.dataset.stpdExt === 'enabled') {
          if (input.checked) await startPaperdoll();
          else cleanup();
        } else if (input.dataset.stpdExt === 'showButton') {
          if (input.checked) bindButton(); else ST_DOC.querySelector('#st-paperdoll-open-button')?.remove();
        } else if (input.dataset.stpdExt === 'blinkEnabled') {
          if (input.checked) syncBlinkRuntime(); else { clearBlinkTimers(); clearBlinkResumeTimer(); blinkRuntime.frame = 0; refreshBlinkVisuals(); }
        } else if (input.dataset.stpdExt === 'aiStateEnabled') {
          if (input.checked) {
            syncAiStatePrompt();
            await handleAiStateMessage();
          } else {
            inlineStatusCardEligible = false;
            clearInlineStatusDollMounts();
            clearAiStatePrompt();
          }
        } else if (input.dataset.stpdExt === 'aiWardrobeGenerationEnabled') {
          lastAiPromptValue = null;
          syncAiStatePrompt({ force: true, source: 'setting' });
        }
        renderExtensionSettingsPanel();
      };
    });
    box.querySelectorAll('[data-stpd-state]').forEach(input => {
      input.onchange = () => {
        state[input.dataset.stpdState] = !!input.checked;
        saveState();
        refreshAll();
        renderExtensionSettingsPanel();
      };
    });
    box.querySelectorAll('[data-stpd-state-range]').forEach(input => {
      input.oninput = () => {
        state[input.dataset.stpdStateRange] = Number(input.value);
        input.parentElement.querySelector('em').textContent = input.dataset.stpdStateRange === 'scale' ? Number(input.value).toFixed(2) : input.value;
        scheduleSave();
        refreshAll({ save: false });
      };
    });
    box.querySelectorAll('[data-stpd-ext-select]').forEach(select => {
      select.onchange = () => {
        const ext = getExtensionSettings();
        ext[select.dataset.stpdExtSelect] = select.value;
        state.activeGroup = select.value;
        state.activeLayer = groupedLayers(state.activeGroup)[0]?.key || state.activeLayer;
        saveExtensionSettings();
        saveState();
      };
    });
    box.querySelectorAll('[data-stpd-mode]').forEach(select => {
      select.onchange = () => {
        state.layerModes[select.dataset.stpdMode] = select.value;
        saveState();
        refreshAll();
        if (dialogEl()) renderDialogBody();
      };
    });
    box.querySelectorAll('[data-stpd-prompt-preset]').forEach(select => {
      select.onchange = () => {
        activateAiPromptPreset(select.value);
        renderExtensionSettingsPanel();
      };
    });
    box.querySelectorAll('[data-stpd-action]').forEach(btn => {
      btn.onclick = async () => {
        const action = btn.dataset.stpdAction;
        if (action === 'openPanel') openSettingsDialog();
        if (action === 'importPack') chooseAssetPackZip();
        if (action === 'editPrompt') openAiPromptEditor();
        if (action === 'reinjectPrompt') {
          syncAiStatePrompt({ force: true, source: 'manual' });
          renderExtensionSettingsPanel();
        }
        if (action === 'resyncStatusRegex') {
          ensureBundledStatusRegex();
          renderExtensionSettingsPanel();
        }
        if (action === 'defaultPrompt') {
          activateAiPromptPreset(BUILTIN_AI_PROMPT_ID);
          renderExtensionSettingsPanel();
        }
        if (action === 'cleanup') cleanup();
        if (action === 'checkUpdate') await checkAndUpdateFramework(btn);
      };
    });
  }

  function stripOriginalIds(root) {
    try {
      root.querySelectorAll?.('[id]').forEach(el => el.removeAttribute('id'));
    } catch (_) {}
  }

  function replaceFontAwesomeIcon(iconEl) {
    if (!iconEl?.classList) return;
    const keep = new Set([
      'fa', 'fas', 'far', 'fab', 'fa-solid', 'fa-regular', 'fa-brands',
      'fa-fw', 'fa-lg', 'fa-xl', 'fa-2x', 'interactable', 'menu_button'
    ]);
    Array.from(iconEl.classList).forEach(cls => {
      if (cls.startsWith('fa-') && !keep.has(cls)) iconEl.classList.remove(cls);
    });
    iconEl.classList.add('fa-solid', 'fa-shirt');
    iconEl.textContent = '';
  }

  function makeNativePaperdollButton(referenceButton) {
    const btn = referenceButton.cloneNode(true);
    stripOriginalIds(btn);
    btn.id = 'st-paperdoll-open-button';
    btn.classList?.remove('active', 'open', 'selected');

    const rootHasFa = Array.from(btn.classList || []).some(cls => cls === 'fa' || cls === 'fas' || cls === 'far' || cls === 'fab' || cls.startsWith('fa-'));
    const iconEl = rootHasFa ? btn : btn.querySelector?.('.fa, .fas, .far, .fab, .fa-solid, .fa-regular, .fa-brands, [class*="fa-"]');
    if (iconEl) {
      replaceFontAwesomeIcon(iconEl);
    } else {
      const icon = ST_DOC.createElement('i');
      icon.className = 'fa-solid fa-shirt';
      btn.textContent = '';
      btn.appendChild(icon);
    }

    btn.title = '纸娃娃换装';
    btn.setAttribute('aria-label', '纸娃娃换装');
    btn.setAttribute('role', 'button');
    btn.tabIndex = 0;
    btn.removeAttribute('data-i18n');
    btn.removeAttribute('data-toggle');
    btn.removeAttribute('aria-expanded');
    btn.removeAttribute('aria-controls');
    btn.removeAttribute('data-toggle-state');
    btn.removeAttribute('data-tooltip');
    return btn;
  }

  function getSendFormRoot() {
    return ST_DOC.querySelector('#send_form') || ST_DOC.querySelector('#send_form_wrapper') || ST_DOC.querySelector('#form_sheld');
  }

  function findBottomOptionsButton() {
    const sendRoot = getSendFormRoot();
    const optionsButton = ST_DOC.querySelector('#options_button');
    if (!sendRoot || !optionsButton || !sendRoot.contains(optionsButton)) return null;
    return optionsButton;
  }

  function insertAfterAnchor(anchor, btn) {
    if (!anchor?.parentNode) return false;
    anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    return true;
  }

  function bindButton(retryCount = 0) {
    if (stopIfScriptDisabled()) return;
    ST_DOC.querySelector('#st-paperdoll-open-button')?.remove();
    if (getExtensionSettings().showButton === false) return;

    const optionsButton = findBottomOptionsButton();
    if (!optionsButton?.parentElement) {
      if (retryCount < 8) {
        ST_WIN.__xjPaperdollButtonTimer = ST_WIN.setTimeout(() => {
          ST_WIN.__xjPaperdollButtonTimer = null;
          if (ST_WIN.__xjPaperdollDestroy === cleanup) bindButton(retryCount + 1);
        }, 600);
      } else {
        console.warn('[纸娃娃换装] 未在输入栏底部区域找到 #options_button，已放弃插入入口，避免错插到第一位。');
      }
      return;
    }

    const btn = makeNativePaperdollButton(optionsButton);
    const open = event => {
      event.preventDefault();
      event.stopPropagation();
      openSettingsDialog();
    };
    btn.addEventListener('click', open);
    btn.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') open(event);
    });

    insertAfterAnchor(optionsButton, btn);
  }

  async function startPaperdoll() {
    if (ST_WIN.__xjPaperdollDestroy === cleanup && ST_WIN.__xjPaperdollVersion === VERSION) {
      ensureBundledStatusRegex();
      scheduleInlineStatusRefresh(0);
      return;
    }
    const previousCleanup = ST_WIN.__xjPaperdollDestroy;
    if (typeof previousCleanup === 'function' && previousCleanup !== cleanup) {
      try { previousCleanup(); } catch (error) { console.warn('[纸娃娃] 旧版本运行时清理失败：', error); }
    }
    transientAiBaseline = null;
    await initSTModules();
    cleanup();
    ST_WIN.__xjPaperdollDestroy = cleanup;
    ST_WIN.__xjPaperdollVersion = VERSION;
    registerIframeLifecycleCleanup();
    ensureExtensionSettingsPanel();
    ensureBundledStatusRegex();
    renderExtensionSettingsPanel();
    if (stopIfScriptDisabled()) return;
    await loadBundledAssets();
    await hydratePackAssets();
    bindButton();
    registerPersonaWatcher();
    registerAiStateWatcher();
    registerInlineStatusInteraction();
    registerWindowEvents();
    applyBindingForCurrentPersona({ silent: true });
    restoreSavedPlanBaseline();
    await handleAiStateMessage();
    syncBlinkRuntime();
    syncAiStatePrompt();
    refreshAll({ save: false });
    log(`纸娃娃换装扩展已加载 v${VERSION}`);
  }


  await startPaperdoll();

  ST_WIN.__stPaperdollWardrobe = {
    start: startPaperdoll,
    cleanup,
    openSettingsDialog,
    renderExtensionSettingsPanel,
    installAssetPackFile,
    exportCurrentBustGif,
    getSettings: getExtensionSettings,
    forceAiStatePrompt: () => syncAiStatePrompt({ force: true, source: 'public-api' }),
    getAiPromptDiagnostics: getAiPromptStatusView,
    refreshInlineStatusBars,
    ensureStatusRegex: ensureBundledStatusRegex,
    getStatusRegexRuntime: () => ({ ...statusRegexRuntime }),
  };
})();
