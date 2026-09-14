/* =========================================================================
   Diamond Paints — Video Hero
   The villa video plays full-screen and undistracted for the first 5
   seconds. After that, the nav and homepage content ease in over a
   dimmed, looping version of the same video running behind them.
   Respects prefers-reduced-motion (reveals immediately, no wait).
   ========================================================================= */
(function () {
  var hero    = document.getElementById('cinema-hero');
  if (!hero) return; // only present on index.html

  var video   = document.getElementById('hero-video');
  var content = document.getElementById('cinema-content');
  var scrollCue = document.getElementById('scroll-cue');
  var nav     = document.getElementById('site-nav');

  var REVEAL_DELAY_MS = 5000;
  var revealed = false;

  function reveal() {
    if (revealed) return;
    revealed = true;
    hero.classList.add('revealed');
    if (nav) nav.classList.add('nav-in');
    if (content) content.classList.add('in');
    if (scrollCue) scrollCue.classList.add('in');
    document.body.classList.remove('intro-lock');
  }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    // Skip the wait and the moving footage entirely; content shows right
    // away over a calm static background (see the reduced-motion rule in
    // style.css, which hides the <video> element).
    if (video) { try { video.pause(); } catch (e) {} }
    reveal();
    return;
  }

  document.body.classList.add('intro-lock');
  window.setTimeout(reveal, REVEAL_DELAY_MS);

  // Safety net: if the video fails to load/play at all, don't leave the
  // homepage stuck waiting — reveal on schedule regardless, and if it
  // errors out immediately, reveal right away over the poster image.
  if (video) {
    video.addEventListener('error', function () { reveal(); });
  }
})();
