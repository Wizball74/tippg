(function($) {
    // Demo-Modus: Wenn kein PHP-Backend erreichbar ist, werden Dummy-Daten angezeigt.
    // Wird automatisch aktiviert wenn der erste AJAX-Call fehlschlaegt.

    var demoData = {
        'php/CheckLogin.php': {
            ok: true,
            loggedIn: true,
            trid: 1,
            md: 25,
            menu: 'Tipps',
            action: 'Uebersicht',
            username: 'Demo-User'
        },
        'php/GetMenu.php': {
            menu: {
                main: [
                    { title: 'Tipps', smenu: 'Tipps', action: 'Uebersicht' },
                    { title: 'Ligasystem', smenu: 'Liga', action: 'Spielplan' },
                    { title: 'Spielplan / Tabelle', smenu: 'Spielplan', action: 'Spielplan' },
                    { title: 'Statistiken', smenu: 'Stat', action: 'Dashboard' },
                    { title: 'Admin', smenu: 'Admin', action: 'Einstellungen' },
                    { title: 'Abmelden', smenu: 'login', action: 'logout' }
                ],
                Tipps: [
                    { title: 'Uebersicht', smenu: 'Tipps', action: 'Uebersicht' },
                    { title: 'Tippabgabe', smenu: 'Tipps', action: 'Tippabgabe' },
                    { title: 'Gesamtstand', smenu: 'Tipps', action: 'Gesamtstand' }
                ],
                Liga: [
                    { title: 'Spielplan', smenu: 'Liga', action: 'Spielplan' },
                    { title: 'Tabellen', smenu: 'Liga', action: 'Tabellen' }
                ],
                Spielplan: [
                    { title: 'Spielplan', smenu: 'Spielplan', action: 'Spielplan' },
                    { title: 'Tabelle', smenu: 'Spielplan', action: 'Tabelle' }
                ],
                Stat: [
                    { title: 'Dashboard', smenu: 'Stat', action: 'Dashboard' },
                    { title: 'Punkteverlauf', smenu: 'Stat', action: 'Punkteverlauf' },
                    { title: 'Trefferquote', smenu: 'Stat', action: 'Trefferquote' },
                    { title: 'Tabellen', smenu: 'Stat', action: 'Tabellen' },
                    { title: 'Breakout', smenu: 'Stat', action: 'Breakout' }
                ],
                Admin: [
                    { title: 'Einstellungen', smenu: 'Admin', action: 'Einstellungen' },
                    { title: 'Profil', smenu: 'Admin', action: 'Profil' }
                ]
            }
        },
        'php/GetTrList.php': {
            ok: true,
            data: {
                Records: 2,
                Rows: [
                    { trid: 1, Name: 'Saison 2025/2026', curmd: 25, Ligen: 1 },
                    { trid: 2, Name: 'Saison 2024/2025', curmd: 34, Ligen: 1 }
                ]
            }
        },
        'php/GetMdList.php': {
            ok: true,
            data: {
                Records: 3,
                Rows: (function() {
                    var rows = [];
                    for (var i = 1; i <= 34; i++) {
                        rows.push({ sptag: i, Anzeige: (i < 10 ? '0' : '') + i + '. Spieltag' });
                    }
                    return rows;
                })()
            }
        },
        'php/getTippInfo.php': function(params) {
            var tidH = params.tidH || 1, tidA = params.tidA || 2;
            var teamNames = { 1:'FC Bayern', 2:'BVB', 3:'SC Freiburg', 4:'Bayer Leverkusen', 5:'FSV Mainz 05',
                6:'VfB Stuttgart', 7:'VfL Wolfsburg', 8:'RB Leipzig', 9:'FC Augsburg', 10:'Hamburger SV',
                11:'Werder Bremen', 12:'FC St. Pauli', 13:'Eintracht Frankfurt', 14:'1. FC Koeln', 15:'TSG Hoffenheim', 16:'1. FC Koeln' };
            var hn = teamNames[tidH] || 'Heim', an = teamNames[tidA] || 'Ausw.';
            function randRes() { return Math.floor(Math.random()*4) + ':' + Math.floor(Math.random()*3); }
            var html = '<table class="kttable tipinfo rounded shadow" style="width:100%">';
            html += '<tr class="row3"><th colspan="3">Letzte 5 Spiele ' + hn + '</th></tr>';
            for (var i = 0; i < 5; i++) html += '<tr><td>' + hn + '</td><td style="text-align:center;font-weight:bold">' + randRes() + '</td><td>Gegner ' + (i+1) + '</td></tr>';
            html += '<tr class="row3"><th colspan="3">Letzte 5 Spiele ' + an + '</th></tr>';
            for (var j = 0; j < 5; j++) html += '<tr><td>' + an + '</td><td style="text-align:center;font-weight:bold">' + randRes() + '</td><td>Gegner ' + (j+1) + '</td></tr>';
            html += '<tr class="row3"><th colspan="3">Direkter Vergleich</th></tr>';
            for (var k = 0; k < 3; k++) html += '<tr><td>' + hn + '</td><td style="text-align:center;font-weight:bold">' + randRes() + '</td><td>' + an + '</td></tr>';
            html += '</table>';
            return { ok: true, html: html };
        },
        'php/GetData.php': function(params) {
            if (params && params.fn === 'TippsUebersicht') {
                return buildDemoOverview();
            }
            if (params && params.fn === 'TippsTippabgabe') {
                return buildDemoTippabgabe();
            }
            if (params && params.fn === 'TippsGesamtstand') {
                return buildDemoGesamtstand();
            }
            if (params && params.fn === 'Spielplan') {
                return buildDemoSpielplan();
            }
            if (params && params.fn === 'Tabelle') {
                return buildDemoTabelle();
            }
            if (params && params.fn === 'StatTippanzahl') {
                return buildDemoTippAnzahl();
            }
            if (params && params.fn === 'LigaSpielplan') {
                return buildDemoLigaSpielplan();
            }
            if (params && params.fn === 'LigaTabelle') {
                return buildDemoLigaTabelle();
            }
            if (params && params.fn === 'Benutzer') {
                return buildDemoProfil();
            }
            if (params && params.fn === 'TippTabelle') {
                return buildDemoTabelle();
            }
            if (params && params.fn === 'LigaTabelleGesamt') {
                return buildDemoLigaTabelle();
            }
            if (params && params.fn === 'StatGesamtstand') {
                return buildDemoGesamtstand();
            }
            return { colModel: [], data: { Records: 0, Rows: [] } };
        }
    };

    var demoNames = [
        'Thomas M', 'Andreas S', 'Michael W', 'Stefan F',
        'Markus W', 'Juergen B', 'Peter H', 'Klaus S',
        'Helmut K', 'Oliver B', 'Frank R', 'Manfred W',
        'Sascha K', 'Marc S', 'Kerstin N', 'Theo S',
        'Tom Z', 'Matthias K'
    ];

    var demoMatches = [
        { sid: 1, tid1: 1, tid2: 7, erg: '4:1', k1: 'FCB', k2: 'Wolf', n1: 'FC Bayern', n2: 'VfL Wolfsburg' },
        { sid: 2, tid1: 3, tid2: 4, erg: '3:3', k1: 'Freibg', k2: 'Lev', n1: 'SC Freiburg', n2: 'Bayer Leverkusen' },
        { sid: 3, tid1: 5, tid2: 6, erg: '2:2', k1: 'M05', k2: 'Stgt', n1: 'FSV Mainz 05', n2: 'VfB Stuttgart' },
        { sid: 4, tid1: 8, tid2: 9, erg: '2:1', k1: 'Leipzig', k2: 'FCA', n1: 'RB Leipzig', n2: 'FC Augsburg' },
        { sid: 5, tid1: 10, tid2: 11, erg: '1:2', k1: 'HSV', k2: 'Breme', n1: 'Hamburger SV', n2: 'Werder Bremen' },
        { sid: 6, tid1: 12, tid2: 13, erg: '0:2', k1: 'Pauli', k2: 'EinF', n1: 'FC St. Pauli', n2: 'Eintracht Frankfurt' },
        { sid: 7, tid1: 14, tid2: 15, erg: '2:4', k1: '1. FC K', k2: 'Hoff', n1: '1. FC Koeln', n2: 'TSG Hoffenheim' },
        { sid: 8, tid1: 16, tid2: 2, erg: '1:2', k1: 'Koeln', k2: 'BVB', n1: '1. FC Koeln', n2: 'Borussia Dortmund' }
    ];

    function randTip() {
        var a = Math.floor(Math.random() * 5);
        var b = Math.floor(Math.random() * 4);
        return a + ':' + b;
    }

    function evalTip(tip, erg) {
        if (erg === '-:-' || tip === '-:-') return 0;
        if (tip === erg) return 3;
        var t = tip.split(':'), r = erg.split(':');
        var td = t[0] - t[1], rd = r[0] - r[1];
        if (td === rd) return 2;
        if (td * rd > 0) return 1;
        return 0;
    }

    function buildDemoOverview() {
        var colModel = [];
        colModel.push({ label: 'Name', width: (window.innerWidth < 768 ? 82 : 200), name: 'Name', classes: 'Name' });

        for (var m = 0; m < demoMatches.length; m++) {
            var match = demoMatches[m];
            var hdr = match.k1 + '<p class="hdrRes">' + match.erg + '</p>' + match.k2;
            colModel.push({ label: hdr, width: 50, name: 't' + match.sid, align: 'center', sortable: false, classes: 'Tipps' });
            colModel.push({ label: 'P', width: 28, name: 'p' + match.sid, align: 'center', sortable: false, classes: 'Pts1' });
        }
        colModel.push({ label: 'Pkt.', width: 40, name: 'Pts', align: 'right', sorttype: 'int', classes: 'Pts' });
        colModel.push({ label: 'Praemie', width: 80, name: 'Bonus', align: 'right', formatter: 'currency', sorttype: 'currency', formatoptions: { defaultValue: '' }, classes: 'Bonus' });
        colModel.push({ name: 'id', key: true, hidden: true });
        colModel.push({ name: 'cls', hidden: true });

        var rows = [];
        for (var i = 0; i < demoNames.length; i++) {
            var row = { Name: demoNames[i], id: i + 1, Pts: 0, cls: (i === 5) ? 'rowUser' : (i === 8 ? 'rowOpponent' : '') };
            for (var mm = 0; mm < demoMatches.length; mm++) {
                var tip = randTip();
                var pts = evalTip(tip, demoMatches[mm].erg);
                row['t' + demoMatches[mm].sid] = tip;
                row['p' + demoMatches[mm].sid] = pts || '';
                row.Pts += pts;
            }
            if (i < 4) row.Bonus = (Math.random() * 8 + 1).toFixed(2);
            rows.push(row);
        }

        rows.sort(function(a, b) { return b.Pts - a.Pts; });

        // Spieltag komplett? (kein -:- Ergebnis)
        var complete = true;
        for (var c = 0; c < demoMatches.length; c++) {
            if (demoMatches[c].erg === '-:-') { complete = false; break; }
        }

        // Sieger mit Krone markieren
        if (complete && rows.length > 0) {
            var maxPts = rows[0].Pts;
            for (var w = 0; w < rows.length; w++) {
                if (rows[w].Pts === maxPts) {
                    rows[w].Name = '\uD83D\uDC51 ' + rows[w].Name;
                } else {
                    break;
                }
            }
        }

        return {
            colModel: colModel,
            data: { Records: rows.length, Rows: rows },
            sortname: 'Pts',
            sortorder: 'desc',
            userdata: { title: 'Tipp-Uebersicht (DEMO)' }
        };
    }

    function buildDemoTippabgabe() {
        var colModel = [];
        colModel.push({ label: ' ', width: 20, name: 'HLogo', formatter: 'logo' });
        colModel.push({ label: 'Heim', width: 130, name: 'HTeam', formatter: 'html', classes: 'Team' });
        colModel.push({ label: ' ', width: 20, name: 'ALogo', formatter: 'logo' });
        colModel.push({ label: 'Ausw.', width: 130, name: 'ATeam', formatter: 'html', classes: 'Team' });
        colModel.push({ label: 'Datum', width: 70, name: 'DateTime', align: 'center', formatter: 'html', classes: 'DateTime' });
        colModel.push({ label: 'Tipp', width: 70, name: 'Tip', align: 'center', classes: 'Result',
            editable: true, editoptions: { size: 5, maxlength: 5, 'class': 'gradient' } });
        colModel.push({ name: 'editable', hidden: true });
        colModel.push({ name: 'sid', key: true, hidden: true });
        colModel.push({ name: 'id', key: true, hidden: true });

        var rows = [];
        for (var i = 0; i < demoMatches.length; i++) {
            var m = demoMatches[i];
            rows.push({
                sid: m.sid, id: m.sid,
                HTeam: m.n1, ATeam: m.n2,
                HLogo: m.tid1, ALogo: m.tid2,
                DateTime: '14.03.<br>15:30',
                Tip: '', editable: true,
                deadline: '14.03.2026 15:30'
            });
        }

        return {
            colModel: colModel,
            data: { Records: rows.length, Rows: rows },
            userdata: { title: 'Tippabgabe (DEMO)' }
        };
    }

    function buildDemoGesamtstand() {
        var colModel = [];
        colModel.push({ label: 'Pos', width: 25, name: 'Pos', align: 'center', classes: 'Pos' });
        colModel.push({ label: 'Name', width: (window.innerWidth < 768 ? 82 : 200), name: 'Name', classes: 'Name' });
        var numMd = 25;
        for (var s = 1; s <= numMd; s++) {
            colModel.push({ label: '' + s, width: 28, name: 's' + s, align: 'center', sortable: false, classes: 'Pts1' });
        }
        colModel.push({ label: 'Pkt.', width: 40, name: 'Pts', align: 'right', sorttype: 'int', classes: 'Pts' });
        colModel.push({ label: 'Praemie', width: 80, name: 'Bonus', align: 'right', formatter: 'currency', sorttype: 'currency', formatoptions: { defaultValue: '' }, classes: 'Bonus' });
        colModel.push({ name: 'id', key: true, hidden: true });
        colModel.push({ name: 'cls', hidden: true });

        var rows = [];
        for (var i = 0; i < demoNames.length; i++) {
            var row = { Name: demoNames[i], id: i + 1, Pts: 0, cls: (i === 5) ? 'rowUser' : (i === 8 ? 'rowOpponent' : '') };
            for (var m = 1; m <= numMd; m++) {
                var mdPts = Math.floor(Math.random() * 18) + 4;
                row['s' + m] = mdPts;
                row.Pts += mdPts;
            }
            rows.push(row);
        }
        rows.sort(function(a, b) { return b.Pts - a.Pts; });
        for (var p = 0; p < rows.length; p++) {
            rows[p].Pos = p + 1;
            if (p < 4) rows[p].Bonus = (Math.random() * 20 + 5).toFixed(2);
        }
        // Sieger mit Krone
        if (rows.length > 0) {
            var maxP = rows[0].Pts;
            for (var w = 0; w < rows.length && rows[w].Pts === maxP; w++) {
                rows[w].Name = '\uD83D\uDC51 ' + rows[w].Name;
            }
        }
        return {
            colModel: colModel,
            data: { Records: rows.length, Rows: rows },
            sortname: 'Pts', sortorder: 'desc',
            userdata: { title: 'Gesamtstand (DEMO)' }
        };
    }

    function buildDemoSpielplan() {
        var colModel = [];
        colModel.push({ label: ' ', width: 20, name: 'HLogo', formatter: 'logo' });
        colModel.push({ label: 'Heim', width: 130, name: 'HTeam', formatter: 'html', classes: 'Team' });
        colModel.push({ label: ' ', width: 20, name: 'ALogo', formatter: 'logo' });
        colModel.push({ label: 'Ausw.', width: 130, name: 'ATeam', formatter: 'html', classes: 'Team' });
        colModel.push({ label: 'Datum', width: 70, name: 'DateTime', align: 'center', formatter: 'html', classes: 'DateTime' });
        colModel.push({ label: 'Ergebnis', width: 70, name: 'Result', align: 'center', classes: 'Result' });
        colModel.push({ name: 'sid', key: true, hidden: true });
        var rows = [];
        for (var i = 0; i < demoMatches.length; i++) {
            var m = demoMatches[i];
            rows.push({
                sid: m.sid, HTeam: m.n1, ATeam: m.n2,
                HLogo: m.tid1, ALogo: m.tid2,
                DateTime: '14.03.<br>15:30', Result: m.erg
            });
        }
        return {
            colModel: colModel,
            data: { Records: rows.length, Rows: rows },
            userdata: { title: 'Spielplan (DEMO)' }
        };
    }

    function buildDemoTabelle() {
        var teams = [
            { tid: 4, name: 'Bayer Leverkusen' }, { tid: 1, name: 'FC Bayern' },
            { tid: 2, name: 'Borussia Dortmund' }, { tid: 8, name: 'RB Leipzig' },
            { tid: 13, name: 'Eintracht Frankfurt' }, { tid: 6, name: 'VfB Stuttgart' },
            { tid: 3, name: 'SC Freiburg' }, { tid: 11, name: 'Werder Bremen' },
            { tid: 15, name: 'TSG Hoffenheim' }, { tid: 7, name: 'VfL Wolfsburg' },
            { tid: 9, name: 'FC Augsburg' }, { tid: 5, name: 'FSV Mainz 05' },
            { tid: 10, name: 'Hamburger SV' }, { tid: 12, name: 'FC St. Pauli' },
            { tid: 14, name: '1. FC Koeln' }, { tid: 16, name: '1. FC Koeln II' }
        ];
        var colModel = [
            { label: 'Pos', width: 30, name: 'Pos', align: 'center', classes: 'Pos' },
            { label: ' ', width: 20, name: 'Logo', formatter: 'logo' },
            { label: 'Team', width: 160, name: 'Team', classes: 'Team' },
            { label: 'Sp', width: 28, name: 'Matches', align: 'center' },
            { label: 'S', width: 28, name: 'Win', align: 'center' },
            { label: 'U', width: 28, name: 'Draw', align: 'center' },
            { label: 'N', width: 28, name: 'Loss', align: 'center' },
            { label: 'Tore', width: 55, name: 'Goals', align: 'center' },
            { label: 'Diff', width: 35, name: 'Diff', align: 'center' },
            { label: 'Pkt', width: 35, name: 'Pts', align: 'right', sorttype: 'int', classes: 'Pts' },
            { name: 'id', key: true, hidden: true }
        ];
        var rows = [];
        for (var i = 0; i < teams.length; i++) {
            var w = Math.floor(Math.random() * 14) + 4;
            var d = Math.floor(Math.random() * 8);
            var l = 24 - w - d;
            var gf = w * 2 + d + Math.floor(Math.random() * 15);
            var ga = l * 2 + d + Math.floor(Math.random() * 10);
            rows.push({
                id: teams[i].tid, Pos: i + 1, Logo: teams[i].tid, Team: teams[i].name,
                Matches: 24, Win: w, Draw: d, Loss: l,
                Goals: gf + ':' + ga, Diff: gf - ga, Pts: w * 3 + d
            });
        }
        rows.sort(function(a, b) { return b.Pts - a.Pts || b.Diff - a.Diff; });
        for (var p = 0; p < rows.length; p++) rows[p].Pos = p + 1;
        return {
            colModel: colModel,
            data: { Records: rows.length, Rows: rows },
            sortname: 'Pts', sortorder: 'desc',
            userdata: { title: 'Tabelle (DEMO)' }
        };
    }

    function buildDemoTippAnzahl() {
        var tipps = {};
        for (var i = 0; i < 800; i++) {
            var t = randTip();
            tipps[t] = (tipps[t] || 0) + 1;
        }
        var vw = window.innerWidth || 400;
        var tw = Math.max(Math.floor(vw * 0.9), 300);
        var colModel = [
            { label: 'Tipp', width: Math.floor(tw * 0.3), name: 'Tipp' },
            { label: 'Anzahl', width: Math.floor(tw * 0.35), name: 'Anzahl', align: 'right', sorttype: 'int' },
            { label: 'Prozent', width: Math.floor(tw * 0.35), name: 'Prozent', align: 'right' },
            { name: 'id', key: true, hidden: true }
        ];
        var rows = [], id = 1, total = 800;
        for (var key in tipps) {
            rows.push({ id: id++, Tipp: key, Anzahl: tipps[key], Prozent: (tipps[key] / total * 100).toFixed(1) + ' %' });
        }
        rows.sort(function(a, b) { return b.Anzahl - a.Anzahl; });
        return {
            colModel: colModel,
            data: { Records: rows.length, Rows: rows },
            sortname: 'Anzahl', sortorder: 'desc',
            userdata: { title: 'Tipphaeufigkeit (DEMO)' }
        };
    }

    function buildDemoLigaSpielplan() {
        var colModel = [
            { label: 'Spieler 1', width: 180, name: 'M1', classes: 'Team' },
            { label: 'Spieler 2', width: 180, name: 'M2', classes: 'Team' },
            { label: 'Ergebnis', width: 90, name: 'Result', align: 'center', classes: 'Result' },
            { name: 'id', key: true, hidden: true }
        ];
        var rows = [];
        for (var i = 0; i < 9; i++) {
            var a = i * 2, b = i * 2 + 1;
            if (b >= demoNames.length) break;
            var s1 = Math.floor(Math.random() * 20) + 5, s2 = Math.floor(Math.random() * 20) + 5;
            rows.push({ id: i + 1, M1: demoNames[a], M2: demoNames[b], Result: s1 + ' : ' + s2 });
        }
        return {
            colModel: colModel,
            data: { Records: rows.length, Rows: rows },
            userdata: { title: 'Liga-Spielplan (DEMO)' }
        };
    }

    function buildDemoLigaTabelle() {
        var colModel = [
            { label: 'Pos', width: 35, name: 'Pos', align: 'center', classes: 'Pos' },
            { label: 'Name', width: 180, name: 'Name', classes: 'Name' },
            { label: 'Sp', width: 30, name: 'Matches', align: 'center' },
            { label: 'S', width: 30, name: 'Win', align: 'center' },
            { label: 'U', width: 30, name: 'Draw', align: 'center' },
            { label: 'N', width: 30, name: 'Loss', align: 'center' },
            { label: 'Pkt', width: 35, name: 'Pts', align: 'right', sorttype: 'int', classes: 'Pts' },
            { name: 'tnid', key: true, hidden: true }
        ];
        var rows = [];
        for (var i = 0; i < demoNames.length; i++) {
            var w = Math.floor(Math.random() * 10);
            var d = Math.floor(Math.random() * 5);
            var l = 12 - w - d;
            rows.push({ tnid: i + 1, Name: demoNames[i], Matches: 12, Win: w, Draw: d, Loss: l, Pts: w * 3 + d });
        }
        rows.sort(function(a, b) { return b.Pts - a.Pts; });
        for (var p = 0; p < rows.length; p++) rows[p].Pos = p + 1;
        return {
            colModel: colModel,
            data: { Records: rows.length, Rows: rows },
            sortname: 'Pts', sortorder: 'desc',
            userdata: { title: 'Liga-Tabelle (DEMO)' }
        };
    }

    function buildDemoProfil() {
        var colModel = [
            { label: 'Name', width: 180, name: 'name', editable: true },
            { label: 'Benutzer', width: 140, name: 'user', editable: true },
            { label: 'E-Mail', width: 200, name: 'email', editable: true },
            { name: 'tnid', key: true, hidden: true }
        ];
        var rows = [
            { tnid: 1, name: 'Demo-User', user: 'demo', email: 'demo@example.com' }
        ];
        return {
            colModel: colModel,
            data: { Records: rows.length, Rows: rows },
            userdata: { title: 'Profil (DEMO)' }
        };
    }

    // AJAX abfangen und Demo-Daten liefern
    var realAjax = $.ajax;
    var demoMode = false;
    var firstCallDone = false;

    function activateDemo() {
        if (demoMode) return;
        demoMode = true;

        // Banner anzeigen
        var banner = $('<div/>').css({
            background: '#d32f2f',
            color: '#fff',
            textAlign: 'center',
            padding: '10px 0',
            fontSize: '16px',
            fontWeight: 'bold',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 99999
        }).html('VORSCHAU &ndash; Kein PHP-Backend &ndash; Dummy-Daten');
        $('body').prepend(banner);
        $('body').css('padding-top', '40px');
    }

    $.ajax = function(opts) {
        var url = opts.url || '';

        // Demo-Modus nur bei file:// Protokoll (lokale Vorschau ohne Server)
        if (!demoMode && window.location.protocol === 'file:') {
            activateDemo();
        }

        if (demoMode) {
            var mockData = demoData[url];
            if (typeof mockData === 'function') {
                // Params extrahieren
                var params = {};
                if (typeof opts.data === 'string') {
                    try { params = JSON.parse(opts.data); } catch(e) {
                        // URL-encoded form data (e.g. "trid=1&md=25&fn=GetData")
                        opts.data.split('&').forEach(function(pair) {
                            var kv = pair.split('=');
                            if (kv.length === 2) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
                        });
                    }
                } else if (typeof opts.data === 'object') {
                    params = opts.data;
                }
                mockData = mockData(params);
            }

            if (mockData) {
                // Simulierten erfolgreichen AJAX-Call zurueckgeben
                var deferred = $.Deferred();
                if (opts.async === false) {
                    // Synchrone Calls sofort ausfuehren
                    if (opts.success) opts.success(mockData);
                    if (opts.complete) opts.complete();
                    deferred.resolve(mockData);
                } else {
                    setTimeout(function() {
                        if (opts.success) opts.success(mockData);
                        if (opts.complete) opts.complete();
                        deferred.resolve(mockData);
                    }, 10);
                }
                return deferred.promise();
            }
        }

        return realAjax.call(this, opts);
    };

})(jQuery);
