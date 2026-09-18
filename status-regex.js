import { extension_settings } from '/scripts/extensions.js';
import { saveSettingsDebounced } from '/script.js';

export const BUNDLED_STATUS_REGEX_ID = '8c785af4-357a-4e12-94ab-0d45f4f74f2a';
export const BUNDLED_STATUS_REGEX_NAME = '[纸娃娃] ❃ user状态栏';

const BUNDLED_STATUS_STYLE = `<style data-stpd-inline-style>
[data-stpd-status-version='5'] {
  --stpd-inline-fg: var(--SmartThemeBodyColor, #383838);
  --stpd-inline-muted: var(--SmartThemeEmColor, var(--SmartThemeBodyColor, #6d6d6d));
  --stpd-inline-accent: var(--SmartThemeQuoteColor, var(--SmartThemeEmColor, #657264));
  --stpd-inline-line: rgba(127, 127, 127, .28);
  --stpd-inline-faint: rgba(127, 127, 127, .12);
  --stpd-inline-accent-soft: rgba(127, 127, 127, .08);
  display: flex;
  justify-content: flex-end;
  width: 100%;
  margin: 14px 0 2px;
  color: var(--stpd-inline-fg);
  font: 11px/1.5 "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif;
  font-synthesis: none;
}

[data-stpd-status-version='5'],
[data-stpd-status-version='5'] * {
  box-sizing: border-box;
}

[data-stpd-status-version='5'] [data-stpd-ui='status'] {
  width: min(365px, 100%);
  max-width: 100%;
  margin: 0;
}

[data-stpd-status-version='5'] [data-stpd-ui='trigger'],
[data-stpd-status-version='5'] [data-stpd-ui='detail'] > summary {
  list-style: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

[data-stpd-status-version='5'] [data-stpd-ui='trigger'] {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 58px;
  height: 26px;
  margin-left: auto;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

[data-stpd-status-version='5'] [data-stpd-ui='trigger']::-webkit-details-marker,
[data-stpd-status-version='5'] [data-stpd-ui='detail'] > summary::-webkit-details-marker {
  display: none;
}

[data-stpd-status-version='5'] [data-stpd-ui='trigger']::before {
  content: "";
  width: 22px;
  height: 1px;
  margin-right: 7px;
  background: linear-gradient(90deg, transparent, var(--stpd-inline-line));
  transition: width .28s ease;
}

[data-stpd-status-version='5'] [data-stpd-ui='floret'] {
  display: inline-grid;
  width: 19px;
  height: 19px;
  place-items: center;
  color: var(--stpd-inline-accent);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 17px;
  line-height: 1;
  transition: transform .38s cubic-bezier(.22, .8, .24, 1), color .25s ease;
}

[data-stpd-status-version='5'] [data-stpd-ui='status'][open] > [data-stpd-ui='trigger']::before {
  width: 32px;
}

[data-stpd-status-version='5'] [data-stpd-ui='status'][open] > [data-stpd-ui='trigger'] [data-stpd-ui='floret'] {
  transform: rotate(45deg);
}

[data-stpd-status-version='5'] [data-stpd-ui='card'] {
  position: relative;
  display: none;
  grid-template-columns: 94px minmax(0, 1fr);
  grid-template-areas:
    "doll info"
    "detail detail";
  column-gap: 15px;
  width: 100%;
  padding: 12px 12px 10px;
  border-block: 1px solid var(--stpd-inline-line);
  background: linear-gradient(90deg, transparent 0, rgba(127, 127, 127, .055) 10%, rgba(127, 127, 127, .055) 90%, transparent 100%);
  isolation: isolate;
}

[data-stpd-status-version='5'] [data-stpd-ui='card']::before,
[data-stpd-status-version='5'] [data-stpd-ui='card']::after {
  content: "";
  position: absolute;
  z-index: -1;
  pointer-events: none;
}

[data-stpd-status-version='5'] [data-stpd-ui='card']::before {
  inset: 7px 0;
  background:
    linear-gradient(90deg, var(--stpd-inline-accent) 0 28px, transparent 28px) top left / 100% 1px no-repeat,
    linear-gradient(90deg, transparent calc(100% - 28px), var(--stpd-inline-accent) calc(100% - 28px)) bottom left / 100% 1px no-repeat;
  opacity: .58;
}

[data-stpd-status-version='5'] [data-stpd-ui='card']::after {
  inset: 0;
  background:
    radial-gradient(circle at 14% 48%, var(--stpd-inline-accent-soft), transparent 32%),
    repeating-linear-gradient(90deg, transparent 0 9px, rgba(127, 127, 127, .018) 9px 10px);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent);
}

[data-stpd-status-version='5'] [data-stpd-ui='status'][open] > [data-stpd-ui='card'] {
  display: grid;
  animation: stpd-inline-card-enter-v5 .34s cubic-bezier(.22, .8, .24, 1) both;
}

@keyframes stpd-inline-card-enter-v5 {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

[data-stpd-status-version='5'] [data-stpd-ui='doll-box'] {
  position: relative;
  grid-area: doll;
  display: grid;
  width: 94px;
  min-width: 0;
  height: 166px;
  place-items: end center;
  overflow: hidden;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

[data-stpd-status-version='5'] [data-stpd-ui='doll-box']::after {
  content: "";
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 18px;
  height: 1px;
  background: var(--stpd-inline-line);
}

[data-stpd-status-version='5'] [data-stpd-ui='doll-placeholder'] {
  z-index: 1;
  place-self: center;
  color: var(--stpd-inline-muted);
  font: 21px/1 Georgia, "Times New Roman", serif;
}

[data-stpd-status-version='5'] [data-stpd-inline-doll][data-stpd-live='true'] > [data-stpd-ui='doll-placeholder'] {
  display: none;
}

[data-stpd-status-version='5'] [data-stpd-inline-render] {
  z-index: 1;
  margin: 0;
  filter: none !important;
  box-shadow: none !important;
}

[data-stpd-status-version='5'] [data-stpd-ui='info'] {
  grid-area: info;
  min-width: 0;
  padding-top: 3px;
}

[data-stpd-status-version='5'] [data-stpd-ui='title'] {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  min-height: 22px;
  padding-bottom: 6px;
}

[data-stpd-status-version='5'] [data-stpd-ui='title-mark'] {
  width: 7px;
  height: 7px;
  border: 1px solid var(--stpd-inline-accent);
  transform: rotate(45deg);
}

[data-stpd-status-version='5'] [data-stpd-ui='title'] strong {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .17em;
}

[data-stpd-status-version='5'] [data-stpd-ui='title-user'] {
  justify-self: end;
  color: var(--stpd-inline-muted);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 7px;
  letter-spacing: .16em;
}

[data-stpd-status-version='5'] [data-stpd-ui='summary'] {
  position: relative;
  display: grid;
  gap: 0;
  padding-top: 3px;
}

[data-stpd-status-version='5'] [data-stpd-ui='summary']::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, var(--stpd-inline-line), transparent);
}

[data-stpd-status-version='5'] [data-stpd-ui='summary-row'] {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 7px;
  min-width: 0;
  padding: 5px 0 4px;
  border-bottom: 1px dotted var(--stpd-inline-faint);
}

[data-stpd-status-version='5'] [data-stpd-ui='key'] {
  color: var(--stpd-inline-muted);
  font-size: 9px;
  letter-spacing: .08em;
  white-space: nowrap;
}

[data-stpd-status-version='5'] [data-stpd-ui='value'] {
  min-width: 0;
  overflow: hidden;
  font-size: 10px;
  letter-spacing: .02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-stpd-status-version='5'] [data-stpd-ui='summary-note'] {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
  min-width: 0;
  padding-top: 6px;
  color: var(--stpd-inline-muted);
  font-size: 9px;
}

[data-stpd-status-version='5'] [data-stpd-ui='summary-note'] b {
  position: relative;
  max-width: 92px;
  padding: 1px 8px 2px;
  overflow: hidden;
  border: 1px solid var(--stpd-inline-faint);
  border-radius: 999px;
  background: var(--stpd-inline-accent-soft);
  color: var(--stpd-inline-fg);
  font-size: 9px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-stpd-status-version='5'] [data-stpd-ui='detail'] {
  grid-area: detail;
  min-width: 0;
  margin-top: 7px;
}

[data-stpd-status-version='5'] [data-stpd-ui='detail'] > summary {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: fit-content;
  margin-left: auto;
  padding: 4px 1px 1px 12px;
  color: var(--stpd-inline-muted);
  font-size: 8px;
  letter-spacing: .1em;
  cursor: pointer;
}

[data-stpd-status-version='5'] [data-stpd-ui='detail'] > summary::before {
  content: "❃";
  display: inline-block;
  margin-right: 6px;
  color: var(--stpd-inline-accent);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 12px;
  line-height: 1;
  transition: transform .35s ease;
}

[data-stpd-status-version='5'] [data-stpd-ui='detail'][open] > summary::before {
  transform: rotate(45deg);
}

[data-stpd-status-version='5'] [data-stpd-ui='detail-close'],
[data-stpd-status-version='5'] [data-stpd-ui='detail'][open] [data-stpd-ui='detail-open'] {
  display: none;
}

[data-stpd-status-version='5'] [data-stpd-ui='detail'][open] [data-stpd-ui='detail-close'] {
  display: inline;
}

[data-stpd-status-version='5'] [data-stpd-ui='detail-grid'] {
  position: relative;
  display: none;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 15px;
  margin-top: 7px;
  padding: 13px 2px 4px;
}

[data-stpd-status-version='5'] [data-stpd-ui='detail-grid']::before {
  content: "";
  position: absolute;
  top: 0;
  left: 4%;
  right: 4%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--stpd-inline-line), transparent);
}

[data-stpd-status-version='5'] [data-stpd-ui='detail'][open] > [data-stpd-ui='detail-grid'] {
  display: grid;
  animation: stpd-inline-detail-enter-v5 .3s ease both;
}

@keyframes stpd-inline-detail-enter-v5 {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

[data-stpd-status-version='5'] [data-stpd-ui='detail-row'] {
  display: grid;
  grid-template-columns: 43px minmax(0, 1fr);
  gap: 6px;
  min-width: 0;
  align-items: baseline;
  padding-bottom: 3px;
  border-bottom: 1px dotted var(--stpd-inline-faint);
}

[data-stpd-status-version='5'] [data-stpd-ui='detail-row'][data-stpd-wide] {
  grid-column: 1 / -1;
}

[data-stpd-status-version='5'] [data-stpd-ui='detail-row'] > span {
  color: var(--stpd-inline-muted);
  font-size: 8px;
  letter-spacing: .05em;
  white-space: nowrap;
}

[data-stpd-status-version='5'] [data-stpd-ui='detail-row'] > b {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--stpd-inline-fg);
  font-size: 9px;
  font-weight: 500;
}

@media (max-width: 350px) {
  [data-stpd-status-version='5'] [data-stpd-ui='card'] {
    grid-template-columns: 84px minmax(0, 1fr);
    column-gap: 11px;
    padding-inline: 9px;
  }
  [data-stpd-status-version='5'] [data-stpd-ui='doll-box'] {
    width: 84px;
    height: 151px;
  }
  [data-stpd-status-version='5'] [data-stpd-inline-render] {
    width: 82px !important;
    height: 146px !important;
  }
  [data-stpd-status-version='5'] [data-stpd-inline-render] > :first-child {
    transform: scale(.656) !important;
  }
  [data-stpd-status-version='5'] [data-stpd-ui='summary-row'] {
    grid-template-columns: 30px minmax(0, 1fr);
    gap: 5px;
  }
  [data-stpd-status-version='5'] [data-stpd-ui='detail-grid'] {
    gap-inline: 11px;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-stpd-status-version='5'] *,
  [data-stpd-status-version='5'] *::before,
  [data-stpd-status-version='5'] *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>`;

