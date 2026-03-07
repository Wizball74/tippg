<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Strict//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html>
  <head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <title>{H_MENU} {H_SUBMENU}</title>
    <LINK rel="stylesheet" TYPE="text/css" href="style.css">
  </head>

  <body leftMargin="0" topMargin="0" marginheight="0" marginwidth="0">

  <div id="main">
  <div id="border">
    <div id="title">
      <h1>
      {H_MENU} {H_SUBMENU}
      </h1>
    </div>
      <div id="title">
      <h2>
        <form name="nav" action="index.php" method=GET target="_self">
        <table width=90%>
        <tr>
          <td width=25%>
            <input type=hidden name="smenu" value="{smenu}">
            <input type=hidden name="action" value="{action}">
          </td>
          <td align=center>
            <select name="trid" class="select" onChange="document.nav.submit()">
        <!-- BEGIN tr_list -->
            <option value="{tr_list.trid}" {tr_list.selected}>{tr_list.name}</option>
        <!-- END tr_list -->
            </select>
            <select name="sptag" class="select" onChange="document.nav.submit()">
        <!-- BEGIN sptag_list -->
            <option value="{sptag_list.sptag}" {sptag_list.selected}>{sptag_list.name}</option>
        <!-- END sptag_list -->
            </select>
            <input type=submit name="sptagbtn" value="-">
            <input type=submit name="sptagbtn" value="+">
            <input type=submit name="sptagbtn" value="Akt.">
          </td>
          <td align=right width=25%>{USERNAME}</td>
        </tr>
        </table>
        </form>
        </h2>
      </div>
    <div id="menu">
      <div id="menusitelinks" class="menus">
    <!-- BEGIN main_menu -->
          <a href="{main_menu.M_LINK}" class="{main_menu.M_CLASS}" target="{main_menu.M_TARGET}">{main_menu.M_LABEL}</a><br>
        <!-- BEGIN sub_menu -->
            <a href="{main_menu.sub_menu.S_LINK}" class="sub{main_menu.sub_menu.S_CLASS}">&nbsp;&nbsp;{main_menu.sub_menu.S_LABEL}</a><br>
        <!-- END sub_menu -->
    <!-- END main_menu -->
      </div>
    </div>
    <div id="content" class="content">
    {REDIRECT}
