(function (kt, $j, undefined) {

	// Grid Defaults
	kt.initJqGrid = function () {
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
			//autowidth: true,
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
			beforeProcessing: jqgBeforeProcessing,
		    // MA 10.01.2017
			//width: verge.viewportW(),
		    //responsive:  true,
		    //styleUI: 'Bootstrap'
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

	/**********************************************************************************************
	* jqGrid erstellen
	*/

	kt.autoGrid = function (id, title, options) {
		//editable, events, addparam, btn) {
		var opt = options || {},
			gridid = "#grid" + id,
			pagerid = "#pager" + id,
			pager = $j(pagerid),
			//url = opt.url || 'php/Get' + id + 'Data.php',
			url = opt.url || 'php/GetData.php',
			postparam = $j("#d" + id).data("params") || {},
			keycol, pgparams,
			events,
			init = true;

		$j.extend(postparam, { trid: kt.trid, md: kt.md, fn: id });
		if (kt.lastmenu) $j.extend(postparam, { menu: kt.lastmenu.smenu, action: kt.lastmenu.action });
		if (opt.addparam) $j.extend(postparam, opt.addparam);

	    // MA 10.01.2017
		$j.extend(postparam, { _w: verge.viewportW(), _h: verge.viewportH() });

		$j("#d" + id).data("params", postparam);

		////ajaxLoading(true);
		// Grid erstellen
		$j.ajax({
			type: 'POST',
			url: url,
			data: postparam || {},
			dataType: "json",
			mtype: "POST",
			contentType: "application/x-www-form-urlencoded",
			success: function (result) {
				// Datenmodell
				var res = result.d || result,
					gdata = res.data.Rows,
					cfg = {
						editurl: 'php/Save' + id + 'Data.php',
						mtype: "POST",
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
						var vw = verge.viewportW();
						var containerW = $j('#d' + id).parent().width() || $j('#content').width() || vw;
						if (vw < 768 && w > vw) {
							// Mobile: Grid behält natürliche Breite, Container scrollt
							cfg.width = w;
							cfg.shrinkToFit = false;
						} else {
							// Desktop: mindestens Containerbreite nutzen
							cfg.width = Math.max(w, containerW);
						}
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
										$j("#" + r[keycol] + "_Date").datepicker({
										    dateFormat: "dd.mm.yy",
										    showOn: "button",
										    buttonImage: "css/images/calendar.gif",
										    buttonImageOnly: true,
										});
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

							// Mindestbreite: Spalten duerfen Text nicht abschneiden
							(function() {
								var $g = $j(gridid);
								var cm = $g.jqGrid('getGridParam', 'colModel') || [];
								var $jqg = $g.closest('.ui-jqgrid');
								var htable = $jqg.find('.ui-jqgrid-htable');
								var btable = $g;
								var canvas = document.createElement('canvas');
								var ctx = canvas.getContext('2d');
								var totalDelta = 0;

								$j.each(cm, function(ci, col) {
									if (col.hidden) return;
									var maxW = 0;
									// Textbreite in Body-Zellen messen
									btable.find('td[aria-describedby="' + $g.attr('id') + '_' + col.name + '"]').each(function() {
										var el = $j(this);
										ctx.font = el.css('font-weight') + ' ' + el.css('font-size') + ' ' + el.css('font-family');
										var tw = Math.ceil(ctx.measureText(el.text()).width) + 12;
										if (tw > maxW) maxW = tw;
									});
									var curW = col.width || 0;
									if (maxW > curW) {
										var delta = maxW - curW;
										totalDelta += delta;
										// Header und Body Spaltenbreite anpassen
										htable.find('th').eq(ci).css('width', maxW + 'px');
										btable.find('tr:first td').eq(ci).css('width', maxW + 'px');
										col.width = maxW;
									}
								});
								// Gesamtbreite des Grids anpassen
								if (totalDelta > 0) {
									var gw = $g.jqGrid('getGridParam', 'width') || $g.width();
									var newW = gw + totalDelta;
									htable.css('width', newW + 'px');
									btable.css('width', newW + 'px');
									$jqg.css('width', newW + 'px');
									$jqg.find('.ui-jqgrid-hdiv, .ui-jqgrid-bdiv').css('width', newW + 'px');
								}
							})();

							if (init) {

							    jqgAddPrintButton(id);

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
												{ serializeDelData: jqgSerializeGridData, afterSubmit: jqgAfterDelSubmit }); // Del

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

							////ajaxLoading(false);
						}
					}
				);

				if (opt.hideempty) $j.extend(events, { gridComplete: function () { hideEmptyGrid(this); } });

				//console.log('EA', events, cfg);
				if (events) $j.extend(cfg, events);
				//console.log('cfg', cfg);

				// Grid erstellen
				$j(gridid).jqGrid(cfg);
				// Mobile: Inline overflow-Styles entfernen, damit CSS-Scroll greift
				if (verge.viewportW() < 768) {
					$j(gridid).closest('.ui-jqgrid').find('.ui-jqgrid-bdiv, .ui-jqgrid-hdiv').css({
						'overflow-x': 'visible',
						'overflow-y': 'visible'
					});
				// Frozen columns: Header-Zelle der Name-Spalte fuer sticky markieren
				$j.each(res.colModel, function(idx, col) {
					if (col.classes && col.classes.indexOf('Name') >= 0) {
						$j(gridid).closest('.ui-jqgrid').find('.ui-jqgrid-hdiv th').eq(idx).addClass('frozen-col');
					}
				});
				// Sticky header: Kopfzeile bleibt oben kleben beim vertikalen Scrollen
				(function() {
					var $jqgrid = $j(gridid).closest('.ui-jqgrid');
					var $hdiv = $jqgrid.find('.ui-jqgrid-hdiv');
					var $ktgrid = $jqgrid.closest('.ktgrid');
					if (!$hdiv.length || !$ktgrid.length) return;
					$j(window).on('scroll.stickyHdr' + id, function() {
						var rect = $ktgrid[0].getBoundingClientRect();
						var hh = $hdiv.outerHeight();
						if (rect.top < 0 && rect.bottom > hh * 2) {
							$hdiv.css('transform', 'translateY(' + (-rect.top) + 'px)');
							$hdiv.addClass('stuck');
						} else {
							$hdiv.css('transform', '');
							$hdiv.removeClass('stuck');
						}
					});
				})();
				}
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
					//$j(gridid).jqGrid('GridUnload');
					$j.jgrid.gridUnload(gridid);
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

	function jqgSort(id, sortname, sortorder, time) {
		//console.log(id, sortname, sortorder, time);
		//setTimeout('jQuery("' + id + '").sortGrid("' + sortname + '",true,"' + sortorder || 'asc' + '");', time);
		var cmd = "jQuery('" + id + "').sortGrid('" + sortname + "', true, '" + (sortorder || 'asc') + "');";
		//console.log(cmd);
		setTimeout(cmd, time);
		//setTimeout("jQuery('" + id + "').sortGrid('" + sortname + "', true, '" + sortorder || 'asc' + "');", time);
	}

	function jqgAddPrintButton(id) {
	    if (verge.viewportW() <= 640) return; // MA 10.01.2017
		var btn = {
			caption: 'Drucken', buttonicon: "icon-print", position: "last",
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

		tbar.addClass("btn");
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
                .append($j('<div/>').addClass('ui-pg-div').append(select));
				//.append("<div class='ui-pg-div'>").append(select).append("</div>");
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

	// leeres Grid nach Laden ausblenden
	function hideEmptyGrid(grid) {
		var recs = $j(grid).getGridParam("records");
		if (recs == 0 || recs == null) $j("#gbox_" + grid.id).hide();
		else $j("#gbox_" + grid.id).show();
	};

	// Daten in JSON-Format serialisieren
	function jqgSerializeGridData(data) { return JSON.stringify({ data: data }); }

	// wird nach Löschanforderung aufgerufen
	function jqgAfterDelSubmit(response) { //, postdata) {
		var json = $j.parseJSON(response.responseText), // eval('(' + response.responseText + ')'),
			res = json.d || json;

		if (res) {
		    showMessage(res, 5);
		    if (res.ok) {
				//$j(this).trigger("reloadGrid");
				$j(this).trigger("refresh");
			}
			return [res.ok, res.message];
		}

		return [false, "Fehler", -1];
	}

	// wird nach Speicheranforderung aufgerufen
	function jqgAfterSaveFunc(id, response) {
		////$j.unblockUI();
		var json = $j.parseJSON(response.responseText), //eval('(' + response.responseText + ')'),
			res = json.d || json;
		if (res) {
		    showMessage(res, 5);
		    if (res.ok) {
		        //$j(this).trigger("reloadGrid");
				$j(this).trigger("refresh");
			}
			return [res.ok, res.message];
		}
		return [false, "Fehler", -1];
	}

	function jqgLoadError(xhr, status, error) {
		// TODO console.log('jqgLoadError', xhr, status, error);
	}

	function jqgBeforeProcessing(data) {
		/// <summary>Eventhandler, wird direkt nach dem Laden der Daten ausgeführt, bevor diese verarbeitet werden</summary>
		var res = data.d || data;
		if (res.NoLogin) {
			clearContent();
			setContent(res.message, true);
			makeMenu();
			return false;
		}

		showMessage(res, 10);

		return true;
	}


	// Grid-Groessenanpassung
	function jgqResize(id, opts) {
		var gridid = "#grid" + id,
			gw = opts.size || 0,
			pw = $j("#d" + id).parent().width();
		if (pw > 0 && pw !== gw) {
			$j(gridid).jqGrid('setGridWidth', Math.max(pw, opts.minwidth || 320), true);
		}
	}

	// Orientation change: resize all visible grids
	$j(window).on('orientationchange resize', function () {
		clearTimeout(window._ktResizeTimer);
		window._ktResizeTimer = setTimeout(function () {
			$j('table[id^="grid"]').each(function () {
				var id = this.id.replace('grid', ''),
					pw = $j("#d" + id).parent().width();
				if (pw > 0) {
					$j(this).jqGrid('setGridWidth', Math.max(pw, 320), true);
				}
			});
		}, 250);
	});

}(window.kt = window.kt || {}, jQuery));