/* Site analytics. Sends page views, sections reached, clicks, video progress and time on page
   to /api/track (api/track.mjs), which stores them as files in a private Blob store.
   Never sends what a learner types. Inside [data-nolabel] a click records only the element's id or data key,
   because those areas show the learner's own tasks. window.track(name, value) adds a custom event. */
(function () {
  if (window.track || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === 'file:') {
    window.track = window.track || function () {};
    return;
  }
  var END = '/api/track', q = [], timer = null, shown = Date.now(), visible = 0, maxScroll = 0, seen = {};

  function rid() { return Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4); }
  function keep(store, k) { try { var x = store.getItem(k); if (!x) { x = rid(); store.setItem(k, x); } return x; } catch (e) { return rid(); } }
  var V = keep(window.localStorage, 'c8.a.v'), S = keep(window.sessionStorage, 'c8.a.s');
  var P = location.pathname.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '');

  function flush(beacon) {
    clearTimeout(timer); timer = null;
    if (!q.length) return;
    var body = JSON.stringify({ v: V, s: S, events: q.splice(0, 60) });
    if (beacon && navigator.sendBeacon) { navigator.sendBeacon(END, new Blob([body], { type: 'text/plain' })); return; }
    fetch(END, { method: 'POST', body: body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(function () {});
  }
  function send(e) {
    e.p = P; e.t = Date.now();
    q.push(e);
    if (q.length >= 40) flush(); else if (!timer) timer = setTimeout(flush, 8000);
  }
  window.track = function (name, value) { send({ e: 'custom', name: String(name), value: value == null ? undefined : String(value) }); };

  send({ e: 'view', ref: document.referrer ? document.referrer.split(/[?#]/)[0] : undefined, w: window.innerWidth });

  /* clicks on links and controls; links keep only their path, never a query or data hash */
  function href(a) {
    var h = a.getAttribute('href') || '';
    if (/^#[\w-]{1,40}$/.test(h)) return h;
    try { var u = new URL(a.href, location.href); return (u.origin === location.origin ? '' : u.origin) + u.pathname; } catch (e) { return undefined; }
  }
  function key(el) {
    if (el.id) return el.id;
    for (var i = 0; i < el.attributes.length; i++) { var n = el.attributes[i].name; if (/^data-/.test(n) && n !== 'data-nolabel') return n.slice(5) + (/^\d+$/.test(el.attributes[i].value) ? '' : '=' + el.attributes[i].value.slice(0, 30)); }
    return undefined;
  }
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('a[href],button,summary,[role=button],[role=radio],[role=tab],[role=switch],[role=checkbox]');
    if (!el) return;
    var priv = !!el.closest('[data-nolabel]');
    var label = priv ? undefined : (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) || undefined;
    var section = el.closest('section[id]');
    send({ e: 'click', id: key(el) || (section ? '#' + section.id : undefined), label: label, href: el.tagName === 'A' ? href(el) : undefined });
  }, true);

  /* sections reached: each section[id] once per view, when a third of it is on screen */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting && !seen[x.target.id]) { seen[x.target.id] = 1; send({ e: 'section', id: x.target.id }); io.unobserve(x.target); } });
    }, { threshold: 0.33 });
    var watch = function () { [].forEach.call(document.querySelectorAll('section[id]'), function (s) { io.observe(s); }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
  }

  /* video: play, each quarter watched, ended */
  document.addEventListener('play', function (ev) { if (ev.target.tagName === 'VIDEO') send({ e: 'video', id: key(ev.target) || ev.target.currentSrc.split('/').pop(), value: 'play' }); }, true);
  document.addEventListener('timeupdate', function (ev) {
    var v = ev.target; if (v.tagName !== 'VIDEO' || !v.duration) return;
    var qt = Math.floor(v.currentTime / v.duration * 4) * 25; v._q = v._q || {};
    if (qt >= 25 && qt < 100 && !v._q[qt]) { v._q[qt] = 1; send({ e: 'video', id: key(v) || v.currentSrc.split('/').pop(), value: qt + '%' }); }
  }, true);
  document.addEventListener('ended', function (ev) { if (ev.target.tagName === 'VIDEO') send({ e: 'video', id: key(ev.target) || ev.target.currentSrc.split('/').pop(), value: 'ended' }); }, true);

  /* time on page (visible time only) and how far down they scrolled */
  window.addEventListener('scroll', function () {
    var d = document.documentElement, h = d.scrollHeight - window.innerHeight;
    if (h > 0) maxScroll = Math.max(maxScroll, Math.round(window.scrollY / h * 100));
  }, { passive: true });
  function leave() {
    if (shown) { visible += Date.now() - shown; shown = 0; }
    send({ e: 'leave', sec: visible / 1000, scroll: Math.min(100, maxScroll) });
    flush(true);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') leave(); else shown = Date.now();
  });
  window.addEventListener('pagehide', function () { if (shown) leave(); });
})();
