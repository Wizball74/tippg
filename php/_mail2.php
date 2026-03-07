<?php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'Mailer/Exception.php';
require 'Mailer/PHPMailer.php';
require 'Mailer/SMTP.php';

	echo "Start";

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

	echo "Init1";
	$mail = new PHPMailer(true);
	echo "Init2";

	try {
		//Server settings
		//$mail->SMTPDebug = SMTP::DEBUG_SERVER;                      // Enable verbose debug output
		$mail->isSMTP();                                            // Send using SMTP
		$mail->Host       = 'mail.your-server.de';                    // Set the SMTP server to send through
		$mail->SMTPAuth   = true;                                   // Enable SMTP authentication
		$mail->Username   = 'reminder@tippg.de';                     // SMTP username
		$mail->Password   = 'h33D10ww9Y47qGq6';                               // SMTP password
		$mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;         // Enable TLS encryption; `PHPMailer::ENCRYPTION_SMTPS` encouraged
		$mail->Port       = 587;                                    // TCP port to connect to, use 465 for `PHPMailer::ENCRYPTION_SMTPS` above

		echo "Init3";

		//Recipients
		$mail->setFrom($from_mail, $from_name);
		$mail->addAddress($mail_to);
		//$mail->addReplyTo('info@example.com', 'Information');
		//$mail->addCC('cc@example.com');
		//$mail->addBCC('bcc@example.com');

		echo "Init4";

		// Content
		$mail->isHTML(true);                                  // Set email format to HTML
		$mail->Subject = $subject;
		$mail->Body    = $message;
		$mail->AltBody = $message;

		echo "Sending";
		$mail->send();
		echo 'Message has been sent';
	} catch (Exception $e) {
		echo "Message could not be sent. Mailer Error: {$mail->ErrorInfo}";
	}

?>