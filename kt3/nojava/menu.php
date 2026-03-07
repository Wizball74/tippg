<?php
  //**************************************************************************
  //** (C) 08/2008 M.Andreas  v2.0
  //** last change : 01.08.08
  //**************************************************************************

  $menu[login][] = 'Anmelden';           $link[login][] = "$PHP_SELF?action=login";

  $menu[main][] = 'Tipps';               $link[main][] = "$PHP_SELF?smenu=Tipps&action=Uebersicht";         
  $menu[main][] = 'Ligasystem';          $link[main][] = "$PHP_SELF?smenu=Liga&action=Spielplan";         
  //$menu[main][] = 'Prämien';             $link[main][] = "$PHP_SELF?smenu=Praemien&action=Uebersicht";   
  //$menu[main][] = 'Admin';               $link[main][] = "$PHP_SELF?smenu=Admin&action=Profil";           
  $menu[main][] = '';                    $link[main][] = "";                                                
  $menu[main][] = 'Abmelden';            $link[main][] = "$PHP_SELF?action=logout";                         

  $menu[Tipps][]   = 'Übersicht';        $link[Tipps][] = "$PHP_SELF?smenu=Tipps&action=Uebersicht";
  $menu[Tipps][]   = 'Tippabgabe';       $link[Tipps][] = "$PHP_SELF?smenu=Tipps&action=Tippabgabe";
  $menu[Tipps][]   = 'Gesamtstand';      $link[Tipps][] = "$PHP_SELF?smenu=Tipps&action=Gesamtstand";

  $menu[Liga][]    = 'Spielplan';        $link[Liga][] = "$PHP_SELF?smenu=Liga&action=Spielplan";
  $menu[Liga][]    = 'Tabellen';         $link[Liga][] = "$PHP_SELF?smenu=Liga&action=Tabellen";

  //$menu[Praemien][] = 'aktuell';         $link[Praemien][] = "$PHP_SELF?smenu=Praemien&action=Uebersicht";
  //$menu[Praemien][] = 'Information';     $link[Praemien][] = "$PHP_SELF?smenu=Praemien&action=Info";

  //$menu[Admin][]   = 'Profil';           $link[Admin][] = "$PHP_SELF?smenu=Admin&action=Profil";             $level[Admin][]=0;

  $_title = 'Die Online-Tippgemeinschaft';
?>
