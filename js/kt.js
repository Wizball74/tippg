(function (kt, $j, undefined) {

    /**********************************************************************************************
    * Seite vorbereiten
    */
    kt.init = function () {

        initAjax();
        checkLogin();
        makeMenu();
        initNav();
        kt.initJqGrid();
        setTitle();

        // letzten Menüpunkt aufrufen
        $j(document).ready(function () {
            if (kt.lastmenu) exec(kt.lastmenu.smenu, kt.lastmenu.action);
        });

        //$j.extend(verge);
        //console.log($j.viewportW(), $j.viewportH());
    };

    /**********************************************************************************************
    * Menübefehl ausführen
    */
    kt.menu = function (smenu, action, param) {
        /// <summary>führt einen Menübefehl aus</summary>
        clearError();

        // $j("#menu-icon:visible").click();
        // Login
        if (action === 'login') { showLogin(); }
        // Logout
        else if (action === 'logout') { logout(); }
        // sonstige Funktionen
        else { exec(smenu, action, param); }
    };

    /****************************************************************************************************************************
    * Login-Funktionen
    */

    function checkLogin() {
        $j.ajax({
            url: "php/CheckLogin.php",
            data: "",
            contentType: "application/x-www-form-urlencoded",
            async: false,
            success: function (data) {
                var res = data.d || data;
                //console.log(data);
                if (res.ok) {
                    kt.loggedIn = res.loggedIn;
                    if (res.trid) kt.trid = res.trid;
                    if (res.md) kt.md = res.md;
                    if (res.username) $j("#username").html(res.username);
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
            //ajaxLoading(false);

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
                    $j("#username").html("");
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
            url: "php/GetMenu.php",
            data: "{}",
            dataType: 'json',
            success: function (data) {
                var mi = data.d || data,
					idx = 0,
					pre = 'menu',
					action = {},
                    menuitem, submenu, subitem, link;

                var menu = $j('#mainmenu');
                menu.html('');

                // Menü zusammenbauen
                $j.each(mi.menu.main, function (key, val) {
                    //if (val.cls) menuitem.addClass(val.cls);

                    submenu = $j('<ul/>').addClass('dropdown-menu');
                    $j.each(mi.menu[val.smenu], function (subkey, subval)
                    {
                        if (kt[subval.smenu] && kt[subval.smenu][subval.action]) // nur implementierte Funktionen anzeigen
                        {
                            action[idx] = subval;
                            subitem = $j('<li/>');
                            link = $j('<a/>').addClass('mi').attr('href', '#').attr('id', pre + (idx++)).html(subval.title);
                            subitem.append(link);
                            submenu.append(subitem);
                        }
                    });

                    //console.log(submenu, submenu.children().length);

                    if (submenu.children().length) {
                        menuitem = $j('<li/>').addClass('dropdown');
                        link = $j('<a/>').attr('href', '#').addClass('dropdown-toggle').html(val.title);
                        link.attr("data-toggle", "dropdown");
                        link.attr("role", "button");
                        link.attr("aria-haspopup", "true");
                        link.attr("aria-expanded", "false");
                        link.append($('<span/>').addClass('caret'));
                        menuitem.append(link);
                        menuitem.append(submenu);
                        menu.append(menuitem);
                    }
                    else
                    {
                        action[idx] = val;
                        menuitem = $j('<li/>');
                        menuitem.append($j('<a/>').addClass('mi').attr('href', '#').attr('id', pre + (idx++)).html(val.title));
                        //menuitem.append($j('<div/>').addClass('hdr').html(val.title));
                    }
                    //console.log(menuitem);
                    menu.append(menuitem);

                });
                
                
                /*
                var h = $j('#mainmenu').height() + $j('#nav').height() + $j('#menu-icon').height() + 20;
                $j('#page').css('min-height', h);*/

                //console.log(action);

                // onClick-Handler
                $j("#navbar a.mi").click(function () {
                    // id des Menüpunkts ermitteln
                    var id = this.id;
                    id = id.replace(/menu/, "");
                    //console.log(id, action, action[id]);
                    if (id) {
                        kt.menu(action[id].smenu, action[id].action);
                        // Titel anpassen
                        if (id > 0) setTitle(action[id].title); //*mi.menu[action[id].smenu].title + ' * ' + 
                        else setTitle("");

                        // Menü schliessen MA 10.01.2017
                        $j("#navbar").collapse('hide')
                    }
                });

                // Navbar ein-/ausblenden
                if (kt.loggedIn) {
                    $j('.navtr').show();
                } else {
                    $j('.navtr').hide();
                }

                return true;
            }
        });      // -- End AJAX Call --

        return false;
    };

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
            ////initCbStyle();
        }
        initCbTr();
        initCbMd();
    }

    function initCbTr() {
        $j.ajax({
            type: 'POST',
            url: 'php/GetTrList.php',
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
            url: 'php/GetMdList.php',
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

    /****************************************************************************************************************************
    * Ajax-Funktionen
    */

    function initAjax() {
        $j.ajaxSetup({
            type: "POST",
            contentType: "application/json; charset=utf-8",
            dataType: 'json',
            beforeSend: ajaxBeforeSend,
            complete: ajaxComplete,
            error: ajaxError
        }); //close $j.ajaxSetup(
    }

    function ajaxError(jqXhr) { showError(jqXhr.responseText); }

    function ajaxBeforeSend(xhr) {
        //xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        //xhr.setRequestHeader("Content-type", "application/json");
        //***hideMessages();
    }

    function ajaxComplete() { }

    /****************************************************************************************************************************
    * Fehler-Funktionen
    */

    this.showMessage = function (data, d) {
        /// <summary>Meldungen anzeigen</summary>

        //console.log("showMessage", data, d);
        if (data.type == Status.NoMsg) return;

        var opt = { html: data.message };
        switch(data.type)
        {
            case Status.OK: opt.class = 'status'; break;
            case Status.Warning: opt.class = 'warning'; break;
            case Status.Error: opt.class = 'error'; break;
        }

        var m = $j('<div/>', opt);
        //console.log(m);

        //var m = $j('<div/>').addClass('error').html(msg);
        $j('#msg').append(m);

        // automatisch ausblenden?
        if (d > 0) setTimeout('kt.clearError();', d * 1000);

        scrollTop();
    };

    this.hideMessages = function () {
        /// <summary>Meldung verstecken</summary>
        //console.log('hideMessages');
        $j('#msg').html('xyz');
    };

    /**********************************************************************************************
    * Fehlermeldung anzeigen
    */
    this.showError = function (msg, d) {
        /// <summary>Fehlermeldung anzeigen</summary>
        var data = { message: msg, type: Status.Error };
        showMessage(data, d);
    };

    /**********************************************************************************************
    * Fehlermeldung löschen
    */
    function clearError() {
        /// <summary>Fehleranzeige löschen</summary>

        $j('#msg').html('');
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

        // content = '<article class="shadow">' + content + '</article>';

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
    * Dokument-/Seitentitel setzen
    */
    function setTitle(s) {
        var t = "Die Online-Tippgemeinschaft",
			hdr = $j("#pagetitle");
        if (s) t += " - " + s;
        // Dokumenttitel
        $j(document).attr("title", t);
        // Seitenüberschrift
        if (hdr.length) hdr.html(t); // TODO

        //console.log($j(".navbar-brand"));
        //$j("#dbg").html(verge.viewportW() + "x" + verge.viewportH());
    }

    function exec(smenu, action, param) {
        /// <summary>Menübefehl ausführen</summary>
        try {
            //window["kt"][smenu][action](param);
            kt.lastmenu = { smenu: smenu, action: action };
            kt[smenu][action](param);
        } catch (e) {
            console.log(e, smenu, action, param);
        }
    }

    // alle Dialogfenster schließen
    function closeDialogs() { $j(".ui-dialog-content:visible").dialog("close"); }

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

    function scrollTop() { window.scrollTo(0, 0); }

    /*
    * http://forum.jquery.com/topic/blockui-centering-the-dialog-window
    */
    $j.fn.center = function () {
        this.css("position", "absolute");
        this.css("top", ($j(window).height() - this.height()) / 2 + $j(window).scrollTop() + "px");
        this.css("left", ($j(window).width() - this.width()) / 2 + $j(window).scrollLeft() + "px");
        return this;
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
    this.Status = {
        NoMsg : 0,
        OK: 1,
        Warning: 2,
        Error: 3,
    };

} (window.kt = window.kt || {}, jQuery));