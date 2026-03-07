(function (kt, $j) /*, undefined)*/{

    function makeTable(id, opt) {
        opt = opt || {};

        var div = $j('<div id="d' + id + '"/>').addClass('content'),
            table = $j('<table id="grid' + id + '"/>').addClass('grid').html('<tr><td/></tr>'),
            result;

        if (opt.fl) { div.css('float', opt.fl); }

        result = div.html(table);
        if (opt.pager) result.append($j('<div id="pager' + id + '"/>'));
        return result.prop('outerHTML');
    };

    function getGridData(gridid, idcol) {
        var grid = $j(gridid),
            gdata = grid.jqGrid('getRowData');
        idcol = idcol || 'id';

        // Daten bereinigen (<input>)
        $j.each(gdata, function (idx, row) {
            $j.each(row, function (field, val) {
                if (!val || val.indexOf("input") != -1) {
                    gdata[idx][field] = $j("#" + row[idcol] + "_" + field).val();
                }
            });
        });

        return gdata;
    }

    // zur Anzeige der Menüpunkte
    kt.login = { login: true, logout: true };

    /**********************************************************************************************
    * Tipps
    */
    kt.Tipps = kt.Tipps || {};
    $j.extend(kt.Tipps, {
        Uebersicht: function () {
            var id = 'TippsUebersicht',
            //gridid = "#grid" + id,
                table, events;

            table = makeTable(id);
            setContent(table);

            events = {
                OnResize: function () {
                    //return;
                    //console.log(jQuery.browser);
                    //if (jQuery.browser.safari) return;
                    //return;
                    //console.log('LC');
                    $j('th[id*="_t"]').each(function () {
                        var el = $j(this),
                            eln = $j(this).next(),
                            elhdr = el.find('div'),
                            w = el.width(),
                            wn = eln.width();

                        el.css('border-color', 'transparent').css('overflow', 'visible');
                        elhdr.width(w + wn + 2); //.css('overflow', 'visible');
                    });
                }
            };

            kt.autoGrid(id, 'Tipp-Übersicht', { events: events });
        },
        Tippabgabe: function () {
            var id = 'TippsTippabgabe',
                idi = 'TippsInfo',
                gridid = "#grid" + id,
                table,
                btn,
                events,
                lastSel;

            table = makeTable(id, { pager: false, fl: true });
            table += $j('<div/>').attr('id', idi).css('float', 'left').prop('outerHTML');
            setContent(table);

            btn = [
            //{ caption: '', buttonicon: "none", position: "last" },
            //{ caption: '-', position: "last" },
                {
                caption: "Speichern",
                title: "",
                buttonicon: "icon-disk",
                tbar: "tb_",
                onClickButton: function () {
                    // Griddaten speichern
                    var gdata = getGridData(gridid);

                    // Daten speichern
                    $j.ajax({
                        url: "php/saveTipps.php",
                        data: { data: gdata, trid: kt.trid, md: kt.md },
                        contentType: "application/x-www-form-urlencoded",
                        async: false,
                        success: function (data) {
                            var res = data.d || data;
                            if (res.ok) {
                                if (res.message) showStatus(res.message, 5);
                            } else {
                                if (res.message) showError(res.message, 5);
                            }
                            $j(gridid).trigger('refresh');
                            return false;
                        } // end success
                    }); // -- End AJAX Call --
                },
                position: "last"
            }];

            events = {
                afterLoadComplete: function (data) {
                    // Deadline setzen
                    var rows = data.d || data;
                    if (rows) rows = rows.rows;
                    //console.log(rows[0].deadline);
                    if (rows[0].deadline) {
                        var tbar = $j("#tb_grid" + id),
                            tbd = $j("<td></td>").html('Tippabgabe bis <span class="deadline">' + rows[0].deadline + '</span>'),
                            findnav = tbar.children('table');

                        if ($j(findnav).find('td').length === 0) { $j("tr", findnav).append(tbd); }
                        else { $j("tr td:eq(0)", findnav).before(tbd); }
                    }

                    $j(gridid + ' :input').focus(function () {
                        // Zeile selektieren, wenn Eingabebox aktiviert wird
                        var rid = $j(this).attr('id').replace(/_Tip/g, '');
                        $j(gridid).jqGrid('setSelection', rid);
                    });

                    // MA 23.08.2012 Tab-Handling, erlaubte Zeichen
                    $j(gridid + ' :input').bind("keypress", function (e) {
                        //console.log(e, e.keyCode, e.which, this);
                        if (e.keyCode === 9) return true; // Tab
                        if (e.keyCode === 8) return true; // BkSp
                        if (e.keyCode === 46) return true; // Entf
                        if (e.keyCode === 38) {
                            nextInput(this, gridid, -1);
                            return false;
                        } // Cursor hoch
                        if (e.keyCode === 40) {
                            nextInput(this, gridid);
                            return false;
                        } // Cursor runter
                        if (e.keyCode >= 37 && e.keyCode <= 40) return true; // Cursor
                        if (e.which === 58) return true; // :
                        if (e.which === 13) {
                            nextInput(this, gridid);
                            return false;
                        } // Enter
                        if (e.which < 48 || e.which > 57) return false; // 0-9
                        return true;
                    });

                    getTippInfo(0, gridid, idi);
                },
                onSelectRow: function (rid) {
                    if (rid && rid !== lastSel) {
                        getTippInfo(rid, gridid, idi);
                        lastSel = rid;
                    }
                }
            };

            kt.autoGrid(id, 'Tippabgabe', {
                editable: true,
                toolbar: [true, 'both'],
                events: events,
                btn: btn
            });
        },
        Gesamtstand: function () {
            var id = 'TippsGesamtstand',
                table;

            table = makeTable(id);
            setContent(table);
            kt.autoGrid(id, 'Gesamtstand');
        }
    });

    function getTippInfo(rid, gridid, destid) {
        var gdata = getGridData(gridid, 'sid'),
            row,
            param = {};

        $j.each(gdata, function (idx, val) { if (val.sid == rid) row = val; });

        if (row) param = { tidH: row.tidH, tidA: row.tidA };

        $j.ajax({
            url: "php/getTippInfo.php",
            data: param,
            contentType: "application/x-www-form-urlencoded",
            success: function (data) {
                var res = data.d || data;
                if (res.ok && res.html) $j('#' + destid).html(res.html);
                return false;
            } // end success
        }); // -- End AJAX Call --
    }

    function nextInput(el, gridid, step) {
        var input = $j(gridid + ' :input'),
            idx = input.index(el);

        step = step || 1;
        idx += step;
        if (idx >= input.length) idx = 0;
        if (idx < 0) idx = input.length - 1;
        input[idx].focus();
    }

    /**********************************************************************************************
    * Liga
    */
    kt.Liga = kt.Liga || {};
    $j.extend(kt.Liga, {
        Tabellen: function () {
            var id = 'LigaTabelle',
                table = [],
                rnd = trdata()[kt.trid].Ligen,
                i, opt;

            for (i = 1; i <= rnd; i++) { table.push(makeTable(id + i, { fl: 'left' })); }
            setContent(table.join('')); // + _cf); //'<br/>'));

            for (i = 1; i <= rnd; i++) {
                opt = {
                    url: 'php/Get' + id + 'Data.php',
                    addparam: { lnr: i }
                };
                kt.autoGrid(id + i, 'Tabelle Liga ' + i, opt);
            }
        },
        Spielplan: function () {
            var id = 'LigaSpielplan',
                table = [],
                rnd = trdata()[kt.trid].Ligen,
                i, opt;

            for (i = 1; i <= rnd; i++) { table.push(makeTable(id + i, { fl: 'left' })); }
            setContent(table.join('')); //'<br/>'));

            for (i = 1; i <= rnd; i++) {
                opt = {
                    url: 'php/Get' + id + 'Data.php',
                    addparam: { lnr: i },
                    hideempty: true
                };
                kt.autoGrid(id + i, 'Spielplan Liga ' + i, opt);
            }
        }
    });

    /**********************************************************************************************
    * Praemien
    */
    kt.Praemien = kt.Praemien || {};
    $j.extend(kt.Praemien, {
        Uebersicht: function () {
            var id = 'PraemienUebersicht',
                table;

            table = makeTable(id);
            setContent(table);
            kt.autoGrid(id, 'Prämien aktuell');
        },
        Info: function () {
            var id = 'PraemienInfo',
                idsum = 'PraemienZusammenfassung',
                gridid = "#grid" + id,
                table, btn, opt, rnd, events;

            table = makeTable(id, { fl: 'left' });
            table += makeTable(idsum, { fl: 'left' });
            setContent(table);

            btn = [{
                caption: 'Wertungsrunde:',
                select: true,
                url: 'php/getRndList.php',
                selkey: 'rnd',
                seldisp: 'Name',
                tbar: 't_',
                id: 'selrnd',
                onChange: function (e) {
                    if (e.target) {
                        rnd = $j(e.target).val();
                        opt.btn[0].selval = rnd;
                        $j(gridid).trigger('refresh', { rnd: rnd }, opt);
                    }
                }
            }];

            events = {
                afterLoadComplete: function (data) {
                    createSummary(idsum, data);
                }
            };

            opt = {
                toolbar: [true, 'top'],
                btn: btn,
                events: events
            };

            kt.autoGrid(id, '', opt);
        }
    });

    function createSummary(id, griddata) {

        var gridid = "#grid" + id,
            cfg, colModel, i,
            gdata = [],
            rndinfo = griddata.userdata || {},
            data = griddata.rows || {};

        colModel = [
            { label: ' ', name: 'c1', width: 150, sortable: false, formatter: 'html', summaryType: 'count', summaryTpl: 'Summe' },
            { label: ' ', name: 'c2', width: 150, sortable: false, align: 'right' },
            { label: ' ', name: 'c3', width: 150, sortable: false, align: 'right', formatter: 'currency', summaryType: 'sum' },
            { name: 'grp' }
        ];

        var stotal = 0.0,
            smatch = 0.0,
            sleague = {};
        for (i = 1; i <= rndinfo.LCount; i++) sleague[i] = 0.0;

        $j.each(data, function (key, val) {
            if (key > 0) {
                if (val.Total) stotal += parseFloat(val.Total);
                if (val.Match) smatch += parseFloat(val.Match);
                for (i = 1; i <= rndinfo.LCount; i++) if (val['L' + i]) sleague[i] += parseFloat(val['L' + i]);
            }
        });

        var fmt = { decimalPlaces: 2, decimalSeparator: ',', suffix: ' €' },
            cnt = rndinfo.MemberCount || 0,
            euro = data[0].Total || 0,
            sumE = cnt * euro,
            sumA;

        gdata.push({ c1: 'Grundbetrag', c2: cnt + ' * ' + $j.fmatter.util.NumberFormat(euro, fmt), c3: cnt * euro, grp: 'Einnahmen' });
        for (i = 1; i <= rndinfo.LCount; i++) {
            cnt = rndinfo.LMembers[i] || 0;
            euro = data[0]['L' + i] || 0;
            sumE += cnt * euro;
            gdata.push({ c1: 'Liga ' + i, c2: cnt + ' * ' + $j.fmatter.util.NumberFormat(euro, fmt), c3: cnt * euro, grp: 'Einnahmen' });
        }
        cnt = rndinfo.MDCount || 0;
        euro = smatch;
        sumA = cnt * euro;
        gdata.push({ c1: 'Tageswertung', c2: cnt + ' * ' + $j.fmatter.util.NumberFormat(euro, fmt), c3: cnt * euro, grp: 'Ausgaben' });
        sumA += stotal;
        gdata.push({ c1: 'Gesamtwertung', c3: stotal, grp: 'Ausgaben' });
        for (i = 1; i <= rndinfo.LCount; i++) {
            sumA += sleague[i];
            gdata.push({ c1: 'Liga ' + i, c3: sleague[i], grp: 'Ausgaben' });
        }

        cfg = {
            datatype: 'local',
            data: gdata,
            rowNum: gdata.length,
            gridview: true,
            colModel: colModel,
            caption: 'Zusammenfassung',
            width: 450,
            autowidth: false,
            grouping: true,
            footerrow: true,
            userDataOnFooter: true,
            userData: { c1: 'Differenz', c3: sumE - sumA },
            groupingView: {
                groupField: ['grp'],
                groupOrder: ['desc'],
                groupColumnShow: [false],
                groupDataSorted: false,
                groupSummary: [true]
            }
        };
        // Grid neu erstellen
        $j(gridid).jqGrid('GridUnload');
        $j(gridid).jqGrid(cfg);
        $j(gridid).sortGrid('grp', true, 'desc');
    }

    /**********************************************************************************************
    * Spielplan
    */
    kt.Spielplan = kt.Spielplan || {};
    $j.extend(kt.Spielplan, {
        Spielplan: function () {
            var id = 'Spielplan',
                table;

            table = makeTable(id);
            setContent(table);
            kt.autoGrid(id, 'Spielplan');
        },
        Tabelle: function () {
            var id = 'Tabelle',
                gridid = "#grid" + id,
                table, opt;

            table = makeTable(id);
            setContent(table);

            var btn = [
                {
                    caption: "Gesamt",
                    title: "",
                    buttonicon: "none",
                    onClickButton: function () { $j(gridid).trigger('refresh', { mode: 't' }); },
                    position: "last",
                    tbar: "tb_"
                },
            //{ caption: '-' },
                {
                caption: "Heim",
                title: "",
                buttonicon: "none",
                onClickButton: function () { $j(gridid).trigger('refresh', { mode: 'h' }); },
                position: "last",
                tbar: "tb_"
            },
            //{ caption: '-' },
                {
                caption: "Auswärts",
                title: "",
                buttonicon: "none",
                onClickButton: function () { $j(gridid).trigger('refresh', { mode: 'a' }); },
                position: "last",
                tbar: "tb_"
            }];

            opt = {
                toolbar: [true, 'both'],
                btn: btn
            };

            kt.autoGrid(id, 'Tabelle', opt);
        }
    });

    /**********************************************************************************************
    * Stat
    */
    kt.Stat = kt.Stat || {};
    $j.extend(kt.Stat, {
        TippAnzahl: function () {
            var id = 'StatTippanzahl',
                gridid = "#grid" + id,
                idc = 'ChartTippanzahl',
                table, //chart,
                btn, opt;

            table = makeTable(id, { fl: 'left' });
            table += $j('<div/>').attr('id', idc).css('float', 'left').prop('outerHTML');
            setContent(table);

            btn = [
                {
                    caption: ' ',
                    select: true,
                    url: 'php/getTrList.php',
                    selkey: 'trid',
                    seldisp: 'Name',
                    tbar: 't_',
                    id: 'seltr',
                    onChange: function (e) {
                        if (e.target) {
                            var tr = $j(e.target).val();
                            opt.btn[0].selval = tr;
                            $j(gridid).trigger('refresh', { trid_s: tr }, opt);
                            $j('#' + idc).html('');
                        }
                    }
                },
                {
                    caption: "Diagramm",
                    title: "",
                    buttonicon: "ui-icon-image",
                    onClickButton: function () {
                        var gdata = getGridData(gridid),
                            s = { width: 600, height: 450 };
                        fitPage(s);
                        //console.log(s);
                        createPieChart(
                            { size: s, xcol: 'Tipp', ycol: 'Anzahl', data: gdata, renderto: idc },
                            { caption: 'Tipphäufigkeit', xAxisName: 'Tipp', yAxisName: 'Anzahl', showNames: '1', decimalPrecision: '0' }
                        );

                        //                        console.log($j('#'+idc).offset().top);

                        // $j('html,body').animate({ scrollTop: $j('#' + idc).offset().top }, 1000);
                    },
                    //position: "last",
                    tbar: "t_"
                }];

            opt = { btn: btn };

            kt.autoGrid(id, 'Tipphäufigkeit', opt);
        },
        TabPlatz: function () {
            var idc1 = 'ChartGesamt',
                idc2 = 'ChartLiga',
                table,
                s = { width: 800, height: 400 };

            table = $j('<div/>').attr('id', idc1).css('float', 'left').prop('outerHTML');
            table += $j('<div/>').attr('id', idc2).css('float', 'left').prop('outerHTML');
            setContent(table);

            fitPage(s);

            createCombiChart({ size: s, renderto: idc1, url: "php/GetStatPlace.php", param: { trid: kt.trid, md: kt.md} });
            createCombiChart({ size: s, renderto: idc2, url: "php/GetStatPlaceLeague.php", param: { trid: kt.trid, md: kt.md} });
        },
        LigaEwig: function () {
            var id = 'LigaTabelleGesamt',
                table = [],
            //rnd = trdata()[kt.trid].Ligen, TODO
                rnd = 1,
                i, opt;

            for (i = 1; i <= rnd; i++) { table.push(makeTable(id + i, { fl: 'left' })); }
            setContent(table.join('')); // + _cf); //'<br/>'));

            for (i = 1; i <= rnd; i++) {
                opt = {
                    url: 'php/Get' + id + 'Data.php',
                    addparam: { lnr: i }
                };
                kt.autoGrid(id + i, 'ewige Tabelle Liga ' + i, opt);
            }
        },
        TippEwig: function () {
            var id = 'StatGesamtstand',
                table;

            table = makeTable(id);
            setContent(table);
            kt.autoGrid(id, 'Gesamtstand');
        },
        TippTabelle: function () {
            var id = ['TippTabelle', 'Tabelle'],
                lbl = ['Tipp-Tabelle', 'reale Tabelle'],
                table = '',
                btn;

            $j.each(id, function (idx, val) { table += makeTable(val, { fl: 'left' }); });
            setContent(table);

            $j.each(id, function (idx, val) {
                var gridid = "#grid" + val;
                btn = [
                    {
                        caption: "Gesamt",
                        title: "",
                        buttonicon: "none",
                        onClickButton: function () { $j(gridid).trigger('refresh', { mode: 't' }); },
                        position: "last",
                        tbar: "tb_"
                    },
                    {
                        caption: "Heim",
                        title: "",
                        buttonicon: "none",
                        onClickButton: function () { $j(gridid).trigger('refresh', { mode: 'h' }); },
                        position: "last",
                        tbar: "tb_"
                    },
                    {
                        caption: "Auswärts",
                        title: "",
                        buttonicon: "none",
                        onClickButton: function () { $j(gridid).trigger('refresh', { mode: 'a' }); },
                        position: "last",
                        tbar: "tb_"
                    }];

                kt.autoGrid(val, lbl[idx], { toolbar: [true, 'both'], btn: btn });
            }); // each
        }
    });

    function createPieChart(chartopt, dataopt) {

        $j.getScript('chart/FusionCharts.js', function () {
            var chart, dataxml;

            dataopt = $j.extend({
                formatNumberScale: '0',
                decimalSeparator: ',',
                thousandSeparator: '.'
            }, dataopt);

            //chart = new FusionCharts("chart/FCF_Pie2D.swf", chartopt.id || {}, chartopt.width, chartopt.height);
            chart = new FusionCharts("chart/Pie2D.swf", chartopt.id || "Chart", chartopt.size.width, chartopt.size.height);

            // Chart-Optionen
            dataxml = $j('<chart/>'); // graph
            $j.each(dataopt, function (key, val) { dataxml.attr(key, val); });

            // Daten
            var d = '';
            $j.each(chartopt.data, function (key, val) {
                /*var d = $j('<set/>')
                .attr('name', val[chartopt.xcol])
                .attr('value', val[chartopt.ycol]);
                dataxml.append(d);*/
                d += "<set label='" + val[chartopt.xcol] + "' value='" + val[chartopt.ycol] + "'/>";
            });
            //console.log(dataxml.prop('outerHTML'));
            //chart.setDataXML(dataxml.prop('outerHTML'));
            //dataxml = "<chart caption='xxx' xAxisName='Tipp' yAxisName='Anzahl' formatNumberScale='0' decimalSeparator=',' thousandSeparator='.'><set label='123' value='22'><set/></chart>";
            dataxml.text('DATA');
            dataxml = dataxml.prop('outerHTML');
            dataxml = dataxml.replace(/\"/g, '\'');
            dataxml = dataxml.replace(/DATA/, d);
            //console.log(dataxml);
            chart.setDataXML(dataxml);

            // Anzeige
            chart.render(chartopt.renderto);
            //console.log(dataxml);
        });
    }

    function createCombiChart(chartopt) {

        $j.getScript('chart/FusionCharts.js', function () {
            var chart;

            chart = new FusionCharts("chart/MSCombiDY2D.swf", chartopt.id || "Chart", chartopt.size.width, chartopt.size.height);
            // Daten
            $j.ajax({
                url: chartopt.url,
                data: chartopt.param,
                contentType: "application/x-www-form-urlencoded",
                success: function (data) {
                    var res = data.d || data;
                    if (res.ok) {
                        if (res.message) showStatus(res.message, 5);
                        chart.setDataXML(res.chart);
                        // Anzeige
                        chart.render(chartopt.renderto);
                    } else {
                        if (res.message) showError(res.message, 5);
                    }
                    return false;
                } // end success
            }); // -- End AJAX Call --
        });
    }

    function fitPage(s) {
        //console.log(screen.availWidth);
        //console.log($j('#nav').width());
        var maxw = $j('#nav').width(),
            f;
        if (s.width < maxw) return;
        f = s.width / s.height;

        s.width = maxw;
        s.height = s.width / f;
    }

    /**********************************************************************************************
    * Admin
    */

    kt.Admin = kt.Admin || {};

    $j.extend(kt.Admin, {
        Spielplan: function () {
            var id = 'Spielplan',
                gridid = "#grid" + id,
                table, opt, btn;

            table = makeTable(id);
            setContent(table);

            btn = [
                {
                    caption: "Speichern",
                    title: "",
                    buttonicon: "icon-disk",
                    tbar: "tb_",
                    onClickButton: function () {
                        // Griddaten speichern
                        var gdata = getGridData(gridid, 'sid');

                        // Daten speichern
                        $j.ajax({
                            url: "php/saveSpielplan.php",
                            data: { data: gdata, trid: kt.trid, md: kt.md },
                            contentType: "application/x-www-form-urlencoded",
                            async: false,
                            success: function (data) {
                                var res = data.d || data;
                                if (res.ok) {
                                    if (res.message) showStatus(res.message, 5);
                                } else {
                                    if (res.message) showError(res.message, 5);
                                }
                                $j(gridid).trigger('refresh');
                                return false;
                            } // end success
                        }); // -- End AJAX Call --
                    },
                    position: "last"
                }];

            opt = {
                toolbar: [true, 'both'],
                editable: true,
                addparam: { edit: true },
                btn: btn
            };

            kt.autoGrid(id, 'Spielplan/Ergebnisse', opt);
        },
        Tipps: function () {
            var id = 'TippsAdmin',
                gridid = "#grid" + id,
                table, opt, btn;

            table = makeTable(id, { pager: false, fl: true });
            setContent(table);

            btn = [
                {
                    caption: 'Teilnehmer:',
                    select: true,
                    url: 'php/getTnList.php',
                    param: { trid: kt.trid, md: kt.md },
                    selkey: 'tnid',
                    seldisp: 'Name',
                    tbar: 't_',
                    id: 'seltn',
                    onChange: function (e) {
                        if (e.target) {
                            var tnid = $j(e.target).val();
                            opt.btn[0].selval = tnid;
                            $j(gridid).trigger('refresh', { tnid: tnid }, opt);
                        }
                    }
                },
                {
                    caption: 'Kommentar:',
                    tbar: 'tb_',
                    input: true,
                    id: 'tbcomment',
                    width: '400px'
                },
                {
                    caption: "Speichern",
                    title: "",
                    buttonicon: "icon-disk",
                    tbar: 'tb_',
                    onClickButton: function () {
                        // Griddaten speichern
                        var gdata = getGridData(gridid);
                        // Daten speichern
                        $j.ajax({
                            url: "php/saveTippsAdmin.php",
                            data: { data: gdata, trid: kt.trid, md: kt.md, comment: $j('tbcomment').val() },
                            contentType: "application/x-www-form-urlencoded",
                            async: false,
                            success: function (data) {
                                var res = data.d || data;
                                if (res.ok) {
                                    if (res.message) showStatus(res.message, 5);
                                } else {
                                    if (res.message) showError(res.message, 5);
                                }
                                $j(gridid).trigger('refresh');
                                return false;
                            } // end success
                        }); // -- End AJAX Call --
                    },
                    position: "last"
                }];

            opt = {
                editable: true,
                hideprint: true,
                btn: btn,
                toolbar: [true, 'both']
            };

            kt.autoGrid(id, 'Tipps ändern', opt);
        },
        Benutzer: function () {
            var id = 'Benutzer',
                gridid = "#grid" + id,
                table, opt, events, lastSel;

            table = makeTable(id, { pager: true });
            setContent(table);

            events = {
                onSelectRow: function (rid) {
                    if (rid && rid !== lastSel) {
                        $j(gridid).restoreRow(lastSel);
                        lastSel = rid;
                    }
                    $j(gridid).jqGrid('editRow', rid, true);
                    $j(gridid + "_ilsave").removeClass('ui-state-disabled');
                    $j(gridid + "_ilcancel").removeClass('ui-state-disabled');
                    $j(gridid + "_iladd").addClass('ui-state-disabled');
                    $j(gridid + "_iledit").addClass('ui-state-disabled');
                }
            };

            opt = {
                editable: true,
                inlineedit: true,
                inlineopt: { edit: false, add: false, del: true, search: false, refresh: false },
                addparam: { mode: 'all' },
                events: events
            };

            kt.autoGrid(id, 'Benutzerliste', opt);
        },
        Profil: function () {
            var id = 'Benutzer',
                gridid = "#grid" + id,
                table, opt, events, lastSel;

            table = makeTable(id, { pager: true });
            setContent(table);

            events = {
                onSelectRow: function (rid) {
                    if (id && id !== lastSel) {
                        $j(gridid).restoreRow(lastSel);
                        lastSel = id;
                    }
                    $j(gridid).jqGrid('editRow', rid, true);
                    $j(gridid + "_ilsave").removeClass('ui-state-disabled');
                    $j(gridid + "_ilcancel").removeClass('ui-state-disabled');
                    $j(gridid + "_iladd").addClass('ui-state-disabled');
                    $j(gridid + "_iledit").addClass('ui-state-disabled');
                },
                afterLoadComplete: function () {
                    setTimeout('jQuery("' + gridid + '_iladd").hide();', 100);
                }
            };

            opt = {
                editable: true,
                inlineedit: true,
                //inlineopt: { edit: false, add: false, del: true, search: false, refresh: false },
                events: events
            };

            kt.autoGrid(id, 'Benutzerprofil', opt);
        },
        Liga: function () {
            var id = 'LigaTeilnehmer',
                table = [],
                gridids = [],
                rnd = trdata()[kt.trid].Ligen,
                i, opt, events, dndopts, btn;

            for (i = 0; i <= rnd; i++) {
                table.push(makeTable(id + i, { fl: 'left', pager: true }));
                gridids.push('#grid' + id + i);
            }
            setContent(table.join(''));

            dndopts = {
                connectWith: gridids.join(),
                beforedrop: function (e, u, data, src, dest) {
                    var gid = dest.attr('id');
                    data.League = gid.substr(gid.length - 1, 1);
                    return data;
                }
            };

            events = { afterLoadComplete: function () { /* Drag&Drop */$j(this).jqGrid('gridDnD', dndopts); } };

            for (i = 1; i <= rnd; i++) {
                opt = {
                    hideprint: true,
                    toolbar: [true, 'both'],
                    url: 'php/Get' + id + 'Data.php',
                    addparam: { lnr: i },
                    events: events,
                    rowcount: true,
                    editable: true,
                    btn: [{
                        caption: 'Spielplan erstellen',
                        id: "bcreate" + i,
                        lnr: i,
                        buttonicon: "icon-start",
                        tbar: 't_',
                        onClickButton: function () { createSchedule(this.lnr, gridids[this.lnr]); }
                    }]
                };

                kt.autoGrid(id + i, 'Liga ' + i, opt);
            }

            btn = [
                {
                    caption: 'Runde:',
                    select: true,
                    url: 'php/getRndList.php',
                    selkey: 'rnd',
                    seldisp: 'Name',
                    tbar: 't_',
                    id: 'selrnd',
                    onChange: function (e) {
                        if (e.target) {
                            rnd = $j(e.target).val();
                            if (opt.btn) {
                                opt.btn[0].selval = rnd;
                                $j('table[id^="grid' + id + '"]').trigger('refresh', { rnd: rnd }, opt);
                            }
                        }
                    }
                }, {
                    caption: 'Speichern',
                    buttonicon: "icon-disk",
                    tbar: 'tb_',
                    onClickButton: function () {
                        var gdata = [];
                        // Daten aus allen Grids ermitteln

                        $j.each(gridids, function (gidx, gid) {
                            var data = getGridData(gid, 'tnid');
                            $j.each(data, function (idx, row) { gdata.push(row); });
                        });

                        // Daten speichern
                        $j.ajax({
                            url: "php/saveLigaTeilnehmer.php",
                            data: { data: gdata, trid: kt.trid },
                            contentType: "application/x-www-form-urlencoded",
                            async: false,
                            success: function (data) {
                                var res = data.d || data;
                                if (res.ok) {
                                    if (res.message) showStatus(res.message, 5);
                                } else {
                                    if (res.message) showError(res.message, 5);
                                }
                                $j.each(gridids, function (gidx, gid) { $j(gid).trigger('refresh'); });
                                return false;
                            } // end success
                        }); // -- End AJAX Call --
                    }
                }
            ];
            opt = {
                url: 'php/Get' + id + 'Data.php',
                addparam: { lnr: 0 },
                toolbar: [true, 'both'],
                hideprint: true,
                btn: btn,
                events: events,
                rowcount: true
            };
            kt.autoGrid(id + '0', 'nicht zugewiesen', opt);

        },
        Tipprunden: function () {
            var id = 'Tipprunden',
                gridid = "#grid" + id,
                table, opt, events, lastSel;

            table = makeTable(id, { pager: true });
            setContent(table);

            events = {
                onSelectRow: function (rid) {
                    if (id && id !== lastSel) {
                        $j(gridid).restoreRow(lastSel);
                        lastSel = id;
                    }
                    $j(gridid).jqGrid('editRow', rid, true);
                    $j(gridid + "_ilsave").removeClass('ui-state-disabled');
                    $j(gridid + "_ilcancel").removeClass('ui-state-disabled');
                    $j(gridid + "_iladd").addClass('ui-state-disabled');
                    $j(gridid + "_iledit").addClass('ui-state-disabled');
                }
            };

            opt = {
                editable: true,
                inlineedit: true,
                inlineopt: { edit: false, add: false, del: true, search: false, refresh: false },
                addparam: { mode: 'all' },
                events: events
            };

            kt.autoGrid(id, 'Tipprunden', opt);
        },
        Praemien: function () {
            var id = 'PraemienInfo',
                idsum = 'PraemienZusammenfassung',
                gridid = "#grid" + id,
                table, btn, opt,
                rnd = 1,
                events;

            table = makeTable(id, { fl: 'left' });
            table += makeTable(idsum, { fl: 'left' });
            setContent(table);

            btn = [
                {
                    caption: 'Wertungsrunde:',
                    select: true,
                    url: 'php/getRndList.php',
                    selkey: 'rnd',
                    seldisp: 'Name',
                    tbar: 't_',
                    id: 'selrnd',
                    onChange: function (e) {
                        if (e.target) {
                            rnd = $j(e.target).val();
                            opt.btn[0].selval = rnd;
                            $j(gridid).trigger('refresh', { rnd: rnd }, opt);
                        }
                    }
                }, {
                    caption: "Speichern",
                    tbar: 't_',
                    buttonicon: "icon-disk",
                    onClickButton: function () {
                        // Griddaten speichern
                        var gdata = getGridData(gridid, 'idx');

                        // Daten speichern
                        $j.ajax({
                            url: "php/savePraemien.php",
                            data: { data: gdata, trid: kt.trid, rnd: rnd },
                            contentType: "application/x-www-form-urlencoded",
                            async: false,
                            success: function (data) {
                                var res = data.d || data;
                                if (res.ok) {
                                    if (res.message) showStatus(res.message, 5);
                                } else {
                                    if (res.message) showError(res.message, 5);
                                }
                                $j(gridid).trigger('refresh');
                                return false;
                            } // end success
                        }); // -- End AJAX Call --
                    },
                    position: "last"
                }];

            events = {
                afterLoadComplete: function (data) {
                    createSummary(idsum, data);
                    $j(gridid + ' :input').change(function () {
                        // beim Ändern einer Zelle Zusammenfassung aktualisieren
                        var d = data,
                            gdata = getGridData(gridid, 'idx');

                        $j.each(gdata, function (idx, val) {
                            d.rows[idx] = val;
                        });
                        createSummary(idsum, d);
                    });
                }
            };

            opt = {
                toolbar: [true, 'top'],
                btn: btn,
                events: events,
                editable: true,
                addparam: { edit: true },
                hideprint: true
            };

            kt.autoGrid(id, '', opt);
        },
        importSP: function () {
            var id = 'SpielplanImport',
                idout = 'SpielplanAusgabe',
                table,
                btn,
                tr;

            btn = [
            // Spielplan anzeigen
                {
                title: 'Spielplan anzeigen',
                id: 'bShow',
                onClickButton: function () {
                    $j.ajax({
                        url: "php/getDFBSpielplan.php",
                        data: { trid: tr },
                        contentType: "application/x-www-form-urlencoded",
                        success: function (data) {
                            var res = data.d || data;
                            if (res.ok && res.html) $j('#' + idout).html(res.html);
                            return false;
                        } // end success
                    }); // -- End AJAX Call --
                }
            },
            // Vorschau anzeigen
                {
                title: 'Vorschau anzeigen',
                id: 'bPreview',
                onClickButton: function () {
                    $j.ajax({
                        url: "php/getDFBSpielplan.php",
                        data: { trid: tr, mode: 'preview' },
                        contentType: "application/x-www-form-urlencoded",
                        success: function (data) {
                            var res = data.d || data;
                            if (res.ok && res.html) $j('#' + idout).html(res.html);
                            return false;
                        } // end success
                    }); // -- End AJAX Call --
                }
            },
            // Importieren
                {
                title: 'Importieren',
                id: 'bImport',
                onClickButton: function () {
                    $j.ajax({
                        url: "php/getDFBSpielplan.php",
                        data: { trid: tr, mode: 'create' },
                        contentType: "application/x-www-form-urlencoded",
                        success: function (data) {
                            var res = data.d || data;
                            if (res.ok && res.html) $j('#' + idout).html(res.html);
                            return false;
                        } // end success
                    }); // -- End AJAX Call --
                }
            },
            // Zeiten aktualisieren
                {
                title: 'Zeiten aktualisieren',
                id: 'bUpdate',
                onClickButton: function () {
                    $j.ajax({
                        url: "php/getDFBSpielplan.php",
                        data: { trid: tr, mode: 'update' },
                        contentType: "application/x-www-form-urlencoded",
                        success: function (data) {
                            var res = data.d || data;
                            if (res.ok && res.html) $j('#' + idout).html(res.html);
                            return false;
                        } // end success
                    }); // -- End AJAX Call --
                }
            }
            ];

            table = $j('<div/>').attr('id', id);
            setContent(table.prop('outerHTML'));
            table = $j('<div/>').attr('id', idout);
            setContent(table.prop('outerHTML'), true);

            table = $j('#' + id);
            var sel = createSelect({
                url: 'php/getTrList.php',
                selkey: 'trid',
                seldisp: 'Name',
                id: 'seltr',
                onChange: function (e) { if (e.target) { tr = $j(e.target).val(); } }
            });
            sel.css('float', 'none');
            sel.addClass('shadow');
            table.append(sel);
            tr = sel.val();
            // Buttons
            $j.each(btn, function (idx, cfg) {
                var b = $j('<button></button>');
                b.attr('value', cfg.title);
                b.css('margin-left', '15px');
                b.append(cfg.title);
                b.addClass('button shadow');
                if (cfg.id) b.attr('id', cfg.id);
                if (cfg.id) b.attr('name', cfg.id);
                b.click(function (e) {
                    if ($j.isFunction(cfg.onClickButton)) { cfg.onClickButton(e); }
                    return false;
                });
                table.append(b);
            });
        }
    });

    function createSchedule(lnr, gridid) {
        var gdata = $j(gridid).jqGrid('getRowData');
        // Daten bereinigen (<input>)
        $j.each(gdata, function (idx, row) {
            $j.each(row, function (field, val) {
                if (val.indexOf("input") != -1) { gdata[idx][field] = $j("#" + row.tnid + "_" + field).val(); }
            });
        });
        if (gdata.length != 18) {
            showError('Es müssen genau 18 Teilnehmer in der Liga sein!', 5);
            return false;
        }

        $j.ajax({
            url: "php/createLigaSpielplan.php",
            data: { data: gdata, trid: kt.trid, rnd: gdata[0].rnd, lnr: lnr },
            contentType: "application/x-www-form-urlencoded",
            async: false,
            success: function (data) {
                var res = data.d || data;
                if (res.ok) {
                    if (res.message) showStatus(res.message, 5);
                } else {
                    if (res.message) showError(res.message, 5);
                }
            } // end success
        }); // -- End AJAX Call --

        return true;
    }

} (window.kt = window.kt || {}, jQuery));