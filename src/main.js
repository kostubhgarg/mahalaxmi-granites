import './style.css';
import { initHeroScene } from './scene.js';
import { initInspector } from './inspector.js';
import { createGraniteTexture, canvasToDataURL } from './textures.js';
import { products, marqueeItems } from './products.js';

/* ============================================================
   CONTACT DETAILS — edit these with your real details
   ============================================================ */
const CONTACT = {
  phone: '+91 98XXX XXXXX',            // ← your phone (display)
  phoneHref: 'tel:+91XXXXXXXXXX',      // ← your phone (link)
  whatsapp: '91XXXXXXXXXX',            // ← your WhatsApp number, digits only
  email: 'sales@mahalaxmigranites.in', // ← your email
  address: 'Granite Market, NH-44, Haryana', // ← your yard address
  hours: 'Mon – Sat · 9:00 AM – 7:00 PM',
};

/* ---------- helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function onVisible(el, cb, threshold = 0.18) {
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    cb(el);
  };
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          fire();
          io.unobserve(e.target);
        }
      });
    },
    { threshold },
  );
  io.observe(el);
  // fallback for environments where IO is delayed: check position directly
  setTimeout(() => {
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92 && r.bottom > 0) {
      fire();
      io.unobserve(el);
    }
  }, 1200);
}

/* ---------- populate contact details ---------- */
function setContact() {
  $('#c-phone').textContent = CONTACT.phone;
  $('#c-phone').href = CONTACT.phoneHref;
  $('#c-email').textContent = CONTACT.email;
  $('#c-email').href = `mailto:${CONTACT.email}`;
  $('#c-address').textContent = CONTACT.address;
  $('#c-hours').textContent = CONTACT.hours;
  $$('.footer-col a[href^="tel:"]').forEach((a) => (a.textContent = CONTACT.phone));
  $$('.footer-col a[href^="mailto:"]').forEach((a) => (a.textContent = CONTACT.email));
  $('#year').textContent = new Date().getFullYear();
}
setContact();

/* ---------- 3D hero ---------- */
initHeroScene($('#hero-canvas'));

/* ---------- nav ---------- */
const nav = $('#nav');
const toggle = $('#nav-toggle');
const navLinks = $('#nav-links');

function onScroll() {
  nav.classList.toggle('scrolled', window.scrollY > 40);
  // reveal-on-scroll triggers
  $$('.reveal').forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) el.classList.add('in-view');
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

toggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  toggle.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
});
$$('.nav-link').forEach((l) =>
  l.addEventListener('click', () => {
    navLinks.classList.remove('open');
    toggle.classList.remove('open');
  }),
);

// active section highlight
const sections = ['home', 'collection', 'story', 'regions', 'contact']
  .map((id) => document.getElementById(id))
  .filter(Boolean);
const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        $$('.nav-link').forEach((l) =>
          l.classList.toggle('active', l.getAttribute('href') === `#${e.target.id}`),
        );
      }
    });
  },
  { rootMargin: '-40% 0px -55% 0px' },
);
sections.forEach((s) => sectionObserver.observe(s));

/* ---------- cursor glow ---------- */
const glow = $('.cursor-glow');
let gx = window.innerWidth / 2;
let gy = window.innerHeight / 3;
let cx = gx;
let cy = gy;
window.addEventListener('pointermove', (e) => {
  gx = e.clientX;
  gy = e.clientY;
});
(function glowLoop() {
  cx += (gx - cx) * 0.07;
  cy += (gy - cy) * 0.07;
  glow.style.transform = `translate(${cx - 240}px, ${cy - 240}px)`;
  requestAnimationFrame(glowLoop);
})();

/* ---------- product cards (tilt + textures) ---------- */
const grid = $('#products-grid');
const textureCache = new Map();
function getTextureUrl(palette) {
  const key = `${palette.base}-${palette.seed}`;
  if (!textureCache.has(key)) {
    textureCache.set(key, canvasToDataURL(createGraniteTexture({ size: 640, ...palette })));
  }
  return textureCache.get(key);
}

grid.innerHTML = products
  .map(
    (p, i) => `
  <article class="product-card tilt" data-name="${p.name}" data-idx="${i}">
    <div class="product-inner">
      <span class="product-badge">Wholesale</span>
      <div class="product-img">
        <div class="slab-bg"></div>
        <button class="slab-3d-btn" type="button" data-viewer="${i}" aria-label="View ${p.name} slab in 3D">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
            <path d="M12 3.5l7.5 4.3v8.4L12 20.5l-7.5-4.3V7.8z" />
            <path d="M12 12l7.5-4.2M12 12v8.5M12 12L4.5 7.8" />
          </svg>
          View in 3D
        </button>
      </div>
      <div class="product-body">
        <h3>${p.name}</h3>
        <p class="product-tag">${p.tagline}</p>
        <div class="product-meta">
          <span class="product-price"><small>from</small>${p.price}</span>
          <a class="product-link" href="#contact" data-name="${p.name}">Enquire <span>→</span></a>
        </div>
      </div>
      <div class="product-shine"></div>
    </div>
  </article>`,
  )
  .join('');