export const BUNDLED_STATUS_REGEX_RULE = Object.freeze({
  id: BUNDLED_STATUS_REGEX_ID,
  scriptName: BUNDLED_STATUS_REGEX_NAME,
  description: '将回复末尾的十一栏 <user状态> 显示为自带完整样式的纸娃娃 ❃ 横向状态栏（v0.2.27，兼容 SillyTavern 1.15）。',
  findRegex: String.raw`/(?:<新衣服>\s*[\s\S]*?\s*<\/新衣服>\s*)?<user状态>\s*头饰\s*[：:]\s*([^\r\n<]*)\s*颈饰\s*[：:]\s*([^\r\n<]*)\s*内衣\s*[：:]\s*([^\r\n<]*)\s*内裤\s*[：:]\s*([^\r\n<]*)\s*衣装\s*[：:]\s*([^\r\n<]*)\s*外搭\s*[：:]\s*([^\r\n<]*)\s*手饰\s*[：:]\s*([^\r\n<]*)\s*袜子\s*[：:]\s*([^\r\n<]*)\s*鞋子\s*[：:]\s*([^\r\n<]*)\s*其他配饰\s*[：:]\s*([^\r\n<]*)\s*表情\s*[：:]\s*([^\r\n<]*)\s*<\/user状态>/gi`,
  replaceString: `${BUNDLED_STATUS_STYLE}
<div data-stpd-status-version='5'>
  <details data-stpd-ui='status'>
    <summary data-stpd-ui='trigger' aria-label='展开 user 当前状态'>
      <span data-stpd-ui='floret' aria-hidden='true'>❃</span>
    </summary>
    <section data-stpd-ui='card' aria-label='user 衣着状态'>
      <div data-stpd-ui='doll-box' data-stpd-inline-doll aria-label='纸娃娃当前造型'>
        <span data-stpd-ui='doll-placeholder' aria-hidden='true'>❃</span>
      </div>
      <div data-stpd-ui='info'>
        <header data-stpd-ui='title'>
          <span data-stpd-ui='title-mark' aria-hidden='true'></span>
          <strong>衣着状态</strong>
          <span data-stpd-ui='title-user'>USER</span>
        </header>
        <div data-stpd-ui='summary'>
          <div data-stpd-ui='summary-row'><span data-stpd-ui='key'>衣装</span><span data-stpd-ui='value'>$5</span></div>
          <div data-stpd-ui='summary-row'><span data-stpd-ui='key'>外搭</span><span data-stpd-ui='value'>$6</span></div>
          <div data-stpd-ui='summary-row'><span data-stpd-ui='key'>足下</span><span data-stpd-ui='value'>$8 · $9</span></div>
          <div data-stpd-ui='summary-row'><span data-stpd-ui='key'>饰品</span><span data-stpd-ui='value'>$10</span></div>
          <div data-stpd-ui='summary-note'><span>表情</span><b>$11</b></div>
        </div>
      </div>
      <details data-stpd-ui='detail'>
        <summary><span data-stpd-ui='detail-open'>全部状态</span><span data-stpd-ui='detail-close'>收拢状态</span></summary>
        <div data-stpd-ui='detail-grid'>
          <div data-stpd-ui='detail-row'><span>头饰</span><b>$1</b></div>
          <div data-stpd-ui='detail-row'><span>颈饰</span><b>$2</b></div>
          <div data-stpd-ui='detail-row'><span>内衣</span><b>$3</b></div>
          <div data-stpd-ui='detail-row'><span>内裤</span><b>$4</b></div>
          <div data-stpd-ui='detail-row' data-stpd-wide><span>衣装</span><b>$5</b></div>
          <div data-stpd-ui='detail-row'><span>外搭</span><b>$6</b></div>
          <div data-stpd-ui='detail-row'><span>手饰</span><b>$7</b></div>
          <div data-stpd-ui='detail-row'><span>袜子</span><b>$8</b></div>
          <div data-stpd-ui='detail-row'><span>鞋子</span><b>$9</b></div>
          <div data-stpd-ui='detail-row' data-stpd-wide><span>其他配饰</span><b>$10</b></div>
          <div data-stpd-ui='detail-row'><span>表情</span><b>$11</b></div>
        </div>
      </details>
    </section>
  </details>
</div>`,
  trimStrings: [],
  placement: [2],
  disabled: false,
  markdownOnly: true,
  promptOnly: false,
  runOnEdit: true,
  substituteRegex: 0,
  minDepth: null,
  maxDepth: null,
});

