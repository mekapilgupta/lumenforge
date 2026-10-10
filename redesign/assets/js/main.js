/* French Toes redesign — minimal, dependency-free progressive enhancement.
   Everything below is optional polish; the page is fully usable with JS off. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- 1. Sticky header shadow on scroll ------------------------------- */
  var header = document.querySelector('.header');
  if (header) {
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        header.classList.toggle('is-stuck', window.scrollY > 8);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- 2. Mobile drawer ------------------------------------------------ */
  var nav = document.querySelector('.nav');
  var burger = document.querySelector('.burger');
  var scrim = document.querySelector('.scrim');

  function setMenu(open) {
    if (!nav || !burger) return;
    nav.classList.toggle('is-open', open);
    if (scrim) scrim.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      var first = nav.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    }
  }

  if (burger) {
    burger.addEventListener('click', function () {
      setMenu(!nav.classList.contains('is-open'));
    });
  }
  if (scrim) scrim.addEventListener('click', function () { setMenu(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  /* ---- 3. Accordion sub-menus on touch/mobile -------------------------- */
  document.querySelectorAll('.nav > li').forEach(function (li) {
    var panel = li.querySelector('.nav__panel');
    var link = li.querySelector('.nav__link');
    if (!panel || !link) return;
    link.addEventListener('click', function (e) {
      // Desktop: let the hover panel + real link behave normally.
      if (window.innerWidth > 980) return;
      e.preventDefault();
      var wasOpen = li.classList.contains('is-expanded');
      document.querySelectorAll('.nav > li.is-expanded').forEach(function (o) {
        o.classList.remove('is-expanded');
      });
      li.classList.toggle('is-expanded', !wasOpen);
      link.setAttribute('aria-expanded', String(!wasOpen));
    });
  });

  /* ---- 4. Reveal on scroll -------------------------------------------- */
  var revealables = document.querySelectorAll('.reveal');
  if (revealables.length && !reduceMotion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---- 5. Wishlist heart toggle (cosmetic) ----------------------------- */
  document.querySelectorAll('.pcard__wish').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', String(!on));
      btn.style.color = on ? '' : '#D4A5A5';
      var path = btn.querySelector('svg path');
      if (path) path.setAttribute('fill', on ? 'none' : 'currentColor');
    });
  });

  /* ---- 6. Newsletter (preview only — no backend) ----------------------- */
  var form = document.querySelector('.news__form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = document.querySelector('.news__note');
      if (note) note.textContent = 'Thanks — this is a design preview, so nothing was submitted yet.';
      form.reset();
    });
  }

  /* ---- 7. Cart count from the demo bag (static preview value) ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
