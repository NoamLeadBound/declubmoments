/* De Club landing (declubmoments.com): per-lead tracking + the WhatsApp form (Noam 2026-11-12, PLAN L1).
 * Built from TriVision's track.js + its WhatsApp form (clients/trivision/output/landing-v2/assets/js/).
 * Configure on <html>: data-page, data-endpoint (the n8n webhook of "De Club · Landing page tracking"),
 * data-fab="on" for the floating button.
 * The link carries ?t=<opaque token>, never a name, an email or a company.
 * A visit counts only after a human signal (scroll, pointer, touch, key): mail scanners and link previews open
 * links and never interact. Nothing is sent before that.
 * Every event carries the visit's running totals (active seconds, deepest scroll %), so the last event of a visit
 * is its summary. Events (EVERY one must be in the workflow's Parse allow-list, tracking/build_workflow.py):
 *   visit · scroll_30/50/90 · time_20/60/180 (active seconds) · form_seen · form_start · wa_click (+ what was typed) · leave
 * The form opens WhatsApp to De Club (wa.me/<data-wa>) with the message ready; the visitor presses send there.
 * What was typed travels only in the wa_click beacon's POST body, never in a URL of ours.
 * Tracking never breaks the page: every send is a fire-and-forget beacon inside try/catch.
 * ?lpdebug=1 also logs every event to the console (QA).
 */
(function () {
  var H = document.documentElement;
  var ENDPOINT = H.getAttribute('data-endpoint') || null;
  var PAGE = H.getAttribute('data-page') || 'events';
  var q = new URLSearchParams(location.search);
  var DEBUG = q.has('lpdebug');
  var token = (q.get('t') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || null;
  var sid = Math.random().toString(36).slice(2, 10);   // one page load = one visit
  var sent = {};
  var human = false;
  var active = 0;            // seconds visible with an interaction in the last 60 s
  var lastMove = 0;
  var maxScroll = 0;         // deepest point reached, % of the page
  var lastLeave = 0;

  function post(name, extra) {
    var body = { event: name, t: token, page: PAGE, sid: sid, active_s: active, scroll: maxScroll, extra: extra || null };
    if (DEBUG || !ENDPOINT) console.info('[lp-track]', JSON.stringify(body));
    if (!ENDPOINT) return;
    try { navigator.sendBeacon(ENDPOINT, new URLSearchParams({ d: JSON.stringify(body) })); } catch (e) { /* never break the page */ }
  }
  function once(name, extra) {
    if (!human || sent[name]) return;
    sent[name] = true;
    post(name, extra);
  }

  function scrollPct() {
    return Math.min(100, Math.round((H.scrollTop + innerHeight) / H.scrollHeight * 100));
  }
  function moved() {
    lastMove = Date.now();
    if (!human) { human = true; maxScroll = scrollPct(); once('visit'); }
  }
  ['scroll', 'pointerdown', 'pointermove', 'touchstart', 'keydown'].forEach(function (ev) {
    addEventListener(ev, moved, { passive: true });
  });

  addEventListener('scroll', function () {
    var p = scrollPct();
    if (p > maxScroll) maxScroll = p;
    if (maxScroll >= 30) once('scroll_30');
    if (maxScroll >= 50) once('scroll_50');
    if (maxScroll >= 90) once('scroll_90');
  }, { passive: true });

  setInterval(function () {
    if (!human || document.visibilityState !== 'visible' || Date.now() - lastMove > 60000) return;
    active += 1;
    if (active === 20) once('time_20');
    if (active === 60) once('time_60');
    if (active === 180) once('time_180');
  }, 1000);

  addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'hidden' || !human || Date.now() - lastLeave < 30000) return;
    lastLeave = Date.now();
    post('leave');
  });

  document.querySelectorAll('[data-sector]').forEach(function (el) { el.hidden = el.getAttribute('data-sector') !== q.get('s'); });

  // Every CTA ([data-book]) scrolls to the form.
  var form = document.getElementById('form');
  function toForm(e) {
    if (e) e.preventDefault();
    if (!form) return;
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setTimeout(function () { var f = form.querySelector('input,select'); if (f) f.focus({ preventScroll: true }); }, reduce ? 0 : 650);
  }
  document.querySelectorAll('[data-book]').forEach(function (a) { a.addEventListener('click', toForm); });

  // Floating button, phones and desktop, hidden once the form is on screen.
  if (H.getAttribute('data-fab') === 'on' && form) {
    var fab = document.createElement('a');
    fab.href = '#form';
    fab.className = 'lp-fab';
    fab.textContent = (window.DECLUB && DECLUB.COPY.cta) || 'לתאם סיור ואימון';
    fab.addEventListener('click', toForm);
    document.body.appendChild(fab);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { fab.classList.toggle('is-away', en[0].isIntersecting); }, { threshold: 0.15 }).observe(form);
    }
    addEventListener('scroll', function () { fab.classList.toggle('is-in', H.scrollTop > innerHeight * 0.6); }, { passive: true });
  }

  if (!form || !form.getAttribute('data-wa')) return;

  // The form: seen, started, sent to WhatsApp.
  var WA = form.getAttribute('data-wa');
  var go = form.querySelector('.lp-go');
  function val(n) { var f = form.elements[n]; return ((f && f.value) || '').trim(); }
  function typed() {
    return { name: val('name').slice(0, 80), role: val('role').slice(0, 80), company: val('company').slice(0, 80), size: val('size').slice(0, 80) };
  }
  function waHref() {
    var lines = ['שלום, אשמח לתאם סיור ואימון ב-De Club.', 'שם: ' + val('name')];
    if (val('role')) lines.push('תפקיד: ' + val('role'));
    lines.push('חברה: ' + val('company'));   // team size stays out of the message (Noam 2026-11-12); it reaches us in wa_click
    return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(lines.join('\n'));
  }
  function sync() { if (go) go.href = waHref(); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en, io) {
      if (en.some(function (x) { return x.isIntersecting; })) { once('form_seen'); if (sent.form_seen) io.disconnect(); }
    }, { threshold: 0.4 }).observe(form);
  }
  form.addEventListener('input', function () { sync(); once('form_start'); });
  form.addEventListener('change', sync);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = null;
    form.querySelectorAll('[required]').forEach(function (f) {
      var ok, mark = f;
      if (f.type === 'radio') {   // a chip group: one required radio per group, the group carries the mark
        ok = !!form.querySelector('[name="' + f.name + '"]:checked');
        mark = f.closest('[role="radiogroup"]') || f;
      } else {
        ok = f.value.trim() !== '';
      }
      mark.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok && !bad) bad = f;
    });
    if (bad) { bad.focus(); return; }
    moved();
    var href = waHref();
    if (go) go.href = href;
    once('wa_click', typed());
    form.classList.add('is-sent');
    var ok = form.querySelector('.lp-sent');
    if (ok) { ok.hidden = false; ok.focus({ preventScroll: true }); }
    window.open(href, '_blank', 'noopener');
  });
  if (go) go.addEventListener('click', function () { moved(); once('wa_click', typed()); });
  sync();
})();
