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
            '@keyframes kt-ember {' +
            '  0%   { box-shadow: inset 0 0 8px 2px rgba(200,80,20,0.25); }' +
            '  15%  { box-shadow: inset 0 0 12px 3px rgba(220,100,15,0.4); }' +
            '  30%  { box-shadow: inset 0 0 6px 1px rgba(180,60,10,0.15); }' +
            '  50%  { box-shadow: inset 0 0 14px 4px rgba(230,110,20,0.45); }' +
            '  65%  { box-shadow: inset 0 0 5px 1px rgba(170,70,15,0.12); }' +
            '  80%  { box-shadow: inset 0 0 10px 3px rgba(210,90,20,0.35); }' +
            '  100% { box-shadow: inset 0 0 8px 2px rgba(200,80,20,0.25); }' +
            '}' +

            '.ui-jqgrid td.kt-ball-burned,' +
            '.ui-jqgrid tr.jqgrow td.kt-ball-burned,' +
            '.ui-jqgrid tr.ui-state-hover td.kt-ball-burned {' +
            '  background-color: transparent;' +
            '  animation: kt-ember 3s ease-in-out infinite;' +
            '  animation-delay: calc(-3s * var(--ember-d, 0));' +
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
        // "Mueller, Thomas" → "Thomas M."
        if (!fullName) return '?';
        var parts = fullName.split(',');
        if (parts.length < 2) return fullName;
        var nachname = parts[0].trim();
        var vorname = parts[1].trim();
        return vorname + ' ' + nachname.charAt(0) + '.';
    }

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
        loop();
    };

    kt.destroyBall = function () {
        active = false;
        if (animFrame) cancelAnimationFrame(animFrame);
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
        removeScorePanel();
        removeStyles();
        document.body.classList.remove('kt-ball-active');
        document.body.classList.remove('kt-ball-game');
        ball = null; canvas = null; ctx = null;
    };

    kt.rescanBallObstacles = function () {
        if (!active) return;
        // Score pro Seitenansicht zurücksetzen (Highscores bleiben in localStorage)
        score = 0;
        revealed = false;
        removeScorePanel();
        document.body.classList.remove('kt-ball-game');
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
        var dot = ball.vx * col.nx + ball.vy * col.ny;
        if (dot < 0) {
            ball.vx -= (1 + CFG.BOUNCE) * dot * col.nx;
            ball.vy -= (1 + CFG.BOUNCE) * dot * col.ny;
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
            var col = circleRectCollision(ball.x, ball.y, CFG.R, rect);
            if (col) { resolveCollision(col); continue; }

            // Anti-Tunneling: Ball hat Linie im letzten Frame überquert
            if (ball.x >= p.left && ball.x <= p.right && ball.vy > 0) {
                var prevY = ball.y - ball.vy;
                if (prevY + CFG.R <= p.y && ball.y + CFG.R > p.y) {
                    ball.y = p.y - CFG.R;
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
            var val = parseInt(el.textContent);
            if (!val || val < 1) continue;
            var rect = el.getBoundingClientRect();
            if (rect.width < 4 || rect.height < 4) continue;
            var col = circleRectCollision(ball.x, ball.y, CFG.R, rect);
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

        //playPling(pts);
        score += pts;
        saveScore();
        updateScorePanel();

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
        var min = CFG.R + CFG.CURSOR_R;
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
        //playKick(Math.min(spd / 25, 1));
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
        var w = window.innerWidth, h = window.innerHeight - CFG.BOTTOM_M, r = CFG.R;
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
        ball.vy += CFG.GRAVITY;
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
            ball.wz = ball.vx / CFG.R;
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
        var bx = ball.x, by = ball.y, r = CFG.R;

        ctx.save();
        ctx.translate(bx, by);
        if (ghostMode) {
            ctx.shadowColor = '#ff8800';
            ctx.shadowBlur = 12 + Math.sin(performance.now() * 0.015) * 6;
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
        if (cursorFlash <= 0) return;
        var r = CFG.CURSOR_R;
        // Ring expandiert leicht beim Ausfaden
        var expand = (1 - cursorFlash) * 8;
        var cr = r + expand;

        ctx.save();
        ctx.globalAlpha = cursorFlash * 0.4;
        ctx.strokeStyle = ghostMode ? '#ff8800' : '#4a7c59';
        ctx.lineWidth = 2 * cursorFlash;
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, cr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        cursorFlash -= dt * 0.003;
        if (cursorFlash < 0) cursorFlash = 0;
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

    function getTop10() {
        // Immer frisch aus localStorage lesen (parallele Sessions!)
        var fresh;
        try { fresh = JSON.parse(localStorage.getItem(CFG.LS_KEY) || '{}'); }
        catch (e) { fresh = {}; }
        var trid = kt.trid || 0, md = kt.md || 0;
        var entries = [];
        for (var key in fresh) {
            var e = fresh[key];
            if (e.trid === trid && e.md === md) entries.push(e);
        }
        entries.sort(function (a, b) { return b.score - a.score; });
        return entries.slice(0, 10);
    }

    function updateScorePanel() {
        if (!scorePanel) return;
        var top = getTop10();
        var fullName = getFullName();
        var myName = shortName(fullName);

        // Aktuelle Runde einfügen falls nicht schon als Highscore drin
        var currentInList = false;
        for (var i = 0; i < top.length; i++) {
            if (top[i].fullName === fullName && top[i].score === score) {
                currentInList = true;
                top[i]._current = true;
                break;
            }
        }
        if (!currentInList && score > 0) {
            top.push({ name: myName, fullName: fullName, score: score, _current: true });
            top.sort(function (a, b) { return b.score - a.score; });
            top = top.slice(0, 10);
        }

        var html = '';
        for (var i = 0; i < top.length; i++) {
            var e = top[i];
            var style = 'white-space:nowrap';
            if (e._current) style += ';color:#FFD700';
            html += '<div style="' + style + '">' +
                '<span style="display:inline-block;min-width:28px;text-align:right;font-weight:bold;margin-right:6px">' +
                e.score + '</span>' + e.name +
                (e._current ? ' \u25C0' : '') + '</div>';
        }
        if (!html) html = '<div style="opacity:0.5">Noch keine Scores</div>';
        scorePanel.innerHTML = html;
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
    //  Score-Persistenz: pro Spieler + Spieltag
    // ═══════════════════════════════════════════════════════════════
    function loadScores() {
        try { allScores = JSON.parse(localStorage.getItem(CFG.LS_KEY) || '{}'); }
        catch (e) { allScores = {}; }
    }

    function saveScore() {
        var fullName = getFullName();
        if (!fullName || score <= 0) return;
        var trid = kt.trid || 0;
        var md = kt.md || 0;
        var key = trid + '_' + md + '_' + fullName;
        // Frisch laden damit parallele Sessions nicht überschrieben werden
        loadScores();
        var existing = allScores[key];
        if (!existing || score > existing.score) {
            allScores[key] = {
                name: shortName(fullName),
                fullName: fullName,
                trid: trid,
                md: md,
                score: score
            };
            try { localStorage.setItem(CFG.LS_KEY, JSON.stringify(allScores)); } catch (e) {}
            register(); // Breakout-Seite freischalten sobald Score existiert
        }
        updateScorePanel();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════
    function bindEvents() {
        // AudioContext bei erster Interaktion initialisieren (Browser-Policy)
        //document.addEventListener('click', function () { initAudio(); }, { once: true });
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

        ctx.clearRect(0, 0, canvas.width, canvas.height);
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

    // Breakout-Seite nur anbieten wenn mindestens 1 Score existiert
    (function () {
        try {
            var d = JSON.parse(localStorage.getItem(CFG.LS_KEY) || '{}');
            for (var k in d) { if (d[k].score >= 1) { register(); return; } }
        } catch (e) {}
    })();

    function register() { kt.Stat.Breakout = breakoutPage; }

    function breakoutPage() {
        var data;
        try { data = JSON.parse(localStorage.getItem(CFG.LS_KEY) || '{}'); }
        catch (e) { data = {}; }

        // Pro Spieler summieren
        var players = {};
        for (var key in data) {
            var entry = data[key];
            if (!entry.fullName || entry.score < 1) continue;
            if (!players[entry.fullName]) {
                players[entry.fullName] = { name: entry.name, fullName: entry.fullName, total: 0, matchdays: 0, best: 0 };
            }
            var p = players[entry.fullName];
            p.total += entry.score;
            p.matchdays++;
            if (entry.score > p.best) p.best = entry.score;
        }

        // In sortiertes Array
        var rows = [];
        for (var fn in players) rows.push(players[fn]);
        rows.sort(function (a, b) { return b.total - a.total; });

        // HTML-Tabelle bauen
        var dark = (localStorage.getItem('kt_theme') || '') === 'premium';
        var html = '<div style="padding:16px 24px;max-width:600px">';
        html += '<h4 style="margin-bottom:12px">Breakout-Rangliste</h4>';

        if (rows.length === 0) {
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

            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                var medal = i === 0 ? ' style="font-weight:bold;color:' + (dark ? '#ffe082' : '#b8860b') + '"' :
                            i === 1 ? ' style="color:' + (dark ? '#e0e0e0' : '#808080') + '"' :
                            i === 2 ? ' style="color:' + (dark ? '#dca06a' : '#8B5E3C') + '"' : '';
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
        html += '</div>';

        setContent(html);
    }

}(window.kt = window.kt || {}, jQuery));
