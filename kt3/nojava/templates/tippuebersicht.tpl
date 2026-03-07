{SORT}
<table>
  <tr class=chdr>
    <td></td>
    <!-- BEGIN l_header -->
      <td class=chdr3 align=center width=60>{l_header.HTeam}<br><font color="FF9999">{l_header.Erg}</font><br>{l_header.ATeam}</td>
      <td></td>
    <!-- END l_header -->
    <td></td>
  </tr>
  <!-- BEGIN l_datarow -->
    <tr class="{l_datarow.CLASS}">
    <td>{l_datarow.Tipper}</td>
    <!-- BEGIN l_datacol -->
      <td align=center>{l_datarow.l_datacol.Tipp}</td>
      <td><b><font color="FF9999">{l_datarow.l_datacol.Punkte}</font></b></td>
    <!-- END l_datacol -->
    <td align=right class=sum width=30><b>{l_datarow.Punkte}</b></td>
    <td align=right class=sum width=50><b>{l_datarow.Praemie}</b></td>
    </tr>
  <!-- END l_datarow -->
</table>