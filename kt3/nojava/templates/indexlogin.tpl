<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Strict//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html>
  <head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <title>{H_TITLE}</title>
    <LINK rel="stylesheet" TYPE="text/css" href="style.css">
  </head>

  <body leftMargin="0" topMargin="0" marginheight="0" marginwidth="0">

  <div id="main">
  <div id="border">
    <div id="title">
      <h1>
        {H_TITLE}
      </h1>
    </div>
    <div id="menu">
      <div id="menusitelinks" class="menus">
        <!-- BEGIN main_menu -->
          <a href="{main_menu.M_LINK}">{main_menu.M_LABEL}</a><br>
        <!-- END main_menu -->
      </div>
    </div>
    <div id="content" class="content">
    {REDIRECT}
    <br>
    <font color=red>{LOGINERROR}</font>
    {LOGIN}