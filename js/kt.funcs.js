(function (kt, $j) /*, undefined)*/{

    function makeTable(id, opt) {
        opt = opt || {};

        var div = $j('<div id="d' + id + '"/>').addClass('ktgrid'), //.addClass('content'),
            table = $j('<table id="grid' + id + '"/>').addClass('grid').html('<tr><td/></tr>'),
            result;

        if (opt.fl) { div.css('float', opt.fl); }
        if (opt.cls) { div.addClass(opt.cls); } // MA 04.01.2017

        result = div.html(table);
        if (opt.pager) result.append($j('<div id="pager' + id + '"/>'));
        return result.prop('outerHTML');
    };

    // Fuer kt.charts.js verfuegbar machen
    kt.makeTable = makeTable;

    // Admin: Ergebnisse-abrufen-Button (wiederverwendbar)
    function fetchResultsBtn(afterFetch) {
        return {
            caption: "Ergebnisse abrufen",
            buttonicon: "none",
            tbar: "tb_",
            onClickButton: function () {
                $j.ajax({
                    url: "php/getDFBErgebnisse.php",
                    data: { trid: kt.trid, md: kt.md },
                    contentType: "application/x-www-form-urlencoded",
                    success: function (data) {
                        var res = data.d || data;
                        if (res.ok) {
                            var count = res.data ? res.data.length : 0;
                            showMessage({ ok: true, message: count + ' Ergebnis(se) abgerufen' }, 3);
                            if (afterFetch) afterFetch(res);
                        } else {
                            showMessage(res, 5);
                        }
                    }
                });
            },
            position: "last"
        };
    }
    function isAdmin() { return $j('#mainmenu a[id*="Admin"]').length > 0; }

    function getGridData(gridid, idcol) {
        var grid = $j(gridid),
            gdata = grid.jqGrid('getRowData');
        idcol = idcol || 'id';

        // Daten bereinigen (<input>)
        $j.each(gdata, function (idx, row) {
            $j.each(row, function (field, val) {
                if (typeof val === 'string' && (!val || val.indexOf("input") != -1 || val.indexOf("INPUT") != -1)) {
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

            var opt = { events: events };
            if (isAdmin()) {
                opt.btn = [fetchResultsBtn(function() { $j('#grid' + id).trigger('refresh'); })];
                opt.toolbar = [true, 'top'];
            }
            kt.autoGrid(id, 'Tipp-Übersicht', opt);
        },
        Tippabgabe: function () {
            var id = 'TippsTippabgabe',
                idi = 'TippsInfo',
                gridid = "#grid" + id,
                table,
                btn,
                events,
                lastSel;

            table = makeTable(id, { pager: false, fl: true, cls: 'col-lg-7 col-md-7 col-xs-12' });
            table += $j('<div/>').attr('id', idi).addClass('col-lg-5 col-md-5 col-xs-12').prop('outerHTML'); //.css('float', 'left').prop('outerHTML');
            setContent(table);

            btn = [
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
                        url: "php/SaveTipps.php",
                        data: { data: gdata, trid: kt.trid, md: kt.md },
                        contentType: "application/x-www-form-urlencoded",
                        success: function (data) {
                            var res = data.d || data;
                            showMessage(res, 5);
                            if (res.ok) {
                                $j(gridid).trigger('refresh');
                            }
                            return false;
                        } // end success
                    }); // -- End AJAX Call --
                },
                position: "last"
            }];

            if (isAdmin()) {
                btn.push(fetchResultsBtn(function() { $j(gridid).trigger('refresh'); }));
            }

            events = {
                afterLoadComplete: function (data) {
                    // Deadline setzen
                    var rows = data.d || data;
                    if (rows) rows = rows.rows;
                    //console.log(rows[0].deadline);
                    if (rows && rows.length && rows[0].deadline) {
                        var tbar = $j("#tb_grid" + id),
                            tbd = $j("<td></td>").html('Tippabgabe bis <span class="deadline">' + rows[0].deadline + '</span>'),
                            findnav = tbar.children('table');

                        if ($j(findnav).find('td').length === 0) { $j("tr", findnav).append(tbd); }
                        else { $j("tr td:eq(0)", findnav).before(tbd); }
                    }

                    // tipMode hier lesen, damit nach Refresh der aktuelle Wert gilt
                    var tipMode = localStorage.getItem('kt_tip_mode') || 'modern';

                    // Toggle-Button in obere Toolbar einfuegen (nur wenn Tippeingabe moeglich)
                    (function() {
                        var tbar = $j("#t_grid" + id);
                        if (!tbar.length || tbar.find('.tipToggle').length) return;
                        if (!$j(gridid + ' :input[id$="_Tip"]').length) return;
                        var activeClass = tipMode === 'modern' ? ' toggle-on' : '';
                        var td = $j('<td class="tipToggle"></td>').html(
                            '<div class="toggleContainer' + activeClass + '">' +
                            '<div>Klassisch</div><div>Schnell</div>' +
                            '</div>'
                        );
                        var row = tbar.find('table tr');
                        if (row.length) row.append(td);
                        td.find('.toggleContainer').on('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            var cur = localStorage.getItem('kt_tip_mode') || 'modern';
                            var newMode = cur === 'modern' ? 'classic' : 'modern';
                            localStorage.setItem('kt_tip_mode', newMode);
                            $j(this).toggleClass('toggle-on', newMode === 'modern');
                            switchTipMode(newMode, gridid);
                        });
                    })();

                    // Spieltag vorbei: Info-Panel ausblenden, Grid verbreitern
                    var hasTipInputs = $j(gridid + ' :input[id$="_Tip"]').length > 0;
                    if (!hasTipInputs) {
                        $j('#' + idi).hide();
                        $j(gridid).closest('.col-lg-7, .col-md-7').removeClass('col-lg-7 col-md-7').addClass('col-lg-12 col-md-12');
                        // Speichern-Button ausblenden
                        $j('#tb_grid' + id).find('.icon-disk').closest('td').hide();
                        return;
                    }

                    if (tipMode === 'modern') {
                        // Moderne Eingabe: zwei separate Felder, Auto-Doppelpunkt, Auto-Weiter
                        var _tipBuilding = true;
                        $j(gridid + ' :input[id$="_Tip"]').each(function () {
                            var orig = $j(this),
                                sid = orig.attr('id').replace('_Tip', ''),
                                val = orig.val() || '',
                                parts = val.split(':'),
                                h = parts[0] || '', a = parts[1] || '';

                            var wrap = $j('<span class="tip-split"></span>');
                            var inH = $j('<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" class="tip-half tip-home gradient"/>').val(h).attr('data-sid', sid);
                            var sep = $j('<span class="tip-sep">:</span>');
                            var inA = $j('<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" class="tip-half tip-away gradient"/>').val(a).attr('data-sid', sid);

                            wrap.append(inH).append(sep).append(inA);
                            orig.hide().after(wrap);

                            // Sync zurueck ins Original
                            function syncOrig() {
                                var hv = inH.val(), av = inA.val();
                                orig.val((hv !== '' && av !== '') ? hv + ':' + av : '');
                            }

                            // Nur Ziffern erlauben
                            function filterKeys(e) {
                                if (e.keyCode === 9 || e.keyCode === 8 || e.keyCode === 46) return true;
                                if (e.keyCode >= 35 && e.keyCode <= 40) return true;
                                if (e.which === 13) { nextModernInput(inA[0], gridid); return false; }
                                if (e.which < 48 || e.which > 57) return false;
                                return true;
                            }

                            inH.on('keypress', filterKeys);
                            inA.on('keypress', filterKeys);

                            // Auto-Weiter: nach Eingabe in Heim -> Auswaerts
                            inH.on('input', function () {
                                syncOrig();
                                if (this.value.length >= 1) inA.focus().select();
                            });
                            // Nach Auswaerts-Eingabe -> naechste Zeile Heim
                            inA.on('input', function () {
                                syncOrig();
                                if (this.value.length >= 1) nextModernInput(this, gridid);
                            });
                            inH.on('change', syncOrig);
                            inA.on('change', syncOrig);

                            // Zeile selektieren bei echtem User-Focus (nicht beim Aufbau)
                            inH.add(inA).on('focus', function () {
                                if (!_tipBuilding) {
                                    $j(gridid).jqGrid('setSelection', sid);
                                }
                                $j(this).select();
                            });

                            // Cursor hoch/runter
                            inH.add(inA).on('keydown', function (e) {
                                if (e.keyCode === 38) { nextModernInput(this, gridid, -1); return false; }
                                if (e.keyCode === 40) { nextModernInput(this, gridid, 1); return false; }
                            });
                        });
                        setTimeout(function() {
                            _tipBuilding = false;
                            // Erstes leeres Feld fokussieren
                            var firstEmpty = $j(gridid + ' .tip-home').filter(function() { return !this.value; }).first();
                            if (firstEmpty.length) firstEmpty.focus();
                        }, 50);
                    } else {
                        // Klassische Eingabe
                        $j(gridid + ' :input').focus(function () {
                            var rid = $j(this).attr('id').replace(/_Tip/g, '');
                            $j(gridid).jqGrid('setSelection', rid);
                        });

                        $j(gridid + ' :input').bind("keypress", function (e) {
                            if (e.keyCode === 9) return true;
                            if (e.keyCode === 8) return true;
                            if (e.keyCode === 46) return true;
                            if (e.keyCode === 38) { nextInput(this, gridid, -1); return false; }
                            if (e.keyCode === 40) { nextInput(this, gridid); return false; }
                            if (e.keyCode >= 35 && e.keyCode <= 40) return true;
                            if (e.which === 58) return true;
                            if (e.which === 13) { nextInput(this, gridid); return false; }
                            if (e.which < 48 || e.which > 57) return false;
                            return true;
                        });
                    }

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

    function nextModernInput(el, gridid, step) {
        // Springt zum naechsten .tip-home Feld (naechste Zeile)
        var homes = $j(gridid + ' .tip-home'),
            current = $j(el).closest('.tip-split').find('.tip-home')[0],
            idx = homes.index(current);

        step = step || 1;
        idx += step;
        if (idx >= homes.length) idx = 0;
        if (idx < 0) idx = homes.length - 1;
        homes[idx].focus();
        $j(homes[idx]).select();
    }

    function switchTipMode(mode, gridid) {
        if (mode === 'modern') {
            // Klassisch -> Modern: Einzelfelder in Split-Felder umwandeln
            $j(gridid + ' :input[id$="_Tip"]:visible').each(function () {
                var orig = $j(this),
                    sid = orig.attr('id').replace('_Tip', ''),
                    val = orig.val() || '',
                    parts = val.split(':'),
                    h = parts[0] || '', a = parts[1] || '';

                var wrap = $j('<span class="tip-split"></span>');
                var inH = $j('<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" class="tip-half tip-home gradient"/>').val(h).attr('data-sid', sid);
                var sep = $j('<span class="tip-sep">:</span>');
                var inA = $j('<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" class="tip-half tip-away gradient"/>').val(a).attr('data-sid', sid);

                wrap.append(inH).append(sep).append(inA);
                orig.hide().after(wrap);

                function syncOrig() {
                    var hv = inH.val(), av = inA.val();
                    orig.val((hv !== '' && av !== '') ? hv + ':' + av : '');
                }
                function filterKeys(e) {
                    if (e.keyCode === 9 || e.keyCode === 8 || e.keyCode === 46) return true;
                    if (e.keyCode >= 35 && e.keyCode <= 40) return true;
                    if (e.which === 13) { nextModernInput(inA[0], gridid); return false; }
                    if (e.which < 48 || e.which > 57) return false;
                    return true;
                }
                inH.on('keypress', filterKeys);
                inA.on('keypress', filterKeys);
                inH.on('input', function () { syncOrig(); if (this.value.length >= 1) inA.focus().select(); });
                inA.on('input', function () { syncOrig(); if (this.value.length >= 1) nextModernInput(this, gridid); });
                inH.on('change', syncOrig);
                inA.on('change', syncOrig);
                inH.add(inA).on('focus', function () {
                    $j(gridid).jqGrid('setSelection', sid);
                    $j(this).select();
                });
                inH.add(inA).on('keydown', function (e) {
                    if (e.keyCode === 38) { nextModernInput(this, gridid, -1); return false; }
                    if (e.keyCode === 40) { nextModernInput(this, gridid, 1); return false; }
                });
            });
        } else {
            // Modern -> Klassisch: Split-Felder entfernen, Originalfelder zeigen
            $j(gridid + ' .tip-split').each(function () {
                var wrap = $j(this),
                    orig = wrap.prev('input[id$="_Tip"]');
                // Wert zurueckschreiben
                var h = wrap.find('.tip-home').val() || '';
                var a = wrap.find('.tip-away').val() || '';
                orig.val((h !== '' && a !== '') ? h + ':' + a : '');
                wrap.remove();
                orig.show();
            });
        }
    }

    /**********************************************************************************************
    * Liga
    */
    kt.Liga = kt.Liga || {};
    $j.extend(kt.Liga, {
        Tabellen: function () {
            var id = 'LigaTabelle',
                table = [],
                rnd = kt.trdata()[kt.trid].Ligen,
                i, opt;

            for (i = 1; i <= rnd; i++) { table.push(makeTable(id + i, { fl: 'left', cls: 'col-lg-6 col-md-6 col-xs-12' })); }
            setContent(table.join('')); // + _cf); //'<br/>'));

            for (i = 1; i <= rnd; i++) {
                opt = {
                    //url: 'php/Get' + id + 'Data.php',
                    addparam: { lnr: i, fn: id }
                };
                kt.autoGrid(id + i, 'Tabelle Liga ' + i, opt);
            }
        },
        Spielplan: function () {
            var id = 'LigaSpielplan',
                table = [],
                rnd = kt.trdata()[kt.trid].Ligen,
                i, opt;

            for (i = 1; i <= rnd; i++) { table.push(makeTable(id + i, { fl: 'left', cls: 'col-lg-6 col-md-6 col-xs-12' })); }
            setContent(table.join('')); //'<br/>'));

            for (i = 1; i <= rnd; i++) {
                opt = {
                    //url: 'php/Get' + id + 'Data.php',
                    addparam: { lnr: i, fn: id },
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

            table = makeTable(id, { fl: 'left', cls: 'col-lg-6 col-md-6 col-xs-12' });
            table += makeTable(idsum, { fl: 'left', cls: 'col-lg-6 col-md-6 col-xs-12' });
            setContent(table);

            btn = [{
                caption: 'Wertungsrunde:',
                select: true,
                url: 'php/GetRndList.php',
                selkey: 'rnd',
                seldisp: 'Name',
                tbar: 't_',
                id: 'selrnd',
                onChange: function (e) {
                    if (e.target) {
                        rnd = $j(e.target).val();
                        opt.btn[0].selval = rnd;
                        $j(gridid).trigger('refresh', [{ rnd: rnd }, opt]);
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
            server = 40.0, // TODO
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
            euro = (data && data.length) ? (data[0].Total || 0) : 0,
            sumE = cnt * euro,
            sumA;

        gdata.push({ c1: 'Grundbetrag', c2: cnt + ' * ' + $j.fmatter.util.NumberFormat(euro, fmt), c3: cnt * euro, grp: 'Einnahmen' });
        for (i = 1; i <= rndinfo.LCount; i++) {
            cnt = rndinfo.LMembers[i] || 0;
            euro = (data && data.length) ? (data[0]['L' + i] || 0) : 0;
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

        sumA += server;
        gdata.push({ c1: 'Server', c3: server, grp: 'Ausgaben' });

        cfg = {
            datatype: 'local',
            data: gdata,
            rowNum: gdata.length,
            gridview: true,
            colModel: colModel,
            caption: 'Zusammenfassung',
            autowidth: true,
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
        //$j(gridid).jqGrid('GridUnload');
        $j.jgrid.gridUnload(gridid);
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
    // Stat-Funktionen sind in kt.charts.js definiert (Dashboard, Punkteverlauf, Trefferquote, Tabellen)


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
                            url: "php/SaveSpielplan.php",
                            data: { data: gdata, trid: kt.trid, md: kt.md },
                            contentType: "application/x-www-form-urlencoded",
                            success: function (data) {
                                var res = data.d || data;
                                showMessage(res, 5);
                                $j(gridid).trigger('refresh');
                                return false;
                            } // end success
                        }); // -- End AJAX Call --
                    },
                    position: "last"
                }, {
                    caption: "Ergebnisse abrufen",
                    title: "",
                    //buttonicon: "icon-disk",
                    tbar: "tb_",
                    onClickButton: function () {
                        // Ergebnisse Online abrufen
                        $j.ajax({
                            url: "php/getDFBErgebnisse.php",
                            data: { trid: kt.trid, md: kt.md },
                            beforeSend: function () { /*ajaxLoading(true);*/ },
                            complete: function () { /*ajaxLoading(false);*/ },
                            contentType: "application/x-www-form-urlencoded",
                            success: function (data) {
                                var res = data.d || data;
                                if (res.ok && res.data.length > 0) {
                                    $j.each(res.data, function () {
                                        var input = $j('#' + this.sid + '_Result:input');
                                        if (this.Res && input) input.val(this.Res);
                                    });
                                }
                                return false;
                            } // end success
                        }); // -- End AJAX Call --
                    },
                    position: "last"
                }
            ];

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
                    url: 'php/GetTnList.php',
                    param: { trid: kt.trid, md: kt.md },
                    selkey: 'tnid',
                    seldisp: 'Name',
                    tbar: 't_',
                    id: 'seltn',
                    onChange: function (e) {
                        if (e.target) {
                            var tnid = $j(e.target).val();
                            opt.btn[0].selval = tnid;
                            $j(gridid).trigger('refresh', [{ tnid: tnid }, opt]);
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
                            url: "php/SaveTippsAdmin.php",
                            data: { data: gdata, trid: kt.trid, md: kt.md, comment: $j('#tbcomment').val() },
                            contentType: "application/x-www-form-urlencoded",
                            success: function (data) {
                                var res = data.d || data;
                                showMessage(res, 5);
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
                    if (rid && rid !== lastSel) {
                        $j(gridid).restoreRow(lastSel);
                        lastSel = rid;
                    }
                    $j(gridid).jqGrid('editRow', rid, true);
                    $j(gridid + "_ilsave").removeClass('ui-state-disabled');
                    $j(gridid + "_ilcancel").removeClass('ui-state-disabled');
                    $j(gridid + "_iladd").addClass('ui-state-disabled');
                    $j(gridid + "_iledit").addClass('ui-state-disabled');
                },
                afterLoadComplete: function () {
                    setTimeout(function() { $j(gridid + '_iladd').hide(); }, 100);
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
        Einstellungen: function () {
            var themes = [
                    { id: 'classic', label: 'Klassisch' },
                    { id: 'modern',  label: 'Modern' },
                    { id: 'premium', label: 'Dunkel' }
                ],
                current = localStorage.getItem('kt_theme') || 'classic',
                html = '<div class="settings-page"><h3>Einstellungen</h3>'
                     + '<div class="settings-section"><h4>Design</h4><div class="theme-list">';

            $j.each(themes, function (i, t) {
                var cls = (t.id === current) ? ' active' : '';
                html += '<button class="btn btn-default theme-btn' + cls + '" data-theme="' + t.id + '">' + t.label + '</button> ';
            });

            html += '</div></div>'
                 + '<div class="settings-section"><h4>Extras</h4>'
                 + '<label class="settings-toggle"><input type="checkbox" id="chkBall"'
                 + ((localStorage.getItem('kt_ball_off') !== '1') ? ' checked' : '')
                 + '> Fußball auf der Tipp-Übersicht</label>'
                 + '</div></div>';
            setContent(html);

            $j('.theme-btn').click(function () {
                var name = $j(this).data('theme');
                window.ktSetTheme(name);
                $j('.theme-btn').removeClass('active');
                $j(this).addClass('active');
            });

            $j('#chkBall').change(function () {
                if (this.checked) {
                    localStorage.removeItem('kt_ball_off');
                } else {
                    localStorage.setItem('kt_ball_off', '1');
                }
            });
        },
        Liga: function () {
            var id = 'LigaTeilnehmer',
                table = [],
                gridids = [],
                rnd = kt.trdata()[kt.trid].Ligen,
                i, opt, events, dndopts, btn;

            for (i = 0; i <= rnd; i++) {
                table.push(makeTable(id + i, { fl: 'left', pager: true, cls: 'col-lg-3 col-md-3 col-xs-6' }));
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
                    // url: 'php/Get' + id + 'Data.php',
                    addparam: { lnr: i, fn: id },
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
                    url: 'php/GetRndList.php',
                    selkey: 'rnd',
                    seldisp: 'Name',
                    tbar: 't_',
                    id: 'selrnd',
                    onChange: function (e) {
                        if (e.target) {
                            rnd = $j(e.target).val();
                            if (opt.btn) {
                                opt.btn[0].selval = rnd;
                                $j('table[id^="grid' + id + '"]').trigger('refresh', [{ rnd: rnd }, opt]);
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
                            url: "php/SaveLigaTeilnehmer.php",
                            data: { data: gdata, trid: kt.trid },
                            contentType: "application/x-www-form-urlencoded",
                            success: function (data) {
                                var res = data.d || data;
                                showMessage(res, 5);
                                $j.each(gridids, function (gidx, gid) { $j(gid).trigger('refresh'); });
                                return false;
                            } // end success
                        }); // -- End AJAX Call --
                    }
                }
            ];
            opt = {
                //url: 'php/Get' + id + 'Data.php',
                addparam: { lnr: 0, fn: id },
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

            kt.autoGrid(id, 'Tipprunden', opt);
        },
        Praemien: function () {
            var id = 'PraemienInfo',
                idsum = 'PraemienZusammenfassung',
                gridid = "#grid" + id,
                table, btn, opt,
                rnd = 1,
                events;

            table = makeTable(id, { fl: 'left', cls: 'col-lg-6 col-md-6 col-xs-12' });
            table += makeTable(idsum, { fl: 'left', cls: 'col-lg-6 col-md-6 col-xs-12' });
            setContent(table);

            btn = [
                {
                    caption: 'Wertungsrunde:',
                    select: true,
                    url: 'php/GetRndList.php',
                    selkey: 'rnd',
                    seldisp: 'Name',
                    tbar: 't_',
                    id: 'selrnd',
                    onChange: function (e) {
                        if (e.target) {
                            rnd = $j(e.target).val();
                            opt.btn[0].selval = rnd;
                            $j(gridid).trigger('refresh', [{ rnd: rnd }, opt]);
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
                            url: "php/SavePraemien.php",
                            data: { data: gdata, trid: kt.trid, rnd: rnd },
                            contentType: "application/x-www-form-urlencoded",
                            success: function (data) {
                                var res = data.d || data;
                                showMessage(res, 5);
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
                /*{
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
            },*/
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
                url: 'php/GetTrList.php',
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
                if (typeof val === 'string' && val.indexOf("input") != -1) { gdata[idx][field] = $j("#" + row.tnid + "_" + field).val(); }
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
            success: function (data) {
                var res = data.d || data;
                showMessage(res, 5);
            } // end success
        }); // -- End AJAX Call --

        return true;
    }

    /**
     * "Nachname, Vorname" → "Vorname" (bei Duplikaten: "Vorname N")
     * names: Array von "Nachname, Vorname" Strings
     * Gibt Array von formatierten Namen zurück
     */
    kt.formatNames = function(names) {
        var parsed = [], firstCounts = {};
        for (var i = 0; i < names.length; i++) {
            var parts = (names[i] || '').split(',');
            var nachname = (parts[0] || '').trim();
            var vorname = parts.length > 1 ? parts[1].trim() : nachname;
            parsed.push({ vorname: vorname, nachname: nachname });
            firstCounts[vorname] = (firstCounts[vorname] || 0) + 1;
        }
        var result = [];
        for (var i = 0; i < parsed.length; i++) {
            var p = parsed[i];
            result.push(firstCounts[p.vorname] > 1 ? p.vorname + ' ' + p.nachname.charAt(0) : p.vorname);
        }
        return result;
    };

    /**********************************************************************************************
    * Pinnwand
    */
    kt.Pinnwand = kt.Pinnwand || {};
    $j.extend(kt.Pinnwand, {
        _uploadedImage: null,

        Anzeigen: function () {
            var fullname = kt.username || $j('#username').text().trim() || '',
                parts = fullname.split(','),
                nick = parts.length > 1 ? parts[1].trim() : parts[0].trim(),
                initial = nick ? nick.charAt(0).toUpperCase() : '?';

            var html = '<div class="pinnwand-container">'
                + '<div class="pinnwand-header">'
                + '  <div class="pinnwand-header-icon">&#128204;</div>'
                + '  <div><h3 class="pinnwand-title">Pinnwand</h3>'
                + '  <p class="pinnwand-subtitle">Neuigkeiten und Diskussionen</p></div>'
                + '</div>'
                + '<div class="pinnwand-form">'
                + '  <div class="pinnwand-form-row">'
                + '    <div class="pinnwand-avatar">' + initial + '</div>'
                + '    <div class="pinnwand-form-content">'
                + '      <textarea id="pwText" class="pinnwand-input" placeholder="Was gibt\'s Neues, ' + kt.Pinnwand._esc(nick) + '?" maxlength="2000" rows="2"></textarea>'
                + '      <div id="pwPreview" class="pinnwand-preview" style="display:none"></div>'
                + '      <div class="pinnwand-form-actions">'
                + '        <label class="pinnwand-upload-btn" title="Bild anhaengen">'
                + '          <input type="file" id="pwFile" accept="image/*" style="display:none">'
                + '          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>'
                + '          <span>Bild</span>'
                + '        </label>'
                + '        <span id="pwFileName" class="pinnwand-filename"></span>'
                + '        <button id="pwSend" class="pinnwand-send">Posten</button>'
                + '      </div>'
                + '    </div>'
                + '  </div>'
                + '</div>'
                + '<div id="pwPosts" class="pinnwand-posts"><div class="pinnwand-loading">Lade Beitraege...</div></div>'
                + '</div>';

            setContent(html);
            kt.Pinnwand._uploadedImage = null;
            kt.Pinnwand._bindEvents();
            kt.Pinnwand._load();
        },

        _bindEvents: function () {
            $j('#pwFile').on('change', function () {
                var file = this.files[0];
                if (!file) return;

                if (file.size > 5 * 1024 * 1024) {
                    showError('Bild zu groß (max. 5 MB).', 5);
                    this.value = '';
                    return;
                }

                $j('#pwFileName').text(file.name);

                // Vorschau
                var reader = new FileReader();
                reader.onload = function (e) {
                    $j('#pwPreview').html('<img src="' + e.target.result + '" class="pinnwand-preview-img">').show();
                };
                reader.readAsDataURL(file);

                // Hochladen
                var fd = new FormData();
                fd.append('action', 'upload');
                fd.append('image', file);

                $j.ajax({
                    url: 'php/Pinnwand.php',
                    type: 'POST',
                    data: fd,
                    processData: false,
                    contentType: false,
                    success: function (data) {
                        var res = data.d || data;
                        if (res.ok) {
                            kt.Pinnwand._uploadedImage = res.image;
                        } else {
                            showError(res.message, 5);
                        }
                    }
                });
            });

            $j('#pwSend').on('click', function () {
                var text = $j('#pwText').val().trim();
                if (!text) {
                    showError('Bitte Text eingeben.', 3);
                    return;
                }

                $j(this).prop('disabled', true);

                $j.ajax({
                    url: 'php/Pinnwand.php',
                    type: 'POST',
                    data: { action: 'save', text: text },
                    success: function (data) {
                        var res = data.d || data;
                        $j('#pwSend').prop('disabled', false);
                        if (res.ok) {
                            $j('#pwText').val('');
                            $j('#pwFile').val('');
                            $j('#pwFileName').text('');
                            $j('#pwPreview').hide().empty();
                            kt.Pinnwand._uploadedImage = null;
                            kt.Pinnwand._render(res);
                        } else {
                            showError(res.message, 5);
                        }
                    }
                });
            });

            // Enter + Ctrl = Absenden
            $j('#pwText').on('keydown', function (e) {
                if (e.ctrlKey && e.keyCode === 13) {
                    $j('#pwSend').click();
                }
            });
        },

        _load: function () {
            $j.ajax({
                url: 'php/Pinnwand.php',
                type: 'POST',
                data: { action: 'load' },
                success: function (data) {
                    var res = data.d || data;
                    if (res.ok) {
                        kt.Pinnwand._render(res);
                    }
                }
            });
        },

        _render: function (res) {
            var posts = res.posts || [],
                isAdmin = res.isAdmin,
                myTnid = res.tnid,
                html = '';

            if (!posts.length) {
                html = '<div class="pinnwand-empty">'
                    + '<div class="pinnwand-empty-icon">&#128172;</div>'
                    + '<p>Noch keine Beiträge.</p><p class="pinnwand-empty-sub">Schreib den ersten!</p></div>';
            }

            $j.each(posts, function (i, post) {
                var isMine = (post.tnid == myTnid),
                    stickyClass = post.sticky == 1 ? ' pinnwand-post-sticky' : '',
                    nick = kt.Pinnwand._esc(post.nick),
                    initial = nick ? nick.charAt(0).toUpperCase() : '?',
                    avatarClass = 'pinnwand-avatar' + (isMine ? ' pinnwand-avatar-me' : '');

                html += '<div class="pinnwand-post' + stickyClass + '" data-id="' + post.id + '">';

                if (post.sticky == 1) {
                    html += '<div class="pinnwand-sticky-badge">&#128204; Angepinnt</div>';
                }

                html += '  <div class="pinnwand-post-header">';
                html += '    <div class="' + avatarClass + '">' + initial + '</div>';
                html += '    <div class="pinnwand-post-meta">';
                html += '      <span class="pinnwand-nick">' + nick + '</span>';
                html += '      <span class="pinnwand-date">' + post.created_fmt + '</span>';
                html += '    </div>';
                html += '  </div>';
                html += '  <div class="pinnwand-post-body">' + kt.Pinnwand._formatText(post.text) + '</div>';

                if (post.image) {
                    html += '  <div class="pinnwand-post-image"><img src="' + kt.Pinnwand._esc(post.image) + '" alt="Bild" loading="lazy"></div>';
                }

                var hasActions = isAdmin || isMine;
                if (hasActions) {
                    html += '<div class="pinnwand-post-actions">';
                    if (isAdmin) {
                        var pinLabel = post.sticky == 1 ? 'Loesen' : 'Anpinnen';
                        var pinIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>';
                        html += '<button class="pinnwand-action pw-sticky" data-id="' + post.id + '">' + pinIcon + ' ' + pinLabel + '</button>';
                    }
                    if (isMine || isAdmin) {
                        var delIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
                        html += '<button class="pinnwand-action pw-delete" data-id="' + post.id + '">' + delIcon + ' Loeschen</button>';
                    }
                    html += '</div>';
                }

                html += '</div>';
            });

            $j('#pwPosts').html(html);

            // Event-Handler für Aktionen
            $j('.pw-delete').off('click').on('click', function () {
                var id = $j(this).data('id');
                if (!confirm('Beitrag wirklich löschen?')) return;
                $j.ajax({
                    url: 'php/Pinnwand.php',
                    type: 'POST',
                    data: { action: 'delete', id: id },
                    success: function (data) {
                        var res = data.d || data;
                        if (res.ok) kt.Pinnwand._render(res);
                        else showError(res.message, 5);
                    }
                });
            });

            $j('.pw-sticky').off('click').on('click', function () {
                var id = $j(this).data('id');
                $j.ajax({
                    url: 'php/Pinnwand.php',
                    type: 'POST',
                    data: { action: 'sticky', id: id },
                    success: function (data) {
                        var res = data.d || data;
                        if (res.ok) kt.Pinnwand._render(res);
                        else showError(res.message, 5);
                    }
                });
            });
        },

        _esc: function (s) {
            var div = document.createElement('div');
            div.appendChild(document.createTextNode(s || ''));
            return div.innerHTML;
        },

        _formatText: function (text) {
            // Escape HTML, dann Zeilenumbrüche
            var safe = kt.Pinnwand._esc(text);
            return safe.replace(/\n/g, '<br>');
        }
    });

} (window.kt = window.kt || {}, jQuery));