/* De Club landing: per-lead tracking + the visit form. Form mode of skills/client-landing-pages/scripts/track.js:
 * De Club has no calendar, so every CTA ([data-book]) scrolls to #form instead of opening Calendly.
 * Configure on <html>: data-page, data-endpoint (n8n webhook, stage 8; until then events go to the console),
 * data-accent, data-fab="on" for the floating button.
 * The link carries ?t=<opaque token>, never a name or an email. A visit counts only after a human signal
 * (scroll, pointer, touch, key, or 8 s visible), because mail scanners open links and do nothing.
 * Events: visit, scroll_30, scroll_50, scroll_90, form_opened, form_submitted. */
(function () {
  var H = document.documentElement;
  var ENDPOINT = H.getAttribute('data-endpoint') || null;
  var page = H.getAttribute('data-page') || 'unknown';
  var q = new URLSearchParams(location.search);
  var token = (q.get('t') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || null;
  var sent = {}, human = false, queue = [];

  function post(body) {
    if (!ENDPOINT) { console.info('[lp-track]', body); return; }
    try { navigator.sendBeacon(ENDPOINT, new URLSearchParams({ d: JSON.stringify(body) })); } catch (e) { /* never breaks the page */ }
  }
  function send(name, extra) {
    if (sent[name]) return;
    sent[name] = true;
    var body = { event: name, t: token, page: page, s: q.get('s'), at: new Date().toISOString(), extra: extra || null };
    if (!human && name !== 'visit') { queue.push(body); return; }
    post(body);
  }
  function becameHuman() {
    if (human) return;
    human = true;
    send('visit');
    queue.splice(0).forEach(function (b) { sent[b.event] = false; send(b.event, b.extra); });
  }
  ['scroll', 'pointerdown', 'pointermove', 'touchstart', 'keydown'].forEach(function (ev) {
    addEventListener(ev, becameHuman, { once: true, passive: true });
  });
  setTimeout(function () { if (document.visibilityState === 'visible') becameHuman(); }, 8000);
  addEventListener('scroll', function () {
    var p = (H.scrollTop + innerHeight) / H.scrollHeight;
    if (p > 0.3) send('scroll_30');
    if (p > 0.5) send('scroll_50');
    if (p > 0.9) send('scroll_90');
  }, { passive: true });

  document.querySelectorAll('[data-sector]').forEach(function (el) { el.hidden = el.getAttribute('data-sector') !== q.get('s'); });

  // Every CTA goes to the form.
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

  if (!form) return;
  form.addEventListener('focusin', function () { send('form_opened'); }, { once: true });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = null;
    form.querySelectorAll('[required]').forEach(function (f) {
      var ok, mark = f;
      if (f.type === 'radio') {   // a chip group: one required radio per group, the group carries the mark
        ok = !!form.querySelector('[name="' + f.name + '"]:checked');
        mark = f.closest('[role="radiogroup"]') || f;
      } else {
        ok = f.value.trim() !== '' && (f.type !== 'tel' || /^[0-9+\-\s()]{9,}$/.test(f.value)) && (f.type !== 'email' || /^\S+@\S+\.\S+$/.test(f.value));
      }
      mark.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok && !bad) bad = f;
    });
    if (bad) { bad.focus(); return; }
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = String(v).slice(0, 300); });
    becameHuman();
    // The details go in the POST body only, never in a URL.
    post({ event: 'form_submitted', t: token, page: page, at: new Date().toISOString(), extra: data });
    sent.form_submitted = true;
    form.classList.add('is-sent');
    var ok = form.querySelector('.lp-sent');
    if (ok) { ok.hidden = false; ok.focus(); }
  });
})();
