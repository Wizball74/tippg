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
        BOUNCE:     0.65,     // Rückprall-Faktor
        FRICTION:   0.997,    // Luftwiderstand (multipliziert pro Frame)
        CURSOR_R:   20,       // Cursor-Kollisionsradius
        MAX_V:      14,       // Maximalgeschwindigkeit
        MIN_VP:     992,      // Minimum-Viewport-Breite
        GHOST_MS:   2500,     // Max Ghost-Mode-Dauer
        PLATFORM_SEL: [
            '.ui-jqgrid-titlebar',
            '.ui-jqgrid-hdiv',
            'tr.rowUser',
            'tr.rowOpponent',
            '.ui-jqgrid-pager',
            '.ui-jqgrid-toppager',
            '.ui-userdata',
            'footer'
        ],
        BLOCK_SEL: 'td.Pts1',
        LS_KEY: 'kt_ball_data'
    };

    // State
    var ball, canvas, ctx;
    var active = false, animFrame;
    var cursor = { x: -999, y: -999, vx: 0, vy: 0, lx: 0, ly: 0, lt: 0 };
    var ghostMode = false, ghostStart = 0;
    var revealed = false;
    var score = 0;
    var allScores = {};  // { "trid_md_fullName": { name, fullName, trid, md, score } }
    var floatingTexts = [];
    var scorePanel = null;

    // Pentagon-Zentren auf Einheitskugel (Ikosaeder)
    var pentas = [
        {x:0,y:-1,z:0},{x:0,y:1,z:0},
        {x:.894,y:-.447,z:0},{x:.276,y:-.447,z:.851},{x:-.724,y:-.447,z:.526},
        {x:-.724,y:-.447,z:-.526},{x:.276,y:-.447,z:-.851},
        {x:.724,y:.447,z:.526},{x:-.276,y:.447,z:.851},{x:-.894,y:.447,z:0},
        {x:-.276,y:.447,z:-.851},{x:.724,y:.447,z:-.526}
    ];

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
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');

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
        ball = null; canvas = null; ctx = null;
    };

    kt.rescanBallObstacles = function () {
        if (!active) return;
        // Score pro Seitenansicht zurücksetzen (Highscores bleiben in localStorage)
        score = 0;
        revealed = false;
        removeScorePanel();
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
            vx: 0, vy: 0, angle: 0, spin: 0
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
    }

    // ═══════════════════════════════════════════════════════════════
    //  Platform-Kollisionen (feste Strukturen)
    // ═══════════════════════════════════════════════════════════════
    function collidePlatforms() {
        if (ghostMode) return;
        var els = document.querySelectorAll(CFG.PLATFORM_SEL.join(','));
        for (var i = 0; i < els.length; i++) {
            var rect = els[i].getBoundingClientRect();
            if (rect.width < 10 || rect.height < 2) continue;
            var col = circleRectCollision(ball.x, ball.y, CFG.R, rect);
            if (col) resolveCollision(col);
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

        score += pts;
        saveScore();        // sofort speichern
        updateScorePanel(); // Panel mit frischen Daten (auch andere Sessions)

        // Floating-Text: Punkte fliegen nach oben
        var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        floatingTexts.push({
            x: cx, y: cy,
            text: '' + pts,
            life: 1400, maxLife: 1400,
            color: pts >= 3 ? '#FFD700' : pts >= 2 ? '#4CAF50' : '#aaa'
        });
        // Gesamt-Score fällt langsam nach unten
        floatingTexts.push({
            x: cx, y: cy,
            text: '' + score,
            life: 1800, maxLife: 1800,
            color: '#fff', falling: true
        });

        // Ganze Zelle weg-puffen
        el.style.transition = 'opacity 0.35s ease-out, transform 0.35s ease-out, filter 0.35s ease-out';
        el.style.transformOrigin = 'center center';
        el.style.opacity = '0';
        el.style.transform = 'scale(2)';
        el.style.filter = 'blur(8px)';
        setTimeout(function () {
            el.textContent = '';
            el.style.visibility = 'hidden';
            el.style.cssText = '';
        }, 350);
    }

    function revealEffect(rect) {
        var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        floatingTexts.push({
            x: cx, y: cy - 30,
            text: 'BREAKOUT!',
            life: 2000, maxLife: 2000,
            color: '#FFD700', big: true
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

        var spd = Math.sqrt(cursor.vx * cursor.vx + cursor.vy * cursor.vy);
        var push = Math.min(spd * 0.15, 4) + 0.3;
        ball.vx += nx * push;
        ball.vy += ny * push;
        if (spd > 8 && !ghostMode) activateGhost();
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
        var w = window.innerWidth, h = window.innerHeight, r = CFG.R;
        if (ball.x - r < 0) { ball.x = r; ball.vx = Math.abs(ball.vx) * CFG.BOUNCE; }
        if (ball.x + r > w) { ball.x = w - r; ball.vx = -Math.abs(ball.vx) * CFG.BOUNCE; }
        if (ball.y + r > h) {
            ball.y = h - r;
            ball.vy = -Math.abs(ball.vy) * CFG.BOUNCE;
            ball.vx *= 0.95;
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
        ball.angle -= ball.vx / CFG.R;
        ball.spin  += ball.vy / CFG.R;
        ball.vx *= CFG.FRICTION;
        ball.vy *= CFG.FRICTION;
        collideWalls();
        collidePlatforms();
        collideBlocks();
        clampSpeed();
        updateGhost();
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

        var angle = ball.angle, spin = ball.spin;
        var cA = Math.cos(angle), sA = Math.sin(angle), cB = Math.cos(spin), sB = Math.sin(spin);
        for (var i = 0; i < pentas.length; i++) {
            var p = pentas[i];
            // Z-Achse: horizontales Rollen (aus vx)
            var x1 = p.x * cA - p.y * sA, y1 = p.x * sA + p.y * cA, z1 = p.z;
            // X-Achse: vertikales Rollen (aus vy)
            var y2 = y1 * cB - z1 * sB, z2 = y1 * sB + z1 * cB;
            if (z2 < 0.1) continue;
            var px = x1 * r, py = y2 * r, pr = r * 0.28 * (0.3 + z2 * 0.7);
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
            ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.ellipse(bx, by + r + 2, r * 0.7, 2, 0, 0, Math.PI * 2);
            ctx.fill(); ctx.restore();
        }
    }

    function drawFloatingTexts(dt) {
        if (!revealed) return;
        for (var i = floatingTexts.length - 1; i >= 0; i--) {
            var ft = floatingTexts[i];
            ft.life -= dt;
            if (ft.life <= 0) { floatingTexts.splice(i, 1); continue; }

            var t = 1 - ft.life / ft.maxLife;
            var ease = 1 - Math.pow(1 - t, 3);
            var alpha, yOff, font;

            if (ft.falling) {
                alpha = 1 - ease * ease;
                yOff = ease * 50;
                font = 'bold 18px sans-serif';
            } else {
                // Punkte: nach oben, wachsend, langsam ausfadend
                alpha = 1 - ease * ease;
                yOff = ease * -50;
                var size = 28 + ease * 16;  // 28px → 44px
                font = 'bold ' + Math.round(size) + 'px sans-serif';
            }

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = font;
            ctx.textAlign = 'center';
            ctx.fillStyle = ft.color;
            ctx.shadowColor = ft.color;
            // Blur: anfangs wenig, erst gegen Ende stärker
            ctx.shadowBlur = ft.big ? 12 : t * t * 10;
            ctx.fillText(ft.text, ft.x, ft.y + yOff);
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
        var entries = [];
        for (var key in fresh) entries.push(fresh[key]);
        entries.sort(function (a, b) { return b.score - a.score; });
        return entries.slice(0, 10);
    }

    function updateScorePanel() {
        if (!scorePanel) return;
        var top = getTop10();
        var html = '';
        for (var i = 0; i < top.length; i++) {
            var e = top[i];
            html += '<div style="white-space:nowrap">' +
                '<span style="display:inline-block;min-width:28px;text-align:right;font-weight:bold;margin-right:6px">' +
                e.score + '</span>' + e.name + '</div>';
        }
        if (!html) html = '<div style="opacity:0.5">Noch keine Scores</div>';
        scorePanel.innerHTML = html;
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
        drawBall();
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
