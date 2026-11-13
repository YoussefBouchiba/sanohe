document.documentElement.classList.add('js');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Menu mobile */
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');
if (toggle && nav) {
  const close = () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); };
  toggle.addEventListener('click', () => { toggle.setAttribute('aria-expanded', String(nav.classList.toggle('open'))); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { close(); toggle.focus(); } });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.bar-in')) close(); });
}

/* Horodatage incrusté : heure locale du visiteur */
const pad = (n) => String(n).padStart(2, '0');
const tcEls = document.querySelectorAll('[data-timecode]');
const tick = () => { const d = new Date(); const t = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; tcEls.forEach((el) => { el.textContent = t; }); };
tick(); setInterval(tick, 1000);

/* Parallaxe à la souris : scène du hero (pointeur précis uniquement) */
const stage = document.querySelector('.stage');
if (stage && !reduce && window.matchMedia('(pointer: fine)').matches) {
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
  const loop = () => {
    cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
    stage.style.setProperty('--px', cx.toFixed(2)); stage.style.setProperty('--py', cy.toFixed(2));
    raf = (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01) ? requestAnimationFrame(loop) : null;
  };
  const hero = document.querySelector('.hero');
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!raf) raf = requestAnimationFrame(loop);
  });
  hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
}

/* Défilement : révélations + parallaxe des images de tuiles (un seul rAF) */
const reveals = [...document.querySelectorAll('[data-reveal]')];
const parallax = [...document.querySelectorAll('.bg img')];
document.querySelectorAll('.bento .tile').forEach((t, i) => t.style.setProperty('--i', i % 3));
document.querySelectorAll('.route .stop').forEach((s, i) => s.style.setProperty('--i', i));
let ticking = false;
const onScroll = () => {
  const vh = window.innerHeight;
  for (let i = reveals.length - 1; i >= 0; i--) {
    const el = reveals[i];
    if (el.getBoundingClientRect().top < vh * 0.9) { el.classList.add('in'); reveals.splice(i, 1); }
  }
  if (!reduce) {
    parallax.forEach((img) => {
      const r = img.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const t = (r.top + r.height / 2 - vh / 2) / vh;          /* -1 … 1 */
      img.style.setProperty('--ty', `${(-t * 6).toFixed(1)}%`);
    });
  }
  ticking = false;
};
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

/* ---------- Formulaire de contact ----------
   Envoi : si <form data-endpoint="..."> est renseigné, le message est envoyé en POST à ce service
   (Formspree, Web3Forms, script PHP...). Sinon, repli : ouverture de la messagerie du visiteur
   avec le message prérempli, à l'adresse de data-mailto. */
const form = document.getElementById('contact-form');
if (form) {
  const status = document.getElementById('form-status');
  const btn = form.querySelector('button[type="submit"]');
  const label = btn.querySelector('.btn-label');
  const PHONE = '01 64 07 02 26';
  const rules = {
    nom:          { id: 'f-nom',  err: 'e-nom',  msg: 'Indiquez votre nom.',                                      ok: (v) => v.trim().length >= 2 },
    telephone:    { id: 'f-tel',  err: 'e-tel',  msg: 'Indiquez un numéro de téléphone valide.',                  ok: (v) => { const d = v.replace(/\D/g, ''); return d.length >= 8 && d.length <= 15; } },
    email:        { id: 'f-mail', err: 'e-mail', msg: 'Indiquez une adresse e-mail valide.',                      ok: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) },
    message:      { id: 'f-msg',  err: 'e-msg',  msg: 'Écrivez votre message.',                                   ok: (v) => v.trim().length >= 5 },
    consentement: { id: 'f-ok',   err: 'e-ok',   msg: 'Veuillez accepter pour que nous puissions vous répondre.', ok: (_, el) => el.checked },
  };
  const setErr = (r, msg) => {
    const el = document.getElementById(r.id), e = document.getElementById(r.err);
    if (msg) { e.textContent = msg; e.hidden = false; el.setAttribute('aria-invalid', 'true'); }
    else { e.textContent = ''; e.hidden = true; el.removeAttribute('aria-invalid'); }
  };
  const check = (r) => { const el = document.getElementById(r.id); const good = r.ok(el.value, el); setErr(r, good ? '' : r.msg); return good; };
  Object.values(rules).forEach((r) => {
    const el = document.getElementById(r.id);
    el.addEventListener('blur', () => { if (el.value || el.checked || el.getAttribute('aria-invalid')) check(r); });
    ['input', 'change'].forEach((ev) => el.addEventListener(ev, () => { if (el.getAttribute('aria-invalid')) check(r); }));
  });
  const say = (text, kind) => { status.textContent = text; status.className = 'form-status' + (kind ? ' is-' + kind : ''); };
  const busy = (on) => { btn.disabled = on; label.textContent = on ? 'Envoi en cours…' : 'Envoyer le message'; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    say('');
    let first = null;
    Object.values(rules).forEach((r) => { if (!check(r) && !first) first = document.getElementById(r.id); });
    if (first) { first.focus(); say('Merci de corriger les champs signalés.', 'error'); return; }

    const data = new FormData(form);
    if (data.get('website')) { say('Merci, votre message a bien été envoyé.', 'ok'); form.reset(); return; }   /* champ piège : robot */

    const endpoint = (form.dataset.endpoint || '').trim();
    if (endpoint) {
      busy(true);
      try {
        const res = await fetch(endpoint, { method: 'POST', headers: { Accept: 'application/json' }, body: data });
        if (!res.ok) throw new Error(res.status);
        say('Merci, votre message a bien été envoyé.', 'ok'); form.reset();
      } catch (err) {
        say("L'envoi a échoué. Réessayez, ou appelez-nous au " + PHONE + '.', 'error');
      } finally { busy(false); }
      return;
    }

    /* Repli sans service d'envoi : messagerie du visiteur */
    const to = (form.dataset.mailto || '').trim();
    const lines = ['Nom : ' + data.get('nom'), 'Téléphone : ' + data.get('telephone'), 'E-mail : ' + data.get('email')];
    if (data.get('societe')) lines.push('Société / Collectivité : ' + data.get('societe'));
    lines.push('', data.get('message'));
    const subject = 'Demande de contact – ' + data.get('nom');
    window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
    say("Votre messagerie va s'ouvrir avec le message prérempli. Si rien ne se passe, appelez-nous au " + PHONE + '.', 'ok');
  });
}

const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();

/* Pages juridiques : sommaire replié sur mobile */
const toc = document.querySelector('details.toc');
if (toc && window.matchMedia('(max-width: 900px)').matches) toc.removeAttribute('open');

/* Barre de navigation : se masque en descendant, réapparaît dès qu'on remonte */
const bar = document.querySelector('.bar');
if (bar) {
  let lastY = window.scrollY, ticking2 = false;
  const menuOpen = () => document.getElementById('site-nav')?.classList.contains('open');
  const show = () => bar.classList.remove('is-hidden');
  const update = () => {
    const y = window.scrollY, dy = y - lastY;
    if (y < 120 || menuOpen() || bar.matches(':focus-within')) show();
    else if (dy > 8) bar.classList.add('is-hidden');
    else if (dy < -8) show();
    if (Math.abs(dy) > 8 || y < 120) lastY = y;
    ticking2 = false;
  };
  window.addEventListener('scroll', () => { if (!ticking2) { ticking2 = true; requestAnimationFrame(update); } }, { passive: true });
  bar.addEventListener('focusin', show);
}
