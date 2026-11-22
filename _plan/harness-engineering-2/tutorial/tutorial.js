(function () {
  var KEY = 'he2-harness', root = document.documentElement, ok = { claude: 1, codex: 1, hermes: 1 };
  function set(h) {
    if (!ok[h]) return;
    root.setAttribute('data-h', h);
    var bs = document.querySelectorAll('[data-pick]');
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', bs[i].getAttribute('data-pick') === h ? 'true' : 'false');
  }
  // the section at the top of the screen, so switching does not move the reader
  function anchor() {
    var ss = document.querySelectorAll('section.s, p.part, figure.route'), a = null;
    for (var i = 0; i < ss.length; i++) { if (ss[i].getBoundingClientRect().top <= 140) a = ss[i]; else break; }
    return a;
  }
  var q = null, saved = null;
  try { q = new URLSearchParams(location.search).get('h'); } catch (e) {}
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  set(ok[q] ? q : ok[saved] ? saved : 'claude');
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pick]');
    if (!b) return;
    var h = b.getAttribute('data-pick'), a = anchor(), t = a && a.getBoundingClientRect().top;
    set(h);
    if (a) window.scrollBy(0, a.getBoundingClientRect().top - t);
    try { localStorage.setItem(KEY, h); } catch (e) {}
    try { var u = new URL(location.href); u.searchParams.set('h', h); history.replaceState(null, '', u); } catch (e) {}
    try { window.posthog && window.posthog.capture('tutorial_harness', { harness: h }); } catch (e) {}
  });
})();