// lazy-load slab textures as cards scroll into view (avoids startup jank)
const cardObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const idx = Number(e.target.dataset.idx);
      const bg = $('.slab-bg', e.target);
      if (bg && !bg.dataset.loaded) {
        bg.style.backgroundImage = `url('${getTextureUrl(products[idx].palette)}')`;
        bg.dataset.loaded = '1';
      }
      cardObserver.unobserve(e.target);
    });
  },
  { rootMargin: '320px 0px' },
);
$$('.product-card').forEach((c) => cardObserver.observe(c));

// 3D tilt
$$('.product-card').forEach((card) => {
  const inner = $('.product-inner', card);
  const shine = $('.product-shine', card);
  let resetTimer;
  card.addEventListener('pointermove', (e) => {
    inner.classList.remove('tilt-reset');
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    inner.style.transform = `rotateY(${px * 9}deg) rotateX(${py * -9}deg)`;
    inner.style.setProperty('--mx', `${(px + 0.5) * 100}%`);
    inner.style.setProperty('--my', `${(py + 0.5) * 100}%`);
    shine.style.opacity = 1;
  });
  card.addEventListener('pointerleave', () => {
    inner.classList.add('tilt-reset');
    inner.style.transform = 'rotateY(0deg) rotateX(0deg)';
    shine.style.opacity = 0;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => inner.classList.remove('tilt-reset'), 600);
  });
});

// Pre-select the granite in the quote form
function prefillQuote(name) {
  const msg = $('#quote-form [name="message"]');
  if (msg && name && !msg.value) {
    msg.value = `Hi! I'd like wholesale rates for ${name}. Please share current pricing and availability.`;
  }
}

$$('.product-link').forEach((link) => {
  link.addEventListener('click', () => prefillQuote(link.dataset.name));
});

/* ---------- 3D slab inspector ---------- */
const inspector = initInspector();

$$('[data-viewer]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const product = products[Number(btn.dataset.viewer)];
    if (inspector) inspector.open(product);
  });
});

const viewerCta = $('#viewer-cta');
if (viewerCta) {
  viewerCta.addEventListener('click', () => {
    prefillQuote(viewerCta.dataset.name);
    inspector?.close();
  });
}

/* ---------- slab showcase ---------- */
const showcase = $('#slab-showcase');
const showSlabs = [
  { palette: products[0].palette, cls: 's1', label: 'Black Galaxy' },
  { palette: products[1].palette, cls: 's2', label: 'Tan Brown' },
  { palette: products[2].palette, cls: 's3', label: 'Kashmir White' },
];
showcase.innerHTML = showSlabs
  .map(
    (s, i) => `
  <div class="slab ${s.cls}">
    ${i === 2 ? '<span class="slab-chip">50+ varieties in stock</span>' : ''}
    <span class="slab-label">${s.label}</span>
  </div>`,
  )
  .join('');

// lazy-load showcase textures
onVisible(showcase, () => {
  $$('.slab', showcase).forEach((s, i) => {
    s.style.backgroundImage = `url('${getTextureUrl(showSlabs[i].palette)}')`;
  });
});

/* ---------- marquee (two halves for a seamless loop) ---------- */
const track = $('#marquee-track');
const marqueeHalf = marqueeItems.map((name) => `<span>${name}</span><i>◆</i>`).join('');
track.innerHTML = `<div class="marquee-half">${marqueeHalf}</div><div class="marquee-half">${marqueeHalf}</div>`;

/* ---------- counters ---------- */
$$('.stat-num').forEach((el) => {
  onVisible(el, () => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const dur = 1600;
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  });
});

/* ---------- WhatsApp form ---------- */
$('#quote-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const data = Object.fromEntries(new FormData(f).entries());
  const text = [
    `*Wholesale Enquiry — Mahalaxmi Granites*`,
    ``,
    `Name: ${data.name}`,
    `Phone: ${data.phone}`,
    `City: ${data.city || '—'}`,
    `I am a: ${data.role}`,
    ``,
    `Requirement:`,
    data.message,
  ].join('\n');
  window.open(`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`, '_blank');
});
