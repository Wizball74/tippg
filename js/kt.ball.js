/* global jQuery, setContent, webkitAudioContext */
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

    const CFG = {
        R:          10,       // Ball-Radius
        GRAVITY:    0.17,     // Schwerkraft pro Frame
        BOUNCE:     0.7,     // Rückprall-Faktor
        FRICTION:   0.997,    // Luftwiderstand (multipliziert pro Frame)
        CURSOR_R:   28,       // Cursor-Kollisionsradius (Schuh-Trefferfläche)
        MAX_V:      15,       // Maximalgeschwindigkeit
        MIN_VP:     992,      // Minimum-Viewport-Breite
        GHOST_MS:   2500,     // Max Ghost-Mode-Dauer
        BOTTOM_M:   90,       // Abstand zum unteren Fensterrand (Taskleiste)
        BLOCK_SEL: 'td.Pts1',
        LS_KEY: 'kt_ball_data'
    };

    // Console-API: ktBall.GRAVITY / .BOUNCE / .FRICTION lesen & setzen
    window.ktBall = {
        get GRAVITY()  { return CFG.GRAVITY; },
        set GRAVITY(v) { CFG.GRAVITY = +v; },
        get BOUNCE()   { return CFG.BOUNCE; },
        set BOUNCE(v)  { CFG.BOUNCE = +v; },
        get FRICTION()  { return CFG.FRICTION; },
        set FRICTION(v) { CFG.FRICTION = +v; }
    };

    // State
    let ball, canvas, ctx;
    let active = false, animFrame;
    let cursor = { x: -999, y: -999, vx: 0, vy: 0, lx: 0, ly: 0, lt: 0 };
    let cursorFlash = 0;  // Aufleuchten bei Kontakt (0..1)
    let cursorSink = 0;   // Quecksilber-Einsink-Tiefe (0..1)
    let cursorVis = 0;    // Cursor-Sichtbarkeit (0 = unsichtbar, 1 = voll)
    let lastKickTime = 0; // Zeitpunkt des letzten Schusses
    let ghostMode = false, ghostStart = 0;
    let revealed = false;
    let score = 0;
    let allScores = {};  // { "trid_md_fullName": { name, fullName, trid, md, score } }
    let floatingTexts = [];
    let particles = [];
    let scorePanel = null;
    let audioCtx = null;
    let soundEnabled = localStorage.getItem('kt_sound') !== 'off';
    let currentLevel = 1;  // 1 = Breakout, 2 = fliegende 5er, 3 = 2er/3er + Fallen

    // Statistik-Tracking pro Durchgang
    let stats = { l1: 0, l2: 0, l3: 0, l4: 0, kicks: 0, splits: [], skullHits: 0, startTime: 0 };
    function resetStats() {
        stats = { l1: 0, l2: 0, l3: 0, l4: 0, kicks: 0, splits: [], skullHits: 0, startTime: performance.now() };
    }
    function trackScore(pts) {
        let key = 'l' + currentLevel;
        if (stats[key] !== undefined) stats[key] += pts;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Boost-System: Punkte laden den Ball auf
    // ═══════════════════════════════════════════════════════════════
    let charge = 0;              // Aufladung (jeder Punkt +1)
    let chargeLastHit = 0;       // Zeitpunkt des letzten Punkt-Treffers
    const CHARGE_HOLD = 1500;      // ms bevor Abbau startet
    const CHARGE_DECAY = 3;        // Abbau pro Sekunde
    const CHARGE_MAX = 40;         // Deckel → dann Split!
    const CHARGE_MAX_FIRST = 35;   // erster Split wenn Ball alleine ist

    function chargeMax()  { return splitBalls.length === 0 ? CHARGE_MAX_FIRST : CHARGE_MAX; }
    function chargePct()  { return Math.min(charge / chargeMax(), 1); }
    function chargeR()   { return CFG.R * (1 + chargePct() * 0.5); }        // bis 50% größer (10→15)
    function chargeBounce() { return CFG.BOUNCE * (1 + chargePct() * 0.4); } // bis 40% mehr Bounce
    function chargeGravity() {
        let g = level4.active ? level4.gravity : CFG.GRAVITY;
        return Math.max(0.08, g * (1 - chargePct() * 0.45));
    }

    // Split-Bälle: kleine Klone die nach dem Charge-Max spawnen
    let splitBalls = [];
    const SPLIT_LIFETIME = 12000;
    let lastSplitTime = 0;
    const SPLIT_COOLDOWN = 1000; // ms bevor nächster Split möglich

    // Ball-Skins: jede Farbe hat eigene Physik-Persönlichkeit
    const BALL_SKINS = [
        { name: 'Standard', grad: ['#fff','#ffe0a0','#e8a020','#b07010'], pent: 'rgba(80,40,0,0.45)', stroke: '#a06010',
          gravity: 0.16, bounce: 0.75, friction: 0.997 },
        { name: 'Panzer',   grad: ['#fff','#ffc0c0','#e04040','#901010'], pent: 'rgba(60,0,0,0.45)',   stroke: '#901010',
          gravity: 0.22, bounce: 0.6,  friction: 0.999 },   // schwer, rollt weit
        { name: 'Feder',    grad: ['#fff','#c0e0ff','#4080e0','#103090'], pent: 'rgba(0,0,60,0.45)',   stroke: '#103090',
          gravity: 0.10, bounce: 0.7,  friction: 0.993 },   // leicht, schwebt länger
        { name: 'Kleber',   grad: ['#fff','#c0ffc0','#40c040','#108010'], pent: 'rgba(0,50,0,0.45)',   stroke: '#108010',
          gravity: 0.17, bounce: 0.45, friction: 0.990 },   // bleibt liegen, kaum Bounce
        { name: 'Geist',    grad: ['#fff','#e0c0ff','#a040e0','#501090'], pent: 'rgba(40,0,60,0.45)',  stroke: '#501090',
          gravity: 0.12, bounce: 0.80, friction: 0.999 },   // gleitet, wenig Reibung
        { name: 'Rakete',   grad: ['#fff','#ffe0c0','#e08020','#904010'], pent: 'rgba(60,30,0,0.45)',  stroke: '#904010',
          gravity: 0.19, bounce: 0.85, friction: 0.998 },   // schnell, springt gut
        { name: 'Flummi',   grad: ['#fff','#ffffc0','#e0e020','#909010'], pent: 'rgba(50,50,0,0.45)',  stroke: '#808010',
          gravity: 0.14, bounce: 0.95, friction: 0.996 },   // extrem bouncy!
        { name: 'Eis',      grad: ['#fff','#c0ffff','#40c0c0','#108080'], pent: 'rgba(0,50,50,0.45)',  stroke: '#108080',
          gravity: 0.16, bounce: 0.70, friction: 0.9995 },  // gleitet ewig, kaum Bremse
    ];

    function addCharge(pts, sourceBall) {
        let cap = chargeMax();
        charge = Math.min(charge + pts, cap);
        chargeLastHit = performance.now();

        // Charge voll → SPLIT! (mit Cooldown)
        if (charge >= cap && performance.now() - lastSplitTime > SPLIT_COOLDOWN) {
            let src = sourceBall || ball;
            if (src) {
                splitBall(src);
                lastSplitTime = performance.now();
                charge = 0;
            }
        }
    }

    function splitBall(src) {
        if (!src) return;
        let splitR = (src === ball ? chargeR() : src.r) * 0.85;
        let angle = (Math.random() > 0.5 ? 1 : -1) * Math.PI / 4;

        splitBalls.push({
            x: src.x,
            y: src.y,
            vx: Math.cos(angle) * 6 + src.vx * 0.5,
            vy: -Math.abs(Math.sin(angle) * 6) - 3,
            lastKick: performance.now(),
            r: splitR,
            life: SPLIT_LIFETIME,
            maxLife: SPLIT_LIFETIME,
            quat: src.quat ? src.quat.slice() : (ball ? ball.quat.slice() : [1,0,0,0]),
            wx: src.wx || 0, wz: src.wz || 0,
            skin: BALL_SKINS[Math.floor(Math.random() * BALL_SKINS.length)]
        });
        stats.splits.push(splitBalls[splitBalls.length - 1].skin.name);

        // Quellball Gegenimpuls
        src.vx -= Math.cos(angle) * 3;
        src.vy -= 3;

        // Visuelles Feedback
        floatingTexts.push({
            x: src.x, y: src.y - 20,
            text: 'SPLIT!',
            life: 2000, maxLife: 2000,
            color: '#FF4136', stroke: '#7b1f1f', big: true
        });

        // Partikel-Burst
        for (let p = 0; p < 20; p++) {
            let pa = Math.random() * Math.PI * 2;
            particles.push({
                x: src.x, y: src.y,
                vx: Math.cos(pa) * (1 + Math.random() * 3),
                vy: Math.sin(pa) * (1 + Math.random() * 3),
                life: 800 + Math.random() * 600,
                maxLife: 800 + Math.random() * 600,
                size: 2 + Math.random() * 3,
                color: ['#FF4136','#FF851B','#FFDC00'][Math.floor(Math.random() * 3)]
            });
        }

        if (soundEnabled) playSplit();
    }

    function stepSplitBalls(dt) {
        let w = window.innerWidth, h = window.innerHeight - CFG.BOTTOM_M;
        for (let i = splitBalls.length - 1; i >= 0; i--) {
            let sb = splitBalls[i];
            if (sb.popping) {
                sb.life -= dt;
                if (sb.life <= 0) { splitBalls.splice(i, 1); continue; }
            } else if (performance.now() - sb.lastKick > 20000) {
                // 20s nicht gekickt → auflösen
                sb.popping = true;
                sb.life = 500;
                for (let p = 0; p < 10; p++) {
                    let pa = Math.random() * Math.PI * 2;
                    particles.push({
                        x: sb.x, y: sb.y,
                        vx: Math.cos(pa) * (1 + Math.random() * 2),
                        vy: Math.sin(pa) * (1 + Math.random() * 2),
                        life: 500 + Math.random() * 300,
                        maxLife: 500 + Math.random() * 300,
                        size: 2 + Math.random() * 2,
                        color: ['#e8a020','#ffe0a0','#b07010'][Math.floor(Math.random() * 3)]
                    });
                }
                if (soundEnabled) playPling(1);
            }

            // Physics (jeder Ball hat eigene Werte aus seinem Skin)
            let sk = sb.skin || BALL_SKINS[0];
            let sbGrav = level4.active ? level4.gravity : sk.gravity;
            let sbBounce = sk.bounce;
            let sbFriction = sk.friction;
            sb.vy += sbGrav;
            sb.x += sb.vx;
            sb.y += sb.vy;
            sb.vx *= sbFriction;
            sb.vy *= sbFriction;

            // Wände
            if (sb.x - sb.r < 0) { sb.x = sb.r; sb.vx = Math.abs(sb.vx) * sbBounce; }
            if (sb.x + sb.r > w) { sb.x = w - sb.r; sb.vx = -Math.abs(sb.vx) * sbBounce; }
            if (sb.y + sb.r > h) { sb.y = h - sb.r; sb.vy = -Math.abs(sb.vy) * sbBounce; sb.vx *= 0.95; }

            // Plattformen
            let platforms = collectPlatforms();
            for (let pi = 0; pi < platforms.length; pi++) {
                let p = platforms[pi];
                let rect = { left: p.left, right: p.right, top: p.y - 1.5, bottom: p.y + 1.5 };
                let col = circleRectCollision(sb.x, sb.y, sb.r, rect);
                if (col) {
                    sb.x += col.nx * col.overlap * 1.01;
                    sb.y += col.ny * col.overlap * 1.01;
                    let dot = sb.vx * col.nx + sb.vy * col.ny;
                    if (dot < 0) { sb.vx -= (1 + CFG.BOUNCE) * dot * col.nx; sb.vy -= (1 + CFG.BOUNCE) * dot * col.ny; }
                }
            }

            // Blöcke treffen (Level 1)
            let cells = document.querySelectorAll(CFG.BLOCK_SEL);
            for (let ci = 0; ci < cells.length; ci++) {
                let el = cells[ci];
                let val = parseInt(el.textContent);
                if (!val || val < 1) continue;
                let cr = el.getBoundingClientRect();
                if (cr.width < 4 || cr.height < 4) continue;
                let bCol = circleRectCollision(sb.x, sb.y, sb.r, cr);
                if (bCol) {
                    sb.x += bCol.nx * bCol.overlap * 1.01;
                    sb.y += bCol.ny * bCol.overlap * 1.01;
                    let bDot = sb.vx * bCol.nx + sb.vy * bCol.ny;
                    if (bDot < 0) { sb.vx -= (1 + CFG.BOUNCE) * bDot * bCol.nx; sb.vy -= (1 + CFG.BOUNCE) * bDot * bCol.ny; }
                    destroyBlock(el, val, cr, sb);
                    break;
                }
            }

            // Level-2-Sprites treffen (Split-Ball)
            if (level2.active && !sb.popping) {
                for (let si = level2.sprites.length - 1; si >= 0; si--) {
                    let spr = level2.sprites[si];
                    let sdx = sb.x - spr.x, sdy = sb.y - spr.y;
                    let sDist = Math.sqrt(sdx * sdx + sdy * sdy);
                    if (sDist < sb.r + spr.r) {
                        // Abprall Split-Ball
                        let snx = sDist > 0.001 ? sdx / sDist : 0;
                        let sny = sDist > 0.001 ? sdy / sDist : -1;
                        let sOverlap = sb.r + spr.r - sDist;
                        sb.x += snx * sOverlap * 0.6;
                        sb.y += sny * sOverlap * 0.6;
                        let sDot = sb.vx * snx + sb.vy * sny;
                        if (sDot < 0) { sb.vx -= (1 + CFG.BOUNCE) * sDot * snx; sb.vy -= (1 + CFG.BOUNCE) * sDot * sny; }

                        let sPts = spr.value;
                        if (soundEnabled) playPling(sPts);
                        score += sPts; trackScore(sPts);
                        addCharge(sPts, sb);
                        saveScore();
                        updateScorePanel();

                        floatingTexts.push({
                            x: spr.x, y: spr.y - 10, text: '+' + sPts,
                            life: 2200, maxLife: 2200,
                            color: L2_COLORS[sPts] || '#FF4136',
                            stroke: L2_STROKES[sPts] || '#7b1f1f'
                        });
                        for (let sp = 0; sp < 14; sp++) {
                            let spa = Math.random() * Math.PI * 2;
                            particles.push({
                                x: spr.x, y: spr.y,
                                vx: Math.cos(spa) * (1 + Math.random() * 3),
                                vy: Math.sin(spa) * (1 + Math.random() * 3),
                                life: 600 + Math.random() * 400,
                                maxLife: 600 + Math.random() * 400,
                                size: 2 + Math.random() * 3,
                                color: L2_COLORS[sPts] || '#FF4136'
                            });
                        }

                        level2.sprites.splice(si, 1);
                        if (level2.sprites.length === 0) {
                            if (level2.countdownTimer) { clearInterval(level2.countdownTimer); level2.countdownTimer = null; }
                            level2.active = false;
                            level2RestoreGrid();
                            spawnConfetti();
                        }
                        break;
                    }
                }
            }

            // Level-3-Sprites treffen (Split-Ball)
            if (level3.active && !sb.popping) {
                for (let si = level3.sprites.length - 1; si >= 0; si--) {
                    let spr = level3.sprites[si];
                    let sdx = sb.x - spr.x, sdy = sb.y - spr.y;
                    let sDist = Math.sqrt(sdx * sdx + sdy * sdy);
                    if (sDist < sb.r + spr.r) {
                        let snx = sDist > 0.001 ? sdx / sDist : 0;
                        let sny = sDist > 0.001 ? sdy / sDist : -1;
                        let sOverlap = sb.r + spr.r - sDist;
                        sb.x += snx * sOverlap * 0.6;
                        sb.y += sny * sOverlap * 0.6;
                        let sDot = sb.vx * snx + sb.vy * sny;
                        if (sDot < 0) { sb.vx -= (1 + CFG.BOUNCE) * sDot * snx; sb.vy -= (1 + CFG.BOUNCE) * sDot * sny; }

                        if (spr.trap) {
                            // Skull: 3 positive Sprites verpuffen lassen
                            if (soundEnabled) playSkull(); stats.skullHits++;
                            floatingTexts.push({ x: spr.x, y: spr.y - 10, text: 'PUFF!', life: 2500, maxLife: 2500, color: L3_TRAP_COLOR, stroke: L3_TRAP_STROKE, big: true });
                            for (let sp = 0; sp < 16; sp++) { let spa = Math.random() * Math.PI * 2; particles.push({ x: spr.x, y: spr.y, vx: Math.cos(spa) * (2 + Math.random() * 3), vy: Math.sin(spa) * (2 + Math.random() * 3), life: 700 + Math.random() * 400, maxLife: 700 + Math.random() * 400, size: 2 + Math.random() * 3, color: L3_TRAP_COLOR }); }
                            level3.sprites.splice(si, 1);
                            let dest = 0;
                            for (let dd = level3.sprites.length - 1; dd >= 0 && dest < 3; dd--) {
                                if (!level3.sprites[dd].trap) {
                                    let ds = level3.sprites[dd];
                                    floatingTexts.push({ x: ds.x, y: ds.y - 10, text: 'PUFF!', life: 1500, maxLife: 1500, color: '#999', stroke: '#444' }); if (soundEnabled) playPuff();
                                    for (let dp = 0; dp < 10; dp++) { let dpa = Math.random() * Math.PI * 2; particles.push({ x: ds.x, y: ds.y, vx: Math.cos(dpa) * 2, vy: Math.sin(dpa) * 2, life: 500, maxLife: 500, size: 2, color: '#999' }); }
                                    level3.sprites.splice(dd, 1);
                                    level3.goodCount--;
                                    dest++;
                                }
                            }
                        } else {
                            let sPts = spr.value;
                            if (soundEnabled) playPling(sPts);
                            score += sPts; trackScore(sPts);
                            addCharge(sPts, sb);
                            saveScore();
                            updateScorePanel();
                            floatingTexts.push({ x: spr.x, y: spr.y - 10, text: '+' + sPts, life: 2200, maxLife: 2200, color: L2_COLORS[sPts] || '#2ECC40', stroke: L2_STROKES[sPts] || '#145a1e' });
                            for (let sp = 0; sp < 12; sp++) { let spa = Math.random() * Math.PI * 2; particles.push({ x: spr.x, y: spr.y, vx: Math.cos(spa) * (1 + Math.random() * 2.5), vy: Math.sin(spa) * (1 + Math.random() * 2.5), life: 500 + Math.random() * 300, maxLife: 500 + Math.random() * 300, size: 2 + Math.random() * 2, color: L2_COLORS[sPts] || '#2ECC40' }); }
                            level3.goodCount--;
                            level3.sprites.splice(si, 1);
                        }
                        if (level3.goodCount <= 0) {
                            level3.active = false;
                            level3.sprites = [];
                            level2RestoreGrid();
                            spawnConfetti();
                        }
                        break;
                    }
                }
            }

            // Speed clamp
            let spd = Math.sqrt(sb.vx * sb.vx + sb.vy * sb.vy);
            if (spd > CFG.MAX_V) { let s = CFG.MAX_V / spd; sb.vx *= s; sb.vy *= s; }

            // Rotation
            sb.wz = sb.vx / sb.r;
            let wSpd = Math.abs(sb.wz);
            if (wSpd > 0.0001) {
                let half = wSpd / 2, sin = Math.sin(half);
                let dq = [Math.cos(half), 0, 0, (sb.wz > 0 ? 1 : -1) * sin];
                sb.quat = qNorm(qMul(dq, sb.quat));
            }
        }
    }

    function drawSplitBalls() {
        for (let i = 0; i < splitBalls.length; i++) {
            let sb = splitBalls[i];
            let skin = sb.skin || BALL_SKINS[0];
            let fadeAlpha = sb.popping ? Math.min(sb.life / 500, 1) : 1;

            ctx.save();
            ctx.globalAlpha = fadeAlpha;
            ctx.translate(sb.x, sb.y);

            // Rotation (vereinfacht: nur Z-Rotation aus Quaternion)
            let q = sb.quat;
            let angle = 2 * Math.atan2(Math.sqrt(q[1]*q[1] + q[2]*q[2] + q[3]*q[3]), q[0]);
            if (q[3] < 0) angle = -angle;
            ctx.rotate(angle);

            // Ball zeichnen mit Skin
            ctx.beginPath();
            ctx.arc(0, 0, sb.r, 0, Math.PI * 2);
            ctx.clip();

            let g = ctx.createRadialGradient(-sb.r * 0.3, -sb.r * 0.3, sb.r * 0.1, 0, 0, sb.r);
            g.addColorStop(0, skin.grad[0]);
            g.addColorStop(0.25, skin.grad[1]);
            g.addColorStop(0.6, skin.grad[2]);
            g.addColorStop(1, skin.grad[3]);
            ctx.fillStyle = g;
            ctx.fill();

            // Pentagon-Muster
            ctx.fillStyle = skin.pent;
            let pr = sb.r * 0.35;
            ctx.beginPath();
            for (let p = 0; p < 5; p++) {
                let pa = p * Math.PI * 2 / 5 - Math.PI / 2;
                ctx[p === 0 ? 'moveTo' : 'lineTo'](Math.cos(pa) * pr, Math.sin(pa) * pr);
            }
            ctx.closePath();
            ctx.fill();

            ctx.restore();

            // Umriss
            ctx.save();
            ctx.globalAlpha = fadeAlpha;
            ctx.strokeStyle = skin.stroke;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.arc(sb.x, sb.y, sb.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    function decayCharge(dt) {
        if (charge <= 0) return;
        let elapsed = performance.now() - chargeLastHit;
        if (elapsed < CHARGE_HOLD) return;
        charge -= CHARGE_DECAY * dt / 1000;
        if (charge < 0) charge = 0;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Zahlen-Jagd: Mini-Game wenn Übersicht leer ist
    // ═══════════════════════════════════════════════════════════════
    let hunt = {
        active: false,
        ready: false,          // true wenn 15s + 10 Berührungen erreicht
        touchCount: 0,
        firstTouchTime: 0,
        round: 0,
        timer: 60,
        timerEl: null,
        targets: [],           // [{ el, num }]
        intervalId: null,
        startTime: 0,          // performance.now() bei Spielstart (fuer Gesamtzeit)
        cooldownUntil: 0       // performance.now() Zeitpunkt bis wann kein neuer Hunt startet
    };

    // "Pfubb"-Sound: kurzer gedämpfter Tiefton, Lautstärke proportional zur Schuss-Stärke
    function initAudio() {
        if (audioCtx) return;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {}
    }

    // Hilfsfunktion: Oszillator + Gain erstellen und verbinden
    function sndOsc(type, freq, freqEnd, vol, volEnd, start, dur) {
        if (!audioCtx) return;
        let now = audioCtx.currentTime + (start || 0);
        let o = audioCtx.createOscillator();
        let g = audioCtx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, now);
        if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, now + dur);
        g.gain.setValueAtTime(vol, now);
        g.gain.exponentialRampToValueAtTime(volEnd || 0.001, now + dur);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(now);
        o.stop(now + dur + 0.01);
    }

    function sndNoise(vol, dur, start) {
        if (!audioCtx) return;
        let now = audioCtx.currentTime + (start || 0);
        let len = audioCtx.sampleRate * dur;
        let buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
        let d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
        let src = audioCtx.createBufferSource();
        src.buffer = buf;
        let g = audioCtx.createGain();
        g.gain.setValueAtTime(vol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        src.connect(g);
        g.connect(audioCtx.destination);
        src.start(now);
    }

    function playKick(intensity) {
        if (intensity < 0.03 || !audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        try {
            let v = 0.04 + intensity * 0.12;
            // Weiches "Tock": kurzer gedämpfter Sinus, kaum Noise
            sndOsc('sine', 220 + intensity * 60, 80, v, 0.001, 0, 0.07);
            sndNoise(v * 0.15, 0.015);
        } catch (e) {}
    }

    function playBounce() {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        try {
            sndOsc('sine', 180, 60, 0.08, 0.001, 0, 0.08);
            sndNoise(0.04, 0.02);
        } catch (e) {}
    }

    function playWallHit() {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        try {
            sndNoise(0.06, 0.025);
            sndOsc('sine', 90, 30, 0.06, 0.001, 0, 0.06);
        } catch (e) {}
    }

    function playPling(pts) {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        try {
            let v = 0.15 + Math.min(pts, 5) * 0.04;
            let f = 800 + pts * 250;
            // Glockenton: Sinus + Oberton + Shimmer
            sndOsc('sine', f, f * 0.9, v, 0.001, 0, 0.35);
            sndOsc('triangle', f * 2, f * 1.8, v * 0.2, 0.001, 0, 0.15);
            sndOsc('sine', f * 3, f * 2.5, v * 0.08, 0.001, 0, 0.1);
        } catch (e) {}
    }

    function playSplit() {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        try {
            // Aufsteigender Sweep + Noise
            sndOsc('sawtooth', 200, 800, 0.12, 0.001, 0, 0.15);
            sndOsc('sine', 400, 1200, 0.08, 0.001, 0.02, 0.12);
            sndNoise(0.1, 0.05);
        } catch (e) {}
    }

    function playSkull() {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        try {
            // Dunkler Doom-Sound: tiefer Buzz + absteigender Ton
            sndOsc('sawtooth', 80, 30, 0.15, 0.001, 0, 0.3);
            sndOsc('square', 120, 40, 0.06, 0.001, 0, 0.25);
            sndNoise(0.12, 0.06);
            // Nachhall
            sndOsc('sine', 60, 25, 0.08, 0.001, 0.1, 0.3);
        } catch (e) {}
    }

    function playPuff() {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        try {
            // Leises Verpuffen
            sndNoise(0.08, 0.06);
            sndOsc('sine', 300, 80, 0.05, 0.001, 0, 0.1);
        } catch (e) {}
    }

    function playLevelUp() {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        try {
            // Aufsteigende Fanfare: 3 Töne
            sndOsc('sine', 523, 523, 0.15, 0.001, 0, 0.15);     // C5
            sndOsc('triangle', 523, 523, 0.06, 0.001, 0, 0.12);
            sndOsc('sine', 659, 659, 0.15, 0.001, 0.12, 0.15);  // E5
            sndOsc('triangle', 659, 659, 0.06, 0.001, 0.12, 0.12);
            sndOsc('sine', 784, 784, 0.18, 0.001, 0.24, 0.25);  // G5
            sndOsc('triangle', 784, 784, 0.08, 0.001, 0.24, 0.2);
            sndOsc('sine', 1047, 1047, 0.2, 0.001, 0.38, 0.35); // C6
            sndOsc('triangle', 1568, 1568, 0.06, 0.001, 0.38, 0.2);
        } catch (e) {}
    }

    function playConfetti() {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        try {
            // Shimmer-Kaskade
            for (let i = 0; i < 6; i++) {
                let f = 1200 + Math.random() * 1500;
                sndOsc('sine', f, f * 0.7, 0.04, 0.001, i * 0.06, 0.2);
            }
            sndNoise(0.05, 0.08, 0.02);
        } catch (e) {}
    }

    // Pentagon-Zentren auf Einheitskugel (Ikosaeder)
    let pentas = [
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
        let len = Math.sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3]);
        return [q[0]/len, q[1]/len, q[2]/len, q[3]/len];
    }

    function qRotate(q, px, py, pz) {
        // q * [0,px,py,pz] * q^-1
        let qp = qMul(q, [0, px, py, pz]);
        let r = qMul(qp, [q[0], -q[1], -q[2], -q[3]]);
        return [r[1], r[2], r[3]];
    }

    // ═══════════════════════════════════════════════════════════════
    //  Injiziertes CSS: Glut-Effekt + Hover-Deaktivierung
    // ═══════════════════════════════════════════════════════════════
    let styleEl = null;
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
        let burned = document.querySelectorAll('.kt-ball-burned');
        for (let i = 0; i < burned.length; i++) {
            burned[i].classList.remove('kt-ball-burned');
            burned[i].style.cssText = '';
            burned[i].style.pointerEvents = '';
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Name-Hilfsfunktionen
    // ═══════════════════════════════════════════════════════════════
    function getFullName() {
        let row = document.querySelector('tr.rowUser td');
        return row ? row.textContent.replace(/\uD83D\uDC51\s*/, '').trim() : '';
    }

    function shortName(fullName) {
        // "Mueller, Thomas" → "Thomas" (bei Duplikaten clientseitig nicht erkennbar → mit Initial)
        if (!fullName) return '?';
        let parts = fullName.split(',');
        if (parts.length < 2) return fullName;
        let nachname = parts[0].trim();
        let vorname = parts[1].trim();
        return vorname + ' ' + nachname.charAt(0);
    }

    kt.setBallSound = function (on) {
        soundEnabled = on;
        if (on) initAudio();
    };

    // ═══════════════════════════════════════════════════════════════
    kt.initBall = function () {
        if (active) return; // bereits gestartet
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
        level3Cleanup();
        level4Cleanup();
        // Burned-Zellen zurücksetzen
        let burned = document.querySelectorAll('.kt-ball-burned');
        for (let i = 0; i < burned.length; i++) burned[i].classList.remove('kt-ball-burned');
        // Ausgeblendete Zellen wiederherstellen
        let faded = document.querySelectorAll('td.Tipps, td.Name, th.Tipps, th.Name, .ui-jqgrid-titlebar');
        for (let i = 0; i < faded.length; i++) { faded[i].style.opacity = ''; faded[i].style.transition = ''; }
        removeStyles();
        document.body.classList.remove('kt-ball-active');
        document.body.classList.remove('kt-ball-game');
        charge = 0;
        score = 0;
        revealed = false;
        currentLevel = 1;
        ball = null; canvas = null; ctx = null;
    };

    // TEST: kt.testCascade(0.7) - blendet 70% der Nicht-Pts1-Zellen aus
    kt.testCascade = function (ratio) {
        ratio = ratio || 0.7;
        let tbody = document.querySelector('.ui-jqgrid-btable tbody');
        if (!tbody) return;
        let cells = tbody.querySelectorAll('td');
        for (let i = 0; i < cells.length; i++) {
            let cell = cells[i];
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

    // TEST: kt.nextLevel() - springt zum nächsten Level
    kt.nextLevel = function () {
        if (!active) return;
        level2Cleanup();
        level3Cleanup();
        level4Cleanup();
        huntCleanup();
        hunt.touchCount = 0;
        hunt.firstTouchTime = 0;
        splitBalls = [];
        spawnConfetti();
    };

    kt.rescanBallObstacles = function () {
        if (!active) return;
        // Score pro Seitenansicht zurücksetzen (Highscores bleiben in localStorage)
        score = 0;
        charge = 0;
        revealed = false;
        huntCleanup();
        hunt.cooldownUntil = 0; // Cooldown bei Seitenwechsel aufheben
        level2Cleanup();
        level3Cleanup();
        level4Cleanup();
        currentLevel = 1;
        glowLines = [];
        splitBalls = [];
        floatingTexts = [];
        removeScorePanel();
        document.body.classList.remove('kt-ball-game');
        // Ausgeblendete Zellen wiederherstellen
        let faded = document.querySelectorAll('td.Tipps, td.Name, th.Tipps, th.Name, .ui-jqgrid-titlebar');
        for (let i = 0; i < faded.length; i++) { faded[i].style.opacity = ''; faded[i].style.transition = ''; }
        setTimeout(function () {
            if (!ball) spawnBall();
        }, 1500);
    };

    // ═══════════════════════════════════════════════════════════════
    function spawnBall() {
        if (!document.querySelector('.ui-jqgrid-titlebar')) return;
        // Oben außerhalb des Viewports starten, fällt dann rein
        let w = window.innerWidth;
        ball = {
            x: w * (0.1 + Math.random() * 0.8),
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
        let cx = Math.max(rect.left, Math.min(bx, rect.right));
        let cy = Math.max(rect.top, Math.min(by, rect.bottom));
        let dx = bx - cx, dy = by - cy;
        let distSq = dx * dx + dy * dy;
        if (distSq >= r * r) return null;
        let dist = Math.sqrt(distSq);
        if (dist < 0.001) return { nx: 0, ny: -1, overlap: r };
        return { nx: dx / dist, ny: dy / dist, overlap: r - dist };
    }

    function resolveCollision(col) {
        ball.x += col.nx * col.overlap * 1.01;
        ball.y += col.ny * col.overlap * 1.01;
        let bounce = chargeBounce();
        let dot = ball.vx * col.nx + ball.vy * col.ny;
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
        let platforms = []; // { y, left, right }
        let grids = document.querySelectorAll('.ui-jqgrid');
        for (let g = 0; g < grids.length; g++) {
            let grid = grids[g];
            let gRect = grid.getBoundingClientRect();
            if (gRect.width < 20 || gRect.bottom < 0 || gRect.top > window.innerHeight) continue;
            let left = gRect.left, right = gRect.right;

            // Titlebar – Oberkante
            let tb = grid.querySelector('.ui-jqgrid-titlebar');
            if (tb) {
                let tbr = tb.getBoundingClientRect();
                platforms.push({ y: tbr.top, left: left, right: right });
            }

            // Header – Unterkante (Spaltenüberschriften)
            let hd = grid.querySelector('.ui-jqgrid-hdiv');
            if (hd) {
                let hdr = hd.getBoundingClientRect();
                platforms.push({ y: hdr.bottom, left: left, right: right });
            }

            // Hervorgehobene Zeilen (rowUser, rowOpponent) – Unterkante (bunt/glow)
            let specials = grid.querySelectorAll('tr.rowUser, tr.rowOpponent');
            for (let s = 0; s < specials.length; s++) {
                let sr = specials[s].getBoundingClientRect();
                if (sr.height > 0) platforms.push({ y: sr.bottom, left: left, right: right, glow: true });
            }

            // Toolbar / Pager – Oberkante (wenn sichtbar)
            let pager = grid.querySelector('.ui-jqgrid-pager');
            if (pager) {
                let pr = pager.getBoundingClientRect();
                if (pr.height > 0) platforms.push({ y: pr.top, left: left, right: right });
            }

            // Letzte Datenzeile – Unterkante (Tabellenboden) — solide, kein Durchflug
            let rows = grid.querySelectorAll('.ui-jqgrid-bdiv tr[role="row"]');
            if (rows.length) {
                let lr = rows[rows.length - 1].getBoundingClientRect();
                platforms.push({ y: lr.bottom, left: left, right: right, solid: true });
            }
        }
        // Pinnwand-Karten – Oberkante als Plattform
        let pinCards = document.querySelectorAll('.pin-card');
        for (let pc = 0; pc < pinCards.length; pc++) {
            let pcr = pinCards[pc].getBoundingClientRect();
            if (pcr.width < 20 || pcr.bottom < 0 || pcr.top > window.innerHeight) continue;
            platforms.push({ y: pcr.top, left: pcr.left, right: pcr.right });
        }

        return platforms;
    }

    function collidePlatforms() {
        let T = 3;
        let platforms = collectPlatforms();
        let cr = chargeR();

        for (let i = 0; i < platforms.length; i++) {
            let p = platforms[i];

            // Ghost-Mode: Ball fliegt durch → Effekt an Austrittsseite (nicht durch solide Linien)
            if (ghostMode && !p.solid) {
                if (ball.x >= p.left && ball.x <= p.right) {
                    let prevY = ball.y - ball.vy;
                    // Ball überquert Linie von oben nach unten
                    if (prevY + cr <= p.y && ball.y + cr > p.y) {
                        spawnPassthroughFx(ball.x, p.y, p.left, p.right, 1, p.glow);  // Austritt unten
                    }
                    // Ball überquert Linie von unten nach oben
                    if (prevY - cr >= p.y && ball.y - cr < p.y) {
                        spawnPassthroughFx(ball.x, p.y, p.left, p.right, -1, p.glow); // Austritt oben
                    }
                }
                continue;
            }

            let rect = { left: p.left, right: p.right, top: p.y - T / 2, bottom: p.y + T / 2 };
            let col = circleRectCollision(ball.x, ball.y, cr, rect);
            if (col) { resolveCollision(col); continue; }

            // Anti-Tunneling: Ball hat Linie im letzten Frame überquert
            if (ball.x >= p.left && ball.x <= p.right && ball.vy > 0) {
                let prevY = ball.y - ball.vy;
                if (prevY + cr <= p.y && ball.y + cr > p.y) {
                    ball.y = p.y - cr;
                    ball.vy = -Math.abs(ball.vy) * CFG.BOUNCE;
                    ball.onGround = true;
                }
            }
        }
    }

    function spawnPassthroughFx(bx, py, left, right, dir, isGlow) {
        let spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        let intensity = Math.min(spd / 4, 3);
        let cx = Math.max(left, Math.min(bx, right));

        if (isGlow) {
            // Elektrisches Bruzzeln: Funken in Austrittsrichtung
            let count = Math.floor(4 + intensity * 4);
            for (let i = 0; i < count; i++) {
                let a = (dir > 0 ? 0.5 : -0.5) * Math.PI + (Math.random() - 0.5) * Math.PI * 0.8;
                let speed = 1 + Math.random() * intensity * 1.5;
                particles.push({
                    x: cx + (Math.random() - 0.5) * 20,
                    y: py + dir * 2,
                    vx: Math.cos(a) * speed + ball.vx * 0.15,
                    vy: Math.sin(a) * speed,
                    life: 150 + Math.random() * 250,
                    maxLife: 150 + Math.random() * 250,
                    size: 1.5 + Math.random() * 2,
                    color: _glowColors[Math.floor(Math.random() * _glowColors.length)],
                    rot: 0, spark: true
                });
            }
        } else {
            // Grauer Staub-Puff in Austrittsrichtung
            let big = Math.random() < 0.12;  // ~12% Chance auf großen Puff
            let count = big ? Math.floor(6 + intensity * 3) : Math.floor(3 + intensity * 2);
            let sizeMul = big ? 2.2 : 1;
            let lifeMul = big ? 1.8 : 1;
            for (let i = 0; i < count; i++) {
                let a = (dir > 0 ? 0.5 : -0.5) * Math.PI + (Math.random() - 0.5) * Math.PI * 0.6;
                let speed = 0.3 + Math.random() * intensity * 0.5;
                particles.push({
                    x: cx + (Math.random() - 0.5) * 16 * sizeMul,
                    y: py + dir * 2,
                    vx: Math.cos(a) * speed + ball.vx * 0.1,
                    vy: Math.sin(a) * speed,
                    life: (300 + Math.random() * 300) * lifeMul,
                    maxLife: (300 + Math.random() * 300) * lifeMul,
                    size: (3 + Math.random() * 5) * sizeMul,
                    color: '#999', rot: 0, dust: true
                });
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Block-Kollisionen (Breakout-Zellen)
    // ═══════════════════════════════════════════════════════════════
    function collideBlocks() {
        if (level2.active || level3.active) return; // Level 2/3 nutzen Sprites, keine Grid-Blöcke
        let cells = document.querySelectorAll(CFG.BLOCK_SEL);
        for (let i = 0; i < cells.length; i++) {
            let el = cells[i];
            if (el.querySelector('.kt-hunt-num')) continue; // Zahlen-Jagd-Target, separat behandelt
            let val = parseInt(el.textContent);
            if (!val || val < 1) continue;
            let rect = el.getBoundingClientRect();
            if (rect.width < 4 || rect.height < 4) continue;
            let col = circleRectCollision(ball.x, ball.y, chargeR(), rect);
            if (col) {
                resolveCollision(col);
                destroyBlock(el, val, rect);
                return;
            }
        }
    }

    function destroyBlock(el, pts, rect, sourceBall) {
        if (!revealed) {
            revealed = true;
            resetStats();
            revealEffect(rect);
            showScorePanel();
        }

        if (soundEnabled) playPling(pts);
        trackScore(pts);
        score += pts;
        addCharge(pts, sourceBall);
        saveScore();
        updateScorePanel();

        // Explosions-Boost: Ball wird etwas weggeschleudert
        if (ball) {
            let boost = 0.3 + pts * 0.15 + chargePct() * 0.5;
            let cx2 = rect.left + rect.width / 2, cy2 = rect.top + rect.height / 2;
            let edx = ball.x - cx2, edy = ball.y - cy2;
            let eDist = Math.sqrt(edx * edx + edy * edy) || 1;
            ball.vx += (edx / eDist) * boost;
            ball.vy += (edy / eDist) * boost;
        }

        let cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;

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

        // Zelle: sofort Text leeren (verhindert Doppeltreffer), dann ausblenden
        el.textContent = '';
        el.style.transition = 'opacity 0.4s ease-out';
        el.style.opacity = '0';
        setTimeout(function () {
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
        let cells = document.querySelectorAll(CFG.BLOCK_SEL);
        for (let i = 0; i < cells.length; i++) {
            let val = parseInt(cells[i].textContent);
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
    const CASCADE_RATIO = 0.65;
    const CASCADE_RADIUS = 2;
    let _cascadePending = false;

    function isCellDead(cell) {
        return cell.classList.contains('kt-ball-burned');
    }

    function getGridCells(el) {
        let tbody = el.closest('tbody');
        if (!tbody) return null;
        let rows = tbody.querySelectorAll('tr');
        let grid = [];
        for (let r = 0; r < rows.length; r++) {
            let cells = rows[r].querySelectorAll('td');
            let row = [];
            for (let c = 0; c < cells.length; c++) row.push(cells[c]);
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
        let grid = getGridCells(srcEl);
        if (!grid) return;

        let toDestroy = [];
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                let cell = grid[r][c];
                if (isCellDead(cell)) continue;
                if (cell.offsetWidth < 4) continue;

                // Nachbarn im Radius zählen
                let total = 0, dead = 0;
                for (let dr = -CASCADE_RADIUS; dr <= CASCADE_RADIUS; dr++) {
                    for (let dc = -CASCADE_RADIUS; dc <= CASCADE_RADIUS; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        let nr = r + dr, nc = c + dc;
                        if (nr < 0 || nr >= grid.length) continue;
                        if (nc < 0 || nc >= grid[nr].length) continue;
                        let neighbor = grid[nr][nc];
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
        let batch = toDestroy.slice(0, 3);
        for (let i = 0; i < batch.length; i++) {
            (function(cell, delay) {
                setTimeout(function() {
                    if (isCellDead(cell)) return;
                    cascadeDestroy(cell);
                }, delay);
            })(batch[i], i * 150);
        }
    }

    function cascadeDestroy(cell) {
        let rect = cell.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return;

        // Pts1-Zellen geben Punkte
        if (cell.classList.contains('Pts1')) {
            let pts = parseInt(cell.textContent) || 0;
            if (pts > 0) {
                score += pts; trackScore(pts);
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
        if (soundEnabled) { playLevelUp(); playConfetti(); }
        let w = window.innerWidth;
        let colors = ['#FF4136','#FF851B','#FFDC00','#2ECC40','#0074D9','#B10DC9','#FF69B4','#01FF70'];
        let count = 150;

        floatingTexts.push({
            x: w / 2, y: window.innerHeight / 2 - 40,
            text: 'ALL CLEAR!',
            life: 4000, maxLife: 4000,
            color: '#FFD700', stroke: '#7A5B00', big: true
        });

        for (let i = 0; i < count; i++) {
            let x = Math.random() * w;
            let delay = Math.random() * 600;
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

        // Split-Bälle nacheinander platzen lassen
        popSplitBalls();

        // Nächstes Level starten nach Konfetti
        setTimeout(function() {
            if (!active) return;
            if (currentLevel === 1) { currentLevel = 2; level2Start(); }
            else if (currentLevel === 2) { currentLevel = 3; level3Start(); }
            else if (currentLevel === 3) { currentLevel = 4; level4Start(); }
            else { showFinalScreen(); }
        }, 4500);
    }

    function popSplitBalls() {
        for (let i = 0; i < splitBalls.length; i++) {
            (function(idx) {
                setTimeout(function() {
                    if (idx >= splitBalls.length) return;
                    let sb = splitBalls[idx];
                    sb.popping = true;
                    sb.life = 500;
                    // Partikel-Burst an der Position
                    for (let p = 0; p < 15; p++) {
                        let pa = Math.random() * Math.PI * 2;
                        particles.push({
                            x: sb.x, y: sb.y,
                            vx: Math.cos(pa) * (1 + Math.random() * 3),
                            vy: Math.sin(pa) * (1 + Math.random() * 3),
                            life: 600 + Math.random() * 400,
                            maxLife: 600 + Math.random() * 400,
                            size: 2 + Math.random() * 3,
                            color: ['#e8a020','#ffe0a0','#b07010'][Math.floor(Math.random() * 3)]
                        });
                    }
                    if (soundEnabled) playPling(1);
                }, i * 400);
            })(i);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Level 2: Frei fliegende Zahlen-Sprites (Countdown 5→1)
    // ═══════════════════════════════════════════════════════════════
    let level2 = {
        active: false,
        sprites: [],       // [{ x, y, vx, vy, value, r, angle, va }]
        countdownTimer: null,
        currentValue: 5,
        startTime: 0
    };

    const L2_SPRITE_R   = 14;   // Sprite-Radius (≈ Zellengröße Level 1)
    const L2_SPEED      = 0.3;  // Basis-Geschwindigkeit (langsam, gemächlich)
    const L2_COUNTDOWN  = 20000; // 20s pro Stufe
    const L2_COLORS     = { 5:'#FF4136', 4:'#FF851B', 3:'#FFDC00', 2:'#2ECC40', 1:'#0074D9' };
    const L2_STROKES    = { 5:'#7b1f1f', 4:'#7a3a00', 3:'#7a6500', 2:'#145a1e', 1:'#003366' };

    function level2Start() {
        if (!active || level2.active) return;
        level2.active = true;
        level2.currentValue = 5;
        level2.startTime = performance.now();
        level2.sprites = [];

        floatingTexts.push({
            x: window.innerWidth / 2, y: window.innerHeight / 2,
            text: 'LEVEL 2',
            life: 3000, maxLife: 3000,
            color: '#FF4136', stroke: '#7b1f1f', big: true
        });

        // Grid komplett ausblenden (Linien, Zellen, alles)
        level2HideGrid();

        // Sprites innerhalb der Tabelle spawnen
        let bounds = level2GetBounds();
        let bw = bounds.right - bounds.left, bh = bounds.bottom - bounds.top;
        let count = Math.min(8, Math.max(4, Math.floor(bw * bh / 20000)));
        for (let n = 0; n < count; n++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = L2_SPEED * (0.7 + Math.random() * 0.6);
            level2.sprites.push({
                x: bounds.left + 30 + Math.random() * (bw - 60),
                y: bounds.top + 30 + Math.random() * (bh - 60),
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                value: 5,
                r: L2_SPRITE_R,
                angle: Math.random() * Math.PI * 2,
                va: (Math.random() - 0.5) * 0.03  // Rotationsgeschwindigkeit
            });
        }

        // Countdown-Timer: alle 20s Wert verringern
        level2.countdownTimer = setInterval(function() {
            if (!active || !level2.active) { level2Cleanup(); return; }
            if (level2.currentValue > 1) {
                level2.currentValue--;
                // Alle lebenden Sprites updaten
                for (let i = 0; i < level2.sprites.length; i++) {
                    level2.sprites[i].value = level2.currentValue;
                }
                // Visuelles Feedback
                floatingTexts.push({
                    x: window.innerWidth / 2, y: 60,
                    text: level2.currentValue === 1 ? 'LETZTE CHANCE!' : level2.currentValue + ' PUNKTE',
                    life: 2500, maxLife: 2500,
                    color: L2_COLORS[level2.currentValue],
                    stroke: L2_STROKES[level2.currentValue], big: true
                });
                if (soundEnabled) playPling(1);
            }
            // Bei 1 bleibt der Timer stehen (kein weiterer Countdown)
            if (level2.currentValue <= 1) {
                clearInterval(level2.countdownTimer);
                level2.countdownTimer = null;
            }
        }, L2_COUNTDOWN);
    }

    function level2HideGrid() {
        // Innere Zellen-Ränder ausblenden (Gitternetzlinien weg),
        // aber äußeren Rahmen und Glow-Lines (Plattformen) behalten
        let grids = document.querySelectorAll('.ui-jqgrid');
        for (let g = 0; g < grids.length; g++) {
            let tds = grids[g].querySelectorAll('.ui-jqgrid-bdiv td');
            for (let c = 0; c < tds.length; c++) {
                tds[c].style.transition = 'border-color 0.8s';
                tds[c].style.borderColor = 'transparent';
                // Restliche Zahlen aus Grid-Zellen entfernen (Überbleibsel Level 1)
                if (tds[c].classList.contains('Pts1') && parseInt(tds[c].textContent)) {
                    tds[c].textContent = '';
                }
            }
            // Horizontale Zeilen-Trennlinien ausblenden
            let trs = grids[g].querySelectorAll('.ui-jqgrid-bdiv tr');
            for (let r = 0; r < trs.length; r++) {
                // rowUser/rowOpponent behalten (sind Plattform + GlowLine)
                if (trs[r].classList.contains('rowUser') || trs[r].classList.contains('rowOpponent')) continue;
                trs[r].style.transition = 'border-color 0.8s';
                trs[r].style.borderColor = 'transparent';
            }
        }
    }

    function level2RestoreGrid() {
        let grids = document.querySelectorAll('.ui-jqgrid');
        for (let g = 0; g < grids.length; g++) {
            let tds = grids[g].querySelectorAll('.ui-jqgrid-bdiv td');
            for (let c = 0; c < tds.length; c++) {
                tds[c].style.transition = 'border-color 0.6s';
                tds[c].style.borderColor = '';
            }
            let trs = grids[g].querySelectorAll('.ui-jqgrid-bdiv tr');
            for (let r = 0; r < trs.length; r++) {
                trs[r].style.transition = 'border-color 0.6s';
                trs[r].style.borderColor = '';
            }
        }
    }

    function level2GetBounds() {
        // Spielfeld = Datenbereich der ersten sichtbaren Tabelle
        let bdiv = document.querySelector('.ui-jqgrid-bdiv');
        if (bdiv) {
            let r = bdiv.getBoundingClientRect();
            if (r.width > 20 && r.height > 20) {
                return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
            }
        }
        // Fallback: ganzer Viewport
        return { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight - CFG.BOTTOM_M };
    }

    function stepLevel2Sprites() {
        if (!level2.active) return;
        let bounds = level2GetBounds();
        let margin = L2_SPRITE_R;

        for (let i = 0; i < level2.sprites.length; i++) {
            let s = level2.sprites[i];

            // Bewegung
            s.x += s.vx;
            s.y += s.vy;
            s.angle += s.va;

            // An Tabellengrenzen abprallen
            if (s.x - margin < bounds.left)   { s.x = bounds.left + margin;  s.vx = Math.abs(s.vx); }
            if (s.x + margin > bounds.right)  { s.x = bounds.right - margin; s.vx = -Math.abs(s.vx); }
            if (s.y - margin < bounds.top)    { s.y = bounds.top + margin;   s.vy = Math.abs(s.vy); }
            if (s.y + margin > bounds.bottom) { s.y = bounds.bottom - margin; s.vy = -Math.abs(s.vy); }

            // Leichte Geschwindigkeitsvariation (Drift)
            if (Math.random() < 0.005) {
                let nudge = 0.05;
                s.vx += (Math.random() - 0.5) * nudge;
                s.vy += (Math.random() - 0.5) * nudge;
                // Speed begrenzen
                let spd = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
                let target = L2_SPEED * (0.7 + Math.random() * 0.6);
                if (spd > 0.01) { s.vx *= target / spd; s.vy *= target / spd; }
            }
        }
    }

    function drawLevel2Sprites() {
        if (!level2.active) return;
        let t = performance.now() * 0.001;

        for (let i = 0; i < level2.sprites.length; i++) {
            let s = level2.sprites[i];
            let col = L2_COLORS[s.value] || '#FF4136';

            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.angle);

            // Äußerer Glow
            ctx.shadowColor = col;
            ctx.shadowBlur = 12 + Math.sin(t * 3 + i) * 4;

            // Kreis-Hintergrund
            ctx.beginPath();
            ctx.arc(0, 0, s.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fill();
            ctx.strokeStyle = col;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Pulsierender Ring
            let pulse = 1 + Math.sin(t * 4 + i * 1.3) * 0.06;
            ctx.beginPath();
            ctx.arc(0, 0, s.r * pulse * 1.12, 0, Math.PI * 2);
            ctx.strokeStyle = col;
            ctx.lineWidth = 0.8;
            ctx.globalAlpha = 0.25 + Math.sin(t * 3 + i) * 0.1;
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Zahl
            ctx.shadowBlur = 0;
            ctx.fillStyle = col;
            ctx.font = 'bold 15px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(s.value, 0, 1);

            ctx.restore();
        }
    }

    function level2Cleanup() {
        level2.active = false;
        if (level2.countdownTimer) { clearInterval(level2.countdownTimer); level2.countdownTimer = null; }
        level2.sprites = [];
        level2.currentValue = 5;
        level2RestoreGrid();
    }

    function level2CollideBall() {
        if (!level2.active || !ball) return;
        let br = chargeR();

        for (let i = level2.sprites.length - 1; i >= 0; i--) {
            let s = level2.sprites[i];
            let dx = ball.x - s.x, dy = ball.y - s.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            let minDist = br + s.r;

            if (dist < minDist) {
                // Abprall
                let nx = dist > 0.001 ? dx / dist : 0;
                let ny = dist > 0.001 ? dy / dist : -1;
                let overlap = minDist - dist;
                ball.x += nx * overlap * 0.6;
                ball.y += ny * overlap * 0.6;
                let dot = ball.vx * nx + ball.vy * ny;
                if (dot < 0) {
                    ball.vx -= (1 + chargeBounce()) * dot * nx;
                    ball.vy -= (1 + chargeBounce()) * dot * ny;
                }

                // Punkte = aktueller Sprite-Wert
                let pts = s.value;
                if (soundEnabled) playPling(pts);
                score += pts; trackScore(pts);
                addCharge(pts);
                saveScore();
                updateScorePanel();

                floatingTexts.push({
                    x: s.x, y: s.y - 10, text: '+' + pts,
                    life: 2200, maxLife: 2200,
                    color: L2_COLORS[pts] || '#FF4136',
                    stroke: L2_STROKES[pts] || '#7b1f1f'
                });

                // Partikel-Burst am Sprite
                let particleCol = L2_COLORS[pts] || '#FF4136';
                for (let p = 0; p < 18; p++) {
                    let pa = Math.random() * Math.PI * 2;
                    particles.push({
                        x: s.x, y: s.y,
                        vx: Math.cos(pa) * (1.5 + Math.random() * 3),
                        vy: Math.sin(pa) * (1.5 + Math.random() * 3),
                        life: 700 + Math.random() * 500,
                        maxLife: 700 + Math.random() * 500,
                        size: 2 + Math.random() * 3,
                        color: particleCol
                    });
                }

                level2.sprites.splice(i, 1);

                // Alle Sprites erwischt? → Konfetti + nächste Runde
                if (level2.sprites.length === 0) {
                    if (level2.countdownTimer) { clearInterval(level2.countdownTimer); level2.countdownTimer = null; }
                    level2.active = false;
                    level2RestoreGrid();
                    spawnConfetti();
                }
                return;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Level 3: 2er/3er + Fallen
    // ═══════════════════════════════════════════════════════════════
    let level3 = {
        active: false,
        sprites: [],    // [{ x, y, vx, vy, value, r, angle, va, trap }]
        goodCount: 0    // Anzahl positiver Sprites (Ziel: 0 → geschafft)
    };

    const L3_TRAP_COLOR  = '#B10DC9';  // Fallen: auffälliges Lila
    const L3_TRAP_STROKE = '#5a066a';


    function level3Start() {
        if (!active || level3.active) return;
        level3.active = true;
        level3.sprites = [];
        level3.goodCount = 0;

        floatingTexts.push({
            x: window.innerWidth / 2, y: window.innerHeight / 2,
            text: 'LEVEL 3',
            life: 3000, maxLife: 3000,
            color: '#B10DC9', stroke: '#5a066a', big: true
        });

        // Grid-Innenlinien ausblenden (gleich wie Level 2)
        level2HideGrid();

        let bounds = level2GetBounds();
        let bw = bounds.right - bounds.left, bh = bounds.bottom - bounds.top;
        let goodCount = Math.min(10, Math.max(5, Math.floor(bw * bh / 18000)));
        let trapCount = Math.max(2, Math.floor(goodCount * 0.4));

        // Positive Sprites (2er und 3er)
        for (let n = 0; n < goodCount; n++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = L2_SPEED * (0.7 + Math.random() * 0.6);
            let val = Math.random() < 0.5 ? 2 : 3;
            level3.sprites.push({
                x: bounds.left + 30 + Math.random() * (bw - 60),
                y: bounds.top + 30 + Math.random() * (bh - 60),
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                value: val,
                r: L2_SPRITE_R,
                angle: Math.random() * Math.PI * 2,
                va: (Math.random() - 0.5) * 0.03,
                trap: false
            });
            level3.goodCount++;
        }

        // Fallen (☠) — größer und gut sichtbar
        for (let n = 0; n < trapCount; n++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = L2_SPEED * (0.7 + Math.random() * 0.6);
            level3.sprites.push({
                x: bounds.left + 30 + Math.random() * (bw - 60),
                y: bounds.top + 30 + Math.random() * (bh - 60),
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                value: 0,
                r: 20,
                angle: Math.random() * Math.PI * 2,
                va: (Math.random() - 0.5) * 0.04,
                trap: true
            });
        }
    }

    function stepLevel3Sprites() {
        if (!level3.active) return;
        let bounds = level2GetBounds();
        let margin = L2_SPRITE_R;

        for (let i = 0; i < level3.sprites.length; i++) {
            let s = level3.sprites[i];
            s.x += s.vx;
            s.y += s.vy;
            s.angle += s.va;

            if (s.x - margin < bounds.left)   { s.x = bounds.left + margin;  s.vx = Math.abs(s.vx); }
            if (s.x + margin > bounds.right)  { s.x = bounds.right - margin; s.vx = -Math.abs(s.vx); }
            if (s.y - margin < bounds.top)    { s.y = bounds.top + margin;   s.vy = Math.abs(s.vy); }
            if (s.y + margin > bounds.bottom) { s.y = bounds.bottom - margin; s.vy = -Math.abs(s.vy); }

            if (Math.random() < 0.005) {
                let nudge = 0.05;
                s.vx += (Math.random() - 0.5) * nudge;
                s.vy += (Math.random() - 0.5) * nudge;
                let spd = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
                let target = L2_SPEED * (0.7 + Math.random() * 0.6);
                if (spd > 0.01) { s.vx *= target / spd; s.vy *= target / spd; }
            }
        }
    }

    function drawLevel3Sprites() {
        if (!level3.active) return;
        let t = performance.now() * 0.001;

        for (let i = 0; i < level3.sprites.length; i++) {
            let s = level3.sprites[i];
            let col, label;

            if (s.trap) {
                col = L3_TRAP_COLOR;
                label = '\u2620'; // ☠ Skull
            } else {
                col = L2_COLORS[s.value] || '#2ECC40';
                label = '' + s.value;
            }

            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.angle);

            // Glow
            ctx.shadowColor = col;
            ctx.shadowBlur = s.trap ? (8 + Math.sin(t * 5 + i) * 6) : (10 + Math.sin(t * 3 + i) * 3);

            if (s.trap) {
                // Pulsierender Glow-Kreis
                ctx.shadowColor = '#ff4080';
                ctx.shadowBlur = 18 + Math.sin(t * 4 + i) * 8;
                ctx.beginPath();
                ctx.arc(0, 0, s.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,40,80,0.25)';
                ctx.fill();
                ctx.strokeStyle = '#ff4080';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Totenkopf mit Canvas-Shapes zeichnen
                let sk = s.r * 0.55;
                // Schädel (Oval)
                ctx.beginPath();
                ctx.ellipse(0, -sk * 0.15, sk * 0.75, sk * 0.85, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#ffe0e8';
                ctx.fill();
                ctx.strokeStyle = '#ff4080';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                // Kiefer
                ctx.beginPath();
                ctx.roundRect(-sk * 0.5, sk * 0.3, sk, sk * 0.4, 3);
                ctx.fillStyle = '#ffe0e8';
                ctx.fill();
                ctx.stroke();
                // Augen
                ctx.fillStyle = '#cc0030';
                ctx.beginPath();
                ctx.ellipse(-sk * 0.3, -sk * 0.2, sk * 0.2, sk * 0.25, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(sk * 0.3, -sk * 0.2, sk * 0.2, sk * 0.25, 0, 0, Math.PI * 2);
                ctx.fill();
                // Nase
                ctx.fillStyle = '#cc0030';
                ctx.beginPath();
                ctx.moveTo(0, sk * 0.05);
                ctx.lineTo(-sk * 0.1, sk * 0.25);
                ctx.lineTo(sk * 0.1, sk * 0.25);
                ctx.closePath();
                ctx.fill();
                // Zähne (Striche im Kiefer)
                ctx.strokeStyle = '#cc0030';
                ctx.lineWidth = 1;
                for (let z = -2; z <= 2; z++) {
                    let zx = z * sk * 0.18;
                    ctx.beginPath();
                    ctx.moveTo(zx, sk * 0.32);
                    ctx.lineTo(zx, sk * 0.65);
                    ctx.stroke();
                }
            } else {
                // Kreis
                ctx.beginPath();
                ctx.arc(0, 0, s.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fill();
                ctx.strokeStyle = col;
                ctx.lineWidth = 2;
                ctx.stroke();

                // Pulsierender Ring
                let pulse = 1 + Math.sin(t * 4 + i * 1.3) * 0.06;
                ctx.beginPath();
                ctx.arc(0, 0, s.r * pulse * 1.12, 0, Math.PI * 2);
                ctx.strokeStyle = col;
                ctx.lineWidth = 0.8;
                ctx.globalAlpha = 0.25 + Math.sin(t * 3 + i) * 0.1;
                ctx.stroke();
                ctx.globalAlpha = 1;

                // Label
                ctx.shadowBlur = 0;
                ctx.fillStyle = col;
                ctx.font = 'bold 15px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, 0, 1);
            }

            ctx.restore();
        }
    }

    function level3CollideBall() {
        if (!level3.active || !ball) return;
        let br = chargeR();

        for (let i = level3.sprites.length - 1; i >= 0; i--) {
            let s = level3.sprites[i];
            let dx = ball.x - s.x, dy = ball.y - s.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist >= br + s.r) continue;

            // Abprall
            let nx = dist > 0.001 ? dx / dist : 0;
            let ny = dist > 0.001 ? dy / dist : -1;
            let overlap = br + s.r - dist;
            ball.x += nx * overlap * 0.6;
            ball.y += ny * overlap * 0.6;
            let dot = ball.vx * nx + ball.vy * ny;
            if (dot < 0) {
                ball.vx -= (1 + chargeBounce()) * dot * nx;
                ball.vy -= (1 + chargeBounce()) * dot * ny;
            }

            if (s.trap) {
                // FALLE! 3 positive Sprites verpuffen lassen
                if (soundEnabled) playSkull(); stats.skullHits++;
                floatingTexts.push({
                    x: s.x, y: s.y - 10, text: 'PUFF!',
                    life: 2500, maxLife: 2500,
                    color: L3_TRAP_COLOR, stroke: L3_TRAP_STROKE, big: true
                });
                // Partikel am Skull
                for (let p = 0; p < 20; p++) {
                    let pa = Math.random() * Math.PI * 2;
                    particles.push({
                        x: s.x, y: s.y,
                        vx: Math.cos(pa) * (2 + Math.random() * 3),
                        vy: Math.sin(pa) * (2 + Math.random() * 3),
                        life: 800 + Math.random() * 500,
                        maxLife: 800 + Math.random() * 500,
                        size: 2 + Math.random() * 3,
                        color: L3_TRAP_COLOR
                    });
                }
                level3.sprites.splice(i, 1);

                // 3 zufällige positive Sprites zerstören
                let destroyed = 0;
                for (let d = level3.sprites.length - 1; d >= 0 && destroyed < 3; d--) {
                    if (!level3.sprites[d].trap) {
                        let ds = level3.sprites[d];
                        floatingTexts.push({ x: ds.x, y: ds.y - 10, text: 'PUFF!', life: 1500, maxLife: 1500, color: '#999', stroke: '#444' }); if (soundEnabled) playPuff();
                        for (let dp = 0; dp < 10; dp++) {
                            let dpa = Math.random() * Math.PI * 2;
                            particles.push({ x: ds.x, y: ds.y, vx: Math.cos(dpa) * 2, vy: Math.sin(dpa) * 2, life: 500, maxLife: 500, size: 2, color: '#999' });
                        }
                        level3.sprites.splice(d, 1);
                        level3.goodCount--;
                        destroyed++;
                    }
                }
                // Keine positiven mehr übrig? → Next Level!
                if (level3.goodCount <= 0) {
                    level3.active = false;
                    level3.sprites = [];
                    level2RestoreGrid();
                    spawnConfetti();
                }
            } else {
                // Positive Treffer
                let pts = s.value;
                if (soundEnabled) playPling(pts);
                score += pts; trackScore(pts);
                addCharge(pts);
                saveScore();
                updateScorePanel();

                floatingTexts.push({
                    x: s.x, y: s.y - 10, text: '+' + pts,
                    life: 2200, maxLife: 2200,
                    color: L2_COLORS[pts] || '#2ECC40',
                    stroke: L2_STROKES[pts] || '#145a1e'
                });
                for (let p = 0; p < 16; p++) {
                    let pa = Math.random() * Math.PI * 2;
                    particles.push({
                        x: s.x, y: s.y,
                        vx: Math.cos(pa) * (1.5 + Math.random() * 2.5),
                        vy: Math.sin(pa) * (1.5 + Math.random() * 2.5),
                        life: 600 + Math.random() * 400,
                        maxLife: 600 + Math.random() * 400,
                        size: 2 + Math.random() * 3,
                        color: L2_COLORS[pts] || '#2ECC40'
                    });
                }

                level3.sprites.splice(i, 1);
                level3.goodCount--;

                // Alle positiven getroffen? → Level geschafft!
                if (level3.goodCount <= 0) {
                    level3.active = false;
                    level3.sprites = [];
                    level2RestoreGrid();
                    spawnConfetti();
                }
            }
            return;
        }
    }

    function level3Cleanup() {
        level3.active = false;
        level3.sprites = [];
        level3.goodCount = 0;
        level2RestoreGrid();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Level 4: Gravity-Challenge – 2×10 + 1×25 am oberen Rand
    // ═══════════════════════════════════════════════════════════════
    let level4 = {
        active: false,
        sprites: [],    // [{ x, y, value, r }]
        count: 0,       // verbleibende Sprites
        gravity: 0.26,  // aktuelle Gravity (steigt pro Treffer)
        countdownTimer: null
    };

    const L4_GRAVITY_START = 0.26;
    const L4_GRAVITY_STEP  = 0.06;  // Gravity-Zunahme pro Treffer
    const L4_SPRITE_R = 18;

    function level4Start() {
        if (!active || level4.active) return;
        level4.active = true;
        level4.sprites = [];
        level4.gravity = L4_GRAVITY_START;

        floatingTexts.push({
            x: window.innerWidth / 2, y: window.innerHeight / 2,
            text: 'LEVEL 4 \u2013 GRAVITY!',
            life: 3000, maxLife: 3000,
            color: '#FF851B', stroke: '#7a3a00', big: true
        });

        level2HideGrid();

        let bounds = level2GetBounds();
        let bw = bounds.right - bounds.left;
        let topY = bounds.top + 35;

        // Links: 10 Punkte
        level4.sprites.push({
            x: bounds.left + bw * 0.25, y: topY,
            value: 10, r: L4_SPRITE_R,
            angle: 0, va: 0.02
        });
        // Mitte: 25 Punkte – oberhalb des Spielfelds!
        level4.sprites.push({
            x: bounds.left + bw * 0.5, y: bounds.top - 30,
            value: 25, r: L4_SPRITE_R - 4,
            angle: 0, va: -0.03
        });
        // Rechts: 10 Punkte
        level4.sprites.push({
            x: bounds.left + bw * 0.75, y: topY,
            value: 10, r: L4_SPRITE_R,
            angle: 0, va: 0.02
        });

        level4.count = 3;

        // Countdown: alle 15s Punkte um 1 verringern (min 1)
        level4.countdownTimer = setInterval(function() {
            if (!active || !level4.active) { level4Cleanup(); return; }
            let changed = false;
            for (let i = 0; i < level4.sprites.length; i++) {
                if (level4.sprites[i].value > 1) {
                    level4.sprites[i].value--;
                    changed = true;
                }
            }
            if (changed) {
                floatingTexts.push({
                    x: window.innerWidth / 2, y: window.innerHeight / 2,
                    text: 'TICK! Punkte -1',
                    life: 2000, maxLife: 2000,
                    color: '#e67e22', stroke: '#7a3a00'
                });
            }
        }, 15000);
    }

    function drawLevel4Sprites() {
        if (!level4.active || !ctx) return;
        let t = performance.now() / 1000;

        for (let i = 0; i < level4.sprites.length; i++) {
            let s = level4.sprites[i];
            s.angle += s.va;

            // Leichtes Schweben (auf und ab)
            let floatY = s.y + Math.sin(t * 2 + i * 2) * 4;

            let col = s.value === 25 ? '#FFD700' : '#FF851B';

            ctx.save();
            ctx.translate(s.x, floatY);
            ctx.rotate(s.angle);

            // Glow
            ctx.shadowColor = col;
            ctx.shadowBlur = 12 + Math.sin(t * 3 + i) * 4;

            // Kreis
            ctx.beginPath();
            ctx.arc(0, 0, s.r, 0, Math.PI * 2);
            ctx.fillStyle = s.value === 25 ? 'rgba(50,40,0,0.7)' : 'rgba(40,20,0,0.7)';
            ctx.fill();
            ctx.strokeStyle = col;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Label
            ctx.shadowBlur = 0;
            ctx.fillStyle = col;
            ctx.font = s.value === 25 ? 'bold 16px Arial, sans-serif' : 'bold 14px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('' + s.value, 0, 1);

            ctx.restore();
        }
    }

    function level4CollideBall() {
        if (!level4.active || !ball) return;
        let br = chargeR();

        for (let i = level4.sprites.length - 1; i >= 0; i--) {
            let s = level4.sprites[i];
            let t = performance.now() / 1000;
            let floatY = s.y + Math.sin(t * 2 + i * 2) * 4;
            let dx = ball.x - s.x, dy = ball.y - floatY;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < br + s.r) {
                // Abprall
                let nx = dist > 0.001 ? dx / dist : 0, ny = dist > 0.001 ? dy / dist : 0;
                let dot = ball.vx * nx + ball.vy * ny;
                if (dot < 0) { ball.vx -= (1 + CFG.BOUNCE) * dot * nx; ball.vy -= (1 + CFG.BOUNCE) * dot * ny; }

                let pts = s.value;
                if (soundEnabled) playPling(pts);
                score += pts; trackScore(pts);
                addCharge(pts);
                updateScorePanel();
                floatingTexts.push({
                    x: s.x, y: floatY - 15, text: '+' + pts,
                    life: 2500, maxLife: 2500,
                    color: s.value === 25 ? '#FFD700' : '#FF851B',
                    stroke: s.value === 25 ? '#7A5B00' : '#7a3a00', big: true
                });
                // Partikel
                for (let p = 0; p < 20; p++) {
                    let pa = Math.random() * Math.PI * 2;
                    particles.push({
                        x: s.x, y: floatY,
                        vx: Math.cos(pa) * (2 + Math.random() * 4),
                        vy: Math.sin(pa) * (2 + Math.random() * 4),
                        life: 800 + Math.random() * 500,
                        maxLife: 800 + Math.random() * 500,
                        size: 2 + Math.random() * 3,
                        color: s.value === 25 ? '#FFD700' : '#FF851B'
                    });
                }

                level4.sprites.splice(i, 1);
                level4.count--;

                // Gravity steigt nach jedem Treffer!
                level4.gravity += L4_GRAVITY_STEP;
                floatingTexts.push({
                    x: window.innerWidth / 2, y: window.innerHeight * 0.7,
                    text: 'GRAVITY +' + L4_GRAVITY_STEP.toFixed(2),
                    life: 2000, maxLife: 2000,
                    color: '#e74c3c', stroke: '#7b1f1f'
                });

                if (level4.count <= 0) {
                    level4.active = false;
                    if (level4.countdownTimer) { clearInterval(level4.countdownTimer); level4.countdownTimer = null; }
                    level2RestoreGrid();
                    spawnConfetti();
                }
                return;
            }
        }
    }

    function level4Cleanup() {
        level4.active = false;
        level4.sprites = [];
        level4.count = 0;
        level4.gravity = L4_GRAVITY_START;
        if (level4.countdownTimer) { clearInterval(level4.countdownTimer); level4.countdownTimer = null; }
        level2RestoreGrid();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Finaler Stats-Screen nach Level 4
    // ═══════════════════════════════════════════════════════════════
    function showFinalScreen() {
        let elapsed = ((performance.now() - stats.startTime) / 1000).toFixed(0);
        let mins = Math.floor(elapsed / 60);
        let secs = elapsed % 60;
        let timeStr = mins > 0 ? (mins + ':' + (secs < 10 ? '0' : '') + secs) : (secs + 's');

        // Klon-Statistik: Namen zählen
        let cloneMap = {};
        for (let i = 0; i < stats.splits.length; i++) {
            let n = stats.splits[i];
            cloneMap[n] = (cloneMap[n] || 0) + 1;
        }
        let cloneList = [];
        for (let name in cloneMap) {
            cloneList.push(cloneMap[name] + '\u00d7 ' + name);
        }

        // Overlay erstellen
        let overlay = document.createElement('div');
        overlay.id = 'kt-final-screen';
        let s = overlay.style;
        s.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10002;' +
            'display:flex;align-items:center;justify-content:center;' +
            'background:rgba(0,0,0,0.85);opacity:0;transition:opacity 0.8s;cursor:pointer';

        let html = '<div style="text-align:center;color:#fff;font-family:Arial,sans-serif;max-width:500px;padding:30px">';
        html += '<div style="font-size:48px;color:#FFD700;text-shadow:0 0 20px rgba(255,215,0,0.5);margin-bottom:10px">' + score + '</div>';
        html += '<div style="font-size:14px;color:#aaa;margin-bottom:25px">PUNKTE</div>';

        html += '<table style="margin:0 auto;text-align:left;color:#ccc;font-size:14px;border-collapse:collapse">';
        html += '<tr><td style="padding:4px 15px 4px 0;color:#888">Breakout</td><td style="color:#e8a020">' + stats.l1 + '</td></tr>';
        html += '<tr><td style="padding:4px 15px 4px 0;color:#888">Level 2</td><td style="color:#FF4136">' + stats.l2 + '</td></tr>';
        html += '<tr><td style="padding:4px 15px 4px 0;color:#888">Level 3</td><td style="color:#2ECC40">' + stats.l3 + '</td></tr>';
        html += '<tr><td style="padding:4px 15px 4px 0;color:#888">Level 4 (Gravity)</td><td style="color:#FF851B">' + stats.l4 + '</td></tr>';
        html += '<tr><td colspan="2" style="border-top:1px solid #444;padding-top:8px"></td></tr>';
        html += '<tr><td style="padding:4px 15px 4px 0;color:#888">Spielzeit</td><td>' + timeStr + '</td></tr>';
        html += '<tr><td style="padding:4px 15px 4px 0;color:#888">Kicks</td><td>' + stats.kicks + '</td></tr>';
        html += '<tr><td style="padding:4px 15px 4px 0;color:#888">Skull-Treffer</td><td style="color:#ff4080">' + stats.skullHits + '</td></tr>';

        if (stats.splits.length > 0) {
            html += '<tr><td colspan="2" style="border-top:1px solid #444;padding-top:8px"></td></tr>';
            html += '<tr><td style="padding:4px 15px 4px 0;color:#888">Klone (' + stats.splits.length + ')</td>';
            html += '<td style="font-size:12px;color:#aaa">' + cloneList.join(', ') + '</td></tr>';
        }
        html += '</table>';

        // Highscore prüfen
        let lsKey = 'kt_ball_hs_' + (kt.trid || 0) + '_' + (kt.md || 0);
        let prevBest = parseInt(localStorage.getItem(lsKey) || '0');
        let isHS = score > prevBest;
        if (isHS) localStorage.setItem(lsKey, score);

        if (isHS) {
            html += '<div style="margin-top:20px;font-size:20px;color:#FFD700;text-shadow:0 0 12px rgba(255,215,0,0.4)">';
            html += 'NEUER HIGHSCORE!</div>';
        } else if (prevBest > 0) {
            html += '<div style="margin-top:15px;font-size:13px;color:#666">Bisheriger Rekord: ' + prevBest + '</div>';
        }

        html += '<div style="margin-top:25px;font-size:12px;color:#555">Klick zum Schlie\u00dfen</div>';
        html += '</div>';

        overlay.innerHTML = html;
        document.body.appendChild(overlay);

        requestAnimationFrame(function() {
            requestAnimationFrame(function() { overlay.style.opacity = '1'; });
        });

        overlay.addEventListener('click', function() {
            overlay.style.opacity = '0';
            setTimeout(function() {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                // Spielende: Grid wiederherstellen, Score speichern, zurück auf Level 1
                level2RestoreGrid();
                saveScore();
                resetStats();
                currentLevel = 1;
                score = 0;
                revealed = false;
                charge = 0;
                removeScorePanel();
                splitBalls = [];
                hunt.touchCount = 0;
                hunt.firstTouchTime = 0;
            }, 800);
        });
    }

    function spawnBorderParticles(rect, pts) {
        let color = pts >= 3 ? '#D4A017' : pts >= 2 ? '#4CAF50' : '#999';
        let count = 20 + pts * 6;
        let edges = [
            // oben
            function () { return { x: rect.left + Math.random() * rect.width, y: rect.top }; },
            // unten
            function () { return { x: rect.left + Math.random() * rect.width, y: rect.bottom }; },
            // links
            function () { return { x: rect.left, y: rect.top + Math.random() * rect.height }; },
            // rechts
            function () { return { x: rect.right, y: rect.top + Math.random() * rect.height }; }
        ];
        let cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;

        for (let i = 0; i < count; i++) {
            let pos = edges[i % 4]();
            // Richtung: weg vom Zellzentrum + etwas Zufall
            let dx = pos.x - cx, dy = pos.y - cy;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            let speed = 1.2 + Math.random() * 2.5;
            let vx = (dx / dist) * speed + (Math.random() - 0.5) * 1.5;
            let vy = (dy / dist) * speed + (Math.random() - 0.5) * 1.5;

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

    // Leuchtende Plattform-Linien (rowUser/rowOpponent Unterkante)
    let glowLines = []; // [{ y, left, right }]

    const _glowColors = ['#ff6fd8','#3366ff','#ff3333','#ffdd00','#9933ff','#ff6fd8'];

    function drawGlowLines() {
        if (!glowLines.length || !ctx || !revealed) return;
        let t = performance.now() * 0.001;
        for (let i = 0; i < glowLines.length; i++) {
            let el = glowLines[i].el;
            if (!el) continue;
            let r = el.getBoundingClientRect();
            if (r.height < 2) continue;
            let y = r.bottom, left = r.left, right = r.right;

            // Rotierender Multicolor-Gradient (wie conic-gradient Spin)
            let offset = (t * 0.15) % 1; // Farbrotation
            let grad = ctx.createLinearGradient(left, 0, right, 0);
            for (let s = 0; s < _glowColors.length; s++) {
                let pos = ((s / (_glowColors.length - 1)) + offset) % 1;
                grad.addColorStop(pos, _glowColors[s]);
            }
            // Wrap: erste Farbe auch am Anfang wenn offset > 0
            if (offset > 0.01) {
                grad.addColorStop(0, _glowColors[Math.floor(offset * (_glowColors.length - 1))]);
                grad.addColorStop(1, _glowColors[Math.floor(offset * (_glowColors.length - 1))]);
            }

            // Outer Glow (blur)
            ctx.save();
            ctx.shadowColor = _glowColors[Math.floor(t * 2) % _glowColors.length];
            ctx.shadowBlur = 16 + Math.sin(t * 3) * 6;
            ctx.globalAlpha = 0.6;
            ctx.strokeStyle = grad;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            ctx.stroke();
            ctx.restore();

            // Kern-Linie (scharf, hell)
            ctx.save();
            ctx.strokeStyle = grad;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            ctx.stroke();
            ctx.restore();
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

        // Nicht-Ziel-Zellen ausblenden, Plattform-Struktur bleibt
        let grids = document.querySelectorAll('.ui-jqgrid');
        for (let g = 0; g < grids.length; g++) {
            let cells = grids[g].querySelectorAll('td');
            for (let ci = 0; ci < cells.length; ci++) {
                let cell = cells[ci];
                if (cell.classList.contains('Pts1') && parseInt(cell.textContent) >= 1) continue; // Ziel-Block mit Punkten: bleibt
                // Nicht-Pts1 Zellen: Text unsichtbar, Zelle selbst bleibt für Layout
                cell.style.transition = 'opacity 0.8s';
                cell.style.visibility = 'hidden';
            }
            // Hover deaktivieren + leuchtende Linien für Hindernis-Reihen sammeln
            let allRows = grids[g].querySelectorAll('tr');
            for (let ri = 0; ri < allRows.length; ri++) {
                allRows[ri].style.pointerEvents = 'none';
                if (allRows[ri].classList.contains('rowUser') || allRows[ri].classList.contains('rowOpponent')) {
                    glowLines.push({ el: allRows[ri] });
                }
            }
        }

        let cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
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
    function pushOneBall(b, radius) {
        let dx = b.x - cursor.x, dy = b.y - cursor.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        let cp = chargePct();
        let cursorR = CFG.CURSOR_R * (1 + cp * 0.4);  // Cursor-Trefferfläche wächst mit Charge
        let min = radius + cursorR;
        let spd = Math.sqrt(cursor.vx * cursor.vx + cursor.vy * cursor.vy);

        // Quecksilber-Effekt: Ball sinkt in ruhenden Cursor ein
        let nearFloor = b === ball && cursor.y > (window.innerHeight - CFG.BOTTOM_M) - CFG.CURSOR_R * 3;
        let ballNear = b === ball && Math.abs(b.x - cursor.x) < cursorR * 2.5;

        if (dist < min && spd < 1.5 && b === ball) {
            cursorSink = Math.min(cursorSink + 0.018, 1);
        } else if (nearFloor && ballNear && spd < 2) {
            // Am Boden: Sink-Fortschritt halten statt zerfallen (Ball hüpft kurz hoch)
            cursorSink = Math.min(cursorSink + 0.006, 1);
        } else if (spd > 3) {
            cursorSink *= 0.85;  // Cursor bewegt sich → schnell zurücksetzen
        } else {
            cursorSink *= 0.97;  // Langsam zerfallen
        }

        if (dist < min && cursorSink > 0.15 && b === ball && spd < 2) {
            // Ball driftet langsam nach unten durch den Cursor
            let sinkForce = cursorSink * 0.4;
            b.vy += sinkForce;
            b.vx *= 0.97;
            // Nur teilweise rausschieben — Ball sinkt ein
            let pushOut = (1 - cursorSink) * (min - dist);
            if (pushOut > 0.5 && dist > 0.1) {
                let nx = dx / dist, ny = dy / dist;
                b.x += nx * pushOut;
                b.y += ny * pushOut;
            }
            return false;
        }

        if (dist >= min || dist < 0.1) return false;

        let nx = dx / dist, ny = dy / dist;
        b.x += nx * (min - dist);
        b.y += ny * (min - dist);

        let dot = b.vx * nx + b.vy * ny;
        if (dot < 0) {
            b.vx -= (1 + CFG.BOUNCE) * dot * nx;
            b.vy -= (1 + CFG.BOUNCE) * dot * ny;
        }

        let tx = -ny;
        let tSpeed = cursor.vx * tx + cursor.vy * nx;
        b.wz += tSpeed * 0.004;

        let kickMult = 1 + cp * 1.5;  // bis 2.5x Kick-Stärke bei voller Charge
        let push = Math.min((spd * 0.08 + spd * spd * 0.005) * kickMult, 18);
        if (push > 0.05) {
            b.vx += nx * push;
            b.vy += ny * push;
        }
        return spd;
    }

    function pushBall() {
        if (!ball) return;

        // Hauptball
        let spd = pushOneBall(ball, chargeR());
        if (spd) {
            if (spd > 14 && !ghostMode) activateGhost();
            cursorFlash = 1;
            cursorVis = 1;
            lastKickTime = performance.now();
            stats.kicks++;
            if (soundEnabled) playKick(Math.min(spd / 25, 1));
        }

        // Split-Bälle
        for (let i = 0; i < splitBalls.length; i++) {
            let sb = splitBalls[i];
            let sbSpd = pushOneBall(sb, sb.r);
            if (sbSpd) {
                sb.lastKick = performance.now();
                cursorFlash = 1;
                cursorVis = 1;
                lastKickTime = performance.now();
                if (soundEnabled) playKick(Math.min(sbSpd / 25, 1));
            }
        }

        // Zahlen-Jagd: Berührungen zählen (nur bei echtem Kick, nicht bei jedem Frame)
        if (spd && !hunt.active && !hunt.ready && !revealed && !level2.active && !level3.active) {
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
        let elapsed = performance.now() - ghostStart;
        if ((elapsed > 120 && ball.vy > 0.3) || elapsed > CFG.GHOST_MS) {
            ghostMode = false;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Wand-Kollisionen
    // ═══════════════════════════════════════════════════════════════
    function collideWalls() {
        let w = window.innerWidth, h = window.innerHeight - CFG.BOTTOM_M, r = chargeR();
        let spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (ball.x - r < 0) { ball.x = r; ball.vx = Math.abs(ball.vx) * CFG.BOUNCE; if (soundEnabled && spd > 2) playWallHit(); }
        if (ball.x + r > w) { ball.x = w - r; ball.vx = -Math.abs(ball.vx) * CFG.BOUNCE; if (soundEnabled && spd > 2) playWallHit(); }
        if (ball.y + r > h) {
            // Quecksilber-Cursor drückt Ball durch den Boden → Wrap nach oben
            if (cursorSink > 0.3 && cursor.y > h - CFG.CURSOR_R * 3) {
                // Staub-Puff an der Durchbruchstelle
                let bx = ball.x;
                for (let dp = 0; dp < 18; dp++) {
                    let a = Math.PI + (Math.random() - 0.5) * Math.PI;  // Halbkreis nach oben
                    let speed = 0.5 + Math.random() * 1.5;
                    particles.push({
                        x: bx + (Math.random() - 0.5) * r * 3,
                        y: h,
                        vx: Math.cos(a) * speed,
                        vy: Math.sin(a) * speed - 0.3,
                        life: 600 + Math.random() * 500,
                        maxLife: 600 + Math.random() * 500,
                        size: 4 + Math.random() * 8,
                        color: '#a0917a',
                        rot: 0, dust: true
                    });
                }
                ball.y = -r * 2;
                ball.vy = Math.abs(ball.vy) * 0.3 + 1;  // sanfter Fall von oben
                cursorSink = -3;  // Cooldown: muss erst von -3 auf 0.3 steigen
                return;
            }
            ball.y = h - r;
            ball.vy = -Math.abs(ball.vy) * CFG.BOUNCE;
            ball.vx *= 0.95;
            ball.onGround = true;
            if (soundEnabled && spd > 2) playBounce();
        }
    }

    function clampSpeed() {
        let spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (spd > CFG.MAX_V) { let s = CFG.MAX_V / spd; ball.vx *= s; ball.vy *= s; }
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

        // NaN-Guard: Ball-Position kaputt → respawnen
        if (isNaN(ball.x) || isNaN(ball.y)) { spawnBall(); return; }

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
        let wSpd = Math.sqrt(ball.wx * ball.wx + ball.wz * ball.wz);
        if (wSpd > 0.0001) {
            let ax = ball.wx / wSpd;
            let az = ball.wz / wSpd;
            let half = wSpd / 2, s = Math.sin(half);
            let dq = [Math.cos(half), ax * s, 0, az * s];
            ball.quat = qNorm(qMul(dq, ball.quat));
        }

        if (ball.y > window.innerHeight + 300 || ball.y < -3000) spawnBall();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Rendering
    // ═══════════════════════════════════════════════════════════════
    function drawBall() {
        if (!ball) return;
        let bx = ball.x, by = ball.y, r = chargeR();

        ctx.save();
        ctx.translate(bx, by);
        let cp = chargePct();
        if (ghostMode) {
            ctx.shadowColor = '#ff8800';
            ctx.shadowBlur = 12 + Math.sin(performance.now() * 0.015) * 6;
        } else if (cp > 0.1) {
            ctx.shadowColor = 'hsl(' + (200 + cp * 60) + ', 90%, 70%)';
            ctx.shadowBlur = 4 + cp * 14 + Math.sin(performance.now() * 0.02) * cp * 4;
        }
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();

        let g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        g.addColorStop(0, '#fff'); g.addColorStop(0.7, '#e8e8e8'); g.addColorStop(1, '#b0b0b0');
        ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);

        let q = ball.quat;
        for (let i = 0; i < pentas.length; i++) {
            let p = pentas[i];
            let rp = qRotate(q, p.x, p.y, p.z);
            let z2 = rp[2];
            if (z2 < 0.1) continue;
            let px = rp[0] * r, py = rp[1] * r, pr = r * 0.28 * (0.3 + z2 * 0.7);
            ctx.fillStyle = 'rgba(40,40,40,' + (0.3 + z2 * 0.6) + ')';
            ctx.beginPath();
            for (let j = 0; j < 5; j++) {
                let a = j / 5 * Math.PI * 2 - Math.PI / 2;
                j === 0 ? ctx.moveTo(px + Math.cos(a) * pr, py + Math.sin(a) * pr)
                        : ctx.lineTo(px + Math.cos(a) * pr, py + Math.sin(a) * pr);
            }
            ctx.closePath(); ctx.fill();
        }

        let gl = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 0, -r * 0.35, -r * 0.35, r * 0.5);
        gl.addColorStop(0, 'rgba(255,255,255,0.6)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gl; ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.restore();

        ctx.save(); ctx.strokeStyle = '#555'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();

        if (!ghostMode) {
            let groundY = window.innerHeight - CFG.BOTTOM_M;
            let height  = groundY - (by + r);
            if (height < 30) {
                let t = Math.max(0, 1 - height / 30);
                let blur = (1 - t) * 6;
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
        // Sichtbarkeit: nach 10s ohne Kick langsam verblassen
        if (lastKickTime > 0) {
            let idle = performance.now() - lastKickTime;
            if (idle > 10000) {
                cursorVis = Math.max(0, cursorVis - dt * 0.0004);  // ~2.5s Fade-out
            }
        }
        if (cursorVis <= 0 && cursorFlash <= 0 && chargePct() <= 0) return;

        let cp = chargePct();
        let r = CFG.CURSOR_R;
        let expand = cursorFlash > 0 ? (1 - cursorFlash) * 8 : 0;
        let cr = r + expand + cp * 12;

        // Geschwindigkeit → Ellipsen-Stauchung in Bewegungsrichtung
        let spd = Math.sqrt(cursor.vx * cursor.vx + cursor.vy * cursor.vy);
        let squish = Math.min(spd / 35, 0.75);           // 0 = Kreis, 0.75 = sehr flach
        let angle = spd > 1 ? Math.atan2(cursor.vy, cursor.vx) : 0;
        let rMove = cr * (1 - squish);                    // Radius in Bewegungsrichtung (schrumpft)
        let rPerp = cr * (1 + squish * 0.25);             // Radius quer (wächst leicht)

        // Quecksilber-Einsinken: Ellipse wird breiter/flacher
        if (cursorSink > 0.1) {
            let s = cursorSink;
            rPerp *= (1 + s * 0.5);  // breiter
            rMove *= (1 - s * 0.3);  // flacher
        }

        // Cursor-Ellipse (nur nach erstem Schuss sichtbar)
        if (cursorVis > 0) {
            ctx.save();
            let baseAlphaFill = (0.08 + cp * 0.3) * cursorVis;
            if (cursorSink > 0.1) baseAlphaFill += cursorSink * 0.12 * cursorVis;
            ctx.globalAlpha = baseAlphaFill;
            if (cursorSink > 0.2) {
                // Quecksilber-Glanz: metallischer Gradient
                let grad = ctx.createRadialGradient(
                    cursor.x - rPerp * 0.3, cursor.y - rMove * 0.3, 0,
                    cursor.x, cursor.y, rPerp
                );
                grad.addColorStop(0, '#c0c8d0');
                grad.addColorStop(0.6, '#7a8a96');
                grad.addColorStop(1, '#4a5560');
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = ghostMode ? '#ff8800' : '#4a7c59';
            }
            ctx.beginPath();
            ctx.ellipse(cursor.x, cursor.y, rPerp, rMove, angle + Math.PI / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Flash/Charge-Effekte
        if (cursorFlash > 0 || cp > 0) {
            ctx.save();
            let baseAlpha = cursorFlash > 0 ? cursorFlash * 0.4 : 0;
            let chargeAlpha = cp * 0.6;
            ctx.globalAlpha = Math.max(baseAlpha, chargeAlpha);

            if (cp > 0.05) {
                // Elektrifizierter Ring: gezackter Ellipsen-Umriss mit Glow
                let segments = 24 + Math.floor(cp * 20);
                let jitter = 2 + cp * 10;
                ctx.shadowColor = 'hsl(' + (200 + cp * 60) + ', 90%, 70%)';
                ctx.shadowBlur = 4 + cp * 16;
                ctx.strokeStyle = 'hsl(' + (200 + cp * 60) + ', 85%, ' + (60 + cp * 20) + '%)';
                ctx.lineWidth = 1.5 + cp * 2;
                ctx.beginPath();
                for (let i = 0; i <= segments; i++) {
                    let a = (i / segments) * Math.PI * 2;
                    let j = (Math.random() - 0.5) * jitter;
                    let ex = Math.cos(a) * (rPerp + j);
                    let ey = Math.sin(a) * (rMove + j);
                    // Rotation auf Bewegungsrichtung
                    let rot = angle + Math.PI / 2;
                    let px = cursor.x + ex * Math.cos(rot) - ey * Math.sin(rot);
                    let py = cursor.y + ex * Math.sin(rot) + ey * Math.cos(rot);
                    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.stroke();

                // Zusätzliche Mini-Blitze vom Ring
                let arcCount = Math.floor(cp * 5);
                for (let ac = 0; ac < arcCount; ac++) {
                    let la = Math.random() * Math.PI * 2;
                    let startR = cr + (Math.random() - 0.5) * 4;
                    let len = 8 + Math.random() * cp * 25;
                    drawLightningBolt(
                        cursor.x + Math.cos(la) * startR,
                        cursor.y + Math.sin(la) * startR,
                        cursor.x + Math.cos(la) * (startR + len),
                        cursor.y + Math.sin(la) * (startR + len),
                        3 + cp * 4, cp * 0.7
                    );
                }
            } else {
                ctx.strokeStyle = ghostMode ? '#ff8800' : '#4a7c59';
                ctx.lineWidth = 2 * cursorFlash;
                ctx.beginPath();
                ctx.ellipse(cursor.x, cursor.y, rPerp, rMove, angle + Math.PI / 2, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }

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
        let steps = 4 + Math.floor(Math.random() * 3);
        for (let i = 1; i < steps; i++) {
            let t = i / steps;
            let mx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * displacement;
            let my = y1 + (y2 - y1) * t + (Math.random() - 0.5) * displacement;
            ctx.lineTo(mx, my);
        }
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }

    // Entladungen: hauptsächlich zu nahegelegenen Hindernissen, selten frei
    function drawElectricArcs() {
        if (!ball) return;
        let cp = chargePct();
        if (cp < 0.15) return;
        let br = chargeR();
        let bx = ball.x, by = ball.y;

        // Nahe Plattformen/Hindernisse finden und Blitze dorthin ziehen
        let platforms = collectPlatforms();
        for (let i = 0; i < platforms.length; i++) {
            let p = platforms[i];
            if (bx < p.left - 40 || bx > p.right + 40) continue;
            let dy = Math.abs(by - p.y);
            if (dy > br + 30 + cp * 40) continue; // zu weit weg
            // Chance steigt je näher + je mehr Charge
            if (Math.random() > cp * 0.4 + (1 - dy / (br + 70)) * 0.3) continue;
            // Startpunkt am Ball, Endpunkt auf der Plattform
            let tx = bx + (Math.random() - 0.5) * 20;
            let clampX = Math.max(p.left, Math.min(tx, p.right));
            drawLightningBolt(bx, by + (p.y > by ? br : -br), clampX, p.y, 5 + cp * 8, cp * 0.6);
        }

        // Ganz sporadisch eine freie Entladung (ca. 10% Chance pro Frame bei hoher Charge)
        if (Math.random() < cp * 0.1) {
            let angle = Math.random() * Math.PI * 2;
            let dist = br + 5;
            let len = 10 + Math.random() * cp * 25;
            drawLightningBolt(
                bx + Math.cos(angle) * dist, by + Math.sin(angle) * dist,
                bx + Math.cos(angle) * (dist + len), by + Math.sin(angle) * (dist + len),
                3 + cp * 5, cp * 0.35
            );
        }
    }

    function drawFloatingTexts(dt) {
        if (!revealed) return;
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            let ft = floatingTexts[i];
            ft.life -= dt;
            if (ft.life <= 0) { floatingTexts.splice(i, 1); continue; }

            let t = 1 - ft.life / ft.maxLife;
            // Langsamer Ease-Out, bleibt länger sichtbar
            let ease = 1 - Math.pow(1 - t, 2);
            // Erst in der letzten 40% ausfaden
            let alpha = t < 0.6 ? 1 : 1 - ((t - 0.6) / 0.4);
            let yOff, font;

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

            let x = ft.x, y = ft.y + yOff;

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
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.life -= dt;
            if (p.life <= 0) { particles.splice(i, 1); continue; }

            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.dust ? -0.02 : p.spark ? 0.08 : 0.04;  // Staub steigt, Funken fallen schnell
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.rot += 0.1;

            let t = Math.min(1 - p.life / p.maxLife, 1);
            let alpha = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
            let size = Math.max(p.size * (1 - t * 0.6), 0.5);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            if (p.spark) {
                // Elektrischer Funke: heller Kern + Glow
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(0, 0, size * (1 - t * 0.8), 0, Math.PI * 2);
                ctx.fill();
            } else if (p.dust) {
                // Weiche runde Staubwolke
                let dr = Math.max(size * (1 + t * 1.5), 1);
                let grad = ctx.createRadialGradient(0, 0, dr * 0.15, 0, 0, dr);
                grad.addColorStop(0, 'rgba(160,145,120,0.5)');
                grad.addColorStop(0.5, 'rgba(160,145,120,0.2)');
                grad.addColorStop(1, 'rgba(160,145,120,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, dr, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Kleine Rechteck-Fragmente (Rahmenstücke)
                ctx.fillRect(-size, -size * 0.4, size * 2, size * 0.8);
            }
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

        let s = scorePanel.style;
        s.cssText = 'position:fixed;bottom:20px;right:20px;z-index:10000;' +
            'background:rgba(0,0,0,0.7);' +
            'color:#fff;font:13px/1.6 sans-serif;padding:10px 14px;' +
            'border-radius:10px;min-width:140px;pointer-events:none;' +
            'opacity:0;transform:translateY(20px);' +
            'transition:opacity 0.5s,transform 0.5s';

        if (document.body.classList.contains('dark-mode')) {
            s.background = 'rgba(255,255,255,0.1)';
        }

        var sp = scorePanel;
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (!sp) return;
                sp.style.opacity = '1';
                sp.style.transform = 'translateY(0)';
            });
        });

        updateScorePanel();
    }

    function renderScoreTable(title, rows) {
        let html = '<div style="font-size:11px;font-weight:bold;margin-bottom:2px;opacity:0.7;text-transform:uppercase;letter-spacing:1px">' + title + '</div>';
        if (!rows || rows.length === 0) {
            html += '<div style="opacity:0.5;font-size:12px">Noch keine Scores</div>';
            return html;
        }
        for (let i = 0; i < rows.length; i++) {
            let e = rows[i];
            let style = 'white-space:nowrap';
            if (e._current) style += ';color:#FFD700';
            html += '<div style="' + style + '">' +
                '<span style="display:inline-block;min-width:28px;text-align:right;font-weight:bold;margin-right:6px">' +
                e.total + '</span>' + e.name +
                (e._current ? ' \u25C0' : '') + '</div>';
        }
        return html;
    }

    function injectCurrentScore(rows, myName, currentScore) {
        let found = false;
        for (let i = 0; i < rows.length; i++) {
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
        let trid = kt.trid || 0, md = kt.md || 0;
        $j.ajax({
            url: 'php/GetGameScores.php',
            method: 'POST',
            data: { game: 'breakout', trid: trid, md: md },
            dataType: 'json',
            success: function(res) {
                if (!scorePanel) return;
                if (!res || !res.ok) { removeScorePanel(); return; }
                let myName = shortName(getFullName());

                let alltime = injectCurrentScore(/** @type {Array} */(res['scores']) || [], myName, score);
                let mdRows = injectCurrentScore(/** @type {Array} */(res['matchday']) || [], myName, score);

                let html = renderScoreTable('Spieltag', mdRows);
                html += '<div style="border-top:1px solid rgba(255,255,255,0.2);margin:6px 0"></div>';
                html += renderScoreTable('All-Time', alltime);

                scorePanel.innerHTML = html;
            },
            error: function() { removeScorePanel(); }
        });
    }

    function pulseScorePanel() {
        if (!scorePanel) return;
        var sp = scorePanel;
        sp.style.transition = 'none';
        sp.style.transform = 'translateY(0) scale(1.12)';
        sp.style.boxShadow = '0 0 16px rgba(255,180,50,0.6)';
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (!sp) return;
                sp.style.transition = 'transform 0.4s ease-out, box-shadow 0.6s ease-out';
                sp.style.transform = 'translateY(0) scale(1)';
                sp.style.boxShadow = 'none';
            });
        });
    }

    function removeScorePanel() {
        if (!scorePanel) return;
        scorePanel.style.opacity = '0';
        scorePanel.style.transform = 'translateY(20px)';
        let p = scorePanel;
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
        let trid = kt.trid || 0;
        let md = kt.md || 0;
        $j.ajax({
            url: 'php/SaveGameScore.php',
            method: 'POST',
            data: { game: 'breakout', score: score, trid: trid, md: md,
                    kicks: stats.kicks, clones: stats.splits.length,
                    l1: stats.l1, l2: stats.l2, l3: stats.l3, l4: stats.l4 },
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
            let now = performance.now(), dt = now - cursor.lt;
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
        if (!kt.loggedIn) return false;
        let cells = document.querySelectorAll(CFG.BLOCK_SEL);
        if (cells.length === 0) return false;
        for (let i = 0; i < cells.length; i++) {
            let val = parseInt(cells[i].textContent);
            if (val >= 1) return false; // mindestens 1 Zelle hat Punkte → nicht leer
        }
        return true;
    }

    function huntCheck() {
        if (hunt.active || hunt.ready || revealed || level2.active || level3.active) return;
        if (hunt.cooldownUntil && performance.now() < hunt.cooldownUntil) return;
        if (!isOverviewEmpty()) return;
        let elapsed = performance.now() - hunt.firstTouchTime;
        if (hunt.touchCount >= 5 && elapsed >= 7500) {
            hunt.ready = true;
            huntStart();
        }
    }

    function huntStart() {
        hunt.active = true;
        hunt.round = 1;
        hunt.timer = 60;
        hunt.startTime = performance.now();
        huntCreateTimer();
        huntPlaceNumbers();
    }

    function huntCreateTimer() {
        if (hunt.timerEl) return;
        hunt.timerEl = document.createElement('div');
        hunt.timerEl.id = 'kt-hunt-timer';
        let s = hunt.timerEl.style;
        // Rechts neben die Tabelle positionieren
        let tbl = document.querySelector('td.Pts1');
        let tblEl = tbl ? tbl.closest('table') : null;
        let tblRect = tblEl ? tblEl.getBoundingClientRect() : null;
        let leftPos = tblRect ? (tblRect.right + 20) : (window.innerWidth - 100);
        let topPos = tblRect ? (tblRect.top + tblRect.height / 2) : (window.innerHeight / 2);
        s.cssText = 'position:fixed;top:' + topPos + 'px;left:' + leftPos + 'px;transform:translateY(-50%);z-index:10001;' +
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
        let best = huntGetBest();
        let timerColor, timerShadow;
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
            (best > 0 ? '<div style="font-size:11px;color:#aaa;margin-top:2px">Rekord: ' + best + (_huntBestTimeCache ? ' (' + huntFormatTime(_huntBestTimeCache) + ')' : '') + '</div>' : '');
    }

    let _huntBestCache = 0;
    let _huntBestTimeCache = 0; // ms des Rekordhalters (0 = unbekannt)

    function huntGetBest() {
        return _huntBestCache;
    }

    function huntFormatTime(ms) {
        if (!ms) return '';
        let s = Math.floor(ms / 1000);
        let m = Math.floor(s / 60);
        s = s % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function huntLoadBest() {
        $j.ajax({
            url: 'php/GetGameScores.php',
            method: 'POST',
            data: { game: 'hunt' },
            dataType: 'json',
            success: function(res) {
                if (res && res.ok && res['scores']) {
                    let rows = /** @type {Array} */(res['scores']);
                    // Erste Zeile = bester Spieler (serverseitig sortiert)
                    if (rows.length > 0) {
                        _huntBestCache = parseInt(rows[0]['best_round'] || 0);
                        _huntBestTimeCache = parseInt(rows[0]['elapsed_ms'] || 0);
                    }
                }
            }
        });
    }

    function huntSaveScore() {
        if (hunt.round < 1) return;
        let elapsed = Math.round(performance.now() - hunt.startTime);
        if (hunt.round > _huntBestCache || (hunt.round === _huntBestCache && (_huntBestTimeCache === 0 || elapsed < _huntBestTimeCache))) {
            _huntBestCache = hunt.round;
            _huntBestTimeCache = elapsed;
        }
        $j.ajax({
            url: 'php/SaveGameScore.php',
            method: 'POST',
            data: { game: 'hunt', score: hunt.round, trid: 0, md: 0, elapsed_ms: elapsed },
            dataType: 'json'
        });
    }

    function huntPlaceNumbers() {
        // Leere Pts1-Zellen sammeln
        let cells = document.querySelectorAll(CFG.BLOCK_SEL);
        let empty = [];
        for (let i = 0; i < cells.length; i++) {
            let el = cells[i];
            let rect = el.getBoundingClientRect();
            if (rect.width < 4 || rect.height < 4) continue;
            if (el.classList.contains('kt-ball-burned')) continue;
            if (el.querySelector('.kt-hunt-num')) continue;
            let val = parseInt(el.textContent);
            if (val >= 1) continue;
            empty.push(el);
        }
        if (empty.length === 0) return;

        // Zellen nahe der Mitte bevorzugen
        let viewCY = window.innerHeight / 2;
        empty.sort(function(a, b) {
            let ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
            return Math.abs(ra.top + ra.height/2 - viewCY) - Math.abs(rb.top + rb.height/2 - viewCY);
        });

        // Aus den mittleren 60% zufällig wählen
        let pool = empty.slice(0, Math.max(Math.ceil(empty.length * 0.6), hunt.round));

        // Bestehende Targets behalten, nur neue Zahlen hinzufügen
        let existingNums = {};
        for (let i = 0; i < hunt.targets.length; i++) {
            existingNums[hunt.targets[i].num] = true;
        }

        for (let n = 1; n <= hunt.round; n++) {
            if (existingNums[n]) continue; // Zahl existiert bereits
            if (pool.length === 0) break;
            let idx = Math.floor(Math.random() * pool.length);
            let cell = pool.splice(idx, 1)[0];
            huntInjectNumber(cell, n);
        }
    }

    function huntInjectNumber(cell, num) {
        // Zelle leeren und Zahl einsetzen
        cell.textContent = '';
        let span = document.createElement('span');
        span.className = 'kt-hunt-num';
        span.textContent = num;
        span.style.cssText = 'font-weight:900;font-size:1.4em;color:#c0392b;' +
            'animation:kt-hunt-blink 0.8s ease-in-out infinite;cursor:default';
        cell.appendChild(span);
        hunt.targets.push({ el: cell, num: num });
    }

    function huntCollideBall() {
        if (!hunt.active || !ball) return;
        for (let i = hunt.targets.length - 1; i >= 0; i--) {
            let t = hunt.targets[i];
            let rect = t.el.getBoundingClientRect();
            if (rect.width < 4 || rect.height < 4) continue;
            let col = circleRectCollision(ball.x, ball.y, chargeR(), rect);
            if (col) {
                // Finde die niedrigste Zahl die getroffen werden muss
                let lowestNum = hunt.round;
                for (let j = 0; j < hunt.targets.length; j++) {
                    if (hunt.targets[j].num < lowestNum) lowestNum = hunt.targets[j].num;
                }
                // Nur die richtige Zahl (die niedrigste) darf getroffen werden
                if (t.num !== lowestNum) {
                    resolveCollision(col);
                    return;
                }

                resolveCollision(col);
                // Treffer!
                let cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
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
        let finalRound = hunt.round;
        let elapsed = Math.round(performance.now() - hunt.startTime);
        huntSaveScore();
        let best = huntGetBest();
        let timeStr = huntFormatTime(elapsed);
        let msg = 'Zeit abgelaufen! Runde ' + finalRound + (timeStr ? ' (' + timeStr + ')' : '');
        if (finalRound >= best && finalRound > 1) msg = 'Neuer Rekord! Runde ' + finalRound + (timeStr ? ' (' + timeStr + ')' : '');
        floatingTexts.push({
            x: window.innerWidth / 2, y: window.innerHeight / 2,
            text: msg,
            life: 3500, maxLife: 3500,
            color: finalRound >= best && finalRound > 1 ? '#FFD700' : '#e74c3c',
            stroke: finalRound >= best && finalRound > 1 ? '#7A5B00' : '#7b1f1f',
            big: true
        });
        hunt.cooldownUntil = performance.now() + 30000; // 30s Pause vor neuem Hunt
        huntCleanup();
    }

    function huntCleanup() {
        hunt.active = false;
        hunt.ready = false;
        hunt.touchCount = 0;
        hunt.firstTouchTime = 0;
        hunt.timer = 60;
        hunt.startTime = 0;
        if (hunt.intervalId) { clearInterval(hunt.intervalId); hunt.intervalId = null; }
        // Targets aus Zellen entfernen
        for (let i = 0; i < hunt.targets.length; i++) {
            let el = hunt.targets[i].el;
            let numSpan = el.querySelector('.kt-hunt-num');
            if (numSpan) numSpan.remove();
        }
        hunt.targets = [];
        hunt.round = 0;
        // Timer-Element entfernen
        if (hunt.timerEl) {
            hunt.timerEl.style.opacity = '0';
            let te = hunt.timerEl;
            setTimeout(function() { if (te.parentNode) te.parentNode.removeChild(te); }, 500);
            hunt.timerEl = null;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Game Loop
    // ═══════════════════════════════════════════════════════════════
    let lastT = 0;
    function loop(ts) {
        if (!active) return;
        ts = ts || performance.now();
        let dt = ts - lastT;
        lastT = ts;
        if (dt > 50) dt = 16;

        try {
        pushBall();
        step();
        stepSplitBalls(dt);
        stepLevel2Sprites();
        stepLevel3Sprites();
        huntCollideBall();
        level2CollideBall();
        level3CollideBall();
        level4CollideBall();
        decayCharge(dt);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (charge > 0.5) drawElectricArcs();
        drawGlowLines();
        drawLevel2Sprites();
        drawLevel3Sprites();
        drawLevel4Sprites();
        drawParticles(dt);
        drawSplitBalls();
        drawBall();
        drawCursorRing(dt);
        drawFloatingTexts(dt);
        } catch (e) { console.error('ball-loop:', e); }

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
        let trid = kt.trid || 0;
        let breakoutDone = false, huntDone = false;
        let breakoutRows = [], huntRows = [];
        let sortKey = 'total', sortDir = 'desc';

        let MEDAL = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49']; // gold, silver, bronze emoji
        let MEDAL_BG = ['rgba(255,215,0,0.1)', 'rgba(192,192,192,0.08)', 'rgba(205,127,50,0.07)'];

        let cols = [
            { key: 'name',         label: 'Spieler',        align: 'left',  type: 'string' },
            { key: 'total',        label: 'Gesamt',         align: 'right', type: 'number', bold: true },
            { key: 'total_l1',     label: 'Breakout',       align: 'right', type: 'number', cls: 'lvl1' },
            { key: 'total_l2',     label: 'Fly',            align: 'right', type: 'number', cls: 'lvl2' },
            { key: 'total_l3',     label: 'Trap',           align: 'right', type: 'number', cls: 'lvl3' },
            { key: 'total_l4',     label: 'Gravity',        align: 'right', type: 'number', cls: 'lvl4' },
            { key: 'matchdays',    label: 'Tage',           align: 'right', type: 'number' },
            { key: 'best',         label: 'Bester',         align: 'right', type: 'number' },
            { key: 'total_kicks',  label: 'Sch\u00fcsse',   align: 'right', type: 'number' },
            { key: 'total_clones', label: 'Klone',          align: 'right', type: 'number' }
        ];

        // Top-3 pro Spalte ermitteln
        function computeTop3(rows) {
            let top3 = {};
            cols.forEach(function(c) {
                if (c.type !== 'number') return;
                let sorted = rows.slice().sort(function(a, b) {
                    return (parseInt(b[c.key]) || 0) - (parseInt(a[c.key]) || 0);
                });
                top3[c.key] = [];
                for (let m = 0; m < 3 && m < sorted.length; m++) {
                    let v = parseInt(sorted[m][c.key]) || 0;
                    if (v > 0) top3[c.key].push(rows.indexOf(sorted[m]));
                }
            });
            return top3;
        }

        function sortRows(rows) {
            rows.sort(function(a, b) {
                let av = a[sortKey], bv = b[sortKey];
                if (cols.find(function(c) { return c.key === sortKey; }).type === 'number') {
                    av = parseInt(av) || 0; bv = parseInt(bv) || 0;
                } else {
                    av = (av || '').toLowerCase(); bv = (bv || '').toLowerCase();
                }
                if (av < bv) return sortDir === 'asc' ? -1 : 1;
                if (av > bv) return sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        }

        function renderBreakout() {
            sortRows(breakoutRows);
            let top3 = computeTop3(breakoutRows);
            let html = '';

            // Header
            html += '<tr>';
            html += '<th class="rk-th" style="width:36px;text-align:center">#</th>';
            cols.forEach(function(c) {
                let arrow = sortKey === c.key ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';
                let active = sortKey === c.key ? ' rk-sort-active' : '';
                html += '<th class="rk-th rk-sortable' + active + '" data-sort="' + c.key + '" style="text-align:' + c.align + '">'
                    + c.label + '<span class="rk-arrow">' + arrow + '</span></th>';
            });
            html += '</tr>';
            $j('#rkBreakoutHead').html(html);

            // Body
            html = '';
            for (let i = 0; i < breakoutRows.length; i++) {
                let r = breakoutRows[i];
                let rowMedal = i < 3 ? ' style="background:' + MEDAL_BG[i] + '"' : '';
                html += '<tr' + rowMedal + '>';
                html += '<td class="rk-td" style="text-align:center;font-weight:bold">' + (i < 3 ? MEDAL[i] : (i + 1)) + '</td>';

                cols.forEach(function(c) {
                    let val = c.type === 'number' ? (parseInt(r[c.key]) || 0) : (r[c.key] || '');
                    let style = 'text-align:' + c.align;
                    if (c.bold) style += ';font-weight:bold';
                    let cellCls = 'rk-td';
                    if (c.cls) cellCls += ' rk-' + c.cls;

                    // Top-3 Dot pro Spalte
                    let dot = '';
                    if (top3[c.key]) {
                        let rank = top3[c.key].indexOf(i);
                        if (rank >= 0) dot = '<span class="rk-dot rk-dot-' + rank + '"></span>';
                    }

                    html += '<td class="' + cellCls + '" style="' + style + '">' + dot + val + '</td>';
                });
                html += '</tr>';
            }
            $j('#rkBreakoutBody').html(html);
        }

        function render() {
            if (!breakoutDone || !huntDone) return;

            let html = '<div class="rk-wrap">';
            html += '<style>' +
                '.rk-wrap { padding:16px 24px; max-width:720px; }' +
                '.rk-title { font-size:18px; font-weight:700; margin:0 0 14px; }' +
                '.rk-table { width:100%; border-collapse:collapse; font-size:13px; }' +
                '.rk-th { padding:7px 6px; border-bottom:2px solid #444; color:#888; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap; }' +
                '.rk-sortable { cursor:pointer; user-select:none; }' +
                '.rk-sortable:hover { color:#ccc; }' +
                '.rk-sort-active { color:#d0d0d0; }' +
                '.rk-arrow { font-size:9px; margin-left:2px; opacity:0.6; }' +
                '.rk-td { padding:6px; border-bottom:1px solid #2e2e2e; }' +
                '.rk-table tr:hover td { background:rgba(255,255,255,0.03); }' +
                '.rk-lvl1 { color:#e8a020; }' +
                '.rk-lvl2 { color:#FF4136; }' +
                '.rk-lvl3 { color:#2ECC40; }' +
                '.rk-lvl4 { color:#FF851B; }' +
                '.rk-dot { display:inline-block; width:6px; height:6px; border-radius:50%; margin-right:4px; vertical-align:middle; }' +
                '.rk-dot-0 { background:#FFD700; }' +
                '.rk-dot-1 { background:#A0A0A0; }' +
                '.rk-dot-2 { background:#CD7F32; }' +
                '.rk-section { margin-top:28px; }' +
                '</style>';

            html += '<h4 class="rk-title">Breakout-Rangliste</h4>';

            if (breakoutRows.length === 0) {
                html += '<p style="opacity:0.6">Noch keine Breakout-Punkte erzielt. ' +
                    'Stupse den Fussball auf der Tipp-Uebersicht in die Punkte-Zellen!</p>';
            } else {
                html += '<table class="rk-table" id="rkBreakout">' +
                    '<thead id="rkBreakoutHead"></thead>' +
                    '<tbody id="rkBreakoutBody"></tbody></table>';
            }

            // Hunt
            if (huntRows.length > 0) {
                html += '<div class="rk-section"><h4 class="rk-title">Zahlen-Jagd</h4>';
                html += '<table class="rk-table"><thead><tr>' +
                    '<th class="rk-th" style="width:36px;text-align:center">#</th>' +
                    '<th class="rk-th" style="text-align:left">Spieler</th>' +
                    '<th class="rk-th" style="text-align:right">Beste Runde</th>' +
                    '</tr></thead><tbody>';
                for (let h = 0; h < huntRows.length; h++) {
                    let hr = huntRows[h];
                    let rowBg = h < 3 ? ' style="background:' + MEDAL_BG[h] + '"' : '';
                    html += '<tr' + rowBg + '>' +
                        '<td class="rk-td" style="text-align:center;font-weight:bold">' + (h < 3 ? MEDAL[h] : (h + 1)) + '</td>' +
                        '<td class="rk-td">' + hr.name + '</td>' +
                        '<td class="rk-td" style="text-align:right;font-weight:bold">' + hr['best_round'] + '</td>' +
                        '</tr>';
                }
                html += '</tbody></table></div>';
            }

            html += '</div>';
            setContent(html);

            if (breakoutRows.length > 0) {
                renderBreakout();

                // Sort click handler
                $j('#rkBreakout').on('click', 'th[data-sort]', function() {
                    let key = this.getAttribute('data-sort');
                    if (sortKey === key) {
                        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortKey = key;
                        sortDir = 'desc';
                    }
                    renderBreakout();
                });
            }
        }

        $j.ajax({
            url: 'php/GetGameScores.php', method: 'POST',
            data: { game: 'breakout', trid: trid }, dataType: 'json',
            success: function(res) {
                if (res && res.ok) breakoutRows = res['scores'] || [];
                breakoutDone = true; render();
            },
            error: function() { breakoutDone = true; render(); }
        });

        $j.ajax({
            url: 'php/GetGameScores.php', method: 'POST',
            data: { game: 'hunt' }, dataType: 'json',
            success: function(res) {
                if (res && res.ok) huntRows = res['scores'] || [];
                huntDone = true; render();
            },
            error: function() { huntDone = true; render(); }
        });

        setContent('<div style="padding:16px 24px"><p style="opacity:0.6">Lade Rangliste...</p></div>');
    }

}(window.kt = window.kt || {}, jQuery)); // eslint-disable-line no-undef
