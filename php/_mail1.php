<?php

	$encoding = "utf-8";
	$from_name = "Reminder";

	$from_mail = "reminder@tippg.de";
	$mail_to = "hunter75@gmx.de";

	$subject = "Erinnerung Tippabgabe: Spieltag x (y)";
	$message = "Hallo x y,<br/><br/>
				Sie haben noch nicht alle Tipps für den x. Spieltag abgegeben.<br/>
				<a href='http://tippg.de/'>Zur Tippapgabe</a><br/><br/>
				Viele Grüße<br/>
				Ihre Online-Tippgemeinschaft";

	// Preferences for Subject field
	$subject_preferences = array(
		"input-charset" => $encoding,
		"output-charset" => $encoding,
		"line-length" => 76,
		"line-break-chars" => "\r\n"
	);

	// Mail header
	$header = "Content-type: text/html; charset=".$encoding." \r\n";
	$header .= "From: ".$from_name." <".$from_mail."> \r\n";
	$header .= "MIME-Version: 1.0 \r\n";
	$header .= "Content-Transfer-Encoding: 8bit \r\n";
	$header .= "Date: ".date("r (T)")." \r\n";
	$header .= iconv_mime_encode("Subject", $mail_subject, $subject_preferences);

	// Send mail
	echo mail($mail_to, $mail_subject, $mail_message, $header);

?>