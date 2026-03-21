(function (kt, $j) {

    // Farb-Palette
    var colors = [
        '#2c5f2d', '#e74c3c', '#3498db', '#f39c12', '#9b59b6',
        '#1abc9c', '#e67e22', '#34495e', '#d35400', '#27ae60',
        '#8e44ad', '#c0392b', '#16a085', '#2980b9', '#f1c40f',
        '#7f8c8d', '#e91e63', '#00bcd4'
    ];

    var colorAlpha = function(hex, a) {
        var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    };

    // Theme-Erkennung
    function isDark() {
        return (localStorage.getItem('kt_theme') || '') === 'premium';
    }

    function chartDefaults() {
        var dark = isDark();
        return {
            color: dark ? '#ccc' : '#666',
            borderColor: dark ? '#444' : '#ddd',
            gridColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            bg: dark ? '#1e1e1e' : '#fff'
        };
    }

    // Plugin: Zahl in jeden Balkenabschnitt schreiben
    var barLabelPlugin = {
        id: 'barLabels',
        afterDraw: function(chart) {
            var ctx = chart.ctx;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            chart.data.datasets.forEach(function(ds, di) {
                var meta = chart.getDatasetMeta(di);
                if (meta.hidden) return;
                var dark = ds.backgroundColor === '#F0E442';
                ctx.fillStyle = dark ? '#333' : '#fff';
                ctx.font = '10px sans-serif';
                meta.data.forEach(function(bar, i) {
                    var val = ds.data[i];
                    if (!val) return;
                    var h = Math.abs(bar.base - bar.y);
                    if (h < 14) return; // zu klein zum Beschriften
                    ctx.fillText(val, bar.x, bar.y + h / 2);
                });
            });
            ctx.restore();
        }
    };

    // Bestehende Chart-Instanzen verwalten
    var charts = {};
    function destroyChart(id) {
        if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    }

    // ==================================================================================
    // 1. DASHBOARD: Tipphaeufigkeit Donut + Spieltagssieger Bar
    // ==================================================================================
    kt.Stat = kt.Stat || {};

    kt.Stat.Dashboard = function() {
        var html = '<div class="row" style="padding:8px 16px">'
            + '<div class="col-lg-5 col-md-6 col-xs-12"><h4>Tipphaeufigkeit</h4><div style="max-height:350px;position:relative"><canvas id="chartDonut"></canvas></div></div>'
            + '<div class="col-lg-7 col-md-6 col-xs-12"><h4>Spieltagssieger</h4><canvas id="chartSieger"></canvas></div>'
            + '</div>';
        setContent(html);

        // Daten laden
        $j.ajax({
            type: 'POST', url: 'php/GetData.php',
            data: { trid: kt.trid, md: kt.md, fn: 'StatTippanzahl' },
            contentType: 'application/x-www-form-urlencoded',
            success: function(result) {
                var res = result.d || result;
                if (res && res.data && res.data.Rows) buildDonut(res.data.Rows);
            }
        });

        $j.ajax({
            type: 'POST', url: 'php/GetData.php',
            data: { trid: kt.trid, md: kt.md, fn: 'TippsGesamtstand' },
            contentType: 'application/x-www-form-urlencoded',
            success: function(result) {
                var res = result.d || result;
                if (res && res.data && res.data.Rows) buildSieger(res.data.Rows, res.colModel);
            }
        });
    };

    function buildDonut(rows) {
        var def = chartDefaults();
        // Top 12 Tipps
        var top = rows.slice(0, 12);
        var labels = [], data = [], bgColors = [];
        $j.each(top, function(i, r) {
            labels.push(r.Tipp);
            data.push(r.Anzahl);
            bgColors.push(colorAlpha(colors[i % colors.length], 0.8));
        });

        // Inline-Labels Plugin
        var datalabelPlugin = {
            id: 'donutLabels',
            afterDraw: function(chart) {
                var ctx = chart.ctx;
                var meta = chart.getDatasetMeta(0);
                var total = 0;
                data.forEach(function(v) { total += v; });
                meta.data.forEach(function(arc, i) {
                    var pct = data[i] / total * 100;
                    if (pct < 3) return; // zu klein fuer Label
                    var pos = arc.tooltipPosition();
                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = 'bold 14px sans-serif';
                    ctx.fillStyle = '#fff';
                    ctx.fillText(labels[i], pos.x, pos.y - 8);
                    ctx.font = '12px sans-serif';
                    ctx.fillStyle = 'rgba(255,255,255,0.85)';
                    ctx.fillText(Math.round(pct) + '%', pos.x, pos.y + 9);
                    ctx.restore();
                });
            }
        };

        destroyChart('chartDonut');
        charts['chartDonut'] = new Chart(document.getElementById('chartDonut'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{ data: data, backgroundColor: bgColors, borderWidth: 1, borderColor: def.bg }]
            },
            plugins: [datalabelPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true }
                }
            }
        });
    }

    function buildSieger(rows, colModel) {
        var def = chartDefaults();
        // Spieltage zaehlen: Spalten s1..sN finden
        var mdCols = [];
        $j.each(colModel, function(i, c) {
            if (c.name && c.name.match(/^s\d+$/)) mdCols.push(c.name);
        });

        // Pro Spieltag den Sieger ermitteln
        var wins = {};
        $j.each(mdCols, function(mi, col) {
            var maxPts = -1, winners = [];
            $j.each(rows, function(ri, r) {
                var p = parseInt(r[col]) || 0;
                if (p > maxPts) { maxPts = p; winners = [r.Name]; }
                else if (p === maxPts) winners.push(r.Name);
            });
            $j.each(winners, function(wi, name) {
                // Krone entfernen
                var clean = name.replace(/^\uD83D\uDC51\s*/, '');
                wins[clean] = (wins[clean] || 0) + 1;
            });
        });

        // Sortieren
        var sorted = [];
        for (var n in wins) sorted.push({ name: n, count: wins[n] });
        sorted.sort(function(a,b) { return b.count - a.count; });
        sorted = sorted.slice(0, 10);

        var rawNames = [];
        $j.each(sorted, function(i, s) { rawNames.push(s.name); });
        var labels = kt.formatNames(rawNames);
        var data = [], bgColors = [];
        $j.each(sorted, function(i, s) {
            data.push(s.count);
            bgColors.push(colorAlpha(colors[i % colors.length], 0.7));
        });

        destroyChart('chartSieger');
        charts['chartSieger'] = new Chart(document.getElementById('chartSieger'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{ label: 'Spieltagssiege', data: data, backgroundColor: bgColors }]
            },
            options: {
                responsive: true,
                indexAxis: 'y',
                scales: {
                    x: { ticks: { color: def.color, stepSize: 1 }, grid: { color: def.gridColor } },
                    y: { ticks: { color: def.color } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // ==================================================================================
    // 2. PUNKTEVERLAUF: Kumulative Punkte ueber Spieltage
    // ==================================================================================
    kt.Stat.Punkteverlauf = function() {
        var html = '<div style="padding:8px 16px"><h4>Punkteverlauf</h4>'
            + '<canvas id="chartVerlauf" style="max-height:500px"></canvas></div>';
        setContent(html);

        $j.ajax({
            type: 'POST', url: 'php/GetData.php',
            data: { trid: kt.trid, md: kt.md, fn: 'TippsGesamtstand' },
            contentType: 'application/x-www-form-urlencoded',
            success: function(result) {
                var res = result.d || result;
                if (res && res.data && res.data.Rows) buildVerlauf(res.data.Rows, res.colModel);
            }
        });
    };

    function buildVerlauf(rows, colModel) {
        var def = chartDefaults();
        // Spieltag-Spalten ermitteln – nur bis zum letzten Spieltag mit Daten
        var allCols = [];
        $j.each(colModel, function(i, c) {
            if (c.name && c.name.match(/^s\d+$/)) allCols.push(c.name);
        });
        var lastWithData = 0;
        $j.each(allCols, function(mi, col) {
            for (var ri = 0; ri < rows.length; ri++) {
                var v = rows[ri][col];
                if (v !== '' && v !== null && v !== undefined) { lastWithData = mi; break; }
            }
        });
        var mdCols = allCols.slice(0, lastWithData + 1);

        var labels = [];
        $j.each(mdCols, function(i, c) {
            labels.push(c.replace('s', ''));
        });

        // Alle Spieler – Top 8 + eigener User sichtbar, Rest per Legende zuschaltbar
        var datasets = [];

        $j.each(rows, function(ri, r) {
            var cumData = [], cum = 0, hasData = true;
            $j.each(mdCols, function(mi, col) {
                var val = r[col];
                if (!hasData || val === '' || val === null || val === undefined) {
                    hasData = false;
                    cumData.push(null);
                } else {
                    cum += (parseInt(val) || 0);
                    cumData.push(cum);
                }
            });
            var name = r.Name.replace(/^\uD83D\uDC51\s*/, '');
            var isUser = r.cls === 'rowUser';
            var visible = ri < 8 || isUser;
            datasets.push({
                label: name,
                data: cumData,
                borderColor: colors[ri % colors.length],
                backgroundColor: 'transparent',
                borderWidth: isUser ? 3 : 1.5,
                pointRadius: 0,
                tension: 0.3,
                hidden: !visible
            });
        });

        destroyChart('chartVerlauf');
        charts['chartVerlauf'] = new Chart(document.getElementById('chartVerlauf'), {
            type: 'line',
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { title: { display: true, text: 'Spieltag', color: def.color }, ticks: { color: def.color }, grid: { color: def.gridColor } },
                    y: { title: { display: true, text: 'Punkte (kumuliert)', color: def.color }, ticks: { color: def.color }, grid: { color: def.gridColor } }
                },
                plugins: {
                    legend: { labels: { color: def.color, font: { size: 11 } } }
                }
            }
        });
    }

    // ==================================================================================
    // 3. TREFFERQUOTE: Stacked Bar + Spieltag-Schwierigkeit
    // ==================================================================================
    kt.Stat.Trefferquote = function() {
        // Dropdown aus Navbar-Daten aufbauen
        var sel = $j('select#cbmd'), opts = '';
        sel.find('option').each(function() {
            opts += '<option value="' + this.value + '">' + $j(this).text().trim() + '</option>';
        });
        var html = '<div style="padding:8px 16px">'
            + '<h4 style="display:inline-block;margin-right:12px">Trefferquote Spieltag</h4>'
            + '<select id="cbTrefferMd" style="font-size:13px;padding:2px 6px;border-radius:4px;border:1px solid #888;color:#222;background:#fff">' + opts + '</select>'
            + '</div>'
            + '<div style="padding:0 16px"><canvas id="chartTreffer" style="max-height:450px"></canvas></div>'
            + '<div style="padding:8px 16px;margin-top:24px"><h4>Trefferquote Gesamt</h4></div>'
            + '<div style="padding:0 16px"><canvas id="chartTrefferGesamt" style="max-height:450px"></canvas></div>';
        setContent(html);
        $j('#cbTrefferMd').val(kt.md).on('change', function() { loadTreffer(parseInt(this.value)); });
        loadTreffer(kt.md);

        $j.ajax({
            type: 'POST', url: 'php/GetData.php',
            data: { trid: kt.trid, md: kt.md, fn: 'TippsGesamtstand' },
            contentType: 'application/x-www-form-urlencoded',
            success: function(result) {
                var res = result.d || result;
                if (res && res.data && res.data.Rows) {
                    buildTrefferGesamt(res.data.Rows, res.colModel);
                }
            }
        });
    };

    // ==================================================================================
    // 4. PUNKTEVERTEILUNG: Min/Max/Durchschnitt pro Spieltag
    // ==================================================================================
    kt.Stat.Punkteverteilung = function() {
        var html = '<div style="padding:8px 16px"><h4>Punkteverteilung pro Spieltag</h4>'
            + '<canvas id="chartSchwierigkeit" style="max-height:450px"></canvas></div>';
        setContent(html);

        $j.ajax({
            type: 'POST', url: 'php/GetData.php',
            data: { trid: kt.trid, md: kt.md, fn: 'TippsGesamtstand' },
            contentType: 'application/x-www-form-urlencoded',
            success: function(result) {
                var res = result.d || result;
                if (res && res.data && res.data.Rows) buildSchwierigkeit(res.data.Rows, res.colModel);
            }
        });
    };

    function loadTreffer(md) {
        $j.ajax({
            type: 'POST', url: 'php/GetData.php',
            data: { trid: kt.trid, md: md, fn: 'TippsUebersicht' },
            contentType: 'application/x-www-form-urlencoded',
            success: function(result) {
                var res = result.d || result;
                if (res && res.data && res.data.Rows) buildTreffer(res.data.Rows, res.colModel);
            }
        });
    }

    function buildTreffer(rows, colModel) {
        var def = chartDefaults();
        // Punkte-Spalten finden (p1, p2, ...)
        var ptsCols = [];
        $j.each(colModel, function(i, c) {
            if (c.name && c.name.match(/^p\d+$/)) ptsCols.push(c.name);
        });

        var rawNames = [];
        $j.each(rows, function(ri, r) {
            rawNames.push(r.Name.replace(/^\uD83D\uDC51\s*/, ''));
        });
        var labels = kt.formatNames(rawNames);
        var exact = [], tend = [], miss = [];
        $j.each(rows, function(ri, r) {
            var e = 0, t = 0, m = 0;
            $j.each(ptsCols, function(pi, col) {
                var raw = r[col];
                if (raw === '' || raw === null || raw === undefined) return;
                // Wert kann HTML sein (<span class="pts-exact">3</span>), Zahl extrahieren
                var p = parseInt(String(raw).replace(/<[^>]*>/g, '')) || 0;
                if (p >= 3) e++;
                else if (p >= 1) t++;
                else m++;
            });
            exact.push(e); tend.push(t); miss.push(m);
        });

        destroyChart('chartTreffer');
        charts['chartTreffer'] = new Chart(document.getElementById('chartTreffer'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Exakt', data: exact, backgroundColor: '#0072B2' },
                    { label: 'Tendenz', data: tend, backgroundColor: '#F0E442' },
                    { label: 'Daneben', data: miss, backgroundColor: '#D55E00' }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: { stacked: true, ticks: { color: def.color, maxRotation: 45 }, grid: { display: false } },
                    y: { stacked: true, ticks: { color: def.color, stepSize: 1 }, grid: { color: def.gridColor } }
                },
                plugins: { legend: { labels: { color: def.color } } }
            },
            plugins: [barLabelPlugin]
        });
    }

    // Gesamt-Trefferquote über alle Spieltage (aus Gesamtstand-Daten)
    function buildTrefferGesamt(rows, colModel) {
        var def = chartDefaults();
        // Alle Spieltag-Spalten mit Daten finden
        var sCols = [];
        $j.each(colModel, function(i, c) {
            if (c.name && c.name.match(/^s\d+$/)) sCols.push(c.name);
        });

        // Einzelne Spieltage laden und Punkte pro Spieler summieren
        var rawNames = [];
        var exact = [], tend = [], miss = [];
        $j.each(rows, function(ri, r) {
            rawNames.push(r.Name.replace(/^\uD83D\uDC51\s*/, ''));
            exact.push(0); tend.push(0); miss.push(0);
        });
        var labels = kt.formatNames(rawNames);

        // Anzahl Spiele pro Spieltag aus dem colModel (Tipp-Spalten zählen)
        // Wir nutzen die s-Spalten: jeder Wert ist die Spieltag-Punktzahl
        // Um Exakt/Tendenz/Daneben zu zählen, brauchen wir die Einzelergebnisse
        // → Alle Spieltage parallel laden
        var loaded = 0, totalMd = 0;
        // Letzten Spieltag mit Daten finden
        var lastMd = 0;
        $j.each(sCols, function(mi, col) {
            for (var ri = 0; ri < rows.length; ri++) {
                var v = rows[ri][col];
                if (v !== '' && v !== null && v !== undefined) { lastMd = mi + 1; break; }
            }
        });
        totalMd = lastMd;
        if (totalMd === 0) return;

        for (var md = 1; md <= totalMd; md++) {
            (function(md) {
                $j.ajax({
                    type: 'POST', url: 'php/GetData.php',
                    data: { trid: kt.trid, md: md, fn: 'TippsUebersicht' },
                    contentType: 'application/x-www-form-urlencoded',
                    success: function(result) {
                        var res = result.d || result;
                        if (res && res.data && res.data.Rows) {
                            var ptsCols = [];
                            $j.each(res.colModel, function(i, c) {
                                if (c.name && c.name.match(/^p\d+$/)) ptsCols.push(c.name);
                            });
                            // Spieler per ID zuordnen
                            $j.each(res.data.Rows, function(ri, r) {
                                // Spieler im Gesamt-Array finden (gleiche Reihenfolge nicht garantiert)
                                var name = r.Name.replace(/^\uD83D\uDC51\s*/, '');
                                var idx = rawNames.indexOf(name);
                                if (idx === -1) return;
                                $j.each(ptsCols, function(pi, col) {
                                    var raw = r[col];
                                    if (raw === '' || raw === null || raw === undefined) return;
                                    var p = parseInt(String(raw).replace(/<[^>]*>/g, '')) || 0;
                                    if (p >= 3) exact[idx]++;
                                    else if (p >= 1) tend[idx]++;
                                    else miss[idx]++;
                                });
                            });
                        }
                        loaded++;
                        if (loaded >= totalMd) renderTrefferGesamt(def, labels, exact, tend, miss);
                    }
                });
            })(md);
        }
    }

    function renderTrefferGesamt(def, labels, exact, tend, miss) {
        destroyChart('chartTrefferGesamt');
        charts['chartTrefferGesamt'] = new Chart(document.getElementById('chartTrefferGesamt'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Exakt', data: exact, backgroundColor: '#0072B2' },
                    { label: 'Tendenz', data: tend, backgroundColor: '#F0E442' },
                    { label: 'Daneben', data: miss, backgroundColor: '#D55E00' }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: { stacked: true, ticks: { color: def.color, maxRotation: 45 }, grid: { display: false } },
                    y: { stacked: true, ticks: { color: def.color, stepSize: 1 }, grid: { color: def.gridColor } }
                },
                plugins: { legend: { labels: { color: def.color } } }
            },
            plugins: [barLabelPlugin]
        });
    }

    function buildSchwierigkeit(rows, colModel) {
        var def = chartDefaults();
        var mdCols = [];
        $j.each(colModel, function(i, c) {
            if (c.name && c.name.match(/^s\d+$/)) mdCols.push(c.name);
        });

        var labels = [], avgs = [], mins = [], maxs = [], meine = [];
        // Eigenen User finden
        var userRow = null;
        $j.each(rows, function(ri, r) { if (r.cls === 'rowUser') { userRow = r; return false; } });

        $j.each(mdCols, function(mi, col) {
            labels.push(col.replace('s', ''));
            // Nur Spieltage mit Daten (mindestens ein Spieler hat einen Wert)
            var vals = [], hasData = false;
            $j.each(rows, function(ri, r) {
                var v = r[col];
                if (v !== null && v !== undefined && v !== '') hasData = true;
                vals.push(parseInt(v) || 0);
            });
            if (!hasData) {
                avgs.push(null); mins.push(null); maxs.push(null);
                meine.push(null);
                return;
            }
            vals.sort(function(a,b) { return a - b; });
            var sum = 0;
            $j.each(vals, function(i,v) { sum += v; });
            avgs.push(Math.round(sum / vals.length * 10) / 10);
            mins.push(vals[0]);
            maxs.push(vals[vals.length - 1]);
            meine.push(userRow ? (parseInt(userRow[col]) || 0) : null);
        });

        destroyChart('chartSchwierigkeit');
        charts['chartSchwierigkeit'] = new Chart(document.getElementById('chartSchwierigkeit'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Max', data: maxs, backgroundColor: colorAlpha('#2c5f2d', 0.3), borderColor: '#2c5f2d', borderWidth: 1 },
                    { label: 'Durchschnitt', data: avgs, backgroundColor: colorAlpha('#3498db', 0.6), borderColor: '#3498db', borderWidth: 1 },
                    { label: 'Min', data: mins, backgroundColor: colorAlpha('#e74c3c', 0.3), borderColor: '#e74c3c', borderWidth: 1 },
                    { label: 'Meine Punkte', data: meine, type: 'line', borderColor: '#D55E00', backgroundColor: 'transparent', borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#D55E00', order: 0 }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: { title: { display: true, text: 'Spieltag', color: def.color }, ticks: { color: def.color }, grid: { display: false } },
                    y: { title: { display: true, text: 'Punkte', color: def.color }, ticks: { color: def.color }, grid: { color: def.gridColor } }
                },
                plugins: { legend: { labels: { color: def.color } } }
            }
        });
    }

    // ==================================================================================
    // 4. TABELLEN: TippTabelle + LigaEwig + Gesamtstand (bestehende Grids)
    // ==================================================================================
    kt.Stat.Tabellen = function() {
        // TippTabelle
        var id = ['TippTabelle', 'Tabelle'],
            lbl = ['Tipp-Tabelle', 'reale Tabelle'],
            table = '', btn;

        $j.each(id, function (idx, val) { table += kt.makeTable(val, { fl: 'left', cls: 'col-lg-6 col-md-6 col-xs-12' }); });

        table += '<div class="clr"></div>'
            + '<svg id="tabellenLinks" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50"></svg>'
            + '<div class="clr" style="margin-bottom:16px"></div>';

        // Ewige Ligatabelle
        var ligaId = 'LigaTabelleGesamt';
        table += kt.makeTable(ligaId + '1', { fl: 'left', cls: 'col-lg-6 col-md-6 col-xs-12' });

        // Ewiger Gesamtstand
        var ewigId = 'StatGesamtstand';
        table += kt.makeTable(ewigId, { fl: 'left', cls: 'col-lg-6 col-md-6 col-xs-12' });

        setContent(table);

        // TippTabelle + reale Tabelle
        $j.each(id, function (idx, val) {
            var gridid = "#grid" + val;
            btn = [
                { caption: "Gesamt", buttonicon: "none", onClickButton: function () { $j(gridid).trigger('refresh', { mode: 't' }); setTimeout(drawTabellenLinks, 800); }, position: "last", tbar: "tb_" },
                { caption: "Heim", buttonicon: "none", onClickButton: function () { $j(gridid).trigger('refresh', { mode: 'h' }); setTimeout(drawTabellenLinks, 800); }, position: "last", tbar: "tb_" },
                { caption: "Auswaerts", buttonicon: "none", onClickButton: function () { $j(gridid).trigger('refresh', { mode: 'a' }); setTimeout(drawTabellenLinks, 800); }, position: "last", tbar: "tb_" }
            ];
            kt.autoGrid(val, lbl[idx], { toolbar: [true, 'both'], btn: btn });
        });

        // Ewige Ligatabelle
        kt.autoGrid(ligaId + '1', 'Ewige Ligatabelle', { addparam: { lnr: 1, fn: ligaId } });

        // Ewiger Gesamtstand
        kt.autoGrid(ewigId, 'Ewiger Gesamtstand');

        // Querverbindungen zwischen TippTabelle und realer Tabelle zeichnen
        (function waitAndDraw() {
            var tries = 0;
            var timer = setInterval(function() {
                var left = $j('#gridTippTabelle tbody tr');
                var right = $j('#gridTabelle tbody tr');
                if (left.length > 1 && right.length > 1) {
                    clearInterval(timer);
                    drawTabellenLinks();
                } else if (++tries > 50) {
                    clearInterval(timer);
                }
            }, 200);
        })();
    };

    function drawTabellenLinks() {
        var svg = document.getElementById('tabellenLinks');
        if (!svg) return;
        var container = svg.parentElement;
        if (!container) return;
        container.style.position = 'relative';

        // Team-Positionen aus beiden Grids auslesen
        var leftTeams = {}, rightTeams = {};
        $j('#gridTippTabelle tbody tr').each(function() {
            var team = $j(this).find('td[aria-describedby$="_Team"]').text().trim();
            if (team) leftTeams[team] = this;
        });
        $j('#gridTabelle tbody tr').each(function() {
            var team = $j(this).find('td[aria-describedby$="_Team"]').text().trim();
            if (team) rightTeams[team] = this;
        });

        // Container-Offset für relative Positionierung
        var cRect = container.getBoundingClientRect();

        // SVG-Größe setzen
        svg.setAttribute('width', cRect.width);
        svg.setAttribute('height', cRect.height);
        svg.style.height = cRect.height + 'px';
        svg.innerHTML = '';

        // Positionen (Rang) aus Zeilen-Index ermitteln
        var leftPos = {}, rightPos = {};
        var idx = 0;
        $j('#gridTippTabelle tbody tr').each(function() {
            var team = $j(this).find('td[aria-describedby$="_Team"]').text().trim();
            if (team) leftPos[team] = idx++;
        });
        idx = 0;
        $j('#gridTabelle tbody tr').each(function() {
            var team = $j(this).find('td[aria-describedby$="_Team"]').text().trim();
            if (team) rightPos[team] = idx++;
        });

        var lineColors = { up: '#D4920A', down: '#3498db', same: '#DAA520' };
        var sameCount = 0;

        for (var team in leftTeams) {
            if (!rightTeams[team]) continue;
            var lRow = leftTeams[team];
            var rRow = rightTeams[team];
            var lRect = lRow.getBoundingClientRect();
            var rRect = rRow.getBoundingClientRect();

            var y1 = lRect.top + lRect.height / 2 - cRect.top;
            var y2 = rRect.top + rRect.height / 2 - cRect.top;
            var x1 = lRect.right - cRect.left;
            var x2 = rRect.left - cRect.left;

            var lp = leftPos[team], rp = rightPos[team];
            var type = lp === rp ? 'same' : (rp < lp ? 'up' : 'down');

            var line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            var mx = (x1 + x2) / 2;
            line.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2);
            line.setAttribute('stroke', lineColors[type]);
            line.setAttribute('stroke-width', type === 'same' ? '4' : '2');
            line.setAttribute('fill', 'none');
            line.setAttribute('opacity', '0.6');
            line.setAttribute('class', 'tl-line tl-' + type);

            // Goldene Linien funkeln lassen
            if (type === 'same') {
                sameCount++;
                var anim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
                anim.setAttribute('attributeName', 'stroke-opacity');
                anim.setAttribute('values', '1;0.4;1');
                anim.setAttribute('dur', '2s');
                anim.setAttribute('repeatCount', 'indefinite');
                line.appendChild(anim);
            }

            svg.appendChild(line);
        }

        // Anzahl korrekte Vorhersagen mittig zwischen den Tabellen
        if (sameCount > 0) {
            // Mitte = Durchschnitt aller x1/x2-Werte der Linien
            var firstLeft = $j('#gridTippTabelle').closest('.ui-jqgrid')[0];
            var firstRight = $j('#gridTabelle').closest('.ui-jqgrid')[0];
            var tx = cRect.width / 2;
            if (firstLeft && firstRight) {
                var lr = firstLeft.getBoundingClientRect();
                var rr = firstRight.getBoundingClientRect();
                tx = ((lr.right - cRect.left) + (rr.left - cRect.left)) / 2;
            }
            var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', tx);
            text.setAttribute('y', 20);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '28');
            text.setAttribute('font-weight', '900');
            text.setAttribute('fill', '#DAA520');
            text.setAttribute('stroke', '#7A5B00');
            text.setAttribute('stroke-width', '0.5');
            text.textContent = sameCount + ' \u2714';
            text.style.cursor = 'pointer';
            text.style.pointerEvents = 'all';
            var goldOnly = false;
            text.addEventListener('click', function() {
                goldOnly = !goldOnly;
                var lines = svg.querySelectorAll('.tl-line');
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i].classList.contains('tl-same')) {
                        lines[i].setAttribute('opacity', '0.6');
                    } else {
                        lines[i].setAttribute('opacity', goldOnly ? '0' : '0.6');
                    }
                }
            });
            svg.appendChild(text);
        }
    }

}(window.kt = window.kt || {}, jQuery));
