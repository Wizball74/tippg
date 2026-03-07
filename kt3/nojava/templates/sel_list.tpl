<form name="{F_NAME}" action="" method=GET target="_self">
<input type=hidden name="smenu" value="{smenu}">
<input type=hidden name="action" value="{action}">
<input type=hidden name="sptag" value="{sptag}">
<select name="{S_NAME}" class="select" onChange="document.{F_NAME}.submit()">
<!-- BEGIN sel_list -->
  <option value="{sel_list.value}" {sel_list.selected}>{sel_list.name}</option>
<!-- END sel_list -->
</select>
</form>