export const statusRegexRuntime = {
  status: 'idle',
  message: '等待同步。',
  changed: false,
};

function cloneBundledStatusRegex(disabled) {
  return {
    ...BUNDLED_STATUS_REGEX_RULE,
    trimStrings: [...BUNDLED_STATUS_REGEX_RULE.trimStrings],
    placement: [...BUNDLED_STATUS_REGEX_RULE.placement],
    disabled,
  };
}

function isBundledStatusRegex(script) {
  return String(script?.id || '') === BUNDLED_STATUS_REGEX_ID
    || String(script?.scriptName || '') === BUNDLED_STATUS_REGEX_NAME;
}

export function ensureBundledStatusRegex() {
  try {
    if (!Array.isArray(extension_settings.regex)) extension_settings.regex = [];
    const existing = extension_settings.regex.find(script => String(script?.id || '') === BUNDLED_STATUS_REGEX_ID)
      || extension_settings.regex.find(script => String(script?.scriptName || '') === BUNDLED_STATUS_REGEX_NAME);
    const definition = cloneBundledStatusRegex(existing?.disabled === true);
    const remaining = extension_settings.regex.filter(script => !isBundledStatusRegex(script));
    const changed = extension_settings.regex.length !== remaining.length + 1
      || extension_settings.regex[extension_settings.regex.length - 1] !== existing
      || JSON.stringify(existing) !== JSON.stringify(definition);

    if (changed) {
      extension_settings.regex.splice(0, extension_settings.regex.length, ...remaining, definition);
      saveSettingsDebounced();
    }

    statusRegexRuntime.status = 'ready';
    statusRegexRuntime.changed = changed;
    statusRegexRuntime.message = changed ? '配套状态栏正则已自动同步。' : '配套状态栏正则已是最新版本。';
    console.log(`[纸娃娃] ${statusRegexRuntime.message}`);
    return { ok: true, changed, definition };
  } catch (error) {
    statusRegexRuntime.status = 'error';
    statusRegexRuntime.changed = false;
    statusRegexRuntime.message = `配套状态栏正则同步失败：${error?.message || error}`;
    console.warn('[纸娃娃] ' + statusRegexRuntime.message);
    return { ok: false, changed: false, error };
  }
}
