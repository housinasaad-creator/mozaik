/* =========================================================
   MOZAIK OFSET — 2050 interactions (v2)
   ========================================================= */
(function () {
  "use strict";
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine    = matchMedia("(pointer:fine)").matches;
  const lerp = (a, b, n) => a + (b - a) * n;

  /* ---- Capability tier ----
     "lite" = a genuinely weak device (any screen size). Set from the <head> probe
     (few cores / low memory / reduced-motion). A runtime FPS watchdog can also flip
     the site into lite mode if real frame-rate is poor. In lite mode the continuously
     animating, GPU-heavy decorations (mosaic spotlight, ambient dots, aurora, smooth-
     scroll, blur) are dropped so scrolling and the 3D boxes stay perfectly smooth. */
  const html = document.documentElement;
  const LITE0 = reduced
    || (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || html.classList.contains("lite");
  if (LITE0) html.classList.add("lite");
  let runtimeWeak = false;
  const isLite = () => LITE0 || runtimeWeak || html.classList.contains("lite");

  /* ---- i18n ---- */
  const DICT = window.MOZAIK_I18N || {};
  const setYear = () => { const y = $("#year"); if (y) y.textContent = new Date().getFullYear(); };
  function applyLang(lang) {
    const d = DICT[lang]; if (!d) return;
    const html = document.documentElement;
    html.setAttribute("lang", lang);
    html.setAttribute("dir", "ltr");   // layout stays fixed for all languages; only text translates
    $$("[data-i18n]").forEach((el) => { const v = d[el.dataset.i18n]; if (v != null) el.textContent = v; });
    $$("[data-i18n-html]").forEach((el) => { const v = d[el.dataset.i18nHtml]; if (v != null) el.innerHTML = v; });
    $$("[data-i18n-ph]").forEach((el) => { const v = d[el.dataset.i18nPh]; if (v != null) el.setAttribute("placeholder", v); });
    $$("#lang [data-lang]").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
    try { localStorage.setItem("mozaik_lang", lang); } catch (e) {}
    setYear();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  $$("#lang [data-lang]").forEach((b) => b.addEventListener("click", () => applyLang(b.dataset.lang)));
  let savedLang = "en"; try { savedLang = localStorage.getItem("mozaik_lang") || "en"; } catch (e) {}

  /* ---- Spotlight + custom cursor ---- */
  const shroud = $("#shroud"), dot = $("#cursorDot"), ring = $("#cursorRing");
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, raf = null;
  function loop() {
    // Spotlight shroud repaints a full-screen radial gradient every mouse move — the single
    // most expensive cursor effect on weak GPUs. Skip it in lite mode (shroud is hidden via CSS);
    // the lightweight custom cursor dot/ring still follow the pointer.
    if (!isLite()) { shroud.style.setProperty("--mx", mx + "px"); shroud.style.setProperty("--my", my + "px"); }
    dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
    rx = lerp(rx, mx, 0.22); ry = lerp(ry, my, 0.22);
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    raf = (Math.abs(rx - mx) > 0.3 || Math.abs(ry - my) > 0.3) ? requestAnimationFrame(loop) : null;
  }
  if (fine && !reduced) {
    addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; dot.style.display="block"; ring.style.display="block"; if (!raf) raf = requestAnimationFrame(loop); }, { passive: true });
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("[data-cursor]");
      ring.classList.toggle("is-hover", !!t && t.dataset.cursor === "link");
      ring.classList.toggle("is-cta", !!t && t.dataset.cursor === "cta");
    });
    document.addEventListener("pointerleave", () => { dot.style.display="none"; ring.style.display="none"; });
  } else { shroud.style.setProperty("--mx", "50%"); shroud.style.setProperty("--my", "38%"); }

  /* ---- Magnetic ---- */
  if (fine && !reduced && !LITE0) $$("[data-magnetic]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${((e.clientX - r.left) / r.width - .5) * 22}px,${((e.clientY - r.top) / r.height - .5) * 22}px)`;
    });
    el.addEventListener("pointerleave", () => { el.style.transform = ""; });
  });

  /* ---- 3D tilt ---- */
  if (fine && !reduced && !LITE0) $$("[data-tilt]").forEach((el) => {
    const inner = $("[data-tilt-inner]", el);
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.transform = `perspective(900px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg)`;
      if (inner) inner.style.transform = `translateZ(50px) translate(${x * 14}px,${y * 14}px)`;
    });
    el.addEventListener("pointerleave", () => { el.style.transform = ""; if (inner) inner.style.transform = ""; });
  });

  /* ---- Media tabs: 3D <-> Video ---- */
  $$("[data-media]").forEach((m) => {
    const tabs = $$(".media-tabs button", m);
    const v3d = $(".media-view--3d", m), vvid = $(".media-view--video", m);
    tabs.forEach((btn) => btn.addEventListener("click", () => {
      tabs.forEach((b) => b.classList.toggle("active", b === btn));
      const is3d = btn.dataset.view === "3d";
      v3d.hidden = !is3d; vvid.hidden = is3d;
    }));
  });

  /* ---- Products carousel (modern slider) ---- */
  (function () {
    const track = $("#stack");
    if (!track || !track.classList.contains("pcarousel__track")) return;
    const slides = $$(".stack__card", track);
    if (!slides.length) return;
    const prev = $("#pcarPrev"), next = $("#pcarNext");
    const dotsWrap = $("#pcarDots"), curEl = $("#pcarCur"), totEl = $("#pcarTot");
    const pad = (n) => String(n + 1).padStart(2, "0");
    if (totEl) totEl.textContent = pad(slides.length - 1);
    const viewport = track.parentElement;
    const N = slides.length;
    let idx = 0;
    // The centred box stays LOADED even when the products section scrolls off-screen,
    // so scrolling back never re-inits the 3D viewer (that reload was the scroll lag).
    // Still only ONE box is ever live at a time — it swaps when you change cards. On
    // first load only card #1 (idx 0) loads.
    const dots = slides.map((_, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "tab");
      b.setAttribute("aria-label", "Ürün " + (i + 1));
      b.setAttribute("data-cursor", "link");
      b.addEventListener("click", () => go(i));
      if (dotsWrap) dotsWrap.appendChild(b);
      return b;
    });
    function sizeViewport() {
      let h = 0;
      slides.forEach((s) => { if (s.offsetHeight > h) h = s.offsetHeight; });
      if (h) viewport.style.height = (h + 48) + "px";
    }
    const MAXV = 3;    // how many cards peek on each side (rotating-wheel look)
    function render() {
      slides.forEach((s, k) => {
        let d = k - idx;
        if (d > N / 2) d -= N; else if (d < -N / 2) d += N;   // shortest circular distance (infinite wheel)
        const ad = Math.abs(d), dir = Math.sign(d);
        let x, scale, op, z, ry, pe;
        if (ad === 0) { x = 0; scale = 1; op = 1; z = 100; ry = 0; pe = "auto"; }
        else if (ad <= MAXV) {                                 // visible side cards — tilted like a wheel, no fade, CLICKABLE
          x = dir * (15 + (ad - 1) * 11);
          scale = Math.max(0.6, 1 - ad * 0.07);
          op = 1;
          z = 100 - ad;
          ry = -dir * (16 + (ad - 1) * 5);
          pe = "auto";
        } else { x = dir * 46; scale = 0.5; op = 0; z = 0; ry = 0; pe = "none"; }
        s.style.transform = "translate(-50%,-50%) translateX(" + x + "%) scale(" + scale + ") rotateY(" + ry + "deg)";
        s.style.opacity = op; s.style.zIndex = z; s.style.pointerEvents = pe;
        s.style.cursor = ad === 0 ? "" : "pointer";
        s.classList.toggle("is-active", ad === 0);
        // keep the live 3D viewer only on the active card + immediate neighbours; others show a clean dark panel.
        // only the active card's iframe takes pointer events (drag to rotate); side cards pass the click to navigate.
        const ifr = s.querySelector("iframe[data-src]");
        if (ifr) {
          // ONLY the centred box keeps a live 3D viewer — load it, unload every other one (one WebGL context max).
          // Not gated by scroll position: the centred box stays loaded so returning to it never re-inits (no lag).
          const active = ad === 0;
          if (active && ifr.dataset.loaded !== "1") {
            // show a branded loading state instead of an empty dark panel while the viewer boots
            const view = ifr.closest(".media-view");
            if (view) { view.classList.add("is-loading"); ifr.addEventListener("load", () => view.classList.remove("is-loading"), { once: true }); }
            ifr.src = ifr.dataset.src; ifr.dataset.loaded = "1";
          }
          else if (!active && ifr.dataset.loaded === "1") { ifr.src = "about:blank"; ifr.dataset.loaded = "0"; }
          ifr.style.visibility = active ? "visible" : "hidden";
          ifr.style.pointerEvents = active ? "auto" : "none";
        }
      });
      dots.forEach((d, k) => d.classList.toggle("is-active", k === idx));
      if (curEl) curEl.textContent = pad(idx);
    }
    function go(i) { idx = (i % N + N) % N; render(); }        // wraps forever in both directions
    if (prev) prev.addEventListener("click", () => go(idx - 1));
    if (next) next.addEventListener("click", () => go(idx + 1));
    // click a side card to bring it to the centre (like pressing the arrow toward it)
    slides.forEach((s, k) => s.addEventListener("click", () => { if (k !== idx) go(k); }));
    addEventListener("resize", () => { sizeViewport(); render(); }, { passive: true });
    let sx = 0, dragging = false;
    track.addEventListener("pointerdown", (e) => { dragging = true; sx = e.clientX; }, { passive: true });
    addEventListener("pointerup", (e) => {
      if (!dragging) return; dragging = false;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 50) go(dx < 0 ? idx + 1 : idx - 1);
    }, { passive: true });
    sizeViewport(); render();
    setTimeout(() => { sizeViewport(); render(); }, 350);
    addEventListener("load", () => { sizeViewport(); render(); });
  })();

  /* ---- Ambient golden dots: an infinite grid drifting down; random 4-dot merges (slow) ---- */
  (function () {
    const canvas = document.querySelector(".dots-fx");
    if (!canvas) return;
    if (matchMedia("(max-width:820px)").matches || isLite()) { canvas.style.display = "none"; return; }  // phones + weak devices: skip animation entirely (perf)
    const ctx = canvas.getContext("2d");
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const GAP = 38, SPEED = 0.2, OY0 = GAP / 2;   // SPEED = gentle downward drift
    let W = 0, H = 0, cols = 0, ox = 0;
    function build() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cols = Math.floor(W / GAP); ox = (W - (cols - 1) * GAP) / 2;
    }
    build(); addEventListener("resize", build, { passive: true });

    const CMYK = [[0, 158, 224], [230, 0, 126], [250, 214, 40], [228, 232, 242]]; // C, M, Y, K (K shown light so it reads on dark)
    const GOLD = [214, 182, 110];

    const merges = []; let cool = 0, scroll = 0;   // scroll = accumulated downward drift
    function spawn() {
      if (cols < 2 || merges.length >= 5) return;
      const Jmin = Math.floor((-scroll - OY0) / GAP), Jmax = Math.floor((H - scroll - OY0) / GAP);
      const I = (Math.random() * (cols - 1)) | 0;
      const J = Jmin + ((Math.random() * (Jmax - Jmin)) | 0);
      if (merges.some((m) => m.I === I && m.J === J)) return;
      merges.push({ I, J, t: 0, dur: 130 + (Math.random() * 150 | 0) });   // slow merge (~2.2–4.7s)
    }

    function frame() {
      scroll += SPEED;
      ctx.clearRect(0, 0, W, H);
      const glow = [];
      for (let m = merges.length - 1; m >= 0; m--) {
        const M = merges[m]; M.t++;
        const p = M.t / M.dur; if (p >= 1) { merges.splice(m, 1); continue; }
        const g = Math.sin(p * Math.PI);                       // 0 -> 1 -> 0 (merge then split)
        const cx = ox + (M.I + 0.5) * GAP, cy = OY0 + (M.J + 0.5) * GAP + scroll;
        const cell = [[0, 0], [1, 0], [0, 1], [1, 1]];
        for (let q = 0; q < 4; q++) {
          const gi = M.I + cell[q][0], gj = M.J + cell[q][1];
          const bx = ox + gi * GAP, by = OY0 + gj * GAP + scroll;
          glow.push([bx + (cx - bx) * g, by + (cy - by) * g, g, q]);
        }
      }
      // only the merging dots — CMYK (print inks) when apart, blending to a plain gold as they merge (no glow)
      for (const gp of glow) {
        const g = gp[2], b = CMYK[gp[3]];
        const cr = (b[0] + (GOLD[0] - b[0]) * g) | 0, cg = (b[1] + (GOLD[1] - b[1]) * g) | 0, cb = (b[2] + (GOLD[2] - b[2]) * g) | 0;
        const r = 1.4 + g * 3;                                  // smaller, solid dots (no glowing halo)
        ctx.fillStyle = "rgba(" + cr + "," + cg + "," + cb + ",.85)";
        ctx.beginPath(); ctx.arc(gp[0], gp[1], r, 0, 6.283); ctx.fill();
      }
      if (--cool <= 0) { spawn(); cool = 48 + (Math.random() * 70 | 0); }
    }
    // Stop the ambient loop the moment the runtime watchdog flips the site into lite mode.
    function loop() { if (isLite()) { canvas.style.display = "none"; return; } frame(); requestAnimationFrame(loop); }
    if (reduced) frame(); else loop();
  })();

  /* ---- Hero video: guarantee autoplay + pause when scrolled off-screen ---- */
  const heroVid = $(".hero__bg-video");
  if (heroVid) {
    heroVid.muted = true; heroVid.defaultMuted = true;
    let heroInView = true;                                   // only decode while the hero is visible
    const tryPlay = () => { if (heroInView && !document.hidden) { const p = heroVid.play(); if (p) p.catch(() => {}); } };
    tryPlay();
    heroVid.addEventListener("canplay", tryPlay, { once: true });
    document.addEventListener("pointerdown", tryPlay, { once: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) tryPlay(); });
    // Pause the background video once the hero leaves the viewport — a video that keeps decoding
    // while you scroll the rest of the page is the main cause of homepage scroll jank on mobile.
    const heroSec = $(".hero") || heroVid;
    new IntersectionObserver((es) => es.forEach((en) => {
      heroInView = en.isIntersecting;
      if (heroInView) tryPlay(); else heroVid.pause();
    }), { threshold: 0.05 }).observe(heroSec);
  }

  /* ---- Pause any live 3D box viewer while its iframe is scrolled off-screen ----
     The active WebGL box otherwise keeps rendering (and slowly auto-rotating) forever, even
     when you've scrolled far past the products/catalogue — burning GPU and battery the whole
     time. We message the viewer to pause when it leaves the viewport and resume when it returns.
     The viewer also pauses itself when the browser tab is hidden. Big win on weak devices. */
  (function () {
    if (!("IntersectionObserver" in window)) return;
    const io3d = new IntersectionObserver((es) => es.forEach((en) => {
      try { const w = en.target.contentWindow; if (w) w.postMessage(en.isIntersecting ? "mzk:resume" : "mzk:pause", "*"); } catch (e) {}
    }), { threshold: 0.01 });
    $$(".media-iframe").forEach((f) => io3d.observe(f));
  })();

  /* ---- Mobile: tap a cert/service card to flip it to its preview image (one active at a time) ---- */
  (function () {
    const cards = $$(".cert, .card").filter((c) => c.querySelector(".cert__preview, .card__preview"));
    if (!cards.length) return;
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        if (!matchMedia("(max-width:820px)").matches) return;   // desktop keeps the hover tooltip
        const wasActive = card.classList.contains("is-preview");
        cards.forEach((c) => c.classList.remove("is-preview"));  // revert any other open card
        if (!wasActive) card.classList.add("is-preview");        // toggle this one
      });
    });
  })();

  /* ---- Navbar + mobile menu ---- */
  const nav = $("#nav");
  const onScrollNav = () => nav.classList.toggle("is-scrolled", scrollY > 24);
  onScrollNav(); addEventListener("scroll", onScrollNav, { passive: true });
  const toggle = $("#navToggle"), links = $("#navLinks");
  toggle.addEventListener("click", () => { const o = links.classList.toggle("is-open"); toggle.setAttribute("aria-expanded", String(o)); });
  $$("#navLinks a").forEach((a) => a.addEventListener("click", () => { links.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); }));

  /* ---- Scroll-spy: glow the nav link of the section currently in view ---- */
  (function () {
    const inpage = $$("#navLinks a[href^='#']");
    const map = new Map();
    inpage.forEach((a) => { const sec = document.getElementById(a.getAttribute("href").slice(1)); if (sec) map.set(sec, a); });
    if (!map.size) return;
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        inpage.forEach((a) => a.classList.remove("is-active"));
        const a = map.get(en.target); if (a) a.classList.add("is-active");
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    map.forEach((_, sec) => spy.observe(sec));
  })();

  /* ---- Reveal on scroll (both directions: appears from nothing) — desktop only; on mobile CSS shows
     everything instantly (constant class-toggling + transitions while scrolling caused jank) ---- */
  const io = new IntersectionObserver((es) => es.forEach((en) => {
    en.target.classList.toggle("is-in", en.isIntersecting);
  }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  if (!matchMedia("(max-width:820px)").matches) $$(".reveal").forEach((el) => io.observe(el));

  /* ---- Counters ---- */
  const cio = new IntersectionObserver((es) => es.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target, target = +el.dataset.count, suffix = el.dataset.suffix || "";
    const t0 = performance.now(), dur = 1500;
    const tick = (now) => { const q = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - q, 3);
      el.textContent = Math.round(target * e).toLocaleString() + suffix; if (q < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick); cio.unobserve(el);
  }), { threshold: 0.6 });
  $$("[data-count]").forEach((el) => cio.observe(el));

  /* ---- Testimonials: reveal 10 more each click ---- */
  const testiMoreBtn = $("#testiMoreBtn");
  if (testiMoreBtn) testiMoreBtn.addEventListener("click", () => {
    const nextBatch = $$(".testi[hidden]").slice(0, 10);
    nextBatch.forEach((el) => { el.hidden = false; el.classList.add("is-in"); io.observe(el); });
    if (!$(".testi[hidden]")) testiMoreBtn.classList.add("is-hidden");
  });

  /* ---- Lenis + GSAP (desktop only — smooth-scroll rAF loops cause lag on mobile; touch uses native scroll) ---- */
  let lenis = null;
  if (window.Lenis && !reduced && fine && !LITE0) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    if (!(window.gsap && window.ScrollTrigger)) { const r = (t) => { lenis.raf(t); requestAnimationFrame(r); }; requestAnimationFrame(r); }
    $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      const id = a.getAttribute("href"); if (id.length < 2) return; const el = $(id); if (!el) return;
      e.preventDefault(); lenis.scrollTo(el, { offset: -70 });
    }));
  }
  if (window.gsap && window.ScrollTrigger && !reduced) {
    gsap.registerPlugin(ScrollTrigger);
    if (lenis) { lenis.on("scroll", ScrollTrigger.update); const drive = (t) => lenis.raf(t * 1000);
      gsap.ticker.add(drive); gsap.ticker.lagSmoothing(0); window.__pauseMotion = () => { gsap.ticker.remove(drive); gsap.globalTimeline.pause(); }; }
    // (product cards are now a carousel — see the Products carousel block below)
  }

  /* ---- Floating scroll-to-top button (colors follow the active theme) ---- */
  const topBtn = document.createElement("button");
  topBtn.type = "button";
  topBtn.className = "scrolltop";
  topBtn.setAttribute("aria-label", "Scroll to top");
  topBtn.setAttribute("data-cursor", "link");
  topBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(topBtn);
  const toggleTopBtn = () => topBtn.classList.toggle("is-visible", scrollY > 560);
  toggleTopBtn();
  addEventListener("scroll", toggleTopBtn, { passive: true });
  topBtn.addEventListener("click", () => {
    if (lenis) lenis.scrollTo(0, { duration: 1.2 });
    else scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  });

  /* ---- Leaflet dark map ---- */
  // Başpınar (Organize) OSB Mah. 2.Bölge, 83227 No'lu Cad. No:15, 27600 Şehitkamil / Gaziantep
  const MAP_LOCATION = [37.167621, 37.304813];   // exact facility coordinates
  if (window.L && $("#map")) {
    const map = L.map("map", { scrollWheelZoom: false, attributionControl: true }).setView(MAP_LOCATION, 16);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { maxZoom: 19, subdomains: "abcd", attribution: '© OpenStreetMap © CARTO' }).addTo(map);
    const icon = L.divIcon({ className: "", html: '<div class="map-pin"><i></i></div>', iconSize: [22, 22], iconAnchor: [11, 20] });
    L.marker(MAP_LOCATION, { icon }).addTo(map)
      .bindPopup("<b>Mozaik Ofset ve Ambalaj</b><br>Başpınar OSB, 83227 No'lu Cad. No:15<br>Şehitkamil / Gaziantep")
      .openPopup();
    setTimeout(() => map.invalidateSize(), 400);
    addEventListener("resize", () => map.invalidateSize());
  }

  /* Theme switcher removed — site locked to the default "gold" theme. */
  document.documentElement.dataset.theme && delete document.documentElement.dataset.theme;
  try { localStorage.removeItem("mozaik_theme"); } catch (e) {}

  /* ---- Quote modal → WhatsApp ---- */
  (function () {
    const modal = $("#quoteModal"); if (!modal) return;
    const form = $("#quoteForm");
    const open = () => { modal.classList.add("is-open"); modal.setAttribute("aria-hidden", "false"); };
    const close = () => { modal.classList.remove("is-open"); modal.setAttribute("aria-hidden", "true"); };
    $$("[data-quote-open]").forEach((b) => b.addEventListener("click", open));
    $$("[data-quote-close]", modal).forEach((b) => b.addEventListener("click", close));
    addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("is-open")) close(); });
    if (form) form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = form.elements, v = (n) => ((f[n] && f[n].value) || "").trim();
      const sel = f["ptype"], ptype = sel ? sel.options[sel.selectedIndex].text : "";
      const rows = [["Name", v("name")], ["Company", v("company")], ["Phone", v("phone")],
        ["Product", ptype], ["Dimensions", v("dims")], ["Quantity", v("qty")], ["Notes", v("notes")]];
      const msg = "*Mozaik — Quote request*\n" + rows.filter((r) => r[1]).map((r) => r[0] + ": " + r[1]).join("\n");
      window.open("https://wa.me/905321753400?text=" + encodeURIComponent(msg), "_blank");
      close();
    });
  })();

  /* ---- Runtime FPS watchdog ----
     Some laptops report plenty of cores yet have a weak GPU. Sample the real frame-rate for a
     short window after load; if it is clearly struggling, flip the whole site into lite mode
     (drops the ambient dots + mosaic spotlight live, and CSS drops blur) so scrolling recovers.
     Skipped when we are already in lite mode. */
  if (!LITE0 && !reduced && !/[?&]full=1/.test(location.search)) {
    let last = 0, acc = 0, frames = 0, badSecs = 0, secs = 0, armed = true;
    const watch = (t) => {
      if (!armed) return;
      if (document.hidden) { last = 0; requestAnimationFrame(watch); return; }   // rAF throttles when hidden — ignore
      if (last) {
        acc += t - last; frames++;
        if (acc >= 1000) {                                    // evaluate one ~1s window at a time
          const fps = (frames * 1000) / acc;
          badSecs = fps < 45 ? badSecs + 1 : 0;               // reset on any good second (avoids false positives)
          acc = 0; frames = 0; secs++;
          if (badSecs >= 2) { runtimeWeak = true; html.classList.add("lite"); return; }  // 2 bad seconds in a row -> go lite
          if (secs >= 12) { armed = false; return; }          // stop watching after ~12s if all is well
        }
      }
      last = t;
      requestAnimationFrame(watch);
    };
    // start after the load burst; monitor spans the first interactions/scroll (where jank shows most)
    setTimeout(() => requestAnimationFrame(watch), 600);
    // if it already stopped, give it one more look on the first real scroll
    addEventListener("scroll", () => {
      if (armed || isLite()) return;
      armed = true; last = 0; acc = 0; frames = 0; badSecs = 0; secs = 9;
      requestAnimationFrame(watch);
    }, { passive: true, once: true });
  }

  /* ---- Init ---- */
  applyLang(savedLang);
})();
