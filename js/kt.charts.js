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

        var labels = [], data = [], bgColors = [];
        $j.each(sorted, function(i, s) {
            labels.push(s.name.split(',')[0]); // Nur Nachname
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
        // Spieltag-Spalten ermitteln
        var mdCols = [];
        $j.each(colModel, function(i, c) {
            if (c.name && c.name.match(/^s\d+$/)) mdCols.push(c.name);
        });

        var labels = [];
        for (var i = 1; i <= mdCols.length; i++) labels.push('' + i);

        // Top 8 Spieler + eigener User
        var datasets = [];
        var top = rows.slice(0, 8);

        $j.each(top, function(ri, r) {
            var cumData = [], cum = 0;
            $j.each(mdCols, function(mi, col) {
                cum += (parseInt(r[col]) || 0);
                cumData.push(cum);
            });
            var name = r.Name.replace(/^\uD83D\uDC51\s*/, '');
            var isUser = r.cls === 'rowUser';
            datasets.push({
                label: name,
                data: cumData,
                borderColor: colors[ri % colors.length],
                backgroundColor: 'transparent',
                borderWidth: isUser ? 3 : 1.5,
                pointRadius: 0,
                tension: 0.3
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
        var html = '<div style="padding:8px 16px"><h4>Trefferquote</h4>'
            + '<canvas id="chartTreffer" style="max-height:450px"></canvas></div>'
            + '<div style="padding:8px 16px;margin-top:16px"><h4>Punkteverteilung pro Spieltag</h4>'
            + '<canvas id="chartSchwierigkeit" style="max-height:350px"></canvas></div>';
        setContent(html);

        $j.ajax({
            type: 'POST', url: 'php/GetData.php',
            data: { trid: kt.trid, md: kt.md, fn: 'TippsUebersicht' },
            contentType: 'application/x-www-form-urlencoded',
            success: function(result) {
                var res = result.d || result;
                if (res && res.data && res.data.Rows) buildTreffer(res.data.Rows, res.colModel);
            }
        });

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

    function buildTreffer(rows, colModel) {
        var def = chartDefaults();
        // Punkte-Spalten finden (p1, p2, ...)
        var ptsCols = [];
        $j.each(colModel, function(i, c) {
            if (c.name && c.name.match(/^p\d+$/)) ptsCols.push(c.name);
        });

        var labels = [], exact = [], diff = [], tend = [], miss = [];
        $j.each(rows, function(ri, r) {
            var name = r.Name.replace(/^\uD83D\uDC51\s*/, '');
            labels.push(name.split(',')[0]);
            var e = 0, d = 0, t = 0, m = 0;
            $j.each(ptsCols, function(pi, col) {
                var p = parseInt(r[col]) || 0;
                if (p >= 3) e++;
                else if (p === 2) d++;
                else if (p === 1) t++;
                else m++;
            });
            exact.push(e); diff.push(d); tend.push(t); miss.push(m);
        });

        destroyChart('chartTreffer');
        charts['chartTreffer'] = new Chart(document.getElementById('chartTreffer'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Exakt', data: exact, backgroundColor: '#0072B2' },
                    { label: 'Differenz', data: diff, backgroundColor: '#56B4E9' },
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
            }
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
            labels.push('' + (mi + 1));
            var vals = [];
            $j.each(rows, function(ri, r) {
                vals.push(parseInt(r[col]) || 0);
            });
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

        // Ewige Ligatabelle
        var ligaId = 'LigaTabelleGesamt';
        table += kt.makeTable(ligaId + '1');

        // Ewiger Gesamtstand
        var ewigId = 'StatGesamtstand';
        table += kt.makeTable(ewigId);

        setContent(table);

        // TippTabelle + reale Tabelle
        $j.each(id, function (idx, val) {
            var gridid = "#grid" + val;
            btn = [
                { caption: "Gesamt", buttonicon: "none", onClickButton: function () { $j(gridid).trigger('refresh', { mode: 't' }); }, position: "last", tbar: "tb_" },
                { caption: "Heim", buttonicon: "none", onClickButton: function () { $j(gridid).trigger('refresh', { mode: 'h' }); }, position: "last", tbar: "tb_" },
                { caption: "Auswaerts", buttonicon: "none", onClickButton: function () { $j(gridid).trigger('refresh', { mode: 'a' }); }, position: "last", tbar: "tb_" }
            ];
            kt.autoGrid(val, lbl[idx], { toolbar: [true, 'both'], btn: btn });
        });

        // Ewige Ligatabelle
        kt.autoGrid(ligaId + '1', 'Ewige Ligatabelle', { addparam: { lnr: 1, fn: ligaId } });

        // Ewiger Gesamtstand
        kt.autoGrid(ewigId, 'Ewiger Gesamtstand');
    };

}(window.kt = window.kt || {}, jQuery));
