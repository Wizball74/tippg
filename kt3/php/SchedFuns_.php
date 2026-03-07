<?php
/*
 * KT 
 * @author    M.Andreas
 * @copyright (c) 2012
 * @date      10/2014
 * @version   3.1
					***(getDFBSchedule.php, parseDFBSchedule.php)
 * MA 02.10.2014 überarbeitet, Kicker-Spielplan statt DFB
 */

    require_once('../mysql.php');
	require_once('funcs.php');

    /*
     * Links aus Seite entfernen
     * MA 02.10.2014
     */
    function removeLinks($html)
    {
        $doc = new DOMDocument();
        @$doc->loadHTML($html);
        
        $finished = false;
        do 
        {
            $tags = $doc->getElementsByTagName('a');
            if ($tags->length==0) $finished = true;
            foreach ($tags as $tag) 
            {
                $text = $doc->createElement('div', $tag->nodeValue);
                $tag->parentNode->replaceChild($text, $tag);
            }       
        } while (!$finished);

        $html = $doc->saveHTML();        
        return $html;
    }
    
    /*
     * Jahreszahl des Saisonstarts
     * MA 03.10.2014
     */
    function getSeasonYear($trid)
    {
        global $TABLE;       
		$row = mysql_fetch_assoc(query("SELECT Beginn FROM $TABLE[tipprunde] WHERE trid=$trid"));
	    
        // Jahreszahl des Saisonstarts
		return substr($row['Beginn'],0,4);

    }

     /*
     * MA 02.10.2014 überarbeitet, Kicker-Spielplan statt DFB
     */
	function getSchedule($trid, $md) 
	{       
		// Saison ermitteln
		$season_l = getSeasonYear($trid);
		$season = substr($season_l,2,2);
	       
        // MA 02.10.2014URL zum Kicker-Spielplan
        $url=sprintf('http://www.kicker.de/news/fussball/bundesliga/spieltag/1-bundesliga/%s-%s/%s/0/spieltag.html', $season_l, $season+1, $md);
        
        // Spielplan laden       
        $html = file_get_contents_curl($url);
        
        $doc = new DOMDocument();
        $doc2 = new DOMDocument();
        $doc2->formatOutput = true;
        
		@$doc->loadHTML($html);
        
        // Spielplan-Bereich ermitteln
        $tags = $doc->getElementsByTagName('div');
        foreach ($tags as $tag) 
        {
            // Content_begegnungen
            if (strpos($tag->getAttribute('id'), 'Content_begegnungen') !== false)
            {
                $node = $doc2->importNode( $tag, true );
                $doc2->appendChild($node);
            }
        }
        
        // nur relevante Daten übernehmen
        $tags = $doc2->getElementsByTagName('div');
        $doc2 = new DOMDocument();
        foreach ($tags as $tag) 
        {
            if (strpos($tag->getAttribute('id'), 'tabHead_thead') !== false) // Überschrift (Spieltag)
            {
                $div = $doc2->createElement('div');
            
                // Spieltag-Header
                $node = $doc2->importNode( $tag, true );
                $div->appendChild($node);
                $sp = intval($tag->nodeValue);
                $div->setAttribute('title', $sp); // Spieltag
                $div->setAttribute('class', 'spieltag');
                
                // Spielplan
                $table = $tag->parentNode->getElementsByTagName('table');
                $node = $doc2->importNode( $table->item(0), true );
                $div->appendChild($node);
                
                $doc2->appendChild($div);
            }
        }
        
        $html = $doc2->saveHTML();
        $html = removeLinks($html);

		return $html;
	}

	function parseSchedule($trid, $md)
	{
		global $TABLE; 

		// Teams laden	
		unset ($_teams);
		$sql = "select * from $TABLE[teams]";
		$res = query($sql);
		while ($row=mysql_fetch_assoc($res)) { 
            $_teams[$row['Name']]=intval($row['tid']); 
            $_teams[$row['alias']]=intval($row['tid']); // MA 03.10.2014
        }
		//while ($row=mysql_fetch_assoc($res)) { $_teams[utf8_encode($row['Name'])]=$row['tid']; }    	
        //echo "<pre>";print_r($_teams);
        
        $year = getSeasonYear($trid);
		$html = getSchedule($trid, $md);
        
        // Parser
        $doc = new DOMDocument();
        @$doc->loadHTML($html);
        
        $tags = $doc->getElementsByTagName('div');
		unset($_sptag);
        foreach ($tags as $tag) 
        {
            if (strpos($tag->getAttribute('class'), 'spieltag') !== false)
            {
                // Spieltag ermitteln
            	$_sptag = $tag->getAttribute('title');
				$_nr = 1;
                
                if ($_sptag == 0 && $md > 0) $_sptag = $md; // Für Einzelspieltag-Abruf (z.B. Ergebnisse)
                if ($_sptag > 0)
                {
                    // Spielplan ermitteln
                    $table = $tag->getElementsByTagName('table');
                    
                    $rows = $table->item(0)->getElementsByTagName('tr');
                    foreach ($rows as $row)
                    {
                        if (strpos($row->getAttribute('class'), 'fest') !== false) // nur Zeilen mit relevanten Daten
                        {
                            $cols = $row->getElementsByTagName('td');
                            
                            // Datum und Zeit
                            $d = utf8_decode(trim($cols->item(1)->nodeValue));
                            if (strlen($d) > 4)
                            {
                                $d = explode(chr(160), utf8_decode(trim($cols->item(1)->nodeValue)));
                                $datum=trim($d[0]);
					            $zeit=trim($d[1]);
                                
                                // Jahreszahl ggf. ergänzen
                                if (strlen($datum) < 10)
                                {
                                    $d = explode('.', $datum);
                                    if (strlen($d[2]) == 2) 
                                        $d[2] = "20".$d[2];
                                    else
                                    {
                                        $d[2] = $d[1] >= 8 ? $year : ($year+1); // TODO Saisonbeginn vor August?
                                    }
                                    
                                    $datum = join('.', $d);
                                }

                                if (strlen($zeit) < 5) $zeit='15:30'; // TODO?
                            }
                            
                            // Teams
                            $t1 = utf8_decode(trim($cols->item(2)->nodeValue));
					        $t2 = utf8_decode(trim($cols->item(4)->nodeValue));
                               
                            $sched[$_sptag][$_nr++] = array(
						        'D' => $datum,
						        'Z' => $zeit,
						        'T1n' => $t1,
						        'T2n' => $t2,
						        'T1' => $_teams[$t1],
						        'T2' => $_teams[$t2],
                                'Result' => utf8_decode(trim($cols->item(5)->nodeValue))
					        );
                        }
                    } // foreach ($rows as $row)
                } // $_sptag > 0
            }
        }
       
        return $sched;
    }
        
    /*
     * MA 03.10.2014 intval
     */
    function findSched($sptag,$t1,$t2, $sched)
	{
		unset($result);
		foreach($sched[$sptag] as $s) 
        {
            if ((intval($s['T1']) == intval($t1)) && (intval($s['T2']) == intval($t2))) $result = $s;
        }
        
		return $result;
	}
?>