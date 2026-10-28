/* ==========================================================================
   RIVALIS — app.js
   Vanilla JS. Dependencias opcionales (CDN) con fallback elegante:
   · Lenis  → scroll suave (si falla, scroll nativo)
   · Three  → logo 3D (si falla / sin WebGL, logo CSS)
   Estructura:
     01 utilidades · 02 estado · 03 preloader · 04 scroll · 05 navegación/menú
     06 texto dividido + reveals · 07 hero (canvas, parallax) · 08 ticker
     09 manifiesto · 10 código 3D · 11 productos · 12 rendimiento
     13 superación (imagen que se abre) · 14 equipo · 15 proceso · 16 galería
     17 formulario · 18 micro-interacciones · 19 arranque
   ========================================================================== */
(() => {
    'use strict';

    /* 01 · UTILIDADES ---------------------------------------------------- */
    const d = document, root = d.documentElement;
    const $ = (s, c = d) => c.querySelector(s);
    const $$ = (s, c = d) => Array.from(c.querySelectorAll(s));
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const rand = (a, b) => a + Math.random() * (b - a);
    const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const WA_NUMBER = '529982588834';

    /* 02 · ESTADO GLOBAL ------------------------------------------------- */
    const S = { vw: innerWidth, vh: innerHeight, y: 0, vel: 0, t: 0, dt: 16, px: 0, py: 0, ready: false };
    let lenis = null;
    const ticks = [];
    const resizers = [];
    const onTick = fn => ticks.push(fn);
    const onResize = fn => resizers.push(fn);

    /** Progreso (0..1) de una sección alta con contenido sticky + si está cerca del viewport. */
    function progressOf(el) {
        const r = el.getBoundingClientRect();
        const total = r.height - S.vh;
        return { r, p: total > 0 ? clamp(-r.top / total) : 0, near: r.bottom > -S.vh * .25 && r.top < S.vh * 1.25 };
    }

    /* 03 · PRELOADER ------------------------------------------------------ */
    function initLoader() {
        return new Promise(resolve => {
            const L = $('#loader');
            if (!L) return resolve();
            root.classList.add('is-loading');

            const num = $('#loaderNum'), bar = $('#loaderBar'), arc = $('#loaderArc');
            const ticksG = $('.loader__ticks', L);
            const NT = 60, lines = [];
            for (let i = 0; i < NT; i++) {
                const a = (i / NT) * Math.PI * 2, r1 = 90, r2 = i % 5 === 0 ? 99 : 95;
                const ln = d.createElementNS('http://www.w3.org/2000/svg', 'line');
                ln.setAttribute('x1', 110 + Math.cos(a) * r1); ln.setAttribute('y1', 110 + Math.sin(a) * r1);
                ln.setAttribute('x2', 110 + Math.cos(a) * r2); ln.setAttribute('y2', 110 + Math.sin(a) * r2);
                ticksG.appendChild(ln); lines.push(ln);
            }

            // carga real: fuentes + imagen del hero + evento load
            const MIN = REDUCE ? 250 : 2200, MAX = 7500;
            const heroImg = $('.hero__athlete img');
            const tasks = [
                d.fonts && d.fonts.ready,
                heroImg && (heroImg.decode ? heroImg.decode().catch(() => {}) : Promise.resolve()),
                new Promise(r => (d.readyState === 'complete' ? r() : addEventListener('load', r, { once: true })))
            ].filter(Boolean);
            let loaded = 0;
            tasks.forEach(t => Promise.resolve(t).catch(() => {}).finally(() => { loaded++; }));

            const t0 = performance.now();
            let p = 0, finished = false;

            const paint = () => {
                const v = Math.round(p);
                num.textContent = String(v).padStart(3, '0');
                bar.style.transform = `scaleX(${p / 100})`;
                arc.style.strokeDashoffset = String(100 - p);
                L.style.setProperty('--pf', clamp((p - 30) / 55).toFixed(2));
                const on = Math.floor((p / 100) * NT);
                for (let i = 0; i < NT; i++) lines[i].classList.toggle('on', i < on);
            };

            const finish = () => {
                if (finished) return; finished = true;
                p = 100; paint();
                setTimeout(() => {
                    L.classList.add('is-done');
                    setTimeout(() => {
                        L.classList.add('is-open');
                        root.classList.remove('is-loading');
                        resolve();
                        setTimeout(() => { L.classList.add('is-gone'); L.setAttribute('aria-hidden', 'true'); }, 1250);
                    }, REDUCE ? 0 : 380);
                }, REDUCE ? 0 : 420);
            };

            const loop = now => {
                if (finished) return;
                const el = now - t0;
                const timeP = easeInOut(clamp(el / MIN)) * 100;
                const realP = loaded >= tasks.length ? 100 : (loaded / tasks.length) * 88;
                p = lerp(p, Math.min(timeP, realP), .16);
                if (p > 99.4 && loaded >= tasks.length && el >= MIN) return finish();
                if (el > MAX) return finish();
                paint();
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        });
    }

    /* 04 · SCROLL (Lenis + bucle principal) ---------------------------------- */
    function initScroll() {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        scrollTo(0, 0);

        if (window.Lenis && !REDUCE) {
            try {
                lenis = new Lenis({ lerp: .085, wheelMultiplier: .92, smoothWheel: true, autoRaf: false });
                lenis.stop();
            } catch (e) { lenis = null; }
        }

        let last = performance.now(), lastY = 0;
        const frame = now => {
            S.dt = Math.min(now - last, 50); last = now; S.t = now;
            if (lenis) lenis.raf(now);
            S.y = lenis ? lenis.scroll : scrollY;
            S.vel = lenis ? lenis.velocity : (S.y - lastY);
            lastY = S.y;
            for (let i = 0; i < ticks.length; i++) ticks[i](now);
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);

        // anclas internas
        d.addEventListener('click', e => {
            const a = e.target.closest('a[href^="#"]');
            if (!a) return;
            const id = a.getAttribute('href');
            if (id.length < 2) return;
            const target = $(id);
            if (!target) return;
            e.preventDefault();
            closeMenu();
            if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.7, easing: t => 1 - Math.pow(1 - t, 4) });
            else target.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' });
        });

        // progreso global
        const barEl = $('#progressBar');
        onTick(() => {
            const max = root.scrollHeight - S.vh;
            barEl.style.transform = `scaleX(${max > 0 ? clamp(S.y / max) : 0})`;
        });
    }
    const stopScroll = () => { if (lenis) lenis.stop(); };
    const startScroll = () => { if (lenis) lenis.start(); };

    /* 05 · NAVEGACIÓN + MENÚ MÓVIL --------------------------------------------- */
    let menuOpen = false;
    function closeMenu() { if (menuOpen) toggleMenu(false); }
    function toggleMenu(force) {
        const menu = $('#menu'), burger = $('#burger');
        if (!menu || !burger) return;
        menuOpen = typeof force === 'boolean' ? force : !menuOpen;
        menu.classList.toggle('is-open', menuOpen);
        menu.setAttribute('aria-hidden', String(!menuOpen));
        burger.setAttribute('aria-expanded', String(menuOpen));
        burger.setAttribute('aria-label', menuOpen ? 'Cerrar menú' : 'Abrir menú');
        root.style.overflow = menuOpen ? 'hidden' : '';
        menuOpen ? stopScroll() : startScroll();
        if (menuOpen) setTimeout(() => { const f = $('.menu__nav a', menu); f && f.focus({ preventScroll: true }); }, 400);
    }
    function initNav() {
        const nav = $('#nav'), burger = $('#burger'), wa = $('.wa');
        $$('.menu__nav a').forEach((a, i) => a.style.setProperty('--n', i));
        burger && burger.addEventListener('click', () => toggleMenu());
        d.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

        let lastY = 0, acc = 0;
        onTick(() => {
            const dy = S.y - lastY; lastY = S.y;
            nav.classList.toggle('is-solid', S.y > 40);
            if (menuOpen) return;
            acc = clamp(acc + dy, -80, 80);
            if (S.y < 500 || acc < -24) nav.classList.remove('is-hidden');
            else if (acc > 48) nav.classList.add('is-hidden');
            if (dy * acc < 0) acc = dy;
        });

        // enlace activo
        const links = new Map($$('.nav__links a').map(a => [a.dataset.nav, a]));
        const io = new IntersectionObserver(entries => {
            entries.forEach(en => {
                if (!en.isIntersecting) return;
                links.forEach(l => l.classList.remove('is-current'));
                const l = links.get(en.target.id);
                l && l.classList.add('is-current');
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        links.forEach((_, id) => { const s = d.getElementById(id); s && io.observe(s); });

        // ocultar el botón de WhatsApp sobre el CTA final para no duplicar
        if (wa) {
            setTimeout(() => wa.classList.add('show-tip'), 6000);
            setTimeout(() => wa.classList.remove('show-tip'), 10500);
        }
    }

    /* 06 · TEXTO DIVIDIDO + REVEALS ---------------------------------------------- */
    function wrapWords(node, make, ctx = { i: 0 }) {
        Array.from(node.childNodes).forEach(ch => {
            if (ch.nodeType === 3) {
                const frag = d.createDocumentFragment();
                ch.textContent.split(/(\s+)/).forEach(part => {
                    if (!part) return;
                    if (/^\s+$/.test(part)) frag.appendChild(d.createTextNode(' '));
                    else frag.appendChild(make(part, ctx.i++));
                });
                node.replaceChild(frag, ch);
            } else if (ch.nodeType === 1 && !ch.matches('br, svg, img')) {
                wrapWords(ch, make, ctx);
            }
        });
        return ctx.i;
    }
    function initSplit() {
        $$('[data-split]').forEach(el => {
            el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
            wrapWords(el, (txt, i) => {
                const w = d.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
                const wi = d.createElement('span'); wi.className = 'wi'; wi.style.setProperty('--wi', i);
                wi.textContent = txt; w.appendChild(wi); return w;
            });
        });
    }
    function initReveals() {
        $$('.gitem').forEach((el, i) => { el.setAttribute('data-reveal', ''); el.style.setProperty('--i', i % 3); });
        const io = new IntersectionObserver((entries, o) => {
            entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); o.unobserve(en.target); } });
        }, { threshold: .15, rootMargin: '0px 0px -6% 0px' });
        $$('[data-reveal], [data-split]').forEach(el => io.observe(el));
    }

    /* 07 · HERO ----------------------------------------------------------------------- */
    function initHero() {
        const hero = $('#inicio'), cv = $('#heroFx');
        if (!hero) return;
        let heroVisible = true;
        onTick(() => { const r = hero.getBoundingClientRect(); heroVisible = r.bottom > 0 && r.top < S.vh; });

        /* parallax por puntero + scroll */
        const layers = $$('[data-depth]', hero).map(el => ({ el, depth: +el.dataset.depth, x: 0, y: 0 }));
        onTick(() => {
            if (!heroVisible) return;
            layers.forEach(o => {
                const tx = FINE ? S.px * o.depth : 0, ty = FINE ? S.py * o.depth * .6 : 0;
                o.x = lerp(o.x, tx, .06); o.y = lerp(o.y, ty, .06);
                const sy = S.y * (o.depth > 0 ? .2 : .1);
                o.el.style.transform = `translate3d(${o.x.toFixed(2)}px, ${(o.y + sy).toFixed(2)}px, 0)`;
            });
        });

        /* cronómetro HUD */
        const out = $('#heroTimer');
        if (out) {
            let t0 = 0, lastTxt = '';
            onTick(now => {
                if (!S.ready || !heroVisible || S.vw < 768) return;
                if (!t0) t0 = now;
                const ms = now - t0;
                const txt = `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(Math.floor(ms / 10) % 100).padStart(2, '0')}`;
                if (txt !== lastTxt) { out.textContent = txt; lastTxt = txt; }
            });
        }

        /* canvas: rayas de velocidad + brasas lima */
        if (!cv) return;
        const ctx = cv.getContext('2d');
        let W = 0, H = 0, dpr = 1;
        const ANG = 28 * Math.PI / 180, DX = Math.cos(ANG), DY = -Math.sin(ANG);
        let streaks = [], embers = [];

        const glow = d.createElement('canvas'); glow.width = glow.height = 64;
        const gx = glow.getContext('2d'), gg = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gg.addColorStop(0, 'rgba(235,255,80,1)'); gg.addColorStop(.22, 'rgba(203,241,0,.6)'); gg.addColorStop(1, 'rgba(203,241,0,0)');
        gx.fillStyle = gg; gx.fillRect(0, 0, 64, 64);

        const spawnStreak = (s, init) => {
            s.len = rand(140, 460) * (.55 + W / 1800);
            s.sp = rand(420, 1250) * (.6 + W / 2200);
            s.lw = rand(.8, 2.6); s.a = rand(.28, .9); s.hot = Math.random() < .22;
            if (init) { s.x = rand(-100, W + 100); s.y = rand(-100, H + 100); }
            else if (Math.random() < .5) { s.x = rand(-s.len, W * .8); s.y = H + rand(20, 160); }
            else { s.x = -s.len * DX - rand(20, 220); s.y = rand(H * .15, H + 80); }
            return s;
        };
        const spawnEmber = (e, init) => {
            e.r = rand(1.2, 4.2); e.vy = rand(14, 52); e.ph = rand(0, 6.28); e.sw = rand(.4, 1.4); e.a = rand(.35, 1); e.tw = rand(1.2, 3.2);
            e.x = rand(0, W); e.y = init ? rand(0, H) : H + rand(10, 80);
            return e;
        };
        const resize = () => {
            W = hero.clientWidth; H = hero.clientHeight;
            dpr = Math.min(devicePixelRatio || 1, S.vw < 768 ? 1.5 : 1.75);
            cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const mob = S.vw < 768;
            streaks = Array.from({ length: mob ? 9 : 18 }, () => spawnStreak({}, true));
            embers = Array.from({ length: mob ? 38 : 96 }, () => spawnEmber({}, true));
        };
        resize(); onResize(resize);

        const draw = (now, dt) => {
            ctx.clearRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'lighter';
            const boost = 1 + clamp(Math.abs(S.vel) * .03, 0, 3.2);
            const sec = dt / 1000;

            for (const s of streaks) {
                s.x += DX * s.sp * sec * boost; s.y += DY * s.sp * sec * boost;
                if (s.x - s.len * DX > W + 60 || s.y + s.len * -DY < -60) spawnStreak(s, false);
                const tx = s.x - DX * s.len, ty = s.y - DY * s.len;
                const g = ctx.createLinearGradient(tx, ty, s.x, s.y);
                const c = s.hot ? '255,255,255' : '203,241,0';
                g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(.75, `rgba(${c},${s.a * .55})`); g.addColorStop(1, `rgba(${c},${s.a})`);
                ctx.strokeStyle = g; ctx.lineWidth = s.lw; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(s.x, s.y); ctx.stroke();
            }
            const wind = FINE ? S.px * 26 : 0;
            for (const e of embers) {
                e.y -= e.vy * sec * (1 + (boost - 1) * .6);
                e.x += (Math.sin(e.ph + now * .001 * e.sw) * 12 + wind) * sec;
                if (e.y < -20) spawnEmber(e, false);
                const tw = .55 + .45 * Math.sin(now * .001 * e.tw + e.ph);
                ctx.globalAlpha = e.a * tw;
                const sz = e.r * 7;
                ctx.drawImage(glow, e.x - sz / 2, e.y - sz / 2, sz, sz);
            }
            ctx.globalAlpha = 1;
        };

        if (REDUCE) { draw(0, 0); return; }
        onTick((now) => { if (heroVisible && !d.hidden) draw(now, S.dt); });
    }

    /* 08 · TICKER ------------------------------------------------------------------------- */
    function initTicker() {
        const rows = $$('.ticker__row').map(row => {
            const track = $('.ticker__track', row);
            return { track, dir: +row.dataset.dir || -1, x: 0, loop: 0 };
        });
        const measure = () => rows.forEach(r => {
            r.loop = r.track.scrollWidth / 4;
            if (r.dir > 0 && r.x === 0) r.x = -r.loop / 2;
        });
        measure(); onResize(measure);
        if (REDUCE) return;
        const wrap = $('.ticker');
        onTick(() => {
            const rc = wrap.getBoundingClientRect();
            if (rc.bottom < -50 || rc.top > S.vh + 50) return;
            const sp = 70 * (1 + clamp(S.vel * .22, -6, 6));
            rows.forEach(r => {
                if (!r.loop) return;
                r.x += r.dir * sp * (S.dt / 1000);
                if (r.x <= -r.loop) r.x += r.loop;
                if (r.x > 0) r.x -= r.loop;
                r.track.style.transform = `translate3d(${r.x.toFixed(1)}px,0,0)`;
            });
        });
    }

    /* 09 · MANIFIESTO (texto que se enciende con el scroll) ------------------------------------ */
    function initManifesto() {
        const sec = $('#manifiesto'), txt = $('#manifestoText');
        if (!sec || !txt) return;
        const words = [];
        wrapWords(txt, (w) => { const s = d.createElement('span'); s.className = 'mw'; s.textContent = w; words.push({ el: s, k: -1 }); return s; });
        if (REDUCE) { words.forEach(w => w.el.style.setProperty('--k', 1)); return; }
        const n = words.length;
        onTick(() => {
            const { p, near } = progressOf(sec);
            if (!near) return;
            const pos = clamp((p - .06) / .7) * (n + 4);
            for (let i = 0; i < n; i++) {
                const k = clamp((pos - i) / 4);
                if (Math.abs(k - words[i].k) > .012) { words[i].k = k; words[i].el.style.setProperty('--k', k.toFixed(3)); }
            }
        });
    }

    /* 10 · EL CÓDIGO — logo 3D con Three.js (+ fallback CSS) ---------------------------------------- */
    function initCode() {
        const sec = $('#codigo'), stage = $('#codeStage'), canvas = $('#codeCanvas');
        if (!sec || !stage) return;
        const steps = $$('.code__step', sec), rail = $$('.code__rail li', sec), fb = $('#codeFallback');
        let stepIdx = -1, p = 0, near = false;
        let gl = null, loading = false;

        const setStep = i => {
            if (i === stepIdx) return; stepIdx = i;
            steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
            rail.forEach((r, k) => r.classList.toggle('is-active', k === i));
        };
        setStep(0);

        onTick(() => {
            const o = progressOf(sec); p = o.p; near = o.near;
            if (!near) return;
            setStep(clamp(Math.floor(p * 3 * .999), 0, 2));
            if (fb) fb.style.setProperty('--ry', (p * 360 + S.px * 12).toFixed(1));
            if (gl) gl.render(S.t, p);
            else if (!loading) { loading = true; boot3D(); }
        });
        // pre-carga del módulo 3D cuando falta ~1 pantalla
        const pre = new IntersectionObserver(es => { if (es[0].isIntersecting && !loading) { loading = true; boot3D(); pre.disconnect(); } }, { rootMargin: '120% 0px' });
        pre.observe(sec);

        async function boot3D() {
            try {
                const test = d.createElement('canvas');
                if (!(test.getContext('webgl2') || test.getContext('webgl'))) throw new Error('sin WebGL');
                const THREE = await import('three');
                let RoomEnvironment = null;
                try { ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js')); } catch (e) { /* opcional */ }
                gl = build3D(THREE, RoomEnvironment);
                stage.classList.add('is-3d');
            } catch (err) {
                console.warn('[Rivalis] 3D no disponible, se usa el logo CSS:', err && err.message);
                stage.classList.add('no-3d');
            }
        }

        function build3D(THREE, RoomEnvironment) {
            const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
            renderer.setClearColor(0x000000, 0);
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.15;
            renderer.outputColorSpace = THREE.SRGBColorSpace;

            const scene = new THREE.Scene();
            if (RoomEnvironment) {
                const pm = new THREE.PMREMGenerator(renderer);
                scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
                scene.environmentIntensity = .9;
            }
            const camera = new THREE.PerspectiveCamera(30, 1, .1, 120);

            // geometría extruida a partir del logotipo
            const sc = 4.6 / 1172, X = x => (x - 586) * sc, Y = y => -(y - 299) * sc;
            const body = new THREE.Shape();
            body.moveTo(X(260), Y(0)); body.lineTo(X(1080), Y(0));
            body.quadraticCurveTo(X(1172), Y(0), X(1150), Y(60)); body.lineTo(X(1090), Y(236));
            body.quadraticCurveTo(X(1079), Y(266), X(1052), Y(280)); body.lineTo(X(923), Y(347));
            body.lineTo(X(1077), Y(521)); body.lineTo(X(903), Y(521)); body.lineTo(X(705), Y(325));
            body.lineTo(X(993), Y(133)); body.lineTo(X(466), Y(133)); body.closePath();
            const leg = new THREE.Shape();
            leg.moveTo(X(475), Y(216)); leg.lineTo(X(718), Y(216)); leg.lineTo(X(353), Y(498)); leg.lineTo(X(0), Y(598)); leg.closePath();

            const depth = .62;
            const geo = new THREE.ExtrudeGeometry([body, leg], { depth, bevelEnabled: true, bevelThickness: .07, bevelSize: .055, bevelSegments: 4, curveSegments: 14 });
            geo.translate(0, 0, -depth / 2);

            const capMat = new THREE.MeshStandardMaterial({ color: 0xcbf100, metalness: .42, roughness: .26, emissive: 0x4a5e00, emissiveIntensity: .55 });
            const sideMat = new THREE.MeshStandardMaterial({ color: 0x8aa300, metalness: .85, roughness: .22, emissive: 0x1e2800, emissiveIntensity: .5 });
            const mesh = new THREE.Mesh(geo, [capMat, sideMat]);
            const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 32), new THREE.LineBasicMaterial({ color: 0xeeff7a, transparent: true, opacity: .5 }));
            const group = new THREE.Group(); group.add(mesh, edges);
            scene.add(group);

            // anillo de partículas
            const N = 900, pos = new Float32Array(N * 3);
            for (let i = 0; i < N; i++) {
                const a = Math.random() * Math.PI * 2, r = 3.4 + Math.pow(Math.random(), 1.6) * 3.4;
                pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = (Math.random() - .5) * 3.2; pos[i * 3 + 2] = Math.sin(a) * r * .55;
            }
            const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xcbf100, size: .045, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }));
            scene.add(dust);

            // luces
            scene.add(new THREE.AmbientLight(0xffffff, .35));
            const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 4, 6); scene.add(key);
            const limeL = new THREE.PointLight(0xcbf100, 55, 24, 1.6); limeL.position.set(-5, -1.5, 4); scene.add(limeL);
            const rim = new THREE.PointLight(0xffffff, 38, 24, 1.6); rim.position.set(5, 2.5, -4); scene.add(rim);

            let w = 0, h = 0, camZ = 12, visW = 10, visH = 6;
            const resize = () => {
                w = stage.clientWidth; h = stage.clientHeight; if (!w || !h) return;
                renderer.setPixelRatio(Math.min(devicePixelRatio || 1, S.vw < 768 ? 1.5 : 1.8));
                renderer.setSize(w, h, false);
                const aspect = w / h; camera.aspect = aspect;
                const frac = aspect > 1.15 ? .42 : .8;
                const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
                camZ = 4.6 / (frac * 2 * tanH * aspect);
                camera.position.set(0, 0, camZ); camera.updateProjectionMatrix();
                visH = 2 * tanH * camZ; visW = visH * aspect;
                if (aspect > 1.15) { group.position.set(visW * .2, 0, 0); } else { group.position.set(0, visH * .2, 0); }
                dust.position.copy(group.position);
            };
            resize(); onResize(resize);

            let rx = 0, ry = 0;
            return {
                render(t, prog) {
                    const idle = REDUCE ? 0 : t * .001;
                    const targetY = -.45 + prog * Math.PI * 2 + (FINE ? S.px * .3 : 0) + Math.sin(idle * .7) * .07;
                    const targetX = (FINE ? S.py * .18 : 0) + Math.sin(idle * .5) * .05;
                    ry = lerp(ry, targetY, .1); rx = lerp(rx, targetX, .1);
                    group.rotation.set(rx, ry, 0);
                    const s = 1 + Math.sin(idle * 1.4) * .012;
                    group.scale.setScalar(s);
                    const k = Math.min(Math.floor(prog * 3 * .999), 2);
                    capMat.emissiveIntensity = lerp(capMat.emissiveIntensity, [.5, 1.05, .8][k], .06);
                    limeL.intensity = lerp(limeL.intensity, [50, 85, 60][k], .06);
                    dust.rotation.y = idle * .12 + prog * 2.2;
                    renderer.render(scene, camera);
                }
            };
        }
    }

    /* 11 · PRODUCTOS (scroll horizontal anclado en desktop, carrusel en móvil) ----------------------------- */
    function initProducts() {
        const sec = $('#productos'), track = $('#prodTrack');
        if (!sec || !track) return;
        const panels = $$('.prod:not(.prod--end)', track);
        const cur = $('#prodCur'), bar = $('#prodBar'), dots = $$('#prodDots li');
        const mq = matchMedia('(min-width: 1024px)');
        let pinned = false, maxX = 0, idx = -1;

        const setIdx = i => {
            if (i === idx) return; idx = i;
            cur.textContent = String(i + 1).padStart(2, '0');
            dots.forEach((dEl, k) => dEl.classList.toggle('is-on', k === i));
        };
        const measure = () => {
            pinned = mq.matches && !REDUCE;
            sec.classList.toggle('is-pinned', pinned);
            track.style.transform = '';
            if (pinned) {
                maxX = Math.max(0, track.scrollWidth - S.vw);
                sec.style.setProperty('--prod-h', `${Math.round(maxX + S.vh * 1.05)}px`);
            } else { sec.style.removeProperty('--prod-h'); maxX = 0; }
        };
        measure(); onResize(measure);
        addEventListener('load', measure);
        d.fonts && d.fonts.ready.then(measure);
        panels.forEach(p => { const im = $('img', p); im && im.addEventListener('load', measure, { once: true }); });

        onTick(() => {
            if (pinned) {
                const { p, near } = progressOf(sec);
                if (!near) return;
                const x = -p * maxX;
                track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
                let best = 0, bd = 1e9;
                panels.forEach((pn, i) => {
                    const r = pn.getBoundingClientRect();
                    const c = r.left + r.width / 2 - S.vw * .5;
                    pn.style.setProperty('--px', clamp(c / S.vw, -1, 1).toFixed(3));
                    if (Math.abs(c) < bd) { bd = Math.abs(c); best = i; }
                });
                setIdx(best);
                bar.style.transform = `scaleX(${(.06 + p * .94).toFixed(3)})`;
            }
        });

        // carrusel nativo (móvil / tablet)
        track.addEventListener('scroll', () => {
            if (pinned) return;
            const max = track.scrollWidth - track.clientWidth;
            const p = max > 0 ? track.scrollLeft / max : 0;
            setIdx(clamp(Math.round(p * (panels.length - 1)), 0, panels.length - 1));
            bar.style.transform = `scaleX(${(.06 + p * .94).toFixed(3)})`;
        }, { passive: true });
        setIdx(0);

        // accesibilidad: si un botón recibe foco con teclado, llevamos el scroll vertical a ese panel
        track.addEventListener('focusin', e => {
            if (!pinned) return;
            const pn = e.target.closest('.prod'); if (!pn) return;
            const pin = $('.products__pin', sec); pin.scrollLeft = 0;
            const x = clamp(pn.offsetLeft - (S.vw - pn.offsetWidth) / 2, 0, maxX);
            const y = sec.getBoundingClientRect().top + scrollY + (maxX ? x / maxX : 0) * (sec.offsetHeight - S.vh);
            lenis ? lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y);
        });
    }

    /* 12 · RENDIMIENTO (hotspots, colores, contadores) -------------------------------------------------------- */
    function initSpec() {
        const sec = $('#rendimiento'); if (!sec) return;
        const hots = $$('.hot', sec), imgs = { A: $('#specA'), B: $('#specB') };

        // ciclo automático de tarjetas
        let hi = 0, last = 0;
        if (!REDUCE) onTick(now => {
            if (now - last < 2600) return;
            const r = sec.getBoundingClientRect(); if (r.bottom < 0 || r.top > S.vh) return;
            last = now; hots.forEach((h, i) => h.classList.toggle('is-hot', i === hi)); hi = (hi + 1) % hots.length;
        });
        hots.forEach(h => h.addEventListener('mouseenter', () => hots.forEach(o => o.classList.toggle('is-hot', o === h))));

        // selector de color
        $$('.swatch', sec).forEach(b => b.addEventListener('click', () => {
            $$('.swatch', sec).forEach(o => { const on = o === b; o.classList.toggle('is-on', on); o.setAttribute('aria-pressed', String(on)); });
            const k = b.dataset.swatch;
            Object.entries(imgs).forEach(([key, im]) => im.classList.toggle('is-on', key === k));
        }));

        // contadores
        const nums = $$('[data-count]', sec);
        const io = new IntersectionObserver((es, o) => es.forEach(en => {
            if (!en.isIntersecting) return; o.unobserve(en.target);
            const el = en.target, to = +el.dataset.count, dur = 1500, t0 = performance.now();
            if (REDUCE) { el.textContent = to; return; }
            const step = now => {
                const k = easeOut(clamp((now - t0) / dur));
                el.textContent = Math.round(to * k);
                if (k < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }), { threshold: .6 });
        nums.forEach(n => { n.textContent = '0'; io.observe(n); });
    }

    /* 12b · SELECTOR DE COLOR en las secciones de detalle (cinturones) ------------------------------------------ */
    function initSwatchGroups() {
        $$('[data-swatch-group]').forEach(g => {
            const btns = $$('.swatch', g), imgs = $$('.spec__img[data-for]', g);
            btns.forEach(b => b.addEventListener('click', () => {
                btns.forEach(o => { const on = o === b; o.classList.toggle('is-on', on); o.setAttribute('aria-pressed', String(on)); });
                imgs.forEach(im => im.classList.toggle('is-on', im.dataset.for === b.dataset.swatch));
            }));
        });
    }

    /* 13 · SUPERACIÓN (la imagen se abre con el scroll) ------------------------------------------------------------ */
    function initReach() {
        const sec = $('#superacion'), frame = $('#reachFrame'), pin = $('.reach__pin', sec || d), bg = $('.reach__bgtext span', sec || d);
        if (!sec || !frame) return;
        const ASP = 618 / 1256;
        let lastFw = 0;
        onTick(() => {
            const { p, near } = progressOf(sec);
            if (!near) return;
            const mobile = S.vw < 768;
            const e = easeInOut(clamp(p / .56));
            const co = clamp((p - .58) / .22);
            const endH = S.vh, endW = mobile ? S.vw : Math.min(S.vw, S.vh * ASP);
            const startH = S.vh * (mobile ? .4 : .36), startW = startH * ASP * (mobile ? 1.05 : 1);
            const fw = lerp(startW, endW, e), fh = lerp(startH, endH, e);
            frame.style.setProperty('--fw', fw.toFixed(1) + 'px');
            frame.style.setProperty('--fh', fh.toFixed(1) + 'px');
            frame.style.setProperty('--cut', (lerp(30, 0, e)).toFixed(1) + 'px');
            frame.style.setProperty('--sc', lerp(1.28, 1, e).toFixed(3));
            frame.style.setProperty('--br', (mobile ? lerp(1, .3, co) : lerp(.85, 1, e)).toFixed(3));
            frame.style.setProperty('--bl', (mobile ? lerp(0, 3, co) : 0).toFixed(2) + 'px');
            pin.style.setProperty('--co', co.toFixed(3));
            if (Math.abs(endW - lastFw) > 1) { pin.style.setProperty('--fw-end', endW.toFixed(1) + 'px'); lastFw = endW; }
            if (bg) bg.style.transform = `translate3d(${lerp(14, -14, p).toFixed(2)}vw,0,0) scale(${lerp(1, 1.18, p).toFixed(3)})`;
        });
    }

    /* 14 · EQUIPO (parallax por capas) ------------------------------------------------------------------------------------ */
    function initTeam() {
        const sec = $('#equipo'); if (!sec) return;
        const els = $$('[data-par]', sec).map(el => ({ el, f: +el.dataset.par / 100, x: !!el.closest('.team__giant') }));
        onTick(() => {
            const r = sec.getBoundingClientRect();
            if (r.bottom < -100 || r.top > S.vh + 100) return;
            const off = r.top + r.height / 2 - S.vh / 2;
            els.forEach(o => {
                const v = off * o.f * (o.x ? -2.2 : 1);
                o.el.style.transform = o.x ? `translate3d(${v.toFixed(1)}px,0,0)` : `translate3d(0,${v.toFixed(1)}px,0)`;
            });
        });
    }

    /* 15 · PROCESO (línea de meta que se llena) --------------------------------------------------------------------------------- */
    function initProcess() {
        const wrap = $('#stepsWrap'), ol = $('#steps'); if (!wrap || !ol) return;
        const steps = $$('.step', ol);
        onTick(() => {
            const r = ol.getBoundingClientRect();
            if (r.bottom < -100 || r.top > S.vh + 100) return;
            const line = S.vh * .62;
            wrap.style.setProperty('--prog', clamp((line - r.top) / r.height).toFixed(4));
            steps.forEach(s => s.classList.toggle('is-on', s.getBoundingClientRect().top < line));
        });
    }

    /* 16 · GALERÍA + LIGHTBOX ----------------------------------------------------------------------------------------------------- */
    function initGallery() {
        const wrap = $('#galleryCols'); if (!wrap) return;
        const cols = $$('.gcol', wrap).map(el => ({ el, f: [0, -.05, .04][+el.dataset.speed] || 0 }));
        if (!REDUCE) onTick(() => {
            if (S.vw < 640) return;
            const r = wrap.getBoundingClientRect();
            if (r.bottom < -100 || r.top > S.vh + 100) return;
            const off = r.top + r.height / 2 - S.vh / 2;
            cols.forEach(c => { if (c.f) c.el.style.transform = `translate3d(0,${(off * c.f).toFixed(1)}px,0)`; });
        });

        const dlg = $('#lightbox'), img = $('#lbImg'), cap = $('#lbCap');
        const items = $$('[data-lightbox]');
        let i = 0, opener = null;
        const show = n => {
            i = (n + items.length) % items.length;
            const b = items[i], th = $('img', b);
            img.src = b.dataset.lightbox; img.alt = th ? th.alt : '';
            cap.textContent = b.dataset.cap || '';
        };
        const open = n => {
            opener = items[n]; show(n);
            if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
            stopScroll();
        };
        const close = () => { dlg.close ? dlg.close() : dlg.removeAttribute('open'); };
        dlg.addEventListener('close', () => { startScroll(); opener && opener.focus({ preventScroll: true }); });
        items.forEach((b, n) => b.addEventListener('click', () => open(n)));
        $('#lbClose').addEventListener('click', close);
        $('#lbPrev').addEventListener('click', () => show(i - 1));
        $('#lbNext').addEventListener('click', () => show(i + 1));
        dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
        dlg.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(i - 1); if (e.key === 'ArrowRight') show(i + 1); });
        let sx = 0;
        dlg.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
        dlg.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); }, { passive: true });
    }

    /* 17 · FORMULARIO → WHATSAPP ------------------------------------------------------------------------------------------------------- */
    function initForm() {
        const form = $('#waForm'); if (!form) return;
        const name = $('#fName'), interest = $('#fInterest'), msg = $('#fMsg');
        const err = (el, text) => {
            const f = el.closest('.field'); f.classList.toggle('has-err', !!text);
            $('.field__err', f).textContent = text || '';
        };
        [name, interest].forEach(el => el.addEventListener('input', () => err(el, '')));
        form.addEventListener('submit', e => {
            e.preventDefault();
            let ok = true;
            if (name.value.trim().length < 2) { err(name, 'Dinos tu nombre para saludarte.'); ok = false; }
            if (!interest.value) { err(interest, 'Elige qué te interesa.'); ok = false; }
            if (!ok) { (name.value.trim().length < 2 ? name : interest).focus(); return; }
            const text = `Hola Rivalis, soy ${name.value.trim()}. Me interesa: ${interest.value}.` +
                (msg.value.trim() ? `\n${msg.value.trim()}` : '') + '\nEstoy listo para competir.';
            const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
            const btn = $('button[type="submit"] span', form), old = btn.innerHTML;
            btn.innerHTML = '¡Abriendo WhatsApp…';
            const w = window.open(url, '_blank', 'noopener');
            if (!w) location.href = url;
            setTimeout(() => { btn.innerHTML = old; }, 3200);
        });
    }

    /* 18 · MICRO-INTERACCIONES ----------------------------------------------------------------------------------------------------------- */
    function initWhatsAppLinks() {
        $$('a[data-wa]').forEach(a => { a.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(a.dataset.wa)}`; });
    }
    function initMagnetic() {
        if (!FINE || REDUCE) return;
        $$('.magnetic').forEach(el => {
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect();
                el.style.setProperty('--tx', ((e.clientX - r.left - r.width / 2) * .22).toFixed(1) + 'px');
                el.style.setProperty('--ty', ((e.clientY - r.top - r.height / 2) * .32).toFixed(1) + 'px');
            });
            el.addEventListener('pointerleave', () => { el.style.setProperty('--tx', '0px'); el.style.setProperty('--ty', '0px'); });
        });
    }
    function initTilt() {
        if (!FINE || REDUCE) return;
        const items = $$('[data-tilt], [data-tilt-soft]').map(el => ({ el, soft: el.hasAttribute('data-tilt-soft'), tx: 0, ty: 0, x: 0, y: 0, hover: false }));
        items.forEach(o => {
            o.el.addEventListener('pointermove', e => {
                const r = o.el.getBoundingClientRect();
                const nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5;
                const m = o.soft ? 7 : 12;
                o.ty = nx * m * 1.2; o.tx = -ny * m; o.hover = true;
            });
            o.el.addEventListener('pointerleave', () => { o.tx = 0; o.ty = 0; o.hover = false; });
        });
        onTick(() => items.forEach(o => {
            if (!o.hover && Math.abs(o.x) < .01 && Math.abs(o.y) < .01) return;
            o.x = lerp(o.x, o.tx, .1); o.y = lerp(o.y, o.ty, .1);
            o.el.style.setProperty('--rx', o.x.toFixed(2) + 'deg'); o.el.style.setProperty('--ry', o.y.toFixed(2) + 'deg');
        }));
    }
    function initPointer() {
        addEventListener('pointermove', e => { S.px = e.clientX / S.vw * 2 - 1; S.py = e.clientY / S.vh * 2 - 1; }, { passive: true });
    }

    /* 19 · ARRANQUE ---------------------------------------------------------------------------------------------------------------------------- */
    function boot() {
        let rt;
        addEventListener('resize', () => {
            clearTimeout(rt);
            rt = setTimeout(() => { S.vw = innerWidth; S.vh = innerHeight; resizers.forEach(fn => fn()); }, 140);
        });
        const yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();

        initWhatsAppLinks();
        initSplit();
        initScroll();
        initPointer();
        initNav();
        initHero();
        initTicker();
        initManifesto();
        initCode();
        initProducts();
        initSpec();
        initSwatchGroups();
        initReach();
        initTeam();
        initProcess();
        initGallery();
        initForm();
        initMagnetic();
        initTilt();

        stopScroll();
        initLoader().then(() => {
            S.ready = true;
            root.classList.add('is-ready');
            startScroll();
            setTimeout(initReveals, 250);
        });
    }

    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
