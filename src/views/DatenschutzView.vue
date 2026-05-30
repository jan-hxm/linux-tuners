<script setup>
import { RouterLink } from 'vue-router'

// Privacy policy — current coverage:
//   - Section 2: Cloudflare Pages hosting (server logs, retention, DPF, SCCs)
//   - Section 3: localStorage (consent decision) + URL hash + Cloudflare's
//                strictly-necessary cookies (__cf_bm etc.)
//   - Section 4: Google AdSense — only loaded after explicit consent
//
// Language note: written in English to match the rest of the site. § 5 TMG /
// Art. 12 GDPR don't mandate German — they require "clear, plain language the
// audience understands". Statute references (§ … TMG, Art. … GDPR, § … TTDSG)
// are intentionally kept in their German citation form.
//
// Bump the "Last updated: …" date below whenever you change anything material.
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">Privacy policy</h1>
      <p class="mt-1 text-xs text-slate-500">
        Information on the processing of personal data per Art. 13 GDPR
      </p>
      <p class="mt-1 text-xs text-slate-400">Last updated: May 2026</p>
    </header>

    <section class="space-y-2 text-sm leading-relaxed text-slate-800">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">1. Controller</h2>
      <p>
        The data controller within the meaning of the GDPR is the person named in the
        <RouterLink to="/imprint" class="text-sky-700 underline">Imprint</RouterLink>.
      </p>
    </section>

    <section class="space-y-2 text-sm leading-relaxed text-slate-800">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">2. Hosting and provision of the website</h2>
      <p>
        This website is a purely static single-page application. All tuner configuration happens in the
        browser; no personal data entered by users is processed, stored, or transmitted to third parties
        on the server side.
      </p>
      <p>
        <strong>Hosting provider:</strong> Cloudflare Pages, operated by
        <strong>Cloudflare, Inc.</strong>, 101 Townsend Street, San Francisco, CA 94107, USA ("Cloudflare").
        Cloudflare serves the site through a global content-delivery network and protects it against
        attacks (DDoS protection, bot detection).
      </p>
      <p><strong>Data processed:</strong> When the page is accessed, Cloudflare processes the following technically required data:</p>
      <ul class="list-disc space-y-1 pl-5">
        <li>IP address</li>
        <li>Date and time of the request</li>
        <li>Requested URL</li>
        <li>User agent (browser, operating system)</li>
        <li>HTTP status code and bytes transferred</li>
        <li>Referrer URL, where applicable</li>
      </ul>
      <p>
        <strong>Legal basis</strong> is Art. 6 (1) (f) GDPR (legitimate interest in the secure, performant,
        and stable operation of the website).
      </p>
      <p>
        <strong>Third-country transfer:</strong> Cloudflare also processes data in the USA. Cloudflare,
        Inc. is certified under the EU–US Data Privacy Framework; in addition, EU standard contractual
        clauses apply via a Data Processing Addendum.
      </p>
      <p>
        <strong>Retention:</strong> Cloudflare typically deletes access logs within a few days (usually
        within seven days), unless longer retention is necessary to investigate security incidents.
      </p>
      <p class="text-xs leading-relaxed text-slate-600">
        Further information:
        <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener" class="text-sky-700 underline">Cloudflare privacy policy</a>
        ·
        <a href="https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/" target="_blank" rel="noopener" class="text-sky-700 underline">Cloudflare cookies</a>
        ·
        <a href="https://www.cloudflare.com/cloudflare-customer-dpa/" target="_blank" rel="noopener" class="text-sky-700 underline">Data Processing Addendum</a>
      </p>
    </section>

    <section class="space-y-2 text-sm leading-relaxed text-slate-800">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">3. Local storage (localStorage)</h2>
      <p>
        The application uses the browser's <code class="rounded bg-slate-100 px-1 font-mono text-[12px]">localStorage</code>
        API solely to remember your consent-banner decision (see section 4). This storage occurs only
        after you have interacted with the banner and contains no personally identifiable data. It is
        permitted without consent per § 25 (2) (2) TTDSG, as it is strictly necessary to fulfil the
        function you requested (avoiding repeated cookie banners).
      </p>
      <p>
        The application also optionally encodes the current tuner state in the URL hash (fragment), so
        you can share or bookmark configurations. The hash is processed exclusively client-side and is
        never transmitted to the server.
      </p>
      <p>
        <strong>Cloudflare security cookies:</strong> The hosting provider (see section 2) may set
        technically required cookies to detect automated requests, in particular
        <code class="rounded bg-slate-100 px-1 font-mono text-[12px]">__cf_bm</code>
        (Cloudflare Bot Management, ~30-minute lifetime) and optionally
        <code class="rounded bg-slate-100 px-1 font-mono text-[12px]">cf_clearance</code>
        (after security checks). These cookies serve solely to ensure secure operation of the site and are
        permitted without consent per § 25 (2) (2) TTDSG. A full overview is published by Cloudflare at
        <a href="https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/" target="_blank" rel="noopener" class="text-sky-700 underline">developers.cloudflare.com</a>.
      </p>
    </section>

    <section class="space-y-2 text-sm leading-relaxed text-slate-800">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">4. Advertising via Google AdSense</h2>
      <p>
        To help fund this website — and only if you have agreed via the consent banner — advertisements
        are embedded via Google AdSense. The provider is <strong>Google Ireland Limited</strong>, Gordon
        House, Barrow Street, Dublin 4, Ireland ("Google").
      </p>
      <p>
        <strong>Legal basis</strong> is your consent per Art. 6 (1) (a) GDPR in conjunction with
        § 25 (1) TTDSG. Without your consent, the AdSense code is <strong>not</strong> loaded and no
        cookies are set.
      </p>
      <p>
        <strong>Purpose and data transferred:</strong> AdSense delivers context-based or personalised
        advertising. To do so, Google processes in particular your IP address, browser and device
        information, data about your interactions with ads, and cookies that allow your browser to be
        recognised. Personalised ads may additionally draw on existing Google user profiles.
      </p>
      <p>
        <strong>Third-country transfer:</strong> Google also processes data in the USA. Google is
        certified under the EU–US Data Privacy Framework; additionally, standard contractual clauses
        apply.
      </p>
      <p>
        <strong>Retention:</strong> AdSense cookies are typically stored on your device for up to 13
        months. You can delete them at any time via your browser settings.
      </p>
      <p>
        <strong>Withdrawing consent:</strong> Via the <em>"Cookie settings"</em> link in the footer you
        can withdraw your decision at any time. A withdrawal means that the AdSense script will not be
        loaded again on the next page load; you can additionally remove already-set AdSense cookies via
        your browser settings.
      </p>
      <p class="text-xs leading-relaxed text-slate-600">
        Further information:
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener" class="text-sky-700 underline">Google privacy policy</a>
        ·
        <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener" class="text-sky-700 underline">How Google uses data from partner sites</a>
        ·
        <a href="https://adssettings.google.com" target="_blank" rel="noopener" class="text-sky-700 underline">Google ad settings / opt-out</a>
      </p>
    </section>

    <section class="space-y-2 text-sm leading-relaxed text-slate-800">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">5. Rights of the data subject</h2>
      <p>You have the right at any time to:</p>
      <ul class="list-disc space-y-1 pl-5">
        <li>Access (Art. 15 GDPR)</li>
        <li>Rectification (Art. 16 GDPR)</li>
        <li>Erasure (Art. 17 GDPR)</li>
        <li>Restriction of processing (Art. 18 GDPR)</li>
        <li>Data portability (Art. 20 GDPR)</li>
        <li>Objection (Art. 21 GDPR)</li>
        <li>Withdrawal of consent given (Art. 7 (3) GDPR)</li>
      </ul>
      <p>
        Please direct requests to the email address listed in the
        <RouterLink to="/imprint" class="text-sky-700 underline">Imprint</RouterLink>.
      </p>
    </section>

    <section class="space-y-2 text-sm leading-relaxed text-slate-800">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">6. Right to lodge a complaint with a supervisory authority</h2>
      <p>
        You have the right to lodge a complaint with a data-protection supervisory authority regarding
        the processing of your personal data. A list of the responsible German authorities is available
        at
        <a
          href="https://www.bfdi.bund.de/DE/Service/Anschriften/Laender/Laender-node.html"
          target="_blank"
          rel="noopener"
          class="text-sky-700 underline"
        >bfdi.bund.de</a>.
      </p>
    </section>

    <section class="space-y-2 text-sm leading-relaxed text-slate-800">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">7. Changes to this privacy policy</h2>
      <p>
        We update this privacy policy when the functionality of the website changes (e.g. integration of
        advertising or external services). The current version is always available on this page.
      </p>
    </section>
  </section>
</template>
