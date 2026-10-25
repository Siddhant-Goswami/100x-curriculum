/* Site analytics: PostHog (US cloud). Every page loads this file in its head.
   Each audience gets its own PostHog project, picked by path. Until the Token Tax Audit has its own
   project, both keys are the same and the `site` property on every event tells them apart.
   PostHog records page views, page leaves with scroll depth, clicks (autocapture) and session replays.
   Replays mask everything typed. Areas marked [data-nolabel] show a learner's own tasks, so they get
   the ph-no-capture class: no click text from them, and replays show a blank box in their place.
   Every event also carries opened_as ('website' inside an iframe on another site, 'link' on its own).
   Custom events: window.posthog && posthog.capture(name, props). Skipped on localhost.
   eventsOnly projects (Token Meter) send page views and their named events only: no autocapture, no replays, no page leaves,
   because those pages show a learner's own chat titles and files. */
(function () {
  if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === 'file:') return;

  var PROJECTS = [
    /* Token Meter: own slot. The org's free plan allows one PostHog project, so this uses the shared key until a second one exists */
    { site: 'token-meter', path: /^\/token-meter(\/|$)/, key: 'phc_vJczCrZxKOn9TkEV0JAZFyslqKTu8orRxfU7V9JxhiT', eventsOnly: true },
    { site: 'token-tax-audit', path: /^\/token-tax-audit(\/|$)/, key: 'phc_vJczCrZxKOn9TkEV0JAZFyslqKTu8orRxfU7V9JxhiT' },
    { site: 'curriculum', path: /^/, key: 'phc_vJczCrZxKOn9TkEV0JAZFyslqKTu8orRxfU7V9JxhiT' }
  ];
  var project = PROJECTS.filter(function (p) { return p.path.test(location.pathname); })[0];

  /* PostHog's loader snippet: queues calls on window.posthog until array.js arrives */
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  posthog.init(project.key, project.eventsOnly ? {
    api_host: 'https://us.i.posthog.com',
    defaults: '2025-05-24',
    person_profiles: 'identified_only',
    autocapture: false, capture_pageleave: false, disable_session_recording: true, capture_heatmaps: false, capture_dead_clicks: false,
    loaded: function (ph) { ph.register({ site: project.site, opened_as: window.self !== window.top ? 'website' : 'link' }); }
  } : {
    api_host: 'https://us.i.posthog.com',
    defaults: '2025-05-24',
    person_profiles: 'identified_only',
    session_recording: { maskAllInputs: true },
    // opened_as: 'website' when the page sits in an iframe on another site (the 100xengineers.com homepage), 'link' when opened on its own
    loaded: function (ph) { ph.register({ site: project.site, opened_as: window.self !== window.top ? 'website' : 'link' }); }
  });

  function hide() { [].forEach.call(document.querySelectorAll('[data-nolabel]'), function (el) { el.classList.add('ph-no-capture'); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hide); else hide();
})();
