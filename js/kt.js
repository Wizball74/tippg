(function (kt, $j, undefined) {

    /**********************************************************************************************
    * Seite vorbereiten
    */
    kt.init = function () {

        initAjax();
        checkLogin(function () {
            makeMenu();
            initNav(false, function () {
                kt.initJqGrid();
                setTitle();

                // letzten Menüpunkt aufrufen (nur wenn trid/md gesetzt)
                if (kt.lastmenu && kt.trid && kt.md) exec(kt.lastmenu.smenu, kt.lastmenu.action);

                // Fußball-Physik starten (nur Desktop, wenn nicht deaktiviert)
                if (kt.initBall && localStorage.getItem('kt_ball') !== 'off') kt.initBall();

                // Nicht eingeloggt? Login-Dialog direkt anzeigen
                if (!kt.loggedIn) showLogin();
            });
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

    function checkLogin(callback) {
        $j.ajax({
            url: "php/CheckLogin.php",
            data: "",
            contentType: "application/x-www-form-urlencoded",
            success: function (data) {
                var res = data.d || data;
                //console.log(data);
                if (res.ok) {
                    kt.loggedIn = res.loggedIn;
                    if (res.trid) kt.trid = res.trid;
                    if (res.md) kt.md = res.md;
                    if (res.username) $j("#username").text(res.username);
                    if (res.menu && res.action) kt.lastmenu = { smenu: res.menu, action: res.action };
                    //console.log(res.menu, res.action);
                }
                if (callback) callback();
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
                            // Benutzername anzeigen
                            $j("#username").text(res.username);
                            // Navigation laden, dann Übersicht aufrufen
                            initNav(true, function () {
                                exec('Tipps', 'Uebersicht');
                            });
                        } else // Fehler
                        {
                            $j('#login_response').text(res.message);
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
            $j("#login").dialog({ modal: true, dialogClass: 'notitle', resizable: false, closeOnEscape: false, position: { my: 'center', at: 'center', of: window } });
            $j("#login").closest('.ui-dialog').find('.ui-dialog-titlebar').hide();
            // Bei Resize zentriert halten
            $j(window).off('resize.loginCenter').on('resize.loginCenter', function() {
                if ($j("#login").closest('.ui-dialog').is(':visible')) {
                    $j("#login").dialog('option', 'position', { my: 'center', at: 'center', of: window });
                }
            });
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
                    $j("#username").text("");
                    $j("#subnav").html("");
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

                // Menüstruktur fuer Subnav speichern
                kt._menuGroups = {};

                // Menü zusammenbauen
                $j.each(mi.menu.main, function (key, val) {
                    //if (val.cls) menuitem.addClass(val.cls);

                    submenu = $j('<ul/>').addClass('dropdown-menu');
                    var groupItems = [];
                    $j.each(mi.menu[val.smenu], function (subkey, subval)
                    {
                        if (kt[subval.smenu] && kt[subval.smenu][subval.action]) // nur implementierte Funktionen anzeigen
                        {
                            action[idx] = subval;
                            groupItems.push(subval);
                            subitem = $j('<li/>');
                            link = $j('<a/>').addClass('mi').attr('href', '#').attr('id', pre + (idx++)).html(subval.title);
                            subitem.append(link);
                            submenu.append(subitem);
                        }
                    });
                    // Alle Unterpunkte dieser Gruppe merken
                    if (groupItems.length) {
                        $j.each(groupItems, function(gi, item) {
                            kt._menuGroups[item.smenu + '.' + item.action] = { title: val.title, items: groupItems };
                        });
                    }

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

                // Theme-Switcher in die Navbar
                (function() {
                    var themes = [
                        { id: 'classic', label: 'Klassisch',  desc: 'Alles wie immer eigentlich' },
                        { id: 'modern',  label: 'Modern',     desc: 'Wie klassisch, aber besser' },
                        { id: 'premium', label: 'Dunkel',     desc: '\u201eIch bin der Schrecken, der die Nacht durchflattert\u201c' }
                    ];
                    var cur = localStorage.getItem('kt_theme') || 'classic';
                    var li = $j('<li class="dropdown kt-theme-switch"/>');
                    var toggle = $j('<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false"/>');
                    toggle.html('<span class="kt-theme-icon">&#9788;</span>');
                    var ul = $j('<ul class="dropdown-menu dropdown-menu-right kt-theme-menu"/>');
                    $j.each(themes, function(i, t) {
                        var a = $j('<a href="#"/>').attr('data-theme', t.id)
                            .append($j('<span class="kt-theme-label"/>').text(t.label))
                            .append($j('<span class="kt-theme-desc"/>').text(t.desc));
                        if (t.id === cur) a.addClass('kt-theme-active');
                        a.click(function(e) {
                            e.preventDefault();
                            window.ktSetTheme(t.id);
                            ul.find('a').removeClass('kt-theme-active');
                            $j(this).addClass('kt-theme-active');
                        });
                        ul.append($j('<li/>').append(a));
                    });
                    li.append(toggle).append(ul);
                    menu.append(li);
                })();

                // Fußball-Toggle (neben der Sonne)
                (function() {
                    var ballOn = localStorage.getItem('kt_ball') !== 'off';
                    var ballLi = $j('<li class="kt-ball-toggle"/>');
                    var ballBtn = $j('<a href="#" role="button" title="Fußball an/aus"/>');
                    ballBtn.html('<span class="kt-theme-icon" style="font-size:15px">&#9917;</span>');
                    if (!ballOn) ballBtn.css('opacity', '0.3');
                    ballBtn.click(function(e) {
                        e.preventDefault();
                        var isOn = localStorage.getItem('kt_ball') !== 'off';
                        if (isOn) {
                            localStorage.setItem('kt_ball', 'off');
                            ballBtn.css('opacity', '0.3');
                            if (kt.destroyBall) kt.destroyBall();
                        } else {
                            localStorage.setItem('kt_ball', 'on');
                            ballBtn.css('opacity', '');
                            if (kt.initBall) kt.initBall();
                        }
                    });
                    ballLi.append(ballBtn);
                    menu.append(ballLi);
                })();

                // Sound-Toggle (neben dem Fußball)
                (function() {
                    var sndOn = localStorage.getItem('kt_sound') !== 'off';
                    var sndLi = $j('<li class="kt-sound-toggle"/>');
                    var sndBtn = $j('<a href="#" role="button" title="Sound an/aus"/>');
                    sndBtn.html('<span class="kt-theme-icon" style="font-size:14px">' + (sndOn ? '&#128266;' : '&#128264;') + '</span>');
                    if (!sndOn) sndBtn.css('opacity', '0.3');
                    sndBtn.click(function(e) {
                        e.preventDefault();
                        var isOn = localStorage.getItem('kt_sound') !== 'off';
                        if (isOn) {
                            localStorage.setItem('kt_sound', 'off');
                            sndBtn.css('opacity', '0.3');
                            sndBtn.find('.kt-theme-icon').html('&#128264;');
                        } else {
                            localStorage.setItem('kt_sound', 'on');
                            sndBtn.css('opacity', '');
                            sndBtn.find('.kt-theme-icon').html('&#128266;');
                        }
                        if (kt.setBallSound) kt.setBallSound(!isOn);
                    });
                    sndLi.append(sndBtn);
                    menu.append(sndLi);
                })();

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
                    $j('.navtr').removeClass('navtr-hidden');
                    $j('#mainmenu > li:not(.kt-theme-switch):not(.kt-ball-toggle):not(.kt-sound-toggle)').show();
                } else {
                    $j('.navtr').addClass('navtr-hidden');
                    $j('#mainmenu > li:not(.kt-theme-switch):not(.kt-ball-toggle):not(.kt-sound-toggle)').hide();
                }

                return true;
            }
        });      // -- End AJAX Call --

        return false;
    };

    kt.trdata = function () { return $j("select#cbtrid").data("data") || {}; };
    kt.mddata = function () { return $j("select#cbmd").data("data") || {}; };

    function initNav(refresh, onReady) {

        if (!refresh) {
            // Events anbinden            
            //cbtrid
            $j("select#cbtrid").change(function () {
                var data = kt.trdata();
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
                var id = $j("select#cbstyle").val();
                if (window.ktSetTheme) window.ktSetTheme(id);
            });
            ////initCbStyle();
        }
        initCbTr(function () {
            initCbMd(onReady);
        });
    }

    function initCbTr(callback) {
        $j.ajax({
            type: 'POST',
            url: 'php/GetTrList.php',
            data: "",
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
                        kt.md = data.Rows[0].curmd;
                    }
                    // curmd immer aus den Daten setzen
                    if (d[kt.trid]) kt.curmd = d[kt.trid].curmd;
                    if (!kt.md) kt.md = kt.curmd;
                    sel.val(kt.trid);
                }
                if (callback) callback();
            }
        });
    }

    function initCbMd(callback) {
        $j.ajax({
            type: 'POST',
            url: 'php/GetMdList.php',
            data: { trid: kt.trid },
            contentType: "application/x-www-form-urlencoded",
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
                if (callback) callback();
            }
        });
    }

    /****************************************************************************************************************************
    * Ajax-Funktionen
    */

    function initAjax() {
        $j.ajaxSetup({
            type: "POST",
            contentType: "application/x-www-form-urlencoded; charset=UTF-8",
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
        if (data.type == Status.NoMsg) return;

        var cls = 'kt-toast';
        switch(data.type) {
            case Status.OK: cls += ' kt-toast-ok'; break;
            case Status.Warning: cls += ' kt-toast-warn'; break;
            case Status.Error: cls += ' kt-toast-error'; break;
        }

        var toast = $j('<div/>').addClass(cls).text(data.message);
        $j('body').append(toast);

        // einblenden
        setTimeout(function() { toast.addClass('kt-toast-show'); }, 10);

        // ausblenden
        var delay = (d > 0) ? d * 1000 : 4000;
        setTimeout(function() {
            toast.removeClass('kt-toast-show');
            setTimeout(function() { toast.remove(); }, 400);
        }, delay);
    };

    this.hideMessages = function () {
        $j('.kt-toast').remove();
    };

    /**********************************************************************************************
    * Fehlermeldung anzeigen
    */
    this.showError = function (msg, d) {
        var data = { message: msg, type: Status.Error };
        showMessage(data, d);
    };

    /**********************************************************************************************
    * Fehlermeldung löschen
    */
    function clearError() {
        $j('.kt-toast').remove();
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

        // Fußball-Hindernisse nach Content-Wechsel aktualisieren
        if (kt.rescanBallObstacles) kt.rescanBallObstacles();
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

    // Seiten die den Spieltag-Wähler brauchen
    var MD_PAGES = { 'Tipps.Uebersicht':1, 'Tipps.Tippabgabe':1, 'Spielplan.Spielplan':1, 'Spielplan.Tabelle':1, 'Liga.Spielplan':1, 'Liga.Tabellen':1, 'Admin.Spielplan':1 };

    function setNavMdEnabled(enabled) {
        var $els = $j('#cbmd, #bprev, #bnext, #bcur');
        $els.prop('disabled', !enabled);
        $els.css('opacity', enabled ? '' : '0.35');
    }

    function exec(smenu, action, param) {
        /// <summary>Menübefehl ausführen</summary>
        try {
            //window["kt"][smenu][action](param);
            kt.lastmenu = { smenu: smenu, action: action };
            kt[smenu][action](param);
            updateSubnav(smenu, action);
            setNavMdEnabled(!!MD_PAGES[smenu + '.' + action]);
        } catch (e) {
            console.log(e, smenu, action, param);
        }
    }

    function updateSubnav(smenu, action) {
        var $sub = $j('#subnav');
        var group = kt._menuGroups && kt._menuGroups[smenu + '.' + action];
        if (!group || group.items.length < 2) { $sub.html(''); return; }

        // Hauptmenu-Punkt hervorheben
        $j('#mainmenu > li').removeClass('active');
        $j('#mainmenu > li > a.dropdown-toggle, #mainmenu > li > a.mi').each(function() {
            if ($j(this).text().replace(/\s/g, '') === group.title.replace(/\s/g, '')) {
                $j(this).parent().addClass('active');
            }
        });

        // Subnav aufbauen
        var html = '';
        $j.each(group.items, function(i, item) {
            var cls = (item.smenu === smenu && item.action === action) ? 'subnav-item active' : 'subnav-item';
            html += '<a href="#" class="' + cls + '" data-smenu="' + item.smenu + '" data-action="' + item.action + '">' + item.title + '</a>';
        });
        $sub.html(html);

        // Click-Handler
        $sub.find('a').off('click').on('click', function(e) {
            e.preventDefault();
            var s = $j(this).data('smenu'), a = $j(this).data('action');
            kt.menu(s, a);
            setTitle($j(this).text());
        });
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
    var Status = {
        NoMsg : 0,
        OK: 1,
        Warning: 2,
        Error: 3,
    };
    kt.Status = Status;

} (window.kt = window.kt || {}, jQuery));