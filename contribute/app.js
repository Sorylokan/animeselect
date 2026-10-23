import { LANGS, DEFAULT_LOCALE, createTranslator, loadLocale, pickLocale } from './i18n.js';
import { searchAnime, cleanSearch } from './anilist.js';
import { prepareIssue, repoConfigured } from './github.js';
import { MAX_ITEMS } from './config.js';
import { CRITERIA_LEVELS, SECTIONS as SEC, MOODS, MAX_MOODS } from './schema.js';
import { DRAFT_KEY, parseDraft, serializeDraft, isEmptyDraft } from './draft.js';

const $ = s => document.querySelector(s), LS = { g(k) { try { return localStorage.getItem(k) } catch { return null } }, s(k, v) { try { localStorage.setItem(k, v) } catch { } } };
if (LS.g('as-theme')) document.documentElement.dataset.theme = LS.g('as-theme');
// Escape all AniList and user text before inserting it as HTML.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- language ----------
let lang = DEFAULT_LOCALE, t = k => k;
const cache = {};
const messages = code => (cache[code] ??= loadLocale(code).catch(() => ({})));
async function setLanguage(code) {
    code = LANGS.includes(code) ? code : DEFAULT_LOCALE;
    const [active, fallback] = await Promise.all([messages(code), messages(DEFAULT_LOCALE)]);
    lang = code; t = createTranslator({ locale: code, messages: { [code]: active, [DEFAULT_LOCALE]: fallback } });
    LS.s('as-lang', code); chrome(); draw()
}

// sel: current anime, R: ratings, M: moods, Q: queue, after: final screen
let sel = null, R = {}, M = [], Q = [], after = null, query = '';
let results = [], search = { state: 'idle' }, searchRun = 0, searchTimer, searchAbort;
let sent = { url: '', body: '' };

