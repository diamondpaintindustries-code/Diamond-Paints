// Diamond Industry — shared behaviour

document.addEventListener('DOMContentLoaded', () => {

  /* ---- shade popups: full-screen takeover, lock page scroll while open ---- */
  document.querySelectorAll('dialog.shade-dialog').forEach((dlg) => {
    dlg.addEventListener('close', () => {
      document.documentElement.classList.remove('dialog-open');
    });
  });
  window.openShadeDialog = function (id) {
    const dlg = document.getElementById(id);
    if (!dlg) return;
    dlg.showModal();
    document.documentElement.classList.add('dialog-open');
  };
  window.closeShadeDialog = function (id) {
    const dlg = document.getElementById(id);
    if (!dlg) return;
    dlg.close();
  };


  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
  }

  /* ---- scroll reveal ---- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* ---- animated counters ---- */
  const counters = document.querySelectorAll('[data-count]');
  const runCount = (el) => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const dur = 1400;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = target * eased;
      el.textContent = (target % 1 === 0 ? Math.floor(val) : val.toFixed(1)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (counters.length && 'IntersectionObserver' in window) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { runCount(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.4 });
    counters.forEach(c => cio.observe(c));
  }

  /* ---- logo mouse parallax (hero) ---- */
  const logoCoin = document.querySelector('.logo-coin');
  const logoStage = document.querySelector('.logo-stage');
  if (logoCoin && logoStage) {
    logoStage.addEventListener('mousemove', (e) => {
      const r = logoStage.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      logoCoin.style.animationPlayState = 'paused';
      logoCoin.style.transform = `translateY(-6px) rotateY(${px * 46}deg) rotateX(${6 - py * 32}deg)`;
    });
    logoStage.addEventListener('mouseleave', () => {
      logoCoin.style.animationPlayState = 'running';
      logoCoin.style.transform = '';
    });
  }

  /* ---- tilt on cards ---- */
  document.querySelectorAll('.cat-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `translateY(-6px) rotateX(${-py * 10}deg) rotateY(${px * 10}deg)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });

  /* ---- product category tabs ---- */
  const tabbtns = document.querySelectorAll('.tabbtn');
  const catSections = document.querySelectorAll('.cat-section');
  if (tabbtns.length) {
    tabbtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabbtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.target;
        if (target === 'all') {
          catSections.forEach(s => s.style.display = '');
        } else {
          catSections.forEach(s => s.style.display = (s.id === target ? '' : 'none'));
        }
        document.getElementById('products-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ---- contact form (demo only, no backend) ---- */
  const form = document.querySelector('#contact-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const original = btn.textContent;
      btn.textContent = 'Message sent';
      btn.disabled = true;
      setTimeout(() => { btn.textContent = original; btn.disabled = false; form.reset(); }, 2200);
    });
  }

});
