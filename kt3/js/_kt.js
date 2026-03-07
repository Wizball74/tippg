(function (kt, $j) /*, undefined)*/{

    /**********************************************************************************************
    * Seite vorbereiten
    */
    kt.init = function () {
        var id = setStyle();
        setConfig();
        initAjax();
        checkLogin();
        makeMenu();
        initNav();
        initJqGrid();
        setTitle();
        $j("select#cbstyle").val(id);
        // letzten Menüpunkt aufrufen
        $j(document).ready(function () {
            if (kt.lastmenu) exec(kt.lastmenu.smenu, kt.lastmenu.action);
        });
    };

    /**********************************************************************************************
    * Menübefehl ausführen
    */
    kt.menu = function (smenu, action, param) {
        /// <summary>führt einen Menübefehl aus</summary>
        clearError();
        // MA 17.08.2012
        $j("#menu-icon:visible").click();
        // Login
        if (action === 'login') { showLogin(); }
        // Logout
        else if (action === 'logout') { logout(); }
        // sonstige Funktionen
        else { exec(smenu, action, param); }
    };

    /**********************************************************************************************
    * jqGrid erstellen
    */

    kt.autoGrid = function (id, title, options) {
        //editable, events, addparam, btn) {
        var opt = options || {},
			gridid = "#grid" + id,
			pagerid = "#pager" + id,
			pager = $j(pagerid),
			url = opt.url || 'php/Get' + id + 'Data.php',
			postparam = $j("#d" + id).data("params") || {},
			keycol, pgparams,
			events,
            init = true;

        $j.extend(postparam, { trid: kt.trid, md: kt.md });
        if (kt.lastmenu) $j.extend(postparam, { menu: kt.lastmenu.smenu, action: kt.lastmenu.action });
        if (opt.addparam) $j.extend(postparam, opt.addparam);
        $j("#d" + id).data("params", postparam);

        ajaxLoading(true);
        // Grid erstellen
        $j.ajax({
            type: 'POST',
            url: url,
            data: postparam || {},
            dataType: "json",
            contentType: "application/x-www-form-urlencoded",
            success: function (result) {
                // Datenmodell
                var res = result.d || result,
                    gdata = res.data.Rows,
                    cfg = {
                        editurl: 'php/Save' + id + 'Data.php',
                        datatype: 'local',
                        data: gdata,
                        rowNum: gdata.length,
                        gridview: true,
                        colModel: res.colModel,
                        pager: pagerid,
                        caption: title,
                        pgbuttons: false,
                        pginput: false,
                        recordtext: "Anzahl: {2}",
                        emptyrecords: "Anzahl: 0",
                        toolbar: opt.toolbar || [true, 'top']
                    },
                    w;

                if (res.userdata) cfg.userData = res.userdata;
                if (res.colNames) cfg.colNames = res.colNames;
                if (res.colModel) {
                    w = 0;
                    $j.each(res.colModel, function (idx, col) {
                        if (!col.hidden && col.width) w += col.width;
                        if (col.key) keycol = col.name;
                    });
                    if (w) {
                        cfg.width = w;
                        cfg.autowidth = false;
                    }
                }

                // zusätzliche Grid-Optionen
                if (res.gridOptions) $j.extend(cfg, res.gridOptions);
                // Grid-Events
                // universeller loadComplete-Handler
                events = opt.events || {};
                //console.log('BE', opt.events, events);
                $j.extend(events,
                    {
                        /*gridComplete: function() {
                        console.log('GC');
                        },*/
                        onClickGroup: function (grpid, collapsed) { jqgSaveCollapsedState(this, grpid, collapsed); }, // Status merken
                        loadComplete: function (data) {
                            //console.log('LC', init);
                            //return;
                            // ggf. vorher existierenden Handler ausführen => am Ende
                            //if (elc) elc.call(this, data);
                            var grid = $j(this), g = this,
                                userdata = grid.jqGrid('getGridParam', 'userData'),
                                ids = grid.jqGrid('getDataIDs'),
                                i, rows;


                            // Tooltips anpassen falls nötig
                            $j.each(res.colModel, function () {
                                if (this.tooltip) {
                                    for (i = 0; i < ids.length; i++) grid.jqGrid("setCell", ids[i], this.name, '', '', { 'title': this.tooltip });
                                }
                                // Header-Tooltip setzen
                                if (this.hdrtooltip) {
                                    try {
                                        var pos = -1, colname = this.name, thd;
                                        // Spalte ermitteln
                                        $j(g.p.colModel).each(function (j) {
                                            if (this.name == colname) {
                                                pos = j;
                                                return;
                                            }
                                        });
                                        if (pos < 0) return;
                                        // Tooltip (title-Attribut) setzen
                                        thd = $j("thead:first", grid[0].grid.hDiv)[0];
                                        $j("tr.ui-jqgrid-labels th:eq(" + pos + ")", thd).attr("title", this.hdrtooltip);
                                    } catch (e) {
                                    }
                                }
                            });

                            // ggf. Titel setzen
                            if (userdata.title) grid.jqGrid('setCaption', userdata.title);

                            // Daten hervorheben/editmodus?
                            rows = data.d || data;
                            if (rows) rows = rows.rows;
                            keycol = keycol || 'id';
                            $j.each(rows, function () {
                                try {
                                    var r = this;
                                    //console.log(opt.editable, r.editable, !opt.inlineedit, keycol);
                                    if (opt.editable && r.editable && !opt.inlineedit) {
                                        grid.jqGrid('editRow', r[keycol], false);
                                        // TODO Spaltenname, alle Datumsspalten
                                        $j("#" + r[keycol] + "_Date").datepicker({ dateFormat: "dd.mm.yy" });
                                    }
                                    if (r.cls) {
                                        grid.jqGrid('setRowData', r[keycol], false, r.cls);
                                    }
                                } catch (e) {
                                }
                            });

                            // Collapsed-State wiederherstellen
                            if (res.gridOptions
                                && res.gridOptions.groupingView) jqgRestoreCollapsedState(this, res.gridOptions.groupingView.groupCollapse);


                            //  Größenanpassung Grids
                            if (!opt.refresh) {
                                var gparent = $j("#d" + id).parent(),
                                    s = $j(gridid).getGridParam('width');
                                if (gparent.length) {
                                    gparent.resize(function (event) {
                                        if ($j(gridid).length) {
                                            //console.log(gparent, gparent.width());
                                            jgqResize(id, { minwidth: 480, size: s });
                                            //$j(gridid).trigger('resize');
                                        } else
                                            $j(this).unbind(event); // Grid existiert nicht mehr, Event entbinden
                                    });
                                }
                            }

                            //console.log($j(gridid).jqGrid('getGridParam', 'sortname'));
                            //console.log(res.sortname);

                            if (!$j(gridid).jqGrid('getGridParam', 'sortname') && res.sortname) {
                                //console.log(res.sortname, true, res.sortorder || 'asc');
                                jqgSort(gridid, res.sortname, res.sortorder, 10);
                                //setTimeout('jQuery("' + gridid + '").sortGrid("Pts",true,"desc");', 100);*                                
                                //$j(gridid).sortGrid(res.sortname, true, res.sortorder || 'asc');
                                //$j(gridid).jqGrid('setGridParam', { sortname: res.sortname });
                                //$j(gridid).jqGrid('setGridParam', 'sortname', res.sortname);
                            }

                            if (init) {

                                if (!opt.hideprint) jqgAddPrintButton(id);

                                // Pager konfigurieren
                                if (pager.length) {

                                    $j(pagerid + "_center").remove();
                                    if (!opt.rowcount) $j(pagerid + "_right").remove();

                                    if (opt.editable) {
                                        // TODO
                                        //console.log(opt.inlineedit, opt.inlineopt);
                                        //$j(gridid).jqGrid('navGrid', pagerid, { edit: false, add: false, del: false, search: false, refresh: false });
                                        if (opt.inlineedit) {
                                            $j(gridid).jqGrid('navGrid', pagerid, opt.inlineopt || { edit: false, add: false, del: false, search: false, refresh: false },
                                                {}, // Edit
                                                {}, // Add
                                                {serializeDelData: jqgSerializeGridData, afterSubmit: jqgAfterDelSubmit }); // Del

                                            pgparams = {
                                                editParams: { aftersavefunc: jqgAfterSaveFunc },
                                                savetitle: "Zeile speichern",
                                                canceltitle: "Bearbeitung abbrechen"
                                                //ajaxRowOptions: { test: 1 }
                                            };
                                            //console.log(pagerid, pgparams);
                                            $j(gridid).jqGrid('inlineNav', pagerid, pgparams);

                                        } else {
                                            $j(gridid).jqGrid('navGrid', pagerid, { edit: false, add: false, del: false, search: false, refresh: false });
                                        }
                                    } else {
                                        $j(gridid).jqGrid('navGrid', pagerid, { edit: false, add: false, del: false, search: false, refresh: false });
                                    }

                                    //console.log(btn);
                                    //opt.btn = opt.btn || [];
                                    //opt.btn.push({ caption: 'Drucken', buttonicon: "ui-icon-print", position: "last" });


                                } else {
                                    // kein Pager
                                    $j(gridid).addClass("noPager");
                                }

                                if (opt.btn) {
                                    $j.each(opt.btn, function (idx, val) {
                                        if (val.tbar) {
                                            jqgAddToolbarButton(val.tbar, id, val);
                                        } else {
                                            jqgAddButton(gridid, pagerid, val);
                                        }
                                    });
                                }

                                init = false;
                            } // if init 
                            //console.log(opt.events);
                            //console.log(opt.events.afterLoadComplete);
                            //MA 13.08.2012
                            if (opt.events && opt.events.afterLoadComplete) opt.events.afterLoadComplete.call(this, data);

                            ajaxLoading(false);
                        }
                    }
                );

                if (opt.hideempty) $j.extend(events, { gridComplete: function () { hideEmptyGrid(this); } });

                //console.log('EA', events, cfg);
                if (events) $j.extend(cfg, events);
                //console.log('cfg', cfg);

                // Grid erstellen
                $j(gridid).jqGrid(cfg);
                // Refresh-Event erstellen
                $j(gridid).on('refresh', function (event, rparam, ropt) {
                    if (rparam) {
                        postparam = $j("#d" + id).data("params") || {};
                        $j.extend(postparam, rparam);
                        $j("#d" + id).data("params", postparam);
                    }
                    if (ropt) {
                        opt = $j.extend(ropt, opt);
                    }
                    $j(gridid).jqGrid('GridUnload');
                    opt = $j.extend(opt, { refresh: true });
                    kt.autoGrid(id, title, opt);
                });
                $j(gridid).on('gridresize', function (event) {
                    //console.log('gridresize');
                    if (opt.events && opt.events.OnResize) opt.events.OnResize.call(this, event);
                });
            },
            error: function (x, e) {
                var msg = x.readyState + " " + x.status + " " + e.msg;
                showError(msg, 10);
            }
        });

    };

    // ====================================================================================================================================
    // **** private ****
    // ====================================================================================================================================

    this.trid = 0;
    this.md = 0;
    this.curmd = 0;
    this.maxmd = 0;
    this.loggedIn = false;
    this.lastmenu = {};

    var styles = [
		{ label: 'Grau', css1: 'kt-gray.css', css2: 'smoothness/jquery-ui-1.8.23.custom.css' },
		{ label: 'Schwarz', css1: 'kt-black.css', css2: 'dark-hive/jquery-ui-1.8.23.custom.css' },
		{ label: 'Blau', css1: 'kt-blue.css', css2: 'blue/jquery-ui-1.8.17.custom.css' }
	];

    function setConfig() {
        /// <summary>Grundeinstellungen</summary>
        $j.blockUI.defaults.css = {};
        $j.blockUI.defaults.overlayCSS = {};
    }

    function setStyle(id) {
        if (id === undefined) id = $j.cookie("kttheme");
        if (id === undefined) id = 1;

        if (styles[id]) {
            $j("link#css1").attr("href", 'css/' + styles[id].css1);
            $j("link#css2").attr("href", 'css/' + styles[id].css2);
            $j.cookie("kttheme", id, { expires: 90 });
        }
        return id;
    }

    /****************************************************************************************************************************
    * Ajax-Funktionen
    */

    function initAjax() {
        /// <summary>Default-Einstellungen für Ajax-Requests</summary>
        $j.ajaxSetup({
            type: "POST",
            contentType: "application/json; charset=utf-8",
            dataType: 'json',
            beforeSend: ajaxBeforeSend,
            complete: ajaxComplete,
            error: ajaxError
        }); //close $j.ajaxSetup(
    }

    function ajaxError(jqXhr) { ajaxLoading(false); showError(jqXhr.responseText); }

    function ajaxBeforeSend() { /*ajaxLoading(true);*/ }

    function ajaxComplete() { /*ajaxLoading(false);*/ }

    function ajaxLoading(show) {
        /// <summary>Lade-Hinweis anzeigen/ausblenden</summary>
        //console.log(show);
        if (show) {
            $j.blockUI({ message: $j('#loading') });
            $j('.blockUI.blockMsg').center();
        }
        else {
            $j.unblockUI();
        }
    }

    /****************************************************************************************************************************
    * Fehler-Funktionen
    */

    /**********************************************************************************************
    * Fehlermeldung anzeigen
    */
    this.showError = function (msg, d) {
        /// <summary>Fehlermeldung anzeigen</summary>
        /// <param name="msg" type="string">anzuzeigender Text</param>
        /// <param name="d" type="integer">automatisch ausblenden nach x Sekunden</param>

        var el = $j('#errortext');
        el.html(msg);
        el.show();
        $j('#status').show();
        // automatisch ausblenden?
        if (d > 0) setTimeout('kt.clearError();', d * 1000);
        scrollTop();
        ajaxLoading(false);
    };

    this.showStatus = function (msg, d) {
        /// <summary>Statusmeldung anzeigen</summary>
        /// <param name="msg" type="string">anzuzeigender Text</param>
        /// <param name="d" type="integer">automatisch ausblenden nach x Sekunden</param>
        var el = $j('#statustext');
        el.html(msg);
        el.show();
        $j('#status').show();
        // automatisch ausblenden?
        if (d > 0) setTimeout('kt.clearError();', d * 1000);
        scrollTop();
    };

    /**********************************************************************************************
    * Fehlermeldung löschen
    */
    function clearError() {
        /// <summary>Fehleranzeige löschen</summary>
        var el = $j('#errortext');
        el.html("");
        el.hide();
        el = $j('#statustext');
        el.html("");
        el.hide();
        $j('#status').hide();
    }

    kt.clearError = function () { clearError(); };

    /****************************************************************************************************************************
    * Content-Funktionen
    */
    this.clearContent = function () { $j('#content').html(""); };

    this.setContent = function (content, append) {
        /// <summary>Fehleranzeige löschen</summary>
        /// <param name="content" type="string">anzuzeigender Inhalt</param>
        /// <param name="append" type="bool">Inhalt anfügen?</param>
        if (!(content)) return;

        append = append || false;

        content = '<article class="shadow">' + content + '</article>';

        if (append)
            $j('#content').append(content);
        else
            $j('#content').html(content);
    };

    function refreshGrids() {
        var grids = $j('table[id^="grid"]');
        grids.trigger('refresh');
    }

    /****************************************************************************************************************************
    * Login-Funktionen
    */

    function checkLogin() {
        $j.ajax({
            url: "php/checklogin.php",
            data: "",
            contentType: "application/x-www-form-urlencoded",
            async: false,
            success: function (data) {
                var res = data.d || data;
                if (res.ok) {
                    kt.loggedIn = res.loggedIn;
                    if (res.trid) kt.trid = res.trid;
                    if (res.md) kt.md = res.md;
                    //if (res.menu) trid = res.trid;
                    //if (res.action) trid = res.trid;                    
                    if (res.username) $j("#username").html(res.username);
                    // TODO 
                    //if (res.menu && res.action) kt.menu(res.menu, res.action);
                    if (res.menu && res.action) kt.lastmenu = { smenu: res.menu, action: res.action };
                    //console.log(res.menu, res.action);
                    initNav(true);
                }
                return false;
            } // end success
        }); // -- End AJAX Call --
    }

    function initLogin(callback) {
        /// <summary>Anmelde-Dialog vorbereiten</summary>
        $j('#login').load('res/login.html', function () {
            ajaxLoading(false);

            // Submit-Handler
            $j("#login > form").submit(function () {
                $j('#login_response').html("");
                $j('#login_response').hide();
                // Button ausblenden
                $j('#bLogin').hide();
                // Ladehinweis anzeigen
                $j('#login_loading').show();
                var arForm = $j(this).serializeArray();

                // -- Start AJAX Call --
                $j.ajax({
                    beforeSend: null,
                    url: "php/login.php",
                    data: arForm,
                    contentType: "application/x-www-form-urlencoded",
                    //complete: function () { },
                    success: function (data) {
                        //console.log(data);
                        var res = data.d || data; //.d; asmx->wcf
                        // Button wieder einblenden
                        $j('#bLogin').show();
                        // Ladehinweis ausblenden
                        $j('#login_loading').hide();
                        if (res.ok) // Login OK?
                        {
                            $j("#login").dialog("close");
                            $j("#password").val("");
                            kt.loggedIn = true;
                            // Menü aktualisieren
                            makeMenu();
                            initNav(true);
                            // Benutzername anzeigen
                            $j("#username").html(res.username);
                            // Übersicht aufrufen
                            exec('Tipps', 'Uebersicht');
                        } else // Fehler
                        {
                            $j('#login_response').html(res.message);
                            $j('#login_response').show();
                        }
                        return false;
                    } // end success
                }); // -- End AJAX Call --
                return false;
            }); // end submit event

            if (callback) callback();
        }); // .load()
    }

    function showLogin() {
        /// <summary>Anmelde-Dialog anzeigen</summary>
        clearError();
        // Formular schon geladen?
        if (!$j("#login").html()) {
            // Formular laden, Funktion danach nochmal aufrufen
            initLogin(function () { showLogin(); });
        }
        else {
            // Formular anzeigen
            $j("#login").dialog({ modal: true, dialogClass: 'notitle', resizable: false });
        }
    }

    function logout() {
        $j.ajax({
            url: "php/logout.php",
            data: "",
            contentType: "application/x-www-form-urlencoded",
            success: function (data) {
                var res = data.d || data;
                if (res.ok) {
                    kt.loggedIn = false;
                    clearContent();
                    closeDialogs();
                    makeMenu();
                }
                return false;
            } // end success
        }); // -- End AJAX Call --
    }

    /****************************************************************************************************************************
    * Menü-Funktionen
    */
    function makeMenu() {
        /// <summary>Menü aufbauen</summary>

        initAjax();
        $j.ajax({
            url: "php/getMenu.php",
            data: "{}",
            dataType: 'json',
            success: function (data) {
                var mi = data.d || data,
					idx = 0,
					pre = 'menu',
					action = {},
                    menuitem, submenu, subitem;

                var menu = $j('<ul/>').attr('id', 'mainmenu');
                // Menü zusammenbauen
                $j.each(mi.menu.main, function (key, val) {
                    menuitem = $j('<li/>');
                    if (val.cls) menuitem.addClass(val.cls);
                    menuitem.append($j('<div/>').addClass('hdr').html(val.title));
                    submenu = $j('<ul/>');
                    $j.each(mi.menu[val.smenu], function (subkey, subval) {
                        if (kt[subval.smenu] && kt[subval.smenu][subval.action]) // nur implementierte Funktionen anzeigen
                        {
                            action[idx] = subval;
                            subitem = $j('<li/>');
                            subitem.append($j('<a/>').attr('href', '#').attr('id', pre + (idx++)).html(subval.title));
                            submenu.append(subitem);
                        }
                    });
                    if (submenu.children().length) { // nur Menüs mit Menüpunkten
                        menuitem.append(submenu);
                        menu.append(menuitem);
                    }
                });

                $j("#navmain").html('');
                $j("#navmain").append(menu);
                $j("#navmain").prepend('<div id="menu-icon">Menu</div>');
                $j("#menu-icon").unbind('click');
                $j("#menu-icon").on("click", function () {
                    $j("#mainmenu").slideToggle();
                    $j(this).toggleClass("active");
                });

                var h = $j('#mainmenu').height() + $j('#nav').height() + $j('#menu-icon').height() + 20;
                $j('#page').css('min-height', h);

                // onClick-Handler
                $j("#navmain a").click(function () {
                    // id des Menüpunkts ermitteln
                    var id = this.id;
                    id = id.replace(/menu/, "");
                    if (id) {
                        kt.menu(action[id].smenu, action[id].action);
                        // Titel anpassen
                        if (id > 0) setTitle(/*mi.menu[action[id].smenu].title + ' * ' + */action[id].title);
                        else setTitle("");
                    }
                });

                // Navbar ein-/ausblenden
                if (kt.loggedIn) {
                    $j('#nav').show();
                } else {
                    $j('#nav').hide();
                    $j("#menu-icon").click();
                }

                return true;
            }
        });      // -- End AJAX Call --

        return false;
    };

    /*
    function makeMenu() {
    /// <summary>Menü aufbauen</summary>

    initAjax();
    $j.ajax({
    url: "php/getMenu.php",
    data: "{}",
    dataType: 'json',
    success: function (data) {
    var items = [],
    mi = data.d || data,
    idx = 0,
    pre = 'menu',
    menu,
    subitems,
    action = {};

    // Menü zusammenbauen
    $j.each(mi.menu.main, function (key, val) {
    //console.log(val);
    var clsm = val.cls || '';
    if (clsm) clsm = ' class="' + clsm + '"';
    menu = '<li' + clsm + '><div class="hdr">' + val.title + '</div>';
    subitems = [];
    $j.each(mi.menu[val.smenu], function (subkey, subval) {
    if (kt[subval.smenu] && kt[subval.smenu][subval.action]) // nur implementierte Funktionen anzeigen
    {
    action[idx] = subval;
    var cls = subval.hidemini ? ' class="hidemini"' : '';
    subitems.push('<li><a href="#" id="' + pre + (idx++) + '"' + cls + '>' + subval.title + '</a></li>');
    }
    });
    if (subitems.length) { // nur Menüs mit Menüpunkten
    menu += '<ul>' + subitems.join('') + '</ul></li>';
    items.push(menu);
    }
    });

    $j("#navmain").html($j('<ul/>', { html: items.join('') }).attr('id', 'mainmenu'));
    $j("#navmain").prepend('<div id="menu-icon">Menu</div>');
    $j("#menu-icon").unbind('click');
    $j("#menu-icon").on("click", function () {
    $j("#mainmenu").slideToggle();
    $j(this).toggleClass("active");
    });

    var h = $j('#mainmenu').height() + $j('#nav').height() + $j('#menu-icon').height() + 20;
    $j('#page').css('min-height', h);

    // onClick-Handler
    $j("#navmain a").click(function () {
    // id des Menüpunkts ermitteln
    var id = this.id;
    id = id.replace(/menu/, "");
    if (id) {
    kt.menu(action[id].smenu, action[id].action);
    // Titel anpassen
    if (id > 0) setTitle(/*mi.menu[action[id].smenu].title + ' * ' + * /action[id].title);
    else setTitle("");
    }
    });

    // Navbar ein-/ausblenden
    if (kt.loggedIn) {
    $j('#nav').show();
    //if (kt.lastmenu) exec(kt.lastmenu.smenu, kt.lastmenu.action);
    } else {
    $j('#nav').hide();
    $j("#menu-icon").click();
    }

    return true;
    }
    });      // -- End AJAX Call --

    return false;
    };
    */
    function exec(smenu, action, param) {
        /// <summary>Menübefehl ausführen</summary>
        try {
            //window["kt"][smenu][action](param);
            kt.lastmenu = { smenu: smenu, action: action };
            kt[smenu][action](param);
        } catch (e) {
            console.log(e);
        }
    }

    // alle Dialogfenster schließen
    function closeDialogs() { $j(".ui-dialog-content:visible").dialog("close"); }

    this.trdata = function () { return $j("select#cbtrid").data("data") || {}; };
    this.mddata = function () { return $j("select#cbmd").data("data") || {}; };

    function initNav(refresh) {

        if (!refresh) {
            // Events anbinden            
            //cbtrid
            $j("select#cbtrid").change(function () {
                var data = trdata();
                kt.trid = parseInt($j("select#cbtrid").val());
                kt.curmd = data[kt.trid].curmd;
                kt.md = kt.curmd;
                initCbMd();
                refreshGrids();
            });
            //cbmd
            $j("select#cbmd").change(function () {
                kt.md = parseInt($j("select#cbmd").val());
                refreshGrids();
            });
            //bprev
            $j("button#bprev").click(function () {
                if (kt.md > 1) {
                    kt.md--;
                    $j("select#cbmd").val(kt.md);
                    refreshGrids();
                }
            });
            //bnext
            $j("button#bnext").click(function () {
                if (kt.md < kt.maxmd) {
                    kt.md++;
                    $j("select#cbmd").val(kt.md);
                    refreshGrids();
                }
            });
            //bcur
            $j("button#bcur").click(function () {
                if (kt.curmd > 0) {
                    kt.md = kt.curmd;
                    $j("select#cbmd").val(kt.md);
                    refreshGrids();
                }
            });
            //cbstyle
            $j("select#cbstyle").change(function () {
                var id = parseInt($j("select#cbstyle").val());
                setStyle(id);
            });
            initCbStyle();
        }
        initCbTr();
        initCbMd();
    }

    function initCbTr() {
        $j.ajax({
            type: 'POST',
            url: 'php/getTrList.php',
            data: "",
            async: false,
            success: function (result) {
                var data = result.data,
					items = [],
					item,
					sel = $j("select#cbtrid"),
					d = {};
                if (data.Rows) {
                    $j.each(data.Rows, function (key, val) {
                        item = '<option value="' + val.trid + '">' + val.Name + '&nbsp;&nbsp;</option>';
                        items.push(item);
                        d[val.trid] = val;
                    });
                    sel.data("data", d);
                    sel.html(items.join(''));

                    if (!kt.trid && data.Rows[0]) {
                        kt.trid = data.Rows[0].trid;
                        kt.curmd = data.Rows[0].curmd;
                    }
                    sel.val(kt.trid);
                }
            }
        });
    }

    function initCbMd() {
        $j.ajax({
            type: 'POST',
            url: 'php/getMdList.php',
            data: { trid: kt.trid },
            contentType: "application/x-www-form-urlencoded",
            async: false,
            success: function (result) {
                var data = result.data,
					items = [],
					item,
					sel = $j("select#cbmd"),
					d = {};

                if (data.Rows) {
                    $j.each(data.Rows, function (key, val) {
                        item = '<option value="' + val.sptag + '">' + val.Anzeige + '&nbsp;&nbsp;</option>';
                        items.push(item);
                        d[val.sptag] = val;
                    });
                    sel.data("data", d);
                    sel.html(items.join(''));
                    if (!kt.md) kt.md = kt.curmd;
                    if (data.Rows.length) kt.maxmd = data.Rows[data.Rows.length - 1].sptag;
                    sel.val(kt.md);
                }
            }
        });
    }

    function initCbStyle() {
        var items = [],
			item,
			sel = $j("select#cbstyle");
        $j.each(styles, function (key, val) {
            item = '<option value="' + key + '">' + val.label + '&nbsp;&nbsp;</option>';
            items.push(item);
        });
        sel.html(items.join(''));
    }

    /****************************************************************************************************************************
    * Dokument-/Seitentitel setzen
    */
    function setTitle(s) {
        var t = "Die Online-Tippgemeinschaft",
			hdr = $j("#pagetitle");
        if (s) t += " - " + s;
        // Dokumenttitel
        $j(document).attr("title", t);
        // Seitenüberschrift
        if (hdr.length) hdr.html(t);
    }

    /****************************************************************************************************************************
    * jqGrid-Funktionen
    */
    // Grid Defaults
    function initJqGrid() {
        /// <summary>jqGrid-Default werte und Spalten-Formatter definieren</summary>
        $j.jgrid.defaults = $j.extend($j.jgrid.defaults, {
            mtype: 'post',
            datatype: 'json',
            //jsonReader: { root: "d.rows", page: "d.page", total: "d.total", records: "d.records", repeatitems: false },
            ajaxGridOptions: { contentType: 'application/json; charset=utf-8' },
            ajaxDelOptions: { contentType: 'application/json; charset=utf-8' },
            ajaxEditOptions: { contentType: 'application/json; charset=utf-8' },
            serializeGridData: jqgSerializeGridData,
            serializeRowData: jqgSerializeGridData,
            serializeDelData: function (postData) { /* wird nicht aufgerufen? */return JSON.stringify({ data: postData }); },
            loadui: "block",
            multiboxonly: true,
            altRows: true,
            altclass: 'gridRowEven',
            autoencode: true,
            autowidth: true,
            gridview: true,
            hoverrows: true,
            viewrecords: true,
            sortable: false,
            headertitles: true,
            height: "auto",
            hidegrid: false,
            rowNum: 0,
            prmNames: { search: "srch" },
            // MA 23.02.2012
            loadError: jqgLoadError,
            beforeProcessing: jqgBeforeProcessing
        });

        /*
        // Formatter MA 10.02.2012
        $j.extend($j.fn.fmatter, {
        // ReSharper disable UnusedParameter
        img: function (cellvalue, options, rowdata) { return "<div class=\"" + cellvalue + "\">&nbsp;</div>"; }
        // ReSharper restore UnusedParameter
        });

        // MA 13.02.2012 Buttons aus Daten generieren
        $j.extend($j.fn.fmatter, {
        button: function (cellvalue, options, rowdata) {
        if (rowdata.action) {
        var act = rowdata.action,
        result = "",
        idx, cls;
        for (idx in act) {
        cls = 'btnGrid';
        // MA 08.03.2012 andere Klasse für Image-Buttons
        if (act[idx].img) cls += 'Img';

        result += "<button title='" + act[idx].label + "' type='button' class='" + cls + "' alt='" + act[idx].label + "' onclick=\"" + act[idx].action + "\">";
        if (act[idx].img)
        result += "<img src=\"/css/images/" + act[idx].img + "\" />";
        else
        result += act[idx].label;
        result += "</button>";
        }

        return result;
        }
        else return "";
        }
        });
        */

        $j.extend($j.fn.fmatter, { html: function (cellvalue) { return "<div>" + cellvalue + "</div>"; } });
        $j.extend($j.fn.fmatter, {
            logo: function (cellvalue) { return "<div class=\"logo l" + cellvalue + "\">&nbsp;</div>"; }
        });
    };

    // Daten in JSON-Format serialisieren
    function jqgSerializeGridData(data) { return JSON.stringify({ data: data }); }

    // wird nach Löschanforderung aufgerufen
    function jqgAfterDelSubmit(response) { //, postdata) {
        var json = $j.parseJSON(response.responseText), // eval('(' + response.responseText + ')'),
			res = json.d || json;

        if (res) {
            if (!res.ok) {
                showError(res.message);
            } else {
                if (res.message) showStatus(res.message, 5);
                //$j(this).trigger("reloadGrid");
                $j(this).trigger("refresh");
            }
            return [res.ok, res.message];
        }

        return [false, "Fehler", -1];
    }

    // wird nach Speicheranforderung aufgerufen
    function jqgAfterSaveFunc(id, response) {
        $j.unblockUI();
        var json = $j.parseJSON(response.responseText), //eval('(' + response.responseText + ')'),
			res = json.d || json;
        if (res) {
            if (!res.ok) {
                showError(res.message);
            } else {
                if (res.message) showStatus(res.message, 5);
                //$j(this).trigger("reloadGrid");
                $j(this).trigger("refresh");
            }
            return [res.ok, res.message];
        }
        return [false, "Fehler", -1];
    }

    // leeres Grid nach Laden ausblenden
    function hideEmptyGrid(grid) {
        var recs = $j(grid).getGridParam("records");
        if (recs == 0 || recs == null) $j("#gbox_" + grid.id).hide();
        else $j("#gbox_" + grid.id).show();
    };

    // ReSharper disable UnusedParameter
    function jqgLoadError(xhr, status, error) {
        // TODO console.log('jqgLoadError', xhr, status, error);
    }
    // ReSharper restore UnusedParameter

    function jqgBeforeProcessing(data) {
        /// <summary>Eventhandler, wird direkt nach dem Laden der Daten ausgeführt, bevor diese verarbeitet werden</summary>
        var res = data.d || data;
        if (res.NoLogin) {
            clearContent();
            setContent(res.message, true);
            makeMenu();
            return false;
        }

        if (res.message) showError(res.message, 10);

        return true;
    }

    /* Status Gruppierungs-Bereiche merken */
    function jqgSaveCollapsedState(grid, grpid, collapsed) {
        var data = $j(grid).data("cstate") || {};
        data[grpid] = collapsed;
        $j(grid).data("cstate", data);
    }

    function jqgRestoreCollapsedState(grid, gridcollapsed) {
        var data = $j(grid).data("cstate") || {};
        $j.each(data, function (grpid, collapsed) {
            // wenn gespeicherter Status vom Grid-Default-Status abweicht Gruppe auf-/zuklappen
            if (collapsed != gridcollapsed) $j(grid).jqGrid('groupingToggle', grpid);
        });
    }

    function jqgAddButton(gridid, pagerid, btn) {
        if (btn.caption == '-')
            $j(gridid).jqGrid('navGrid', pagerid).navSeparatorAdd(pagerid + "_left");
        else
            $j(gridid).jqGrid('navGrid', pagerid).navButtonAdd(pagerid + "_left", btn);
    }

    function jqgAddPrintButton(id) {
        var btn = { caption: 'Drucken', buttonicon: "icon-print", position: "last",
            onClickButton: function () {

                $j(".ui-jqgrid-pager").hide();
                var html = $j("#d" + id).html();
                $j(".ui-jqgrid-pager").show();

                // TODO

                var printWindow;
                printWindow = window.open('', 'productionReport');
                printWindow.document.write('<head><link rel="stylesheet" href="./css/print.css" /><link rel="stylesheet" href="css/ui.jqgrid.css" /></head>');
                printWindow.document.write('<html><body style="background-color:#ffffff"><div id="print">');
                printWindow.document.write(html);
                printWindow.document.write('</div></body></html>');
                printWindow.document.close();

            }
        };
        jqgAddToolbarButton("t_", id, btn);
    }

    /*
    *
    * The toolbar has the following properties
    *	id of top toolbar: t_<tablename>
    *	id of bottom toolbar: tb_<tablename>
    *	class of toolbar: ui-userdata
    * elem is the toolbar name to which button needs to be added. This can be
    *	#t_tablename - if button needs to be added to the top toolbar
    *	#tb_tablename - if button needs to be added to the bottom toolbar
    */
    this.jqgAddToolbarButton = function (bar, gridid, p) {
        p = $j.extend({
            caption: "newButton",
            title: '',
            buttonicon: 'none',
            onClickButton: function () { console.log(this.caption); /* TODO */ },
            position: "last"
        }, p || {});

        var elem = "#" + bar + "grid" + gridid,
			tbar = $j(elem),
			tableString = "<table cellspacing=\"0\" cellpadding=\"0\" border=\"0\" style=\"table-layout: auto;\"><tbody><tr></tr></table>",
			icon;

        tbar.addClass("ui-jqgrid-pager").addClass("ui-jqgrid-toolbar").removeClass("ui-userdata");
        //step 2
        if (tbar.children('table').length === 0) { tbar.append(tableString); }
        //step 3
        var tbd = $j("<td></td>");
        if (p.buttonicon && p.buttonicon != 'none') icon = "<span class='ui-icon " + p.buttonicon + "'></span>";
        else icon = "";
        if (p.select) {
            var select = createSelect(p);
            $j(tbd)//.addClass('ui-pg-selbox ui-corner-all')
				.append("<div class='ui-pg-div'>" + icon + p.caption || "" + "</div>").attr("title", p.title || "")
				.append(select);
        }
        else if (p.input) {
            var input = $j('<input/>').attr('id', p.id);
            input.addClass("ui-pg-input");
            input.addClass('rounded gradient');
            input.css('float', 'right');
            if (p.width) input.css('width', p.width);
            $j(tbd)//.addClass('ui-pg-input ui-corner-all')
				.append("<div class='ui-pg-div'>" + icon + p.caption || "" + "</div>").attr("title", p.title || "")
				.append(input);
        }
        else {
            $j(tbd).addClass('ui-corner-all') // ui-pg-button
				.append("<div class='btnGrid'>" + icon + p.caption + "</div>").attr("title", p.title || "") // ui-pg-div 
				.click(function (e) {
				    if ($j.isFunction(p.onClickButton)) {
				        p.onClickButton(e);
				    }
				    return false;
				});
            /*.hover(
            function () { $j(this).addClass("ui-state-hover"); },
            function () { $j(this).removeClass("ui-state-hover"); }
            );*/
            if (p.id) {
                $j(tbd).attr("id", p.id);
            }
        }

        if (p.align) { tbar.attr("align", p.align); }
        var findnav = tbar.children('table');
        if (p.position === 'first') {
            if ($j(findnav).find('td').length === 0) { $j("tr", findnav).append(tbd); }
            else { $j("tr td:eq(0)", findnav).before(tbd); }
        } else {
            $j("tr", findnav).append(tbd);
        }

        /*
        * Step 1: check whether a table is already added. If not add
        * Step 2: If there is no table already added then add a table
        * Step 3: Make the element ready for addition to the table
        * Step 4: Check the position and corresponding add the element
        * Step 5: Add other properties
        */
    };


    function jgqResize(id, opt) {
        //console.log(id, opt);

        var gridid = "#grid" + id,
			grid = $j(gridid),
			gparent = $j("#d" + id),
        //tw, wr,
			pw, gw;

        opt = opt || {};

        if (grid.length && gparent.length) {
            //pw = gparent.width();
            gparent = gparent.parent();
            pw = gparent.innerWidth();
            gw = grid.getGridParam('width');

            //console.log(id, pw, gw);

            // Minimalgröße
            if (opt.minwidth && pw < opt.minwidth) pw = opt.minwidth;

            // neue Größe, Grid verkleinern
            if (gw > pw) {
                grid.setGridWidth(pw);
                grid.trigger('gridresize');
            }
            // neue Größe, Grid vergrößern
            if (gw < pw) {
                if (pw > opt.size && !opt.fitparent) pw = opt.size;
                grid.setGridWidth(pw);
                grid.trigger('gridresize');
                //if (pw <= opt.size || opt.fitparent)
                //&& opt.fitparent) grid.setGridWidth(pw);
            }

            /*tw = grid.getGridParam('tblwidth');
            wr = grid.getGridParam('width');
            console.log(tw, wr, wr > tw);*/
            // if (wr > tw) grid.setGridWidth(tw, false);
        }


    }

    function jqgSort(id, sortname, sortorder, time) {
        //console.log(id, sortname, sortorder, time);
        //setTimeout('jQuery("' + id + '").sortGrid("' + sortname + '",true,"' + sortorder || 'asc' + '");', time);
        var cmd = "jQuery('" + id + "').sortGrid('" + sortname + "', true, '" + (sortorder || 'asc') + "');";
        //console.log(cmd);
        setTimeout(cmd, time);
        //setTimeout("jQuery('" + id + "').sortGrid('" + sortname + "', true, '" + sortorder || 'asc' + "');", time);
    }

    /****************************************************************************************************************************
    * Hilfsfunktionen
    */

    /*
    * http://forum.jquery.com/topic/blockui-centering-the-dialog-window
    */
    $j.fn.center = function () {
        this.css("position", "absolute");
        this.css("top", ($j(window).height() - this.height()) / 2 + $j(window).scrollTop() + "px");
        this.css("left", ($j(window).width() - this.width()) / 2 + $j(window).scrollLeft() + "px");
        return this;
    };

    this.createSelect = function (cfg) {
        var sel = $j("<select></select>");
        sel.addClass("ui-pg-selbox");
        sel.addClass('rounded gradient');
        sel.css('float', 'right');
        sel.change(function (e) {
            if ($j.isFunction(cfg.onChange)) { cfg.onChange(e); }
            return false;
        });

        // Optionen
        $j.ajax({
            type: 'POST',
            url: cfg.url,
            data: cfg.param || {},
            contentType: "application/x-www-form-urlencoded",
            async: false,
            success: function (result) {
                var data = result.data,
					items = [],
					item,
					d = {};

                if (data.Rows) {
                    $j.each(data.Rows, function (key, val) {
                        item = '<option value="' + val[cfg.selkey] + '">' + val[cfg.seldisp] + '&nbsp;&nbsp;</option>';
                        items.push(item);
                        d[val[cfg.selkey]] = val;
                    });
                    sel.data("data", d);
                    sel.html(items.join(''));
                }
            }
        });

        if (cfg.id) sel.attr("id", cfg.id);
        if (cfg.selval) sel.val(cfg.selval);

        return sel;
    };

    /*
    function getUrlVars() {
    /// <summary>URL-Variablen (GET-Parameter) ermitteln</summary>
    var vars = [],
    hash,
    hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&'),
    i;

    for (i = 0; i < hashes.length; i++) {
    hash = hashes[i].split('=');
    vars.push(hash[0]);
    vars[hash[0]] = hash[1];
    }
    return vars;
    }*/

    /*
    * 
    */
    function scrollTop() { window.scrollTo(0, 0); }

    /*
    * eval-Alternative
    */
    /*
    function runJs(code) {
    if (code) {
    try {
    //code = 'console.log(this, hvs, this.initForm);';
    var tmpFunc = new Function(code);
    return tmpFunc();
    }
    catch (e) {
    showError(e.message);
    return null;
    }
    }
    return null;
    }*/

} (window.kt = window.kt || {}, jQuery));