const title = a => a.title;
const ini = a => a.title.split(/\s+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase() || a.title[0];
const poster = (a, c) => a.cover
    ? `<img class="poster ${c}" src="${esc(a.cover)}" alt="" loading="lazy" decoding="async">`
    : `<div class="poster ${c}" aria-hidden="true" style="background:hsl(${(a.id * 37) % 360} 38% 38%)">${esc(ini(a))}</div>`;
const fmt = a => [a.year, a.format && (t.has('fmt.' + a.format) ? t('fmt.' + a.format) : a.format.replaceAll('_', ' '))].filter(Boolean).join(', ');
const nR = r => Object.keys(r).length;
const entries = () => [...Q, ...(sel && nR(R) ? [{ a: sel, r: R, m: M }] : [])];
const pend = () => entries().length;

function rail() {
    const n = sel ? nR(R) : 0, tot = pend(), q = Q.length; let h = '';
    if (after) { $('#rail').innerHTML = ''; return }
    if (sel) h += `<div class="picked">${poster(sel, '')}<div><h2>${esc(title(sel))}</h2><p class="meta">${esc(fmt(sel))}</p><p class="whole-short">${t('whole.short')}</p><a class="lnk" href="https://anilist.co/anime/${sel.id}" target="_blank" rel="noopener noreferrer">AniList ↗</a><br><button class="lnk" data-a="change">${t('picked.change')}</button></div></div>`;
    if (q) h += `<section class="queue"><h3>${t('queue.title')} <span>(${q})</span></h3><ul>${Q.map((x, i) => `<li><span>${esc(title(x.a))}<small>${t.plural('crit.count', nR(x.r))}</small></span><button class="lnk" data-a="rm" data-i="${i}">${t('queue.remove')}</button></li>`).join('')}</ul></section>`;
    if (!sel && !q) h += `<section class="steps"><h3>${t('steps.title')}</h3><ol>${[1, 2, 3].map(i => `<li>${t('steps.' + i)}</li>`).join('')}</ol></section>`;
    else h += `<div class="bar"><div class="pips" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div><p class="mt">${sel ? t.plural('crit.count', n) : t.plural('queue.ready', tot)}</p><p class="hint">${sel && !n ? t('hint.none') : tot >= MAX_ITEMS ? t('hint.limit') : ''}</p>${sel ? `<button class="btn s" data-a="add" ${n && tot < MAX_ITEMS ? '' : 'disabled'}>${t('add.button')}</button>` : ''}<button class="btn p" data-a="send" ${tot ? '' : 'disabled'}>${t('send.one')}</button></div>`;
    h += `<button class="lnk" data-a="help" style="text-align:left">[?] ${t('crit.help')}</button>`; $('#rail').innerHTML = h
}
function row(k, i) {
    const r = R[k], c = 'criteria.' + k;
    return `<div class="row" data-k="${k}" data-d="${r?.c === 'm' ? 1 : 0}"><div class="rs"><div class="rt"><b>${i}. ${t(c + '.label')}</b><p>${t(c + '.desc')}</p></div><div class="rc"><label class="none"><input type="radio" name="r-${k}" data-lv="0" ${r ? '' : 'checked'}><span>${t('crit.none')}</span></label><span class="mw"><label class="dbt"><input type="checkbox" data-dbt="${k}" ${r ? '' : 'disabled'} ${r?.c === 'm' ? 'checked' : ''}><span>${t('crit.mixed')}</span></label><button type="button" class="q" data-a="tip" aria-label="?">[?]</button><span class="tip" role="tooltip">${t('crit.tip')}</span></span></div></div><div class="scale">${CRITERIA_LEVELS.map(j => `<label class="seg"><input type="radio" name="r-${k}" data-lv="${j}" ${r?.l === j ? 'checked' : ''}><span><b>${t(c + '.w' + j)}</b></span></label>`).join('')}</div></div>`
}

// ---------- search ----------
function status() {
    const s = search.state;
    if (s === 'loading') return t('search.loading');
    if (s === 'empty') return t('search.empty');
    if (s === 'done') return '';
    if (s === 'error') return search.code === 'limit' ? (search.seconds ? t('search.error.limit', { n: search.seconds }) : t('search.error.limitUnknown')) : t('search.error.' + search.code);
    return t('search.hint');
}
function res() {
    const wall = $('#wall'), st = $('#st'); if (!wall) return;
    st.textContent = status(); st.classList.toggle('err', search.state === 'error');
    $('#retry').hidden = search.state !== 'error';
    const taken = new Set(Q.map(x => x.a.id));
    wall.innerHTML = results.filter(a => !taken.has(a.id)).map(a => `<li><button class="res" data-a="pick" data-i="${a.id}">${poster(a, '')}<span><b>${esc(title(a))}</b><small>${esc(fmt(a))}</small>${a.sequels ? `<small>${t.plural('search.sequels', a.sequels)}</small>` : ''}</span></button></li>`).join('');
    wall.setAttribute('aria-busy', String(search.state === 'loading'))
}
async function runSearch() {
    searchAbort?.abort(); searchAbort = new AbortController(); // cancel previous search
    const run = ++searchRun, signal = searchAbort.signal, text = cleanSearch(query);
    if (text.length < 2) { results = []; search = { state: 'idle' }; res(); return }
    search = { state: 'loading' }; res();
    try {
        const list = await searchAnime(text, { signal });
        if (run !== searchRun) return; // outdated
        results = list; search = { state: list.length ? 'done' : 'empty' }
    } catch (error) {
        if (run !== searchRun || error.code === 'aborted') return;
        console.error('[AnimeSelect] AniList', error);
        search = { state: 'error', code: error.code || 'network', seconds: error.seconds }
    }
    res()
}

function main() {
    let h = '';
    const manual = sent.url ? `<a class="btn s" href="${esc(sent.url)}" target="_blank" rel="noopener noreferrer">${t('opened.manual')}</a>` : '';
    if (after === 'norepo') h = `<section class="after"><h2>${t('norepo.title')}</h2><p>${t('norepo.text')}</p><div class="act"><button class="btn s" data-a="back">${t('opened.back')}</button></div></section>`;
    else if (after === 'paste') h = `<section class="after"><h2>${t('paste.title')}</h2><p>${t('paste.text')}</p><div class="act"><button class="btn p" data-a="copyopen">${t('paste.open')}</button>${manual}<button class="btn s" data-a="back">${t('opened.back')}</button></div><p>${t('paste.manual')}</p><textarea class="paste" readonly rows="8">${esc(sent.body)}</textarea></section>`;
    else if (after) h = `<section class="after"><h2>${t('opened.title')}</h2><p>${after === 'opened' ? t('opened.link') : t('opened.paste')}</p>${after === 'opened2' ? `<div class="act"><button class="btn s" data-a="copy">${t('paste.again')}</button></div>` : ''}<div class="act"><button class="btn p" data-a="reset">${t('opened.again')}</button>${manual}<button class="btn s" data-a="back">${t('opened.back')}</button></div></section>`;
    else if (!sel) h = `<h1>${t('home.title')}</h1><p class="intro">${t('home.intro')}</p><aside class="whole"><b>${t('whole.title')}</b><p>${t('whole.text')}</p></aside><label class="lab" for="q">${t('home.label')}</label><input id="q" type="search" autocomplete="off" maxlength="80" placeholder="${esc(t('home.placeholder'))}" value="${esc(query)}"><p class="st" id="st" role="status" aria-live="polite"></p><button class="lnk" id="retry" data-a="retry" hidden>${t('search.retry')}</button><ul class="wall" id="wall"></ul><p class="credit">${t('search.credit')} <a class="lnk" href="https://anilist.co" target="_blank" rel="noopener noreferrer">AniList ↗</a></p>`;
    else {
        let n = 0; h = SEC.map(([id, keys], si) => {
            const items = keys.map(k => row(k, ++n)).join(''); let extra = '';
            if (si === 2) extra = `<div class="row"><div class="rs"><div class="rt"><b>${n + 1}. ${t('mood.title')}</b><p>${t('mood.desc')} ${t('mood.hint')} <b>${M.length ? t('mood.count', { n: M.length }) : ''}</b></p></div></div><div class="chips">${MOODS.map(id => `<label class="chip"><input type="checkbox" data-mood="${id}" ${M.includes(id) ? 'checked' : ''} ${M.length >= MAX_MOODS && !M.includes(id) ? 'disabled' : ''}><span>${t('mood.' + id)}</span></label>`).join('')}</div></div>`;
            return `<section class="sec"><div class="sh"><span>0${si + 1} —</span><h2>${t('section.' + id + '.title')}</h2></div><p class="sd">${t('section.' + id + '.desc')}</p><div class="sheet">${items}${extra}</div></section>`
        }).join('') + `<div class="more"><button class="btn p" data-a="send" ${pend() ? '' : 'disabled'}>${t('send.one')}</button></div>`
    }
    $('#main').innerHTML = h; if (!sel && !after) res()
}
function chrome() {
    document.documentElement.lang = lang; document.title = t('page.title');
    $('#nav').innerHTML = ['contribute', 'library', 'about'].map((x, i) => `<button class="${i ? '' : 'on'}">${t('nav.' + x)}</button>`).join('');
    $('#lg').innerHTML = LANGS.map(l => l === lang ? `<b data-l="${l}">${l.toUpperCase()}</b>` : `<span data-l="${l}">${l.toUpperCase()}</span>`).join(' ');
    $('#lg').setAttribute('aria-label', t('lang.label')); $('#th').setAttribute('aria-label', t('theme.label'));
    $('#dm-h').textContent = t('dialog.multi.title'); $('#dm-p').textContent = t('dialog.multi.text'); $('[data-a=dx]').textContent = t('dialog.cancel'); $('[data-a=dok]').textContent = t('dialog.ok'); $('#dh-h').textContent = t('help.title'); $('[data-a=hx]').textContent = t('dialog.close');
    $('#dh-b').innerHTML = [1, 2, 3].map(i => `<p>${t('help.p' + i)}</p>`).join('') + `<details><summary>${t('help.curious')}</summary><p style="margin-top:.5rem">${t('help.formula')}</p><p class="f">${t('help.example')}</p></details>`
}
// Keep keyboard focus across re-renders.
function focusKey(el) {
    if (!el || el === document.body) return null;
    if (el.id) return '#' + CSS.escape(el.id);
    for (const attr of ['data-mood', 'data-dbt']) if (el.hasAttribute(attr)) return `[${attr}="${CSS.escape(el.getAttribute(attr))}"]`;
    if (el.name && el.dataset.lv !== undefined) return `input[name="${CSS.escape(el.name)}"][data-lv="${el.dataset.lv}"]`;
    if (el.dataset.a) return `[data-a="${CSS.escape(el.dataset.a)}"]` + (el.dataset.i !== undefined ? `[data-i="${CSS.escape(el.dataset.i)}"]` : '') + (el.closest('#rail') ? ':is(#rail *)' : ':is(#main *)');
    return null;
}
function saveDraft() {
    try { isEmptyDraft({ sel, Q }) ? localStorage.removeItem(DRAFT_KEY) : localStorage.setItem(DRAFT_KEY, serializeDraft({ sel, R, M, Q })) } catch { }
}
const draw = () => {
    const key = focusKey(document.activeElement);
    rail(); main(); saveDraft();
    if (key) document.querySelector(key)?.focus({ preventScroll: true })
};
const reset = () => { sel = null; R = {}; M = [] };

// ---------- send ----------
async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true } catch { return false }
}
function send() {
    if (!repoConfigured()) { after = 'norepo'; draw(); scrollTo(0, 0); return }
    const issue = prepareIssue(entries());
    sent = { url: issue.url, body: issue.body };
    if (issue.prefilled) { window.open(issue.url, '_blank', 'noopener'); after = 'opened' }
    else after = 'paste'; // too long for a link
    draw(); scrollTo(0, 0)
}
async function copyAndOpen() {
    // No await before window.open: Safari blocks it.
    const copying = copy(sent.body);
    window.open(sent.url, '_blank', 'noopener');
    if (await copying) { after = 'opened2'; draw() }
    else { const area = $('.paste'); area?.focus(); area?.select() }
}

