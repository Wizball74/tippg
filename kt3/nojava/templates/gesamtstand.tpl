
<table>
  <tr class=chdr>
    <td></td>
    <td></td>
    <td></td>
    <!-- BEGIN l_header -->
      <td class=chdr4 align=center width=15>{l_header.SpTag}</td>
    <!-- END l_header -->
    <td></td>
  </tr>
  <!-- BEGIN l_datarow -->
    <tr class="{l_datarow.CLASS}">
    <td align=right>{l_datarow.Platz}</td>
    <td>{l_datarow.Tipper}</td>
    <td align=right class=sum width=30><b>{l_datarow.Punkte}</b></td>
    <!-- BEGIN l_datacol -->
      <td align=right  class=chdr4>{l_datarow.l_datacol.Punkte}</td>
    <!-- END l_datacol -->
    <td align=right>{l_datarow.Praemie}</td>
    </tr>
  <!-- END l_datarow -->
</table>