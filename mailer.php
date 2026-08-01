<?php
/* =====================================================================
   Tiny dependency-free mailer.

   wesley_send_mail($to, $subject, $textBody, $replyToEmail, $replyToName)
       -> true on success, false on failure

   Uses PHP's mail() by default. If WESLEY_SMTP_HOST is set in config.php it
   talks SMTP directly over a socket instead (useful when mail() is disabled
   or messages keep landing in spam).
   ===================================================================== */

/* Strip anything that could be used to inject extra mail headers. */
function wesley_clean_header($s) {
    return trim(str_replace(["\r", "\n", "\0"], '', (string)$s));
}

function wesley_send_mail($to, $subject, $body, $replyTo = '', $replyToName = '') {
    $to      = wesley_clean_header($to);
    $subject = wesley_clean_header($subject);
    $replyTo = filter_var(wesley_clean_header($replyTo), FILTER_VALIDATE_EMAIL) ? wesley_clean_header($replyTo) : '';
    $replyToName = wesley_clean_header($replyToName);

    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return false;

    $fromEmail = wesley_clean_header(WESLEY_CONTACT_FROM);
    $fromName  = wesley_clean_header(WESLEY_CONTACT_FROM_NAME);
    if (!filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
        // Fall back to something on the current host so the message is at least valid.
        $host = isset($_SERVER['HTTP_HOST']) ? preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST']) : 'localhost';
        $fromEmail = 'website@' . preg_replace('/^www\./', '', $host);
    }

    $encSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $encFrom    = ($fromName ? '=?UTF-8?B?' . base64_encode($fromName) . '?= ' : '') . '<' . $fromEmail . '>';

    $headers = [];
    $headers[] = 'From: ' . $encFrom;
    if ($replyTo) {
        $headers[] = 'Reply-To: ' .
            ($replyToName ? '=?UTF-8?B?' . base64_encode($replyToName) . '?= ' : '') . '<' . $replyTo . '>';
    }
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: 8bit';
    $headers[] = 'X-Mailer: Wesley-CMS';

    if (defined('WESLEY_SMTP_HOST') && WESLEY_SMTP_HOST !== '') {
        return wesley_smtp_send($fromEmail, $to, $encSubject, $headers, $body);
    }

    // -f sets the envelope sender, which greatly improves deliverability.
    return @mail($to, $encSubject, $body, implode("\r\n", $headers), '-f' . $fromEmail);
}

/* ---------------------------------------------------------------------
   Minimal SMTP client (AUTH LOGIN, optional SSL/STARTTLS)
   --------------------------------------------------------------------- */
function wesley_smtp_send($from, $to, $encSubject, $headers, $body) {
    $host   = WESLEY_SMTP_HOST;
    $port   = (int)WESLEY_SMTP_PORT;
    $secure = strtolower(WESLEY_SMTP_SECURE);
    $target = ($secure === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;

    $fp = @stream_socket_client($target, $errno, $errstr, 15);
    if (!$fp) return false;
    stream_set_timeout($fp, 15);

    $read = function () use ($fp) {
        $data = '';
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') break;
        }
        return $data;
    };
    $cmd = function ($line, $expect) use ($fp, $read) {
        if ($line !== null) fwrite($fp, $line . "\r\n");
        $resp = $read();
        return (int)substr($resp, 0, 3) === $expect || in_array((int)substr($resp, 0, 3), (array)$expect, true);
    };

    $ehlo = isset($_SERVER['HTTP_HOST']) ? preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST']) : 'localhost';
    if (!$cmd(null, 220))                { fclose($fp); return false; }
    if (!$cmd('EHLO ' . $ehlo, 250))     { fclose($fp); return false; }

    if ($secure === 'tls') {
        if (!$cmd('STARTTLS', 220)) { fclose($fp); return false; }
        if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) { fclose($fp); return false; }
        if (!$cmd('EHLO ' . $ehlo, 250)) { fclose($fp); return false; }
    }

    if (WESLEY_SMTP_USER !== '') {
        if (!$cmd('AUTH LOGIN', 334))                        { fclose($fp); return false; }
        if (!$cmd(base64_encode(WESLEY_SMTP_USER), 334))     { fclose($fp); return false; }
        if (!$cmd(base64_encode(WESLEY_SMTP_PASS), 235))     { fclose($fp); return false; }
    }

    if (!$cmd('MAIL FROM:<' . $from . '>', 250)) { fclose($fp); return false; }
    if (!$cmd('RCPT TO:<' . $to . '>', [250, 251])) { fclose($fp); return false; }
    if (!$cmd('DATA', 354))                      { fclose($fp); return false; }

    // Dot-stuff the body so a lone "." can't end the message early.
    $safeBody = preg_replace('/^\./m', '..', str_replace("\r\n", "\n", $body));
    $safeBody = str_replace("\n", "\r\n", $safeBody);

    $message = 'To: <' . $to . ">\r\n" .
               'Subject: ' . $encSubject . "\r\n" .
               implode("\r\n", $headers) . "\r\n" .
               'Date: ' . date('r') . "\r\n\r\n" .
               $safeBody . "\r\n.";

    if (!$cmd($message, 250)) { fclose($fp); return false; }
    $cmd('QUIT', 221);
    fclose($fp);
    return true;
}