document.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); const op = document.querySelectorAll('.mw.open'); if (!b || b.dataset.a !== 'tip') op.forEach(x => x.classList.remove('open')); if (!b) return; const a = b.dataset.a;
    if (a === 'tip') b.parentNode.classList.toggle('open');
    else if (a === 'help') $('#dh').showModal(); else if (a === 'hx') $('#dh').close();
    else if (a === 'pick') { sel = results.find(x => x.id == b.dataset.i); R = {}; M = []; draw(); scrollTo(0, 0) }
    else if (a === 'change') { reset(); draw() }
    else if (a === 'retry') runSearch();
    else if (a === 'rm') { Q.splice(+b.dataset.i, 1); draw() }
    else if (a === 'add') $('#dm').showModal(); else if (a === 'dx') $('#dm').close();
    else if (a === 'dok') { Q.push({ a: sel, r: { ...R }, m: [...M] }); reset(); query = ''; results = []; search = { state: 'idle' }; $('#dm').close(); draw(); scrollTo(0, 0) }
    else if (a === 'send') send();
    else if (a === 'copyopen') copyAndOpen();
    else if (a === 'copy') copy(sent.body); else if (a === 'back') { after = null; draw() }
    else if (a === 'reset') { reset(); Q = []; query = ''; results = []; search = { state: 'idle' }; sent = { url: '', body: '' }; after = null; draw() }
});
document.addEventListener('change', e => {
    const i = e.target, row = i.closest('.row');
    if (i.dataset.lv !== undefined) { const k = row.dataset.k, l = +i.dataset.lv; if (!l) delete R[k]; else R[k] = { l, c: R[k]?.c || 'c' }; draw() }
    else if (i.dataset.dbt) { R[i.dataset.dbt].c = i.checked ? 'm' : 'c'; draw() }
    else if (i.dataset.mood) { const id = i.dataset.mood; M = i.checked ? [...M, id].slice(0, MAX_MOODS) : M.filter(x => x !== id); draw() }
});
document.addEventListener('input', e => { if (e.target.id === 'q') { query = e.target.value; clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 400) } });
$('#lg').onclick = e => { const picked = e.target.closest('[data-l]')?.dataset.l; setLanguage(picked && picked !== lang ? picked : LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]) };
$('#th').onclick = () => { const d = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches; const v = d ? 'light' : 'dark'; document.documentElement.dataset.theme = v; LS.s('as-theme', v) };
// Startup: restore draft, then language (saved, browser, or English).
{ const d = parseDraft(LS.g(DRAFT_KEY)); if (d) ({ sel, R, M, Q } = d) }
await setLanguage(pickLocale([LS.g('as-lang'), ...(navigator.languages ?? [navigator.language]), 'en']));
document.addEventListener('focusin', e => { if (e.target.matches?.('.paste')) e.target.select() });
