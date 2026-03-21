/**
 * kt.ball.js – Fußball-Easter-Egg auf der Tipp-Übersicht
 *
 * Ein kleiner Fußball liegt auf der Tabelle. Cursor stupst ihn.
 * Versteckte Breakout-Mechanik: Punkte-Zellen (td.Pts1) sind unsichtbare
 * Blöcke – erst beim ersten Treffer offenbart sich das Spiel.
 * Score wird pro Spieler/Spieltag gespeichert.
 * Nur Desktop (>= 992px). Keine externe Physics-Engine nötig.
 */
(function (kt, $j) {

    var CFG = {
        R:          10,       // Ball-Radius
        GRAVITY:    0.09,     // Schwerkraft pro Frame
        BOUNCE:     0.69,     // Rückprall-Faktor
        FRICTION:   0.997,    // Luftwiderstand (multipliziert pro Frame)
        CURSOR_R:   20,       // Cursor-Kollisionsradius
        MAX_V:      14,       // Maximalgeschwindigkeit
        MIN_VP:     992,      // Minimum-Viewport-Breite
        GHOST_MS:   2500,     // Max Ghost-Mode-Dauer
        BOTTOM_M:   50,       // Abstand zum unteren Fensterrand (Taskleiste)
        BLOCK_SEL: 'td.Pts1',
        LS_KEY: 'kt_ball_data'
    };

    // State
    var ball, canvas, ctx;
    var active = false, animFrame;
    var cursor = { x: -999, y: -999, vx: 0, vy: 0, lx: 0, ly: 0, lt: 0 };
    var cursorFlash = 0;  // Aufleuchten bei Kontakt (0..1)
    var ghostMode = false, ghostStart = 0;
    var revealed = false;
    var score = 0;
    var allScores = {};  // { "trid_md_fullName": { name, fullName, trid, md, score } }
    var floatingTexts = [];
    var particles = [];
    var scorePanel = null;
    var audioCtx = null;
    var soundEnabled = localStorage.getItem('kt_sound') !== 'off';

    // ═══════════════════════════════════════════════════════════════
    //  Boost-System: Punkte laden den Ball auf
    // ═══════════════════════════════════════════════════════════════
    var charge = 0;              // Aufladung (jeder Punkt +1)
    var chargeLastHit = 0;       // Zeitpunkt des letzten Punkt-Treffers
    var CHARGE_HOLD = 1000;      // ms bevor Abbau startet
    var CHARGE_DECAY = 4;        // Abbau pro Sekunde (nach ~6-7s fast weg)
    var CHARGE_MAX = 25;         // Deckel

    function chargePct() { return Math.min(charge / CHARGE_MAX, 1); }
    function chargeR()   { return CFG.R * (1 + chargePct() * 0.5); }        // bis 50% größer
    function chargeBounce() { return CFG.BOUNCE * (1 + chargePct() * 0.4); } // bis 40% mehr Bounce
    function chargeGravity() { return CFG.GRAVITY * (1 - chargePct() * 0.45); } // bis 45% weniger Gravity

    function addCharge(pts) {
        charge = Math.min(charge + pts, CHARGE_MAX);
        chargeLastHit = performance.now();
    }

    function decayCharge(dt) {
        if (charge <= 0) return;
        var elapsed = performance.now() - chargeLastHit;
        if (elapsed < CHARGE_HOLD) return;
        charge -= CHARGE_DECAY * dt / 1000;
        if (charge < 0) charge = 0;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Zahlen-Jagd: Mini-Game wenn Übersicht leer ist
    // ═══════════════════════════════════════════════════════════════
    var hunt = {
        active: false,
        ready: false,          // true wenn 15s + 10 Berührungen erreicht
        touchCount: 0,
        firstTouchTime: 0,
        round: 0,
        timer: 60,
        timerEl: null,
        targets: [],           // [{ el, num }]
        intervalId: null
    };

    // "Pfubb"-Sound: kurzer gedämpfter Tiefton, Lautstärke proportional zur Schuss-Stärke
    function initAudio() {
        if (audioCtx) return;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {}
    }

    function playKick(intensity) {
        if (intensity < 0.03) return;
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        try {
            var now = audioCtx.currentTime;
            var vol = 0.15 + intensity * 0.55;    // 0.15 (leise) bis 0.7 (kräftig)
            var freq = 100 + intensity * 80;      // 100-180 Hz

            // Noise-Burst für den "Pf"-Anteil
            var bufLen = audioCtx.sampleRate * 0.03;
            var noiseBuf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
            var data = noiseBuf.getChannelData(0);
            for (var i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
            var noise = audioCtx.createBufferSource();
            noise.buffer = noiseBuf;
            var noiseGain = audioCtx.createGain();
            noiseGain.gain.setValueAtTime(vol * 0.4, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            noise.connect(noiseGain);
            noiseGain.connect(audioCtx.destination);
            noise.start(now);

            // Tiefer Sinus für den "ubb"-Anteil
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.2);
        } catch (e) {}
    }

    // "Pling"-Sound beim Block-Zerstören: heller Glockenton
    function playPling(pts) {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        try {
            var now = audioCtx.currentTime;
            var vol = 0.18 + Math.min(pts, 3) * 0.06;
            var baseFreq = 1200 + pts * 200;   // höher bei mehr Punkten

            // Hauptton (Sinus)
            var osc1 = audioCtx.createOscillator();
            var g1 = audioCtx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(baseFreq, now);
            osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, now + 0.25);
            g1.gain.setValueAtTime(vol, now);
            g1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc1.connect(g1);
            g1.connect(audioCtx.destination);
            osc1.start(now);
            osc1.stop(now + 0.35);

            // Oberton (Triangle, Oktave höher) für Glanz
            var osc2 = audioCtx.createOscillator();
            var g2 = audioCtx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(baseFreq * 2, now);
            g2.gain.setValueAtTime(vol * 0.3, now);
            g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc2.connect(g2);
            g2.connect(audioCtx.destination);
            osc2.start(now);
            osc2.stop(now + 0.2);
        } catch (e) {}
    }

    // Pentagon-Zentren auf Einheitskugel (Ikosaeder)
    var pentas = [
        {x:0,y:-1,z:0},{x:0,y:1,z:0},
        {x:.894,y:-.447,z:0},{x:.276,y:-.447,z:.851},{x:-.724,y:-.447,z:.526},
        {x:-.724,y:-.447,z:-.526},{x:.276,y:-.447,z:-.851},
        {x:.724,y:.447,z:.526},{x:-.276,y:.447,z:.851},{x:-.894,y:.447,z:0},
        {x:-.276,y:.447,z:-.851},{x:.724,y:.447,z:-.526}
    ];

    // ═══════════════════════════════════════════════════════════════
    //  Quaternion-Hilfsfunktionen (physikalisch korrekte 3D-Rotation)
    // ═══════════════════════════════════════════════════════════════
    function qMul(a, b) {
        return [
            a[0]*b[0] - a[1]*b[1] - a[2]*b[2] - a[3]*b[3],
            a[0]*b[1] + a[1]*b[0] + a[2]*b[3] - a[3]*b[2],
            a[0]*b[2] - a[1]*b[3] + a[2]*b[0] + a[3]*b[1],
            a[0]*b[3] + a[1]*b[2] - a[2]*b[1] + a[3]*b[0]
        ];
    }

    function qNorm(q) {
        var len = Math.sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3]);
        return [q[0]/len, q[1]/len, q[2]/len, q[3]/len];
    }

    function qRotate(q, px, py, pz) {
        // q * [0,px,py,pz] * q^-1
        var qp = qMul(q, [0, px, py, pz]);
        var r = qMul(qp, [q[0], -q[1], -q[2], -q[3]]);
        return [r[1], r[2], r[3]];
    }

    // ═══════════════════════════════════════════════════════════════
    //  Injiziertes CSS: Glut-Effekt + Hover-Deaktivierung
    // ═══════════════════════════════════════════════════════════════
    var styleEl = null;
    function injectStyles() {
        if (styleEl) return;
        styleEl = document.createElement('style');
        styleEl.textContent =
            // Platz am unteren Rand, damit der Ball die letzten Zeilen erreicht
            'body.kt-ball-active { margin-bottom: ' + CFG.BOTTOM_M + 'px; }' +

            // Row-Hover im Game-Mode deaktivieren (alle Themes)
            'body.kt-ball-game .ui-jqgrid tr.jqgrow:hover td,' +
            'body.kt-ball-game .ui-jqgrid tr.jqgrow.gridRowEven:hover td,' +
            'body.kt-ball-game .ui-jqgrid tr.ui-state-hover td,' +
            'body.kt-ball-game .ui-jqgrid tr.jqgrow.ui-state-hover td {' +
            '  background: transparent !important;' +
            '}' +

            // Getroffene Zellen: kein Hover, kein Rand
            '.kt-ball-burned,' +
            '.kt-ball-burned:hover,' +
            'tr.ui-state-hover .kt-ball-burned,' +
            'tr.jqgrow:hover .kt-ball-burned {' +
            '  cursor: default !important;' +
            '  border: none !important;' +
            '}' +

            // Glut-Animation: Inner Glow mit flackerndem box-shadow
            // Zahlen-Jagd: blinkende Zahlen
            '@keyframes kt-hunt-blink {' +
            '  0%, 100% { opacity: 1; transform: scale(1); }' +
            '  50% { opacity: 0.3; transform: scale(1.15); }' +
            '}' +

            '@keyframes kt-ember {' +
            '  0%   { box-shadow: inset 0 0 12px 3px rgba(220,100,15,0.5); }' +
            '  8%   { box-shadow: inset 0 0 16px 5px rgba(240,120,20,0.6); }' +
            '  15%  { box-shadow: inset 0 0 8px 2px rgba(200,80,20,0.35); }' +
            '  25%  { box-shadow: inset 0 0 14px 4px rgba(230,110,20,0.45); }' +
            '  40%  { box-shadow: inset 0 0 6px 2px rgba(200,80,20,0.2); }' +
            '  60%  { box-shadow: inset 0 0 4px 1px rgba(180,60,10,0.1); }' +
            '  80%  { box-shadow: inset 0 0 2px 0px rgba(160,50,10,0.04); }' +
            '  100% { box-shadow: none; }' +
            '}' +

            '.ui-jqgrid td.kt-ball-burned,' +
            '.ui-jqgrid tr.jqgrow td.kt-ball-burned,' +
            '.ui-jqgrid tr.ui-state-hover td.kt-ball-burned {' +
            '  background-color: transparent;' +
            '  animation: kt-ember 10s ease-out forwards;' +
            '  animation-delay: calc(-0.5s * var(--ember-d, 0));' +
            '}';
        document.head.appendChild(styleEl);
    }

    function removeStyles() {
        if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
        styleEl = null;
        // Burned-Klasse von allen Zellen entfernen
        var burned = document.querySelectorAll('.kt-ball-burned');
        for (var i = 0; i < burned.length; i++) {
            burned[i].classList.remove('kt-ball-burned');
            burned[i].style.cssText = '';
            burned[i].style.pointerEvents = '';
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Name-Hilfsfunktionen
    // ═══════════════════════════════════════════════════════════════
    function getFullName() {
        var row = document.querySelector('tr.rowUser td');
        return row ? row.textContent.replace(/\uD83D\uDC51\s*/, '').trim() : '';
    }

    function shortName(fullName) {
        // "Mueller, Thomas" → "Thomas" (bei Duplikaten clientseitig nicht erkennbar → mit Initial)
        if (!fullName) return '?';
        var parts = fullName.split(',');
        if (parts.length < 2) return fullName;
        var nachname = parts[0].trim();
        var vorname = parts[1].trim();
        return vorname + ' ' + nachname.charAt(0);
    }

    kt.setBallSound = function (on) {
        soundEnabled = on;
        if (on) initAudio();
    };

    // ═══════════════════════════════════════════════════════════════
    kt.initBall = function () {
        if (localStorage.getItem('kt_ball_off') === '1') return;
        if (window.innerWidth < CFG.MIN_VP) return;

        canvas = document.createElement('canvas');
        canvas.id = 'kt-ball-canvas';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');

        injectStyles();
        document.body.classList.add('kt-ball-active');
        bindEvents();
        active = true;
        loadScores();
        huntLoadBest();
        // Ball sofort spawnen falls noch kein Grid da ist
        setTimeout(function() { if (!ball) spawnBall(); }, 2000);
        loop();
    };

    kt.destroyBall = function () {
        active = false;
        if (animFrame) cancelAnimationFrame(animFrame);
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
        removeScorePanel();
        huntCleanup();
        level2Cleanup();
        // Burned-Zellen zurücksetzen
        var burned = document.querySelectorAll('.kt-ball-burned');
        for (var i = 0; i < burned.length; i++) burned[i].classList.remove('kt-ball-burned');
        // Ausgeblendete Zellen wiederherstellen
        var faded = document.querySelectorAll('td.Tipps, td.Name, th.Tipps, th.Name, .ui-jqgrid-titlebar');
        for (var i = 0; i < faded.length; i++) { faded[i].style.opacity = ''; faded[i].style.transition = ''; }
        removeStyles();
        document.body.classList.remove('kt-ball-active');
        document.body.classList.remove('kt-ball-game');
        charge = 0;
        score = 0;
        revealed = false;
        ball = null; canvas = null; ctx = null;
    };

    // TEST: kt.testCascade(0.7) - blendet 70% der Nicht-Pts1-Zellen aus
    kt.testCascade = function (ratio) {
        ratio = ratio || 0.7;
        var tbody = document.querySelector('.ui-jqgrid-btable tbody');
        if (!tbody) return;
        var cells = tbody.querySelectorAll('td');
        for (var i = 0; i < cells.length; i++) {
            var cell = cells[i];
            if (cell.classList.contains('Pts1')) continue;
            if (cell.offsetWidth < 4) continue;
            if (Math.random() < ratio) {
                cell.textContent = '';
                cell.style.cssText = 'border:none !important;pointer-events:none;';
                cell.style.opacity = '0';
                cell.classList.add('kt-ball-burned');
            }
        }
    };

    kt.rescanBallObstacles = function () {
        if (!active) return;
        // Score pro Seitenansicht zurücksetzen (Highscores bleiben in localStorage)
        score = 0;
        charge = 0;
        revealed = false;
        huntCleanup();
        level2Cleanup();
        removeScorePanel();
        document.body.classList.remove('kt-ball-game');
        // Ausgeblendete Zellen wiederherstellen
        var faded = document.querySelectorAll('td.Tipps, td.Name, th.Tipps, th.Name, .ui-jqgrid-titlebar');
        for (var i = 0; i < faded.length; i++) { faded[i].style.opacity = ''; faded[i].style.transition = ''; }
        setTimeout(function () {
            if (!ball) spawnBall();
        }, 1500);
    };

    // ═══════════════════════════════════════════════════════════════
    function spawnBall() {
        var tb = document.querySelector('.ui-jqgrid-titlebar');
        if (!tb) return;
        var r = tb.getBoundingClientRect();
        // Oben außerhalb des Viewports starten, fällt dann rein
        ball = {
            x: r.left + r.width * (0.3 + Math.random() * 0.4),
            y: -CFG.R - 30,
            vx: 0, vy: 0,
            quat: [1, 0, 0, 0],
            wx: 0, wz: 0,           // Winkelgeschwindigkeit (X- und Z-Achse)
            onGround: false
        };
        score = 0;
        revealed = false;
        removeScorePanel();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Kollisions-Erkennung: Kreis vs. Rechteck
    // ═══════════════════════════════════════════════════════════════
    function circleRectCollision(bx, by, r, rect) {
        var cx = Math.max(rect.left, Math.min(bx, rect.right));
        var cy = Math.max(rect.top, Math.min(by, rect.bottom));
        var dx = bx - cx, dy = by - cy;
        var distSq = dx * dx + dy * dy;
        if (distSq >= r * r) return null;
        var dist = Math.sqrt(distSq);
        if (dist < 0.001) return { nx: 0, ny: -1, overlap: r };
        return { nx: dx / dist, ny: dy / dist, overlap: r - dist };
    }

    function resolveCollision(col) {
        ball.x += col.nx * col.overlap * 1.01;
        ball.y += col.ny * col.overlap * 1.01;
        var bounce = chargeBounce();
        var dot = ball.vx * col.nx + ball.vy * col.ny;
        if (dot < 0) {
            ball.vx -= (1 + bounce) * dot * col.nx;
            ball.vy -= (1 + bounce) * dot * col.ny;
        }
        // Bodenkontakt: Normale zeigt nach oben (ny < -0.5)
        if (col.ny < -0.5) ball.onGround = true;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Platform-Kollisionen – dynamisch pro sichtbarem Grid
    // ═══════════════════════════════════════════════════════════════
    function collectPlatforms() {
        var platforms = []; // { y, left, right }
        var grids = document.querySelectorAll('.ui-jqgrid');
        for (var g = 0; g < grids.length; g++) {
            var grid = grids[g];
            var gRect = grid.getBoundingClientRect();
            if (gRect.width < 20 || gRect.bottom < 0 || gRect.top > window.innerHeight) continue;
            var left = gRect.left, right = gRect.right;

            // Titlebar – Oberkante
            var tb = grid.querySelector('.ui-jqgrid-titlebar');
            if (tb) {
                var tbr = tb.getBoundingClientRect();
                platforms.push({ y: tbr.top, left: left, right: right });
            }

            // Header – Unterkante (Spaltenüberschriften)
            var hd = grid.querySelector('.ui-jqgrid-hdiv');
            if (hd) {
                var hdr = hd.getBoundingClientRect();
                platforms.push({ y: hdr.bottom, left: left, right: right });
            }

            // Hervorgehobene Zeilen (rowUser, rowOpponent) – Unterkante
            var specials = grid.querySelectorAll('tr.rowUser, tr.rowOpponent');
            for (var s = 0; s < specials.length; s++) {
                var sr = specials[s].getBoundingClientRect();
                if (sr.height > 0) platforms.push({ y: sr.bottom, left: left, right: right });
            }

            // Toolbar / Pager – Oberkante (wenn sichtbar)
            var pager = grid.querySelector('.ui-jqgrid-pager');
            if (pager) {
                var pr = pager.getBoundingClientRect();
                if (pr.height > 0) platforms.push({ y: pr.top, left: left, right: right });
            }

            // Letzte Datenzeile – Unterkante (Tabellenboden)
            var rows = grid.querySelectorAll('.ui-jqgrid-bdiv tr[role="row"]');
            if (rows.length) {
                var lr = rows[rows.length - 1].getBoundingClientRect();
                platforms.push({ y: lr.bottom, left: left, right: right });
            }
        }
        return platforms;
    }

    function collidePlatforms() {
        if (ghostMode) return;
        var T = 3; // Liniendicke für Kollision
        var platforms = collectPlatforms();

        for (var i = 0; i < platforms.length; i++) {
            var p = platforms[i];
            var rect = { left: p.left, right: p.right, top: p.y - T / 2, bottom: p.y + T / 2 };
            var cr = chargeR();
            var col = circleRectCollision(ball.x, ball.y, cr, rect);
            if (col) { resolveCollision(col); continue; }

            // Anti-Tunneling: Ball hat Linie im letzten Frame überquert
            if (ball.x >= p.left && ball.x <= p.right && ball.vy > 0) {
                var prevY = ball.y - ball.vy;
                if (prevY + cr <= p.y && ball.y + cr > p.y) {
                    ball.y = p.y - cr;
                    ball.vy = -Math.abs(ball.vy) * CFG.BOUNCE;
                    ball.onGround = true;
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Block-Kollisionen (Breakout-Zellen)
    // ═══════════════════════════════════════════════════════════════
    function collideBlocks() {
        var cells = document.querySelectorAll(CFG.BLOCK_SEL);
        for (var i = 0; i < cells.length; i++) {
            var el = cells[i];
            if (el.querySelector('.kt-hunt-num')) continue; // Zahlen-Jagd-Target, separat behandelt
            var val = parseInt(el.textContent);
            if (!val || val < 1) continue;
            var rect = el.getBoundingClientRect();
            if (rect.width < 4 || rect.height < 4) continue;
            var col = circleRectCollision(ball.x, ball.y, chargeR(), rect);
            if (col) {
                resolveCollision(col);
                destroyBlock(el, val, rect);
                return;
            }
        }
    }

    function destroyBlock(el, pts, rect) {
        if (!revealed) {
            revealed = true;
            revealEffect(rect);
            showScorePanel();
        }

        if (soundEnabled) playPling(pts);
        score += pts;
        addCharge(pts);
        saveScore();
        updateScorePanel();

        // Explosions-Boost: Ball wird etwas weggeschleudert
        if (ball) {
            var boost = 0.3 + pts * 0.15 + chargePct() * 0.5;
            var cx2 = rect.left + rect.width / 2, cy2 = rect.top + rect.height / 2;
            var edx = ball.x - cx2, edy = ball.y - cy2;
            var eDist = Math.sqrt(edx * edx + edy * edy) || 1;
            ball.vx += (edx / eDist) * boost;
            ball.vy += (edy / eDist) * boost;
        }

        var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;

        // Floating-Text: Punkte
        floatingTexts.push({
            x: cx, y: cy,
            text: '+' + pts,
            life: 2200, maxLife: 2200,
            color: pts >= 3 ? '#D4A017' : pts >= 2 ? '#2E7D32' : '#555',
            stroke: pts >= 3 ? '#7A5B00' : pts >= 2 ? '#1B4D1B' : '#222'
        });

        // Score-Panel kurz aufblinken lassen
        pulseScorePanel();

        // Partikel entlang der Zellenränder erzeugen
        spawnBorderParticles(rect, pts);

        // Zelle: Inhalt ausblenden, dann Rand entfernen + Glut-Effekt
        el.style.transition = 'opacity 0.4s ease-out';
        el.style.opacity = '0';
        setTimeout(function () {
            el.textContent = '';
            el.style.cssText = 'border:none !important;pointer-events:none;';
            el.style.setProperty('--ember-d', Math.random().toFixed(3));
            el.classList.add('kt-ball-burned');

            // Nachbarn prüfen: Cascade
            checkCascade(el);

            // Alle Blöcke abgeräumt? → Konfetti!
            if (allBlocksCleared()) spawnConfetti();
        }, 400);
    }

    function allBlocksCleared() {
        var cells = document.querySelectorAll(CFG.BLOCK_SEL);
        for (var i = 0; i < cells.length; i++) {
            var val = parseInt(cells[i].textContent);
            if (val >= 1) return false;
        }
        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Cascade: Zellen brechen weg wenn genug Nachbarn zerstört sind
    // ═══════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════
    //  Cascade: Zellen brechen weg wenn genug Umgebung zerstört ist
    //  Radius 2 (5x5), Schwelle 65% der existierenden Nachbarn
    // ═══════════════════════════════════════════════════════════════
    var CASCADE_RATIO = 0.65;
    var CASCADE_RADIUS = 2;
    var _cascadePending = false;

    function isCellDead(cell) {
        return cell.classList.contains('kt-ball-burned') || cell.style.opacity === '0';
    }

    function getGridCells(el) {
        var tbody = el.closest('tbody');
        if (!tbody) return null;
        var rows = tbody.querySelectorAll('tr');
        var grid = [];
        for (var r = 0; r < rows.length; r++) {
            var cells = rows[r].querySelectorAll('td');
            var row = [];
            for (var c = 0; c < cells.length; c++) row.push(cells[c]);
            grid.push(row);
        }
        return grid;
    }

    function checkCascade(srcEl) {
        if (_cascadePending) return;
        _cascadePending = true;
        // Kurze Verzögerung: Zerstörung muss sich erst "setzen"
        setTimeout(function() {
            _cascadePending = false;
            doCascadePass(srcEl);
        }, 500);
    }

    function doCascadePass(srcEl) {
        var grid = getGridCells(srcEl);
        if (!grid) return;

        var toDestroy = [];
        for (var r = 0; r < grid.length; r++) {
            for (var c = 0; c < grid[r].length; c++) {
                var cell = grid[r][c];
                if (isCellDead(cell)) continue;
                if (cell.offsetWidth < 4) continue;

                // Nachbarn im Radius zählen
                var total = 0, dead = 0;
                for (var dr = -CASCADE_RADIUS; dr <= CASCADE_RADIUS; dr++) {
                    for (var dc = -CASCADE_RADIUS; dc <= CASCADE_RADIUS; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        var nr = r + dr, nc = c + dc;
                        if (nr < 0 || nr >= grid.length) continue;
                        if (nc < 0 || nc >= grid[nr].length) continue;
                        var neighbor = grid[nr][nc];
                        if (neighbor.offsetWidth < 4) continue; // hidden
                        total++;
                        if (isCellDead(neighbor)) dead++;
                    }
                }
                if (total > 0 && dead / total >= CASCADE_RATIO) {
                    toDestroy.push(cell);
                }
            }
        }

        // Gestaffelt, maximal 3 pro Durchgang
        var batch = toDestroy.slice(0, 3);
        for (var i = 0; i < batch.length; i++) {
            (function(cell, delay) {
                setTimeout(function() {
                    if (isCellDead(cell)) return;
                    cascadeDestroy(cell);
                }, delay);
            })(batch[i], i * 150);
        }
    }

    function cascadeDestroy(cell) {
        var rect = cell.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return;

        // Pts1-Zellen geben Punkte
        if (cell.classList.contains('Pts1')) {
            var pts = parseInt(cell.textContent) || 0;
            if (pts > 0) {
                score += pts;
                saveScore();
                updateScorePanel();
            }
        }

        spawnBorderParticles(rect, 1);

        cell.style.transition = 'opacity 0.3s ease-out';
        cell.style.opacity = '0';
        setTimeout(function() {
            cell.textContent = '';
            cell.style.cssText = 'border:none !important;pointer-events:none;';
            cell.classList.add('kt-ball-burned');

            // Nächster Cascade-Check (gedrosselt durch _cascadePending)
            checkCascade(cell);

            if (allBlocksCleared()) spawnConfetti();
        }, 300);
    }

    function spawnConfetti() {
        var w = window.innerWidth;
        var colors = ['#FF4136','#FF851B','#FFDC00','#2ECC40','#0074D9','#B10DC9','#FF69B4','#01FF70'];
        var count = 150;

        floatingTexts.push({
            x: w / 2, y: window.innerHeight / 2 - 40,
            text: 'ALL CLEAR!',
            life: 4000, maxLife: 4000,
            color: '#FFD700', stroke: '#7A5B00', big: true
        });

        for (var i = 0; i < count; i++) {
            var x = Math.random() * w;
            var delay = Math.random() * 600;
            (function (x, delay) {
                setTimeout(function () {
                    particles.push({
                        x: x, y: -10,
                        vx: (Math.random() - 0.5) * 3,
                        vy: 1.5 + Math.random() * 3,
                        life: 2500 + Math.random() * 1500,
                        maxLife: 2500 + Math.random() * 1500,
                        size: 2 + Math.random() * 4,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        rot: Math.random() * Math.PI * 2
                    });
                }, delay);
            })(x, delay);
        }

        // Level 2 starten nach Konfetti
        setTimeout(function() { if (active) level2Start(); }, 4500);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Level 2: Bewegliche 5er
    // ═══════════════════════════════════════════════════════════════
    var level2 = {
        active: false,
        movers: [],    // [{ el, grid, row, col, moveInterval }]
        moveTimer: null
    };

    function level2Start() {
        if (!active || level2.active) return;
        level2.active = true;

        floatingTexts.push({
            x: window.innerWidth / 2, y: window.innerHeight / 2,
            text: 'LEVEL 2',
            life: 3000, maxLife: 3000,
            color: '#FF4136', stroke: '#7b1f1f', big: true
        });

        // Alle burned-Zellen wiederherstellen
        var cells = document.querySelectorAll(CFG.BLOCK_SEL);
        var grid = [];
        var tbody = cells[0] ? cells[0].closest('tbody') : null;
        if (tbody) {
            var rows = tbody.querySelectorAll('tr');
            for (var r = 0; r < rows.length; r++) {
                var tds = rows[r].querySelectorAll('td');
                var row = [];
                for (var c = 0; c < tds.length; c++) row.push(tds[c]);
                grid.push(row);
            }
        }

        // Zellen zurücksetzen (leer, sichtbar)
        for (var i = 0; i < cells.length; i++) {
            var el = cells[i];
            el.classList.remove('kt-ball-burned');
            el.textContent = '';
            el.style.cssText = '';
            el.style.pointerEvents = '';
        }

        // Bewegliche 5er platzieren
        var count = Math.min(8, Math.floor(cells.length * 0.08));
        var placed = [];
        for (var n = 0; n < count; n++) {
            var attempts = 0;
            while (attempts < 50) {
                var r = Math.floor(Math.random() * grid.length);
                var c = Math.floor(Math.random() * grid[r].length);
                var key = r + ',' + c;
                if (placed.indexOf(key) === -1) {
                    placed.push(key);
                    var cell = grid[r][c];
                    level2InjectFiver(cell);
                    level2.movers.push({ el: cell, grid: grid, row: r, col: c });
                    break;
                }
                attempts++;
            }
        }

        // Bewegungs-Timer: alle 2s springen die 5er
        level2.moveTimer = setInterval(function() {
            if (!active || !level2.active) { level2Cleanup(); return; }
            level2MoveAll();
        }, 2000);
    }

    function level2InjectFiver(cell) {
        cell.textContent = '';
        cell.classList.remove('kt-ball-burned');
        cell.style.cssText = '';
        var span = document.createElement('span');
        span.className = 'kt-level2-num';
        span.textContent = '5';
        span.style.cssText = 'font-weight:900;font-size:1.4em;color:#FF4136;' +
            'text-shadow:0 0 8px rgba(255,65,54,0.6);transition:transform 0.3s';
        cell.appendChild(span);
    }

    function level2MoveAll() {
        for (var i = 0; i < level2.movers.length; i++) {
            var m = level2.movers[i];
            // Nachbarzellen finden (oben, unten, links, rechts)
            var neighbors = [];
            var dirs = [[-1,0],[1,0],[0,-1],[0,1]];
            for (var d = 0; d < dirs.length; d++) {
                var nr = m.row + dirs[d][0];
                var nc = m.col + dirs[d][1];
                if (nr >= 0 && nr < m.grid.length && nc >= 0 && nc < m.grid[nr].length) {
                    var target = m.grid[nr][nc];
                    // Nur in leere Zellen springen (keine anderen 5er, keine Pts-Zellen)
                    if (!target.querySelector('.kt-level2-num') && !parseInt(target.textContent)) {
                        neighbors.push({ r: nr, c: nc, el: target });
                    }
                }
            }
            if (neighbors.length === 0) continue;

            // Zufällige Nachbarzelle wählen
            var pick = neighbors[Math.floor(Math.random() * neighbors.length)];

            // Alte Zelle leeren
            var oldSpan = m.el.querySelector('.kt-level2-num');
            if (oldSpan) oldSpan.remove();
            m.el.textContent = '';

            // Neue Zelle füllen
            level2InjectFiver(pick.el);
            m.el = pick.el;
            m.row = pick.r;
            m.col = pick.c;

            // Kurzer Animations-Pulse
            pick.el.style.transition = 'background 0.3s';
            pick.el.style.background = 'rgba(255,65,54,0.1)';
            setTimeout(function(el) { el.style.background = ''; }, 400, pick.el);
        }
    }

    function level2Cleanup() {
        level2.active = false;
        if (level2.moveTimer) { clearInterval(level2.moveTimer); level2.moveTimer = null; }
        for (var i = 0; i < level2.movers.length; i++) {
            var span = level2.movers[i].el.querySelector('.kt-level2-num');
            if (span) span.remove();
        }
        level2.movers = [];
    }

    function level2CollideBall() {
        if (!level2.active || !ball) return;
        for (var i = level2.movers.length - 1; i >= 0; i--) {
            var m = level2.movers[i];
            var rect = m.el.getBoundingClientRect();
            if (rect.width < 4 || rect.height < 4) continue;
            var col = circleRectCollision(ball.x, ball.y, chargeR(), rect);
            if (col) {
                resolveCollision(col);

                // Treffer! 5 Punkte
                var pts = 5;
                if (soundEnabled) playPling(pts);
                score += pts;
                addCharge(pts);
                saveScore();
                updateScorePanel();

                var cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
                floatingTexts.push({
                    x: cx, y: cy, text: '+5',
                    life: 2200, maxLife: 2200,
                    color: '#FF4136', stroke: '#7b1f1f'
                });
                spawnBorderParticles(rect, pts);

                // Zelle leeren
                var span = m.el.querySelector('.kt-level2-num');
                if (span) span.remove();
                m.el.textContent = '';
                m.el.style.cssText = 'border:none !important;pointer-events:none;';
                m.el.style.opacity = '0';
                m.el.classList.add('kt-ball-burned');

                level2.movers.splice(i, 1);

                // Alle 5er erwischt? → nochmal!
                if (level2.movers.length === 0) {
                    level2.active = false;
                    if (level2.moveTimer) { clearInterval(level2.moveTimer); level2.moveTimer = null; }
                    spawnConfetti();
                }
                return;
            }
        }
    }

    function spawnBorderParticles(rect, pts) {
        var color = pts >= 3 ? '#D4A017' : pts >= 2 ? '#4CAF50' : '#999';
        var count = 20 + pts * 6;
        var edges = [
            // oben
            function () { return { x: rect.left + Math.random() * rect.width, y: rect.top }; },
            // unten
            function () { return { x: rect.left + Math.random() * rect.width, y: rect.bottom }; },
            // links
            function () { return { x: rect.left, y: rect.top + Math.random() * rect.height }; },
            // rechts
            function () { return { x: rect.right, y: rect.top + Math.random() * rect.height }; }
        ];
        var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;

        for (var i = 0; i < count; i++) {
            var pos = edges[i % 4]();
            // Richtung: weg vom Zellzentrum + etwas Zufall
            var dx = pos.x - cx, dy = pos.y - cy;
            var dist = Math.sqrt(dx * dx + dy * dy) || 1;
            var speed = 1.2 + Math.random() * 2.5;
            var vx = (dx / dist) * speed + (Math.random() - 0.5) * 1.5;
            var vy = (dy / dist) * speed + (Math.random() - 0.5) * 1.5;

            particles.push({
                x: pos.x, y: pos.y,
                vx: vx, vy: vy,
                life: 600 + Math.random() * 500,
                maxLife: 600 + Math.random() * 500,
                size: 1.5 + Math.random() * 2.5,
                color: color,
                rot: Math.random() * Math.PI * 2
            });
        }
    }

    function revealEffect(rect) {
        document.body.classList.add('kt-ball-game');
        // Hover in allen Grids deaktivieren
        try { jQuery('table.ui-jqgrid-btable').each(function() {
            jQuery(this).jqGrid('setGridParam', { hoverrows: false });
            jQuery(this).off('mouseover mouseout');
            jQuery(this).find('tr.ui-state-hover').removeClass('ui-state-hover');
        }); } catch (e) {}
        // Tipp-/Ergebnis-Zellen ausblenden (außer User/Gegner-Reihe = Hindernisse)
        var fade = document.querySelectorAll('td.Tipps, td.Name, th.Tipps, th.Name, .ui-jqgrid-titlebar');
        for (var i = 0; i < fade.length; i++) {
            var row = fade[i].closest('tr');
            if (row && (row.classList.contains('rowUser') || row.classList.contains('rowOpponent'))) continue;
            fade[i].style.transition = 'opacity 0.8s';
            fade[i].style.opacity = '0.08';
        }
        var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        floatingTexts.push({
            x: cx, y: cy - 20,
            text: 'BREAKOUT!',
            life: 3500, maxLife: 3500,
            color: '#B8860B', stroke: '#5C3A00', big: true
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  Cursor → Ball stupsen
    // ═══════════════════════════════════════════════════════════════
    function pushBall() {
        if (!ball) return;
        var dx = ball.x - cursor.x, dy = ball.y - cursor.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var min = chargeR() + CFG.CURSOR_R;
        if (dist >= min || dist < 0.1) return;

        var nx = dx / dist, ny = dy / dist;
        ball.x += nx * (min - dist);
        ball.y += ny * (min - dist);

        // Ball-Geschwindigkeit in Richtung Cursor reflektieren (Abprall)
        var dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
            ball.vx -= (1 + CFG.BOUNCE) * dot * nx;
            ball.vy -= (1 + CFG.BOUNCE) * dot * ny;
        }

        // Drehimpuls aus tangentialer Cursor-Komponente (Effet)
        var tx = -ny, ty = nx;                              // Tangente am Kontaktpunkt
        var tSpeed = cursor.vx * tx + cursor.vy * ty;      // tangentiale Cursor-Geschw.
        ball.wz += tSpeed * 0.004;

        // Zusätzlicher linearer Impuls aus Cursor-Bewegung
        // Progressiv: sanft bei langsamer Maus, kräftig bei Wucht
        var spd = Math.sqrt(cursor.vx * cursor.vx + cursor.vy * cursor.vy);
        var push = Math.min(spd * 0.05 + spd * spd * 0.003, 5);
        if (push > 0.05) {
            ball.vx += nx * push;
            ball.vy += ny * push;
        }
        if (spd > 8 && !ghostMode) activateGhost();
        cursorFlash = 1;
        if (soundEnabled) playKick(Math.min(spd / 25, 1));

        // Zahlen-Jagd: Berührungen zählen
        if (!hunt.active && !hunt.ready && !revealed) {
            if (hunt.touchCount === 0) hunt.firstTouchTime = performance.now();
            hunt.touchCount++;
            huntCheck();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Ghost-Mode
    // ═══════════════════════════════════════════════════════════════
    function activateGhost() {
        ghostMode = true;
        ghostStart = performance.now();
    }

    function updateGhost() {
        if (!ghostMode) return;
        var elapsed = performance.now() - ghostStart;
        if ((elapsed > 120 && ball.vy > 0.3) || elapsed > CFG.GHOST_MS) {
            ghostMode = false;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Wand-Kollisionen
    // ═══════════════════════════════════════════════════════════════
    function collideWalls() {
        var w = window.innerWidth, h = window.innerHeight - CFG.BOTTOM_M, r = chargeR();
        if (ball.x - r < 0) { ball.x = r; ball.vx = Math.abs(ball.vx) * CFG.BOUNCE; }
        if (ball.x + r > w) { ball.x = w - r; ball.vx = -Math.abs(ball.vx) * CFG.BOUNCE; }
        if (ball.y + r > h) {
            ball.y = h - r;
            ball.vy = -Math.abs(ball.vy) * CFG.BOUNCE;
            ball.vx *= 0.95;
            ball.onGround = true;
        }
    }

    function clampSpeed() {
        var spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (spd > CFG.MAX_V) { var s = CFG.MAX_V / spd; ball.vx *= s; ball.vy *= s; }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Physics-Step
    // ═══════════════════════════════════════════════════════════════
    function step() {
        if (!ball) return;
        ball.vy += chargeGravity();
        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.vx *= CFG.FRICTION;
        ball.vy *= CFG.FRICTION;

        // Kollisionen (setzen ggf. ball.onGround = true)
        ball.onGround = false;
        collideWalls();
        collidePlatforms();
        collideBlocks();
        clampSpeed();
        updateGhost();

        // Rotation: Boden = exaktes Abrollen, Luft = Trudeln mit Dämpfung
        if (ball.onGround) {
            // Horizontale Fläche: nur vx erzeugt Rollbewegung (um Z-Achse)
            ball.wz = ball.vx / chargeR();
            ball.wx *= 0.9;             // vertikales Trudeln am Boden abdämpfen
        } else {
            // In der Luft: Trudeln langsam abdämpfen
            ball.wx *= 0.98;
            ball.wz *= 0.98;
        }

        // Winkelgeschwindigkeit auf Quaternion anwenden
        var wSpd = Math.sqrt(ball.wx * ball.wx + ball.wz * ball.wz);
        if (wSpd > 0.0001) {
            var ax = ball.wx / wSpd;
            var az = ball.wz / wSpd;
            var half = wSpd / 2, s = Math.sin(half);
            var dq = [Math.cos(half), ax * s, 0, az * s];
            ball.quat = qNorm(qMul(dq, ball.quat));
        }

        if (ball.y > window.innerHeight + 300 || ball.y < -3000) spawnBall();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Rendering
    // ═══════════════════════════════════════════════════════════════
    function drawBall() {
        if (!ball) return;
        var bx = ball.x, by = ball.y, r = chargeR();

        ctx.save();
        ctx.translate(bx, by);
        var cp = chargePct();
        if (ghostMode) {
            ctx.shadowColor = '#ff8800';
            ctx.shadowBlur = 12 + Math.sin(performance.now() * 0.015) * 6;
        } else if (cp > 0.1) {
            ctx.shadowColor = 'hsl(' + (200 + cp * 60) + ', 90%, 70%)';
            ctx.shadowBlur = 4 + cp * 14 + Math.sin(performance.now() * 0.02) * cp * 4;
        }
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();

        var g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        g.addColorStop(0, '#fff'); g.addColorStop(0.7, '#e8e8e8'); g.addColorStop(1, '#b0b0b0');
        ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);

        var q = ball.quat;
        for (var i = 0; i < pentas.length; i++) {
            var p = pentas[i];
            var rp = qRotate(q, p.x, p.y, p.z);
            var z2 = rp[2];
            if (z2 < 0.1) continue;
            var px = rp[0] * r, py = rp[1] * r, pr = r * 0.28 * (0.3 + z2 * 0.7);
            ctx.fillStyle = 'rgba(40,40,40,' + (0.3 + z2 * 0.6) + ')';
            ctx.beginPath();
            for (var j = 0; j < 5; j++) {
                var a = j / 5 * Math.PI * 2 - Math.PI / 2;
                j === 0 ? ctx.moveTo(px + Math.cos(a) * pr, py + Math.sin(a) * pr)
                        : ctx.lineTo(px + Math.cos(a) * pr, py + Math.sin(a) * pr);
            }
            ctx.closePath(); ctx.fill();
        }

        var gl = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 0, -r * 0.35, -r * 0.35, r * 0.5);
        gl.addColorStop(0, 'rgba(255,255,255,0.6)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gl; ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.restore();

        ctx.save(); ctx.strokeStyle = '#555'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();

        if (!ghostMode) {
            var groundY = window.innerHeight - CFG.BOTTOM_M;
            var height  = groundY - (by + r);
            if (height < 30) {
                var t = Math.max(0, 1 - height / 30);
                var blur = (1 - t) * 6;
                ctx.save();
                ctx.globalAlpha = 0.15 * t;
                ctx.shadowColor = '#000';
                ctx.shadowBlur = blur;
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.ellipse(bx, groundY, r * (0.4 + 0.3 * t), 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }

    function drawCursorRing(dt) {
        if (cursorFlash <= 0 && charge <= 0) return;
        var cp = chargePct();
        var r = CFG.CURSOR_R;
        var expand = cursorFlash > 0 ? (1 - cursorFlash) * 8 : 0;
        var cr = r + expand + cp * 12;

        ctx.save();
        var baseAlpha = cursorFlash > 0 ? cursorFlash * 0.4 : 0;
        var chargeAlpha = cp * 0.6;
        ctx.globalAlpha = Math.max(baseAlpha, chargeAlpha);

        if (cp > 0.05) {
            // Elektrifizierter Ring: gezackter Kreis mit Glow
            var segments = 24 + Math.floor(cp * 20);
            var jitter = 2 + cp * 10;
            ctx.shadowColor = 'hsl(' + (200 + cp * 60) + ', 90%, 70%)';
            ctx.shadowBlur = 4 + cp * 16;
            ctx.strokeStyle = 'hsl(' + (200 + cp * 60) + ', 85%, ' + (60 + cp * 20) + '%)';
            ctx.lineWidth = 1.5 + cp * 2;
            ctx.beginPath();
            for (var i = 0; i <= segments; i++) {
                var a = (i / segments) * Math.PI * 2;
                var j = (Math.random() - 0.5) * jitter;
                var px = cursor.x + Math.cos(a) * (cr + j);
                var py = cursor.y + Math.sin(a) * (cr + j);
                i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();

            // Zusätzliche Mini-Blitze vom Ring
            var arcCount = Math.floor(cp * 5);
            for (var a = 0; a < arcCount; a++) {
                var angle = Math.random() * Math.PI * 2;
                var startR = cr + (Math.random() - 0.5) * 4;
                var len = 8 + Math.random() * cp * 25;
                drawLightningBolt(
                    cursor.x + Math.cos(angle) * startR,
                    cursor.y + Math.sin(angle) * startR,
                    cursor.x + Math.cos(angle) * (startR + len),
                    cursor.y + Math.sin(angle) * (startR + len),
                    3 + cp * 4, cp * 0.7
                );
            }
        } else {
            ctx.strokeStyle = ghostMode ? '#ff8800' : '#4a7c59';
            ctx.lineWidth = 2 * cursorFlash;
            ctx.beginPath();
            ctx.arc(cursor.x, cursor.y, cr, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();

        if (cursorFlash > 0) {
            cursorFlash -= dt * 0.003;
            if (cursorFlash < 0) cursorFlash = 0;
        }
    }

    // Blitz-Linie zeichnen (zickzack)
    function drawLightningBolt(x1, y1, x2, y2, displacement, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = 'hsl(210, 100%, 80%)';
        ctx.lineWidth = 1;
        ctx.shadowColor = 'hsl(210, 90%, 70%)';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        var steps = 4 + Math.floor(Math.random() * 3);
        for (var i = 1; i < steps; i++) {
            var t = i / steps;
            var mx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * displacement;
            var my = y1 + (y2 - y1) * t + (Math.random() - 0.5) * displacement;
            ctx.lineTo(mx, my);
        }
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }

    // Entladungen: hauptsächlich zu nahegelegenen Hindernissen, selten frei
    function drawElectricArcs() {
        if (!ball) return;
        var cp = chargePct();
        if (cp < 0.15) return;
        var br = chargeR();
        var bx = ball.x, by = ball.y;

        // Nahe Plattformen/Hindernisse finden und Blitze dorthin ziehen
        var platforms = collectPlatforms();
        for (var i = 0; i < platforms.length; i++) {
            var p = platforms[i];
            if (bx < p.left - 40 || bx > p.right + 40) continue;
            var dy = Math.abs(by - p.y);
            if (dy > br + 30 + cp * 40) continue; // zu weit weg
            // Chance steigt je näher + je mehr Charge
            if (Math.random() > cp * 0.4 + (1 - dy / (br + 70)) * 0.3) continue;
            // Startpunkt am Ball, Endpunkt auf der Plattform
            var tx = bx + (Math.random() - 0.5) * 20;
            var clampX = Math.max(p.left, Math.min(tx, p.right));
            drawLightningBolt(bx, by + (p.y > by ? br : -br), clampX, p.y, 5 + cp * 8, cp * 0.6);
        }

        // Ganz sporadisch eine freie Entladung (ca. 10% Chance pro Frame bei hoher Charge)
        if (Math.random() < cp * 0.1) {
            var angle = Math.random() * Math.PI * 2;
            var dist = br + 5;
            var len = 10 + Math.random() * cp * 25;
            drawLightningBolt(
                bx + Math.cos(angle) * dist, by + Math.sin(angle) * dist,
                bx + Math.cos(angle) * (dist + len), by + Math.sin(angle) * (dist + len),
                3 + cp * 5, cp * 0.35
            );
        }
    }

    function drawFloatingTexts(dt) {
        if (!revealed) return;
        for (var i = floatingTexts.length - 1; i >= 0; i--) {
            var ft = floatingTexts[i];
            ft.life -= dt;
            if (ft.life <= 0) { floatingTexts.splice(i, 1); continue; }

            var t = 1 - ft.life / ft.maxLife;
            // Langsamer Ease-Out, bleibt länger sichtbar
            var ease = 1 - Math.pow(1 - t, 2);
            // Erst in der letzten 40% ausfaden
            var alpha = t < 0.6 ? 1 : 1 - ((t - 0.6) / 0.4);
            var yOff, font;

            if (ft.big) {
                yOff = ease * -20;
                font = 'bold 32px sans-serif';
            } else {
                yOff = ease * -35;
                font = 'bold 22px sans-serif';
            }

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            var x = ft.x, y = ft.y + yOff;

            // Outline für Kontrast auf hellem Hintergrund
            if (ft.stroke) {
                ctx.strokeStyle = ft.stroke;
                ctx.lineWidth = ft.big ? 5 : 3;
                ctx.lineJoin = 'round';
                ctx.strokeText(ft.text, x, y);
            }

            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, x, y);
            ctx.restore();
        }
    }

    function drawParticles(dt) {
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.life -= dt;
            if (p.life <= 0) { particles.splice(i, 1); continue; }

            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.04;           // leichte Schwerkraft
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.rot += 0.1;

            var t = 1 - p.life / p.maxLife;
            var alpha = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
            var size = p.size * (1 - t * 0.6);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            // Kleine Rechteck-Fragmente (Rahmenstücke)
            ctx.fillRect(-size, -size * 0.4, size * 2, size * 0.8);
            ctx.restore();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Score-Panel (DOM, erscheint erst nach Reveal)
    // ═══════════════════════════════════════════════════════════════
    function showScorePanel() {
        if (scorePanel) return;
        scorePanel = document.createElement('div');
        scorePanel.id = 'kt-ball-score';
        document.body.appendChild(scorePanel);

        var s = scorePanel.style;
        s.cssText = 'position:fixed;bottom:20px;right:20px;z-index:10000;' +
            'background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);' +
            'color:#fff;font:13px/1.6 sans-serif;padding:10px 14px;' +
            'border-radius:10px;min-width:140px;pointer-events:none;' +
            'opacity:0;transform:translateY(20px);' +
            'transition:opacity 0.5s,transform 0.5s';

        if (document.body.classList.contains('dark-mode')) {
            s.background = 'rgba(255,255,255,0.1)';
        }

        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                scorePanel.style.opacity = '1';
                scorePanel.style.transform = 'translateY(0)';
            });
        });

        updateScorePanel();
    }

    function renderScoreTable(title, rows, myName) {
        var html = '<div style="font-size:11px;font-weight:bold;margin-bottom:2px;opacity:0.7;text-transform:uppercase;letter-spacing:1px">' + title + '</div>';
        if (!rows || rows.length === 0) {
            html += '<div style="opacity:0.5;font-size:12px">Noch keine Scores</div>';
            return html;
        }
        for (var i = 0; i < rows.length; i++) {
            var e = rows[i];
            var style = 'white-space:nowrap';
            if (e._current) style += ';color:#FFD700';
            html += '<div style="' + style + '">' +
                '<span style="display:inline-block;min-width:28px;text-align:right;font-weight:bold;margin-right:6px">' +
                e.total + '</span>' + e.name +
                (e._current ? ' \u25C0' : '') + '</div>';
        }
        return html;
    }

    function injectCurrentScore(rows, myName, currentScore) {
        var found = false;
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].name === myName) {
                found = true;
                rows[i]._current = true;
                if (currentScore > parseInt(rows[i].total || 0)) rows[i].total = currentScore;
                break;
            }
        }
        if (!found && currentScore > 0) {
            rows.push({ name: myName, total: currentScore, _current: true });
            rows.sort(function(a, b) { return parseInt(b.total) - parseInt(a.total); });
            rows = rows.slice(0, 10);
        }
        return rows;
    }

    function updateScorePanel() {
        if (!scorePanel) return;
        var trid = kt.trid || 0, md = kt.md || 0;
        $j.ajax({
            url: 'php/GetGameScores.php',
            method: 'POST',
            data: { game: 'breakout', trid: trid, md: md },
            dataType: 'json',
            success: function(res) {
                if (!scorePanel || !res || !res.ok) return;
                var myName = shortName(getFullName());

                var alltime = injectCurrentScore(res.scores || [], myName, score);
                var mdRows = injectCurrentScore(res.matchday || [], myName, score);

                var html = renderScoreTable('Spieltag', mdRows, myName);
                html += '<div style="border-top:1px solid rgba(255,255,255,0.2);margin:6px 0"></div>';
                html += renderScoreTable('All-Time', alltime, myName);

                scorePanel.innerHTML = html;
            }
        });
    }

    function pulseScorePanel() {
        if (!scorePanel) return;
        scorePanel.style.transition = 'none';
        scorePanel.style.transform = 'translateY(0) scale(1.12)';
        scorePanel.style.boxShadow = '0 0 16px rgba(255,180,50,0.6)';
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                scorePanel.style.transition = 'transform 0.4s ease-out, box-shadow 0.6s ease-out';
                scorePanel.style.transform = 'translateY(0) scale(1)';
                scorePanel.style.boxShadow = 'none';
            });
        });
    }

    function removeScorePanel() {
        if (!scorePanel) return;
        scorePanel.style.opacity = '0';
        scorePanel.style.transform = 'translateY(20px)';
        var p = scorePanel;
        setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 500);
        scorePanel = null;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Score-Persistenz: Server-API
    // ═══════════════════════════════════════════════════════════════
    function loadScores() {
        // Nicht mehr nötig — Scores werden vom Server geladen
    }

    function saveScore() {
        if (score <= 0) return;
        var trid = kt.trid || 0;
        var md = kt.md || 0;
        $j.ajax({
            url: 'php/SaveGameScore.php',
            method: 'POST',
            data: { game: 'breakout', score: score, trid: trid, md: md },
            dataType: 'json'
        });
        register();
        updateScorePanel();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════
    function bindEvents() {
        // AudioContext bei erster Interaktion initialisieren (Browser-Policy)
        document.addEventListener('click', function () { if (soundEnabled) initAudio(); }, { once: true });
        document.addEventListener('mousemove', function (e) {
            var now = performance.now(), dt = now - cursor.lt;
            if (dt > 0) {
                cursor.vx = (e.clientX - cursor.lx) / dt * 16;
                cursor.vy = (e.clientY - cursor.ly) / dt * 16;
            }
            cursor.x = cursor.lx = e.clientX;
            cursor.y = cursor.ly = e.clientY;
            cursor.lt = now;
        });
        window.addEventListener('resize', function () {
            if (window.innerWidth < CFG.MIN_VP) {
                if (active) kt.destroyBall();
            } else if (!active) {
                kt.initBall();
            } else if (canvas) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  Zahlen-Jagd: Logik
    // ═══════════════════════════════════════════════════════════════
    function isOverviewEmpty() {
        var cells = document.querySelectorAll(CFG.BLOCK_SEL);
        if (cells.length === 0) return false;
        for (var i = 0; i < cells.length; i++) {
            var val = parseInt(cells[i].textContent);
            if (val >= 1) return false; // mindestens 1 Zelle hat Punkte → nicht leer
        }
        return true;
    }

    function huntCheck() {
        if (hunt.active || hunt.ready || revealed) return;
        if (!isOverviewEmpty()) return;
        var elapsed = performance.now() - hunt.firstTouchTime;
        if (hunt.touchCount >= 5 && elapsed >= 7500) {
            hunt.ready = true;
            huntStart();
        }
    }

    function huntStart() {
        hunt.active = true;
        hunt.round = 1;
        hunt.timer = 60;
        huntCreateTimer();
        huntPlaceNumbers();
    }

    function huntCreateTimer() {
        if (hunt.timerEl) return;
        hunt.timerEl = document.createElement('div');
        hunt.timerEl.id = 'kt-hunt-timer';
        var s = hunt.timerEl.style;
        // Neben die Tabelle positionieren
        var grid = document.querySelector('.ui-jqgrid');
        var gridRect = grid ? grid.getBoundingClientRect() : null;
        var rightPos = gridRect ? (window.innerWidth - gridRect.right - 20) : 12;
        if (rightPos < 12) rightPos = 12;
        s.cssText = 'position:fixed;top:50%;right:' + rightPos + 'px;transform:translateY(-50%);z-index:10001;' +
            'text-align:center;pointer-events:none;opacity:0;transition:opacity 0.5s';
        document.body.appendChild(hunt.timerEl);
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                if (hunt.timerEl) hunt.timerEl.style.opacity = '1';
            });
        });
        huntUpdateTimerDisplay();

        hunt.intervalId = setInterval(function() {
            if (!hunt.active) { huntCleanup(); return; }
            hunt.timer--;
            huntUpdateTimerDisplay();
            if (hunt.timer <= 0) {
                huntGameOver();
            }
        }, 1000);
    }

    function huntUpdateTimerDisplay() {
        if (!hunt.timerEl) return;
        var best = huntGetBest();
        var timerColor, timerShadow;
        if (hunt.timer <= 10) {
            timerColor = '#e74c3c';
            timerShadow = '0 0 12px rgba(231,76,60,0.6)';
        } else if (hunt.timer <= 20) {
            timerColor = '#e67e22';
            timerShadow = '0 0 8px rgba(230,126,34,0.4)';
        } else {
            timerColor = '#4a7c59';
            timerShadow = '0 0 8px rgba(74,124,89,0.4)';
        }
        hunt.timerEl.innerHTML =
            '<div style="font-size:48px;font-weight:900;font-family:monospace;color:' + timerColor + ';text-shadow:' + timerShadow + ';line-height:1">' + hunt.timer + '</div>' +
            '<div style="font-size:13px;color:#888;margin-top:6px;font-weight:600">Runde ' + hunt.round + '</div>' +
            (best > 0 ? '<div style="font-size:11px;color:#aaa;margin-top:2px">Rekord: ' + best + '</div>' : '');
    }

    var _huntBestCache = 0;

    function huntGetBest() {
        return _huntBestCache;
    }

    function huntLoadBest() {
        $j.ajax({
            url: 'php/GetGameScores.php',
            method: 'POST',
            data: { game: 'hunt' },
            dataType: 'json',
            success: function(res) {
                if (res && res.ok && res.scores) {
                    var max = 0;
                    for (var i = 0; i < res.scores.length; i++) {
                        var r = parseInt(res.scores[i].best_round || 0);
                        if (r > max) max = r;
                    }
                    _huntBestCache = max;
                }
            }
        });
    }

    function huntSaveScore() {
        if (hunt.round < 1) return;
        if (hunt.round > _huntBestCache) _huntBestCache = hunt.round;
        $j.ajax({
            url: 'php/SaveGameScore.php',
            method: 'POST',
            data: { game: 'hunt', score: hunt.round, trid: 0, md: 0 },
            dataType: 'json'
        });
    }

    function huntPlaceNumbers() {
        // Leere Pts1-Zellen sammeln
        var cells = document.querySelectorAll(CFG.BLOCK_SEL);
        var empty = [];
        for (var i = 0; i < cells.length; i++) {
            var el = cells[i];
            var rect = el.getBoundingClientRect();
            if (rect.width < 4 || rect.height < 4) continue;
            if (el.classList.contains('kt-ball-burned')) continue;
            if (el.querySelector('.kt-hunt-num')) continue;
            var val = parseInt(el.textContent);
            if (val >= 1) continue;
            empty.push(el);
        }
        if (empty.length === 0) return;

        // Zellen nahe der Mitte bevorzugen
        var viewCY = window.innerHeight / 2;
        empty.sort(function(a, b) {
            var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
            return Math.abs(ra.top + ra.height/2 - viewCY) - Math.abs(rb.top + rb.height/2 - viewCY);
        });

        // Aus den mittleren 60% zufällig wählen
        var pool = empty.slice(0, Math.max(Math.ceil(empty.length * 0.6), hunt.round));

        // Bestehende Targets behalten, nur neue Zahlen hinzufügen
        var existingNums = {};
        for (var i = 0; i < hunt.targets.length; i++) {
            existingNums[hunt.targets[i].num] = true;
        }

        for (var n = 1; n <= hunt.round; n++) {
            if (existingNums[n]) continue; // Zahl existiert bereits
            if (pool.length === 0) break;
            var idx = Math.floor(Math.random() * pool.length);
            var cell = pool.splice(idx, 1)[0];
            huntInjectNumber(cell, n);
        }
    }

    function huntInjectNumber(cell, num) {
        // Zelle leeren und Zahl einsetzen
        cell.textContent = '';
        var span = document.createElement('span');
        span.className = 'kt-hunt-num';
        span.textContent = num;
        span.style.cssText = 'font-weight:900;font-size:1.4em;color:#c0392b;' +
            'animation:kt-hunt-blink 0.8s ease-in-out infinite;cursor:default';
        cell.appendChild(span);
        hunt.targets.push({ el: cell, num: num });
    }

    function huntCollideBall() {
        if (!hunt.active || !ball) return;
        for (var i = hunt.targets.length - 1; i >= 0; i--) {
            var t = hunt.targets[i];
            var rect = t.el.getBoundingClientRect();
            if (rect.width < 4 || rect.height < 4) continue;
            var col = circleRectCollision(ball.x, ball.y, chargeR(), rect);
            if (col) {
                // Finde die niedrigste Zahl die getroffen werden muss
                var lowestNum = hunt.round;
                for (var j = 0; j < hunt.targets.length; j++) {
                    if (hunt.targets[j].num < lowestNum) lowestNum = hunt.targets[j].num;
                }
                // Nur die richtige Zahl (die niedrigste) darf getroffen werden
                if (t.num !== lowestNum) {
                    resolveCollision(col);
                    return;
                }

                resolveCollision(col);
                // Treffer!
                var cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
                floatingTexts.push({
                    x: cx, y: cy,
                    text: '#' + t.num + '!',
                    life: 1500, maxLife: 1500,
                    color: '#27ae60', stroke: '#1a6e3c'
                });
                spawnBorderParticles(rect, 2);
                t.el.textContent = '';
                t.el.style.transition = 'background 0.3s';
                t.el.style.background = 'rgba(39,174,96,0.15)';
                setTimeout(function(el) { el.style.background = ''; }, 600, t.el);
                hunt.targets.splice(i, 1);

                // Alle Zahlen dieser Runde getroffen?
                if (hunt.targets.length === 0) {
                    huntNextRound();
                }
                return;
            }
        }
    }

    function huntNextRound() {
        hunt.round++;
        hunt.timer = 60;
        huntSaveScore();
        huntUpdateTimerDisplay();

        floatingTexts.push({
            x: window.innerWidth / 2, y: window.innerHeight / 2,
            text: 'Runde ' + hunt.round + '!',
            life: 2000, maxLife: 2000,
            color: '#2980b9', stroke: '#1a5276', big: true
        });

        // Kurze Pause, dann neue Zahlen setzen
        setTimeout(function() {
            if (hunt.active) huntPlaceNumbers();
        }, 800);
    }

    function huntGameOver() {
        var finalRound = hunt.round;
        huntSaveScore();
        var best = huntGetBest();
        var msg = 'Zeit abgelaufen! Runde ' + finalRound;
        if (finalRound >= best && finalRound > 1) msg = 'Neuer Rekord! Runde ' + finalRound;
        floatingTexts.push({
            x: window.innerWidth / 2, y: window.innerHeight / 2,
            text: msg,
            life: 3500, maxLife: 3500,
            color: finalRound >= best && finalRound > 1 ? '#FFD700' : '#e74c3c',
            stroke: finalRound >= best && finalRound > 1 ? '#7A5B00' : '#7b1f1f',
            big: true
        });
        huntCleanup();
    }

    function huntCleanup() {
        hunt.active = false;
        hunt.ready = false;
        hunt.touchCount = 0;
        hunt.firstTouchTime = 0;
        if (hunt.intervalId) { clearInterval(hunt.intervalId); hunt.intervalId = null; }
        // Targets aus Zellen entfernen
        for (var i = 0; i < hunt.targets.length; i++) {
            var el = hunt.targets[i].el;
            var numSpan = el.querySelector('.kt-hunt-num');
            if (numSpan) numSpan.remove();
        }
        hunt.targets = [];
        hunt.round = 0;
        // Timer-Element entfernen
        if (hunt.timerEl) {
            hunt.timerEl.style.opacity = '0';
            var te = hunt.timerEl;
            setTimeout(function() { if (te.parentNode) te.parentNode.removeChild(te); }, 500);
            hunt.timerEl = null;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Game Loop
    // ═══════════════════════════════════════════════════════════════
    var lastT = 0;
    function loop(ts) {
        if (!active) return;
        ts = ts || performance.now();
        var dt = ts - lastT;
        lastT = ts;
        if (dt > 50) dt = 16;

        pushBall();
        step();
        huntCollideBall();
        level2CollideBall();
        decayCharge(dt);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (charge > 0.5) drawElectricArcs();
        drawParticles(dt);
        drawBall();
        drawCursorRing(dt);
        drawFloatingTexts(dt);

        animFrame = requestAnimationFrame(loop);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Statistik-Seite: Breakout
    // ═══════════════════════════════════════════════════════════════
    kt.Stat = kt.Stat || {};

    // Breakout-Seite immer registrieren (Scores kommen vom Server)
    function register() { kt.Stat.Breakout = breakoutPage; }
    register();

    function breakoutPage() {
        var dark = (localStorage.getItem('kt_theme') || '') === 'premium';
        var trid = kt.trid || 0;

        // Beide Ranglisten parallel vom Server laden
        var breakoutDone = false, huntDone = false;
        var breakoutRows = [], huntRows = [];

        function render() {
            if (!breakoutDone || !huntDone) return;

            var html = '<div style="padding:16px 24px;max-width:600px">';
            html += '<h4 style="margin-bottom:12px">Breakout-Rangliste</h4>';

            if (breakoutRows.length === 0) {
                html += '<p style="opacity:0.6">Noch keine Breakout-Punkte erzielt. ' +
                    'Stupse den Fussball auf der Tipp-Uebersicht in die Punkte-Zellen!</p>';
            } else {
                html += '<table class="table table-striped" style="width:100%">';
                html += '<thead><tr>' +
                    '<th style="width:40px">#</th>' +
                    '<th>Spieler</th>' +
                    '<th style="text-align:right">Gesamt</th>' +
                    '<th style="text-align:right">Spieltage</th>' +
                    '<th style="text-align:right">Bester</th>' +
                    '</tr></thead><tbody>';

                for (var i = 0; i < breakoutRows.length; i++) {
                    var r = breakoutRows[i];
                    var medal = i === 0 ? ' style="font-weight:bold;color:#8b6914"' :
                                i === 1 ? ' style="color:#606060"' :
                                i === 2 ? ' style="color:#7a4a2a"' : '';
                    html += '<tr' + medal + '>' +
                        '<td>' + (i + 1) + '</td>' +
                        '<td>' + r.name + '</td>' +
                        '<td style="text-align:right;font-weight:bold">' + r.total + '</td>' +
                        '<td style="text-align:right">' + r.matchdays + '</td>' +
                        '<td style="text-align:right">' + r.best + '</td>' +
                        '</tr>';
                }
                html += '</tbody></table>';
            }

            if (huntRows.length > 0) {
                html += '<h4 style="margin:24px 0 12px">Zahlen-Jagd</h4>';
                html += '<table class="table table-striped" style="width:100%">';
                html += '<thead><tr>' +
                    '<th style="width:40px">#</th>' +
                    '<th>Spieler</th>' +
                    '<th style="text-align:right">Beste Runde</th>' +
                    '</tr></thead><tbody>';
                for (var h = 0; h < huntRows.length; h++) {
                    var hr = huntRows[h];
                    var hmedal = h === 0 ? ' style="font-weight:bold;color:#8b6914"' :
                                 h === 1 ? ' style="color:#606060"' :
                                 h === 2 ? ' style="color:#7a4a2a"' : '';
                    html += '<tr' + hmedal + '>' +
                        '<td>' + (h + 1) + '</td>' +
                        '<td>' + hr.name + '</td>' +
                        '<td style="text-align:right;font-weight:bold">' + hr.best_round + '</td>' +
                        '</tr>';
                }
                html += '</tbody></table>';
            }

            html += '</div>';
            setContent(html);
        }

        $j.ajax({
            url: 'php/GetGameScores.php', method: 'POST',
            data: { game: 'breakout', trid: trid }, dataType: 'json',
            success: function(res) {
                if (res && res.ok) breakoutRows = res.scores || [];
                breakoutDone = true; render();
            },
            error: function() { breakoutDone = true; render(); }
        });

        $j.ajax({
            url: 'php/GetGameScores.php', method: 'POST',
            data: { game: 'hunt' }, dataType: 'json',
            success: function(res) {
                if (res && res.ok) huntRows = res.scores || [];
                huntDone = true; render();
            },
            error: function() { huntDone = true; render(); }
        });

        // Sofort "Lade..." anzeigen
        setContent('<div style="padding:16px 24px"><p style="opacity:0.6">Lade Rangliste...</p></div>');
    }

}(window.kt = window.kt || {}, jQuery));
