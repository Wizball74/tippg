<script type="text/javascript">
function chkFormular ()
{

  for (i = 0; i < document.Tipps.length; ++i)
  {
    if (document.Tipps.elements[i].name.indexOf("Tipp") != -1)
    {
      if (document.Tipps.elements[i].value.length < 3)
      {
          alert("Kein Ergebnis eingegeben !");
          document.Tipps.elements[i].focus();
          return false;
      }

      var chkZ = 1;
      for (j = 0; j < document.Tipps.elements[i].value.length; ++j)
        if ((document.Tipps.elements[i].value.charAt(j) < "0" ||
            document.Tipps.elements[i].value.charAt(j) > "9") &&
            (document.Tipps.elements[i].value.charAt(j) != ":"))
          chkZ = -1;
      if (chkZ == -1)
      {
          alert("Ungültiges Zeichen !");
          document.Tipps.elements[i].focus();
          return false;
      }
    }
  }
}
</script>

<h3>{MESSAGE}</h3>
<table cellspacing=5 cellpadding=1>
  <form name="Tipps" action="" method="post" onSubmit="return chkFormular()">
  <input type="hidden" name="action" value="{F_ACTION}">
  <!-- BEGIN hidden -->
    <input type="hidden" name="{hidden.NAME}" value="{hidden.VALUE}">
  <!-- END hidden -->
  <tr class=chdr>
    <!-- BEGIN l_header -->
      <td class=chdr2>{l_header.H_LABEL}</td>
    <!-- END l_header -->
  </tr>
  <!-- BEGIN l_datarow -->
    <tr class="{l_datarow.CLASS}">
    <!-- BEGIN l_datacol -->
      <td align="{l_datarow.l_datacol.ALIGN}">{l_datarow.l_datacol.VALUE}</td>
    <!-- END l_datacol -->
    <!-- BEGIN l_input -->
      <td>
      <input name="{l_datarow.l_input.NAME}" type="text" size="{l_datarow.l_input.SIZE}"
                 maxlength="{l_datarow.l_input.SIZE}" value="{l_datarow.l_input.VALUE}" {l_datarow.l_input.DISABLED} class="{l_datarow.l_input.CLASS}">
      </td>
    <!-- END e_input -->
    </tr>
  <!-- END l_datarow -->
  <tr>
  <td colspan=5 align=center>Abgabeschluss : <b><font color="FF9999">{DEADLINE}</font><b></td>
  </tr>
  <tr>
  <td colspan=5 align=center>Tippabgabe in der Form : 1:0, 3:4, 2:2, ...</td>
  </tr>
  <tr class="{e_button.CLASS}">
  <td colspan=5 align=center><input type="submit" value=" OK ">
                   <input type="reset" value=" Reset "></td>
  </tr>
</table>