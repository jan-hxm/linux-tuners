<script setup>
import { RouterLink } from 'vue-router'

// NOTE: this Datenschutzerklärung covers the *current* state of the site —
// purely static SPA, no cookies, no tracking, no backend. When ads or
// analytics are added (Phase 4), the following sections must be expanded:
//
//   - "Drittanbieter" → declare Google AdSense (or chosen ad provider):
//       Anbieter, Zweck, Rechtsgrundlage (Einwilligung Art. 6 Abs. 1 lit. a
//       DSGVO), übermittelte Daten, Drittlandtransfer (USA), Speicherdauer,
//       Widerruf der Einwilligung.
//   - "Cookies" → list every cookie set, purpose, retention, source.
//   - "Einwilligung" → describe the cookie consent banner and how revocation
//       works.
//
// Hosting-provider IP logging is also a processing activity that needs
// disclosure once a real host is chosen (Cloudflare Pages / Vercel / etc.).
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">Datenschutzerklärung</h1>
      <p class="mt-1 text-xs text-slate-500">
        Informationen zur Verarbeitung personenbezogener Daten nach Art. 13 DSGVO
      </p>
    </header>

    <aside class="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p class="font-semibold">Platzhalter — vor dem Live-Gang prüfen und anpassen.</p>
      <p class="mt-1 text-xs leading-relaxed">
        Abschnitt 4 enthält bereits die AdSense-Pflichtangaben für den Fall, dass Anzeigen aktiviert sind.
        Die Verarbeitung durch den Hosting-Anbieter (Abschnitt 2) muss ergänzt werden, sobald der Host feststeht.
        Verantwortlicher in Abschnitt 1 verweist auf das Impressum — dort müssen die Platzhalter ausgefüllt sein.
      </p>
    </aside>

    <section class="space-y-2 text-sm leading-relaxed text-slate-800">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">1. Verantwortlicher</h2>
      <p>
        Verantwortlicher im Sinne der DSGVO ist die im
        <RouterLink to="/impressum" class="text-sky-700 underline">Impressum</RouterLink>
        genannte Person.
      </p>
    </section>

    <section class="space-y-2 text-sm leading-relaxed text-slate-800">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">2. Verarbeitung beim Besuch der Website</h2>
      <p>
        Diese Website ist eine rein statische Single-Page-Anwendung. Die gesamte Konfiguration findet im
        Browser des Nutzers statt. Es werden serverseitig keine personenbezogenen Eingaben verarbeitet,
        gespeichert oder an Dritte übermittelt.
      </p>
      <p>
        Beim Aufruf der Seite werden vom Hosting-Anbieter technisch bedingt Zugriffsdaten verarbeitet
        (insbesondere IP-Adresse, Zeitpunkt der Anfrage, abgerufene URL, User-Agent). Rechtsgrundlage ist
        Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren und stabilen Betrieb der Website).
        Diese Daten werden ausschließlich zur technischen Bereitstellung und Abwehr von Angriffen verwendet
        und nach kurzer Frist gelöscht.
      </p>
      <p class="text-xs text-slate-500">
        [TODO: konkreten Hosting-Anbieter, dessen Standort und die genaue Speicherdauer ergänzen, sobald
        die Wahl feststeht.]
      </p>
    </section>

    <section class="space-y-2 text-sm leading-relaxed text-slate-800">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">3. Lokale Speicherung (localStorage)</h2>
      <p>
        Die Anwendung verwendet die <code class="rounded bg-slate-100 px-1 font-mono text-[12px]">localStorage</code>-API
        des Browsers ausschließlich, um deine Entscheidung zum Consent-Banner zu speichern (siehe Abschnitt 4).
        Diese Speicherung erfolgt erst, nachdem du das Banner bedient hast, und enthält keine personenbeziehbaren
        Daten. Sie ist gemäß § 25 Abs. 2 Nr. 2 TTDSG ohne Einwilligung zulässig, da sie zur Erfüllung der von dir
        gewünschten Funktion (Vermeidung wiederholter Cookie-Banner) unbedingt erforderlich ist.
      </p>
      <p>
        Darüber hinaus kodiert die Anwendung den aktuellen Tuning-Zustand optional in den URL-Hash (Fragment),
        damit du Konfigurationen teilen oder als Lesezeichen speichern kannst. Der Hash wird ausschließlich
        clientseitig verarbeitet und nicht an den Server übermittelt.
      </p>
    </section>

    <section class="space-y-2 text-sm leading-relaxed text-slate-800">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">4. Werbung durch Google AdSense</h2>
      <p>
        Zur Finanzierung dieser Website werden — sofern du dem Consent-Banner zugestimmt hast — Werbeanzeigen
        über Google AdSense eingebunden. Anbieter ist <strong>Google Ireland Limited</strong>, Gordon House,
        Barrow Street, Dublin 4, Irland („Google").
      </p>
      <p>
        <strong>Rechtsgrundlage</strong> ist deine Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO i. V. m.
        § 25 Abs. 1 TTDSG. Ohne deine Einwilligung wird der AdSense-Code <strong>nicht</strong> geladen und es
        werden keine Cookies gesetzt.
      </p>
      <p>
        <strong>Zweck und übermittelte Daten:</strong> AdSense liefert kontextbezogene oder personalisierte
        Werbung aus. Dabei verarbeitet Google insbesondere deine IP-Adresse, Browser- und Geräteinformationen,
        Daten über deine Interaktion mit Anzeigen sowie Cookies, die eine Wiedererkennung deines Browsers
        ermöglichen. Personalisierte Werbung kann zusätzlich auf vorhandenen Google-Nutzerprofilen basieren.
      </p>
      <p>
        <strong>Drittlandübermittlung:</strong> Google verarbeitet Daten auch in den USA. Google ist nach dem
        EU–US Data Privacy Framework zertifiziert; zusätzlich kommen Standardvertragsklauseln zur Anwendung.
      </p>
      <p>
        <strong>Speicherdauer:</strong> AdSense-Cookies werden in der Regel bis zu 13 Monate auf deinem Gerät
        gespeichert. Du kannst sie jederzeit über deine Browser-Einstellungen löschen.
      </p>
      <p>
        <strong>Widerruf der Einwilligung:</strong> Über den Link <em>„Cookie-Einstellungen"</em> im Footer
        kannst du deine Entscheidung jederzeit zurücknehmen. Ein Widerruf führt dazu, dass beim nächsten
        Seitenaufruf das AdSense-Skript nicht erneut geladen wird; bereits gesetzte AdSense-Cookies kannst du
        zusätzlich über die Browser-Einstellungen entfernen.
      </p>
      <p class="text-xs leading-relaxed text-slate-600">
        Weitere Informationen:
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener" class="text-sky-700 underline">Datenschutzerklärung von Google</a>
        ·
        <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener" class="text-sky-700 underline">Wie Google Daten von Partner-Websites verwendet</a>
        ·
        <a href="https://adssettings.google.com" target="_blank" rel="noopener" class="text-sky-700 underline">Google-Anzeigeneinstellungen / Opt-Out</a>
      </p>
    </section>

    <section class="space-y-2 text-sm leading-relaxed text-slate-800">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">5. Rechte der betroffenen Person</h2>
      <p>Du hast jederzeit das Recht auf:</p>
      <ul class="list-disc space-y-1 pl-5">
        <li>Auskunft (Art. 15 DSGVO)</li>
        <li>Berichtigung (Art. 16 DSGVO)</li>
        <li>Löschung (Art. 17 DSGVO)</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Widerspruch (Art. 21 DSGVO)</li>
        <li>Widerruf erteilter Einwilligungen (Art. 7 Abs. 3 DSGVO)</li>
      </ul>
      <p>
        Anfragen richtest du bitte an die im
        <RouterLink to="/impressum" class="text-sky-700 underline">Impressum</RouterLink>
        genannte E-Mail-Adresse.
      </p>
    </section>

    <section class="space-y-2 text-sm leading-relaxed text-slate-800">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">6. Beschwerderecht bei einer Aufsichtsbehörde</h2>
      <p>
        Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung deiner
        personenbezogenen Daten zu beschweren. Eine Liste der zuständigen Behörden findest du unter
        <a
          href="https://www.bfdi.bund.de/DE/Service/Anschriften/Laender/Laender-node.html"
          target="_blank"
          rel="noopener"
          class="text-sky-700 underline"
        >bfdi.bund.de</a>.
      </p>
    </section>

    <section class="space-y-2 text-sm leading-relaxed text-slate-800">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">7. Änderungen dieser Datenschutzerklärung</h2>
      <p>
        Diese Datenschutzerklärung passen wir an, wenn sich an der Funktionalität der Website etwas ändert
        (z. B. Einbindung von Werbung oder externer Dienste). Die jeweils aktuelle Fassung ist über diese
        Seite abrufbar.
      </p>
    </section>
  </section>
</template>
