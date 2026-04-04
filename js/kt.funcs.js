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
            tbar: "t_",
            onClickButton: function () {
                $j.ajax({
                    url: "php/getDFBErgebnisse.php",
                    data: { trid: kt.trid, md: kt.md },
                    contentType: "application/x-www-form-urlencoded",
                    success: function (data) {
                        var res = data.d || data;
                        if (res.ok) {
                            var count = res.data ? res.data.length : 0;
                            var parts = [count + ' abgerufen'];
                            if (res.neu) parts.push(res.neu + ' neu eingetragen');
                            if (res.aktualisiert) parts.push(res.aktualisiert + ' aktualisiert');
                            if (res.vorhanden) parts.push(res.vorhanden + ' bereits vorhanden');
                            showMessage({ ok: true, message: parts.join(', ') }, 5);
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
    function isAdmin() { return $j('#mainmenu a.dropdown-toggle').filter(function() { return $j(this).text().indexOf('Admin') >= 0; }).length > 0; }

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
                gridid = "#grid" + id,
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
                },
                afterLoadComplete: function (data) {
                    var ud = $j(gridid).jqGrid('getGridParam', 'userData');
                    if (!ud || !ud.ownTips) return;

                    // User-Zeile finden
                    var $userRow = $j(gridid + ' tr.rowUser');
                    if (!$userRow.length) return;
                    var userRowId = $userRow.attr('id');

                    // Augen-Icon in Name-Zelle (nur einmal)
                    var nameCell = $userRow.find('td.Name');
                    if (nameCell.find('.tipRevealBtn').length) return;

                    var btn = $j('<span class="tipRevealBtn glyphicon glyphicon-eye-open" title="Eigene Tipps anzeigen"></span>');
                    nameCell.append(btn);

                    btn.on('click', function (e) {
                        e.stopPropagation();
                        var $b = $j(this), revealed = $b.data('revealed');

                        if (!revealed) {
                            $j.each(ud.ownTips, function (col, tip) {
                                $j(gridid).jqGrid('setCell', userRowId, col, tip);
                            });
                            $b.removeClass('glyphicon-eye-open').addClass('glyphicon-eye-close')
                              .attr('title', 'Eigene Tipps verbergen').data('revealed', true);
                        } else {
                            $j.each(ud.ownTips, function (col) {
                                $j(gridid).jqGrid('setCell', userRowId, col, '-:-');
                            });
                            $b.removeClass('glyphicon-eye-close').addClass('glyphicon-eye-open')
                              .attr('title', 'Eigene Tipps anzeigen').data('revealed', false);
                        }
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
                        // Toolbar auf Mobile sichtbar machen
                        tbar.closest('.ui-userdata-top').addClass('has-tipToggle');
                        var imgSrc = tipMode === 'modern' ? 'îmg/inputFields2.png' : 'îmg/inputFields1.png';
                        var td = $j('<td class="tipToggle"></td>').html(
                            '<img class="tipToggleImg" src="' + imgSrc + '" alt="Eingabemodus" />'
                        );
                        var row = tbar.find('table tr');
                        if (row.length) row.append(td);
                        td.find('.tipToggleImg').on('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            var cur = localStorage.getItem('kt_tip_mode') || 'modern';
                            var newMode = cur === 'modern' ? 'classic' : 'modern';
                            localStorage.setItem('kt_tip_mode', newMode);
                            this.src = newMode === 'modern' ? 'îmg/inputFields2.png' : 'îmg/inputFields1.png';
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
                                this.value = this.value.replace(/[^0-9]/g, '');
                                syncOrig();
                                if (this.value.length >= 1) inA.focus().select();
                            });
                            // Nach Auswaerts-Eingabe -> naechste Zeile Heim
                            inA.on('input', function () {
                                this.value = this.value.replace(/[^0-9]/g, '');
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

                            // Backspace bei leerem Feld: zurueckspringen
                            // Cursor hoch/runter
                            inH.add(inA).on('keydown', function (e) {
                                if (e.keyCode === 8 && !this.value) {
                                    e.preventDefault();
                                    var $el = $j(this);
                                    if ($el.hasClass('tip-away')) {
                                        $el.closest('.tip-split').find('.tip-home').focus().select();
                                    } else {
                                        var allSplits = $j(gridid + ' .tip-split');
                                        var idx = allSplits.index($el.closest('.tip-split'));
                                        if (idx > 0) allSplits.eq(idx - 1).find('.tip-away').focus().select();
                                    }
                                    return false;
                                }
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
                inH.on('input', function () { this.value = this.value.replace(/[^0-9]/g, ''); syncOrig(); if (this.value.length >= 1) inA.focus().select(); });
                inA.on('input', function () { this.value = this.value.replace(/[^0-9]/g, ''); syncOrig(); if (this.value.length >= 1) nextModernInput(this, gridid); });
                inH.on('change', syncOrig);
                inA.on('change', syncOrig);
                inH.add(inA).on('focus', function () {
                    $j(gridid).jqGrid('setSelection', sid);
                    $j(this).select();
                });
                inH.add(inA).on('keydown', function (e) {
                    if (e.keyCode === 8 && !this.value) {
                        e.preventDefault();
                        var $el = $j(this);
                        if ($el.hasClass('tip-away')) {
                            $el.closest('.tip-split').find('.tip-home').focus().select();
                        } else {
                            var allSplits = $j(gridid + ' .tip-split');
                            var idx = allSplits.index($el.closest('.tip-split'));
                            if (idx > 0) allSplits.eq(idx - 1).find('.tip-away').focus().select();
                        }
                        return false;
                    }
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

    /**********************************************************************************************
    * Pinnwand (Social Feed / Threaded)
    */
    kt.Pinnwand = kt.Pinnwand || {};
    $j.extend(kt.Pinnwand, {
        _uploadedImage: null,
        _replyTo: null,          // ID des Posts auf den geantwortet wird
        _styles: [
            { key: '',         icon: '\u2709', title: 'Standard' },
            { key: 'elegant',  icon: '\uD83D\uDC51', title: 'Edel' },
            { key: 'neon',     icon: '\uD83D\uDCA1', title: 'Neon' },
            { key: 'retro',    icon: '\uD83D\uDCBB', title: 'Retro' },
            { key: 'dark',     icon: '\uD83C\uDF11', title: 'Tafel' },
            { key: 'glass',    icon: '\uD83D\uDC8E', title: 'Glas' },
            { key: 'doodle',   icon: '\u270F',  title: 'Doodle' },
            { key: 'polaroid', icon: '\uD83D\uDDBC', title: 'Polaroid' },
            { key: 'vintage',  icon: '\u2615',  title: 'Vintage' },
            { key: 'frame',    icon: '\uD83D\uDDBC', title: 'Rahmen' },
            { key: 'tape',     icon: '\uD83D\uDCCC', title: 'Gepinnt' },
            { key: 'shadow',   icon: '\uD83D\uDD76', title: 'Schatten' }
        ],

        Anzeigen: function () {
            // Gelesen-Timestamp setzen, Badge ausblenden
            localStorage.setItem('kt_pin_seen', new Date().toISOString().slice(0,19).replace('T',' '));
            $j('#pinBadge').hide();

            var nick = (kt.username || '').split(',');
            nick = nick.length > 1 ? nick[1].trim() : nick[0].trim();
            var P = kt.Pinnwand, esc = P._esc;

            var styleHtml = '<div class="pin-style-picker">';
            $j.each(P._styles, function (i, s) {
                styleHtml += '<button type="button" class="pin-style-dot' + (i === 0 ? ' active' : '') + '" data-style="' + s.key + '" title="' + s.title + '">'
                    + s.icon + '</button>';
            });
            styleHtml += '<input type="hidden" id="pwStyle" value="">';
            styleHtml += '</div>';

            var html = '<div class="pin-form">'
                + '<div id="pwReplyBar" class="pin-reply-bar" style="display:none">'
                + '<span class="pin-reply-label">Antwort auf <b id="pwReplyName"></b></span>'
                + '<button type="button" id="pwReplyCancel" class="pin-reply-cancel">&times;</button>'
                + '</div>'
                + '<div class="pin-form-inner">'
                + '<div class="pin-avatar pin-avatar-form">' + esc(P._initials(nick)) + '</div>'
                + '<div class="pin-form-body">'
                + '<textarea id="pwText" placeholder="Was gibt\'s Neues, ' + esc(nick) + '?" maxlength="2000" rows="1"></textarea>'
                + '<div id="pwPreview" class="pin-preview" style="display:none"></div>'
                + '<div class="pin-form-actions">'
                + styleHtml
                + '<label class="pin-upload-btn" title="Bild anhaengen">'
                + '  <input type="file" id="pwFile" accept="image/*" style="display:none">'
                + '  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>'
                + '</label>'
                + '<span id="pwFileName" class="pin-filename"></span>'
                + '<button id="pwSend" class="pin-send">Posten</button>'
                + '</div>'
                + '</div>'
                + '</div>'
                + '</div>'
                + '<div id="pwBoard" class="pin-board"><div class="pin-loading">Lade Beitraege...</div></div>'
                + '<div id="pinLightbox" class="pin-lightbox-overlay" style="display:none"><img id="pinLightboxImg" src="" alt="Vollbild"></div>';

            setContent(html);
            kt.Pinnwand._uploadedImage = null;
            kt.Pinnwand._bindEvents();
            kt.Pinnwand._load();
        },

        _allStyleClasses: 'pin-style-elegant pin-style-neon pin-style-retro pin-style-dark pin-style-glass pin-style-doodle pin-style-polaroid pin-style-vintage pin-style-frame pin-style-tape pin-style-shadow',

        _bindEvents: function () {
            var P = kt.Pinnwand;

            // Style-Picker
            $j('.pin-style-picker').on('click', '.pin-style-dot', function () {
                $j('.pin-style-dot').removeClass('active');
                $j(this).addClass('active');
                var style = $j(this).data('style');
                $j('#pwStyle').val(style);
                // Preview auf dem Formular
                var form = $j('.pin-form');
                form.removeClass(P._allStyleClasses);
                if (style) form.addClass('pin-style-' + style);
            });

            // Auto-resize textarea
            $j('#pwText').on('input', function () {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            });

            // Bild-Upload
            $j('#pwFile').on('change', function () {
                var file = this.files[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { showError('Bild zu gross (max. 5 MB).', 5); this.value = ''; return; }
                $j('#pwFileName').text(file.name);
                var reader = new FileReader();
                reader.onload = function (e) { $j('#pwPreview').html('<img src="' + e.target.result + '" class="pin-preview-img">').show(); };
                reader.readAsDataURL(file);
                var fd = new FormData();
                fd.append('action', 'upload');
                fd.append('image', file);
                $j.ajax({ url: 'php/Pinnwand.php', type: 'POST', data: fd, processData: false, contentType: false,
                    success: function (data) { var res = data.d || data; if (res.ok) P._uploadedImage = res.image; else showError(res.message, 5); }
                });
            });

            // Reply abbrechen
            $j('#pwReplyCancel').on('click', function () {
                P._replyTo = null;
                $j('#pwReplyBar').hide();
                $j('#pwText').attr('placeholder', 'Was gibt\'s Neues?');
            });

            // Posten
            $j('#pwSend').on('click', function () {
                var text = $j('#pwText').val().trim();
                if (!text) { showError('Bitte Text eingeben.', 3); return; }
                $j(this).prop('disabled', true);
                var style = $j('#pwStyle').val() || '';
                var postData = { action: 'save', text: text, style: style };
                if (P._replyTo) postData.reply_to = P._replyTo;
                $j.ajax({ url: 'php/Pinnwand.php', type: 'POST', data: postData,
                    success: function (data) {
                        var res = data.d || data;
                        $j('#pwSend').prop('disabled', false);
                        if (res.ok) {
                            $j('#pwText').val('').css('height', ''); $j('#pwFile').val(''); $j('#pwFileName').text('');
                            $j('#pwPreview').hide().empty(); P._uploadedImage = null;
                            $j('#pwStyle').val(''); $j('.pin-style-dot').removeClass('active').first().addClass('active');
                            $j('.pin-form').removeClass(P._allStyleClasses);
                            P._replyTo = null; $j('#pwReplyBar').hide();
                            $j('#pwText').attr('placeholder', 'Was gibt\'s Neues?');
                            P._render(res);
                        } else { showError(res.message, 5); }
                    }
                });
            });

            // Ctrl+Enter = Absenden
            $j('#pwText').on('keydown', function (e) { if (e.ctrlKey && e.keyCode === 13) $j('#pwSend').click(); });

            // Lightbox
            $j(document).on('click', '.pin-card-image', function () {
                $j('#pinLightboxImg').attr('src', this.src);
                $j('#pinLightbox').show();
            });
            $j('#pinLightbox').on('click', function () { $j(this).hide(); $j('#pinLightboxImg').attr('src', ''); });
            $j(document).on('keydown', function (e) { if (e.key === 'Escape' && $j('#pinLightbox').is(':visible')) $j('#pinLightbox').hide(); });
        },

        _load: function () {
            $j.ajax({ url: 'php/Pinnwand.php', type: 'POST', data: { action: 'load' },
                success: function (data) { var res = data.d || data; if (res.ok) kt.Pinnwand._render(res); }
            });
        },

        _renderCard: function (post, myTnid, isAdmin, isReply) {
            var P = kt.Pinnwand,
                isMine = (post.tnid == myTnid),
                nick = P._esc(post.nick),
                styleClass = post.card_style ? ' pin-style-' + post.card_style : '',
                ownClass = isMine ? ' pin-card-own' : '',
                stickyClass = (!isReply && post.sticky == 1) ? ' pin-card-pinned' : '',
                replyClass = isReply ? ' pin-card-reply' : '',
                html = '';

            html += '<div class="pin-card' + ownClass + stickyClass + styleClass + replyClass + '" data-id="' + post.id + '" data-owner="' + post.tnid + '">';

            // Header: Avatar + Name + Date + Actions
            html += '<div class="pin-card-header">';
            html += '<div class="pin-avatar">' + P._esc(P._initials(nick)) + '</div>';
            html += '<div class="pin-card-meta">';
            html += '<span class="pin-card-author">' + nick + '</span>';
            html += '<span class="pin-card-date">' + (post.created_fmt || '') + '</span>';
            html += '</div>';

            // Actions (hover-only)
            html += '<div class="pin-card-actions">';
            if (!isReply) {
                html += '<button type="button" class="pin-action-btn pin-card-reply-btn" title="Antworten">&#8617;</button>';
            }
            if (isAdmin) {
                html += '<button type="button" class="pin-action-btn pin-card-sticky-btn" title="' + (post.sticky == 1 ? 'Loesen' : 'Anpinnen') + '">'
                    + (post.sticky == 1 ? '&#128204;' : '&#128392;') + '</button>';
            }
            if (isMine) {
                html += '<button type="button" class="pin-action-btn pin-card-edit" title="Bearbeiten">&#9998;</button>';
            }
            if (isMine || isAdmin) {
                html += '<button type="button" class="pin-action-btn pin-card-delete" title="Loeschen">&times;</button>';
            }
            html += '</div>';
            html += '</div>';

            // Sticky indicator
            if (!isReply && post.sticky == 1) {
                html += '<div class="pin-sticky-badge">&#128204; Angepinnt</div>';
            }

            // Message
            html += '<div class="pin-card-message">' + P._formatText(post.text) + '</div>';

            // Bild
            if (post.image) {
                html += '<img src="' + P._esc(post.image) + '" alt="Bild" class="pin-card-image" loading="lazy">';
            }

            html += '</div>';
            return html;
        },

        _render: function (res) {
            var posts = res.posts || [],
                isAdmin = res.isAdmin,
                myTnid = res.tnid,
                P = kt.Pinnwand,
                html = '';

            if (!posts.length) {
                html = '<div class="pin-empty"><div class="pin-empty-icon">&#128172;</div>'
                    + '<p>Noch keine Beitraege.</p><p class="pin-empty-sub">Schreib den ersten!</p></div>';
            }

            // Threads aufbauen: Top-Level-Posts mit ihren Replies gruppieren
            var threads = [], threadMap = {}, orphanReplies = [];
            $j.each(posts, function (i, post) {
                if (!post.reply_to) {
                    threadMap[post.id] = { root: post, replies: [] };
                    threads.push(threadMap[post.id]);
                }
            });
            $j.each(posts, function (i, post) {
                if (post.reply_to) {
                    if (threadMap[post.reply_to]) {
                        threadMap[post.reply_to].replies.push(post);
                    } else {
                        orphanReplies.push(post);
                    }
                }
            });

            // Threads rendern
            $j.each(threads, function (i, thread) {
                html += '<div class="pin-thread">';

                // Startbeitrag (links)
                html += P._renderCard(thread.root, myTnid, isAdmin, false);

                // Replies (rechts) — chronologisch
                if (thread.replies.length) {
                    thread.replies.sort(function (a, b) { return a.id - b.id; });
                    html += '<div class="pin-replies">';
                    $j.each(thread.replies, function (j, reply) {
                        html += P._renderCard(reply, myTnid, isAdmin, true);
                    });
                    html += '</div>';
                }

                html += '</div>';
            });

            // Verwaiste Replies als Top-Level anzeigen (Fallback)
            $j.each(orphanReplies, function (i, post) {
                html += '<div class="pin-thread">';
                html += P._renderCard(post, myTnid, isAdmin, false);
                html += '</div>';
            });

            $j('#pwBoard').html(html);
            P._initBoard(myTnid, isAdmin);
        },

        _initBoard: function (myTnid, isAdmin) {
            var P = kt.Pinnwand,
                board = document.getElementById('pwBoard');
            if (!board) return;

            $j(board).off('.pinboard');

            // Reply
            $j(board).on('click.pinboard', '.pin-card-reply-btn', function () {
                var card = $j(this).closest('.pin-card'),
                    id = card.data('id'),
                    author = card.find('.pin-card-author').text();
                P._replyTo = id;
                $j('#pwReplyName').text(author);
                $j('#pwReplyBar').show();
                $j('#pwText').attr('placeholder', 'Antwort schreiben...').focus();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            // Edit (inline)
            $j(board).on('click.pinboard', '.pin-card-edit', function () {
                var card = $j(this).closest('.pin-card'),
                    id = card.data('id'),
                    msgEl = card.find('.pin-card-message');

                // Schon im Edit-Modus?
                if (card.hasClass('pin-editing')) return;
                card.addClass('pin-editing');

                // Aktuellen Text aus dem HTML rekonstruieren (br → \n, HTML-Entities zurück)
                var raw = msgEl.html().replace(/<br\s*\/?>/gi, '\n');
                var tmp = document.createElement('textarea');
                tmp.innerHTML = raw;
                var text = tmp.value;

                var ta = $j('<textarea class="pin-edit-textarea" maxlength="2000"></textarea>').val(text);
                var actions = $j('<div class="pin-edit-actions"></div>');
                var btnSave = $j('<button class="pin-edit-save">Speichern</button>');
                var btnCancel = $j('<button class="pin-edit-cancel">Abbrechen</button>');
                actions.append(btnSave).append(btnCancel);

                msgEl.empty().append(ta).append(actions);
                ta.focus();
                ta[0].style.height = Math.min(ta[0].scrollHeight, 200) + 'px';

                // Ctrl+Enter = Speichern
                ta.on('keydown', function (e) { if (e.ctrlKey && e.keyCode === 13) btnSave.click(); });
                // Escape = Abbrechen
                ta.on('keydown', function (e) { if (e.key === 'Escape') btnCancel.click(); });

                btnCancel.on('click', function () {
                    msgEl.html(P._formatText(text));
                    card.removeClass('pin-editing');
                });

                btnSave.on('click', function () {
                    var newText = ta.val().trim();
                    if (!newText) { showError('Text darf nicht leer sein.', 3); return; }
                    btnSave.prop('disabled', true);
                    $j.ajax({ url: 'php/Pinnwand.php', type: 'POST',
                        data: { action: 'edit', id: id, text: newText },
                        success: function (data) {
                            var res = data.d || data;
                            if (res.ok) P._render(res);
                            else { showError(res.message, 5); btnSave.prop('disabled', false); }
                        }
                    });
                });
            });

            // Delete
            $j(board).on('click.pinboard', '.pin-card-delete', function () {
                var id = $j(this).closest('.pin-card').data('id');
                if (!confirm('Beitrag wirklich loeschen?')) return;
                $j.ajax({ url: 'php/Pinnwand.php', type: 'POST', data: { action: 'delete', id: id },
                    success: function (data) { var res = data.d || data; if (res.ok) P._render(res); else showError(res.message, 5); }
                });
            });

            // Sticky toggle (admin)
            $j(board).on('click.pinboard', '.pin-card-sticky-btn', function () {
                var id = $j(this).closest('.pin-card').data('id');
                $j.ajax({ url: 'php/Pinnwand.php', type: 'POST', data: { action: 'sticky', id: id },
                    success: function (data) { var res = data.d || data; if (res.ok) P._render(res); else showError(res.message, 5); }
                });
            });
        },

        _initials: function (name) {
            if (!name) return '?';
            var parts = name.replace(/,/g, ' ').trim().split(/\s+/);
            if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
            return parts[0].substring(0, 2).toUpperCase();
        },

        _esc: function (s) {
            var div = document.createElement('div');
            div.appendChild(document.createTextNode(s || ''));
            return div.innerHTML;
        },

        _formatText: function (text) {
            var safe = kt.Pinnwand._esc(text);
            return safe.replace(/\n/g, '<br>');
        }
    });

} (window.kt = window.kt || {}, jQuery));