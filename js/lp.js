/* The landing page's form and (optional) visit tracking.
 * Form: name, role, company, phone -> one 'form_submit' event to data-endpoint (n8n alerts De Club's WhatsApp
 * group with the details), then a thank-you in place of the form. No WhatsApp hand-off (Yuval 18.11: a personal
 * approach must not land in customer service).
 * Tracking: only when <html> carries data-endpoint. Without it (this copy) nothing is sent anywhere;
 * add ?lpdebug=1 to the address to see the events in the browser console.
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
    fab.textContent = (window.DECLUB && DECLUB.COPY.cta) || 'לתאם סשן היכרות';
    fab.addEventListener('click', toForm);
    document.body.appendChild(fab);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { fab.classList.toggle('is-away', en[0].isIntersecting); }, { threshold: 0.15 }).observe(form);
    }
    addEventListener('scroll', function () { fab.classList.toggle('is-in', H.scrollTop > innerHeight * 0.6); }, { passive: true });
  }

  if (!form) return;

  // The form: seen, started, submitted.
  function val(n) { var f = form.elements[n]; return ((f && f.value) || '').trim(); }
  function typed() {
    return { name: val('name').slice(0, 80), role: val('role').slice(0, 80), company: val('company').slice(0, 80),
      phone: val('phone').slice(0, 40) };
  }
  // A phone is valid with 9 to 15 digits (05x, 03, +972, abroad); spaces, dashes and brackets are allowed.
  function phoneOk(v) { var d = v.replace(/\D/g, ''); return d.length >= 9 && d.length <= 15 && !/[^\d\s()+\-.]/.test(v); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en, io) {
      if (en.some(function (x) { return x.isIntersecting; })) { once('form_seen'); if (sent.form_seen) io.disconnect(); }
    }, { threshold: 0.4 }).observe(form);
  }
  form.addEventListener('input', function () { once('form_start'); });

  // The submit is the one event that must arrive: a beacon, and a keepalive fetch if the browser refuses the beacon.
  function send(extra) {
    var body = { event: 'form_submit', t: token, page: PAGE, sid: sid, active_s: active, scroll: maxScroll, extra: extra };
    if (DEBUG || !ENDPOINT) console.info('[lp-track]', JSON.stringify(body));
    if (!ENDPOINT) return;
    var data = new URLSearchParams({ d: JSON.stringify(body) });
    var ok = false;
    try { ok = navigator.sendBeacon(ENDPOINT, data); } catch (e) { ok = false; }
    if (!ok) {
      try { fetch(ENDPOINT, { method: 'POST', body: data, keepalive: true, mode: 'no-cors' }); } catch (e) { /* nothing left to try */ }
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sent.form_submit) return;
    var bad = null;
    form.querySelectorAll('[required]').forEach(function (f) {
      var ok = f.value.trim() !== '' && (f.name !== 'phone' || phoneOk(f.value.trim()));
      f.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok && !bad) bad = f;
    });
    if (bad) { bad.focus(); return; }
    moved();
    sent.form_submit = true;
    send(typed());
    form.classList.add('is-sent');
    var done = form.querySelector('.lp-sent');
    if (done) { done.hidden = false; done.focus({ preventScroll: true }); }
  });
})();
