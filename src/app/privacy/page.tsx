import type { Metadata } from "next";
import { PRIVACY_PATH } from "@/components/landing/constants";
import {
  LEGAL_ANALYTICS_ID_KEY,
  LEGAL_CONTACT_EMAIL,
  LEGAL_FEEDBACK_RETENTION,
  LEGAL_SITE_NAME,
} from "@/components/legal/constants";
import {
  LegalLayout,
  LegalOperatorSection,
  LegalSection,
} from "@/components/legal/LegalLayout";
import { absoluteUrl } from "@/components/seo/jsonLdBuilders";
import { EVENT_ALLOWLIST } from "@/lib/analytics/events";

const ANALYTICS_EVENT_NAMES = Object.keys(EVENT_ALLOWLIST);

const TITLE = `Privacy Policy — ${LEGAL_SITE_NAME}`;
const DESCRIPTION = `How ${LEGAL_SITE_NAME} handles your data: local-only storage, anonymous usage analytics, the request proxy, DeepSeek and xAI, encrypted 24-hour share links, and how to ask for deletion.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl(PRIVACY_PATH) },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: absoluteUrl(PRIVACY_PATH),
  },
};

export default function PrivacyRoute() {
  return (
    <LegalLayout title="Privacy Policy">
      <LegalOperatorSection />
      <LegalSection heading="The short version">
        <p>
          {LEGAL_SITE_NAME} is free and has no accounts. Your work stays in your
          browser. We collect anonymous usage statistics and error reports to
          improve the app, and you can turn them off. We run no ad trackers. A
          few features send data to a server or a third party to work, and this
          page lists each one.
        </p>
      </LegalSection>
      <LegalSection heading="Stored only in your browser">
        <p>
          Collections, requests, environments, tabs, history, settings, chains
          and Relay conversations are saved in your browser (IndexedDB and local
          storage). They are not uploaded to us. They stay until you delete them
          or clear your browser data.
        </p>
      </LegalSection>
      <LegalSection heading="Request proxy">
        <p>
          To let your browser reach APIs that block cross-origin calls, requests
          go through our server proxy. It forwards the method, headers and body
          to the URL you chose and returns the response. The proxy does not
          store the request or the response, and the application writes no logs
          for it. Responses over 50 MB are refused.
        </p>
      </LegalSection>
      <LegalSection heading="AI features: DeepSeek">
        <p>
          Relay chat and the AI actions in the request editor send your prompt
          and the request or response context you choose to DeepSeek, which
          generates the reply. Relay removes secrets in your browser first, and
          our server refuses a message that still contains one. DeepSeek handles
          that data under its own terms and privacy policy, including how long
          it keeps it and where it is processed, which may be outside India.
        </p>
        <p>
          Providers can change. If we add, replace or remove one, this page is
          updated to match.
        </p>
      </LegalSection>
      <LegalSection heading="Voice input: your browser or xAI">
        <p>
          When server speech-to-text is configured and your browser can record
          audio, {LEGAL_SITE_NAME} records a short clip, sends it to our server,
          and the server forwards it to xAI to turn speech into text. We do not
          keep the audio. xAI handles it under its own terms. Otherwise, where
          your browser supports speech recognition, the browser does the work
          and may send your audio to the browser vendor, whose policy applies.
        </p>
      </LegalSection>
      <LegalSection heading="Share links">
        <p>
          A share link is encrypted in your browser before it is sent. We store
          only the encrypted data, on Upstash Redis, and delete it after 24
          hours. The key sits in the part of the link after the # sign, which
          browsers do not send to servers, so we cannot read the contents.
          Anyone who has the full link can open it until it expires, so share it
          carefully.
        </p>
      </LegalSection>
      <LegalSection heading="Rate limiting and server logs">
        <p>
          To prevent abuse, Relay chat messages are counted per IP address (and
          per anonymous random ID kept in your browser), and sharing is counted
          per that anonymous ID. These counters live in Upstash Redis and expire
          on their own, within hours. Our host and CDN, Vercel, may also keep
          standard request logs such as IP address, timestamp and URL, under its
          own policy. We also use Vercel Web Analytics and Speed Insights for
          page views and performance. They set no cookies and report only
          aggregate figures.
        </p>
      </LegalSection>
      <LegalSection heading="Hub templates">
        <p>
          The template hub serves files that ship with the app. Opening one
          sends nothing to a third party.
        </p>
      </LegalSection>
      <LegalSection heading="Anonymous usage analytics">
        <p>
          To learn which features work and which break, the app sends a small
          set of named events to PostHog, our analytics processor, hosted in its
          US region. PostHog handles the data on our behalf under its own terms,
          so it is processed in the United States, outside India. An event is a
          name plus coarse values such as a bucket (&quot;under 100 ms&quot;) or
          a fixed choice (&quot;GET&quot;). It never contains the content of
          your requests, responses, prompts, URLs or names. Events go to our own
          server first, which forwards them with your IP address stripped, and
          geo-IP lookup is disabled. The IP address is discarded and never
          stored with an event.
        </p>
        <p>
          These are all the events we collect, and nothing outside this list.
          The list is enforced in code: any event or property that is not on it
          is dropped before it is sent.
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Collected events">
          {ANALYTICS_EVENT_NAMES.map((name) => (
            <li key={name}>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {name}
              </code>
            </li>
          ))}
        </ul>
      </LegalSection>
      <LegalSection heading="Anonymous analytics ID and cookies">
        <p>
          Events carry a random anonymous analytics ID, stored in your
          browser&apos;s local storage as <code>{LEGAL_ANALYTICS_ID_KEY}</code>.
          It is just a random string: it is not derived from you or your device,
          it is separate from the ID used for rate limiting, and we cannot tie
          it to a person. It only lets us count a visit once instead of many
          times. We set no cookies. Turning analytics off deletes the ID.
        </p>
      </LegalSection>
      <LegalSection heading="Error reports">
        <p>
          When the app crashes or hits an unhandled error, it can send a report
          with the error type, a short message and file and line numbers.
          Addresses, URLs, headers, tokens and request or response content are
          removed in your browser before anything is sent.
        </p>
      </LegalSection>
      <LegalSection heading="Feedback">
        <p>
          If you send feedback, the rating and any text you write are sent
          exactly as written. The email address is optional. If you enter one,
          we use it only to reply to you. An email address is the only personal
          information we may receive. Feedback is not linked to your analytics
          ID. We keep feedback for {LEGAL_FEEDBACK_RETENTION}, then delete it.
          To have yours deleted sooner, email{" "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="text-foreground underline underline-offset-4"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
      <LegalSection heading="Opting out of analytics">
        <p>
          Turn off &quot;Share anonymous usage data&quot; in Settings, General.
          Analytics also stays off automatically when your browser sends Do Not
          Track or Global Privacy Control. When it is off, usage events and
          error reports are not sent.
        </p>
      </LegalSection>
      <LegalSection heading="What we do not collect">
        <p>
          No advertising or cross-site tracking. No request or response content,
          URLs, header or variable values, collection or environment names, or
          Relay messages in analytics. No accounts or payment details, because
          there is nothing to sign up for or buy. Fonts are bundled at build
          time, so your browser does not call a font service.
        </p>
      </LegalSection>
      <LegalSection heading="Your choices and deletion requests">
        <p>
          Clear your browser storage to remove everything saved on your device.
          Share links and rate-limit counters delete themselves. To ask about
          data we may hold, or to request deletion or correction, email{" "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="text-foreground underline underline-offset-4"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
      <LegalSection heading="Changes">
        <p>
          We update this page when the app changes how it handles data. The
          effective date above shows the latest version.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
