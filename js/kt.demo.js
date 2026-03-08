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
                    { title: 'Statistiken', smenu: 'Stat', action: 'TippAnzahl' },
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
                    { title: 'Tipphaeufigkeit', smenu: 'Stat', action: 'TippAnzahl' }
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
                    { trid: 1, Name: 'Saison 2025/2026', curmd: 25 },
                    { trid: 2, Name: 'Saison 2024/2025', curmd: 34 }
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
        'php/GetData.php': function(params) {
            if (params && params.fn === 'TippsUebersicht') {
                return buildDemoOverview();
            }
            if (params && params.fn === 'TippsTippabgabe') {
                return buildDemoTippabgabe();
            }
            return { colModel: [], data: { Records: 0, Rows: [] } };
        }
    };

    var demoNames = [
        'Mueller, Thomas', 'Schmidt, Andreas', 'Weber, Michael', 'Fischer, Stefan',
        'Wagner, Markus', 'Becker, Juergen', 'Hoffmann, Peter', 'Schneider, Klaus',
        'Koch, Helmut', 'Braun, Oliver', 'Richter, Frank', 'Wolf, Manfred',
        'Klein, Sascha', 'Schroeder, Marc', 'Neumann, Kerstin', 'Schwarz, Theo',
        'Zimmermann, Tom', 'Krueger, Matthias'
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
        colModel.push({ label: 'Name', width: 200, name: 'Name', classes: 'Name' });

        for (var m = 0; m < demoMatches.length; m++) {
            var match = demoMatches[m];
            var hdr = match.k1 + '<p class="hdrRes">' + match.erg + '</p>' + match.k2;
            colModel.push({ label: hdr, width: 50, name: 't' + match.sid, align: 'center', sortable: false, classes: 'Tipps' });
            colModel.push({ label: ' ', width: 20, name: 'p' + match.sid, align: 'center', sortable: false, classes: 'Pts1' });
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
        colModel.push({ label: 'Heimteam', width: 200, name: 'HTeam', formatter: 'html', classes: 'Team' });
        colModel.push({ label: ' ', width: 20, name: 'ALogo', formatter: 'logo' });
        colModel.push({ label: 'Auswaertsteam', width: 200, name: 'ATeam', formatter: 'html', classes: 'Team' });
        colModel.push({ label: 'Datum', width: 90, name: 'Date', align: 'right', formatter: 'date', classes: 'Date' });
        colModel.push({ label: 'Zeit', width: 60, name: 'Time', align: 'center', formatter: 'date', classes: 'Time',
            formatoptions: { srcformat: 'H:i:s', newformat: 'H:i' } });
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
                Date: '2026-03-14', Time: '15:30:00',
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

        // Erster Call: testen ob PHP erreichbar
        if (!firstCallDone && !demoMode) {
            firstCallDone = true;
            // Pruefen ob wir auf file:// sind
            if (window.location.protocol === 'file:') {
                activateDemo();
            }
        }

        if (demoMode || window.location.protocol === 'file:') {
            activateDemo();

            var mockData = demoData[url];
            if (typeof mockData === 'function') {
                // Params extrahieren
                var params = {};
                if (typeof opts.data === 'string') {
                    try { params = JSON.parse(opts.data); } catch(e) {}
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

        // Echter AJAX-Call, aber bei Fehler Demo-Modus aktivieren
        var originalError = opts.error;
        opts.error = function(xhr, status, error) {
            if (!demoMode) {
                activateDemo();
                // Nochmal mit Demo-Daten versuchen
                $.ajax(opts);
                return;
            }
            if (originalError) originalError(xhr, status, error);
        };

        return realAjax.call(this, opts);
    };

})(jQuery);
