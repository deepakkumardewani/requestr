import type { Metadata } from "next";
import { PRIVACY_PATH } from "@/components/landing/constants";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_SITE_NAME,
} from "@/components/legal/constants";
import {
  LegalLayout,
  LegalOperatorSection,
  LegalSection,
} from "@/components/legal/LegalLayout";
import { absoluteUrl } from "@/components/seo/jsonLdBuilders";

const TITLE = `Privacy Policy — ${LEGAL_SITE_NAME}`;
const DESCRIPTION = `How ${LEGAL_SITE_NAME} handles your data: local-only storage, the request proxy, DeepSeek and xAI, encrypted 24-hour share links, and how to ask for deletion.`;

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
          browser. We run no analytics or ad trackers. A few features send data
          to a server or a third party to work, and this page lists each one.
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
          on their own, within hours. Our host, Vercel, may also keep standard
          request logs such as IP address, timestamp and URL, under its own
          policy.
        </p>
      </LegalSection>
      <LegalSection heading="Hub templates">
        <p>
          The template hub serves files that ship with the app. Opening one
          sends nothing to a third party.
        </p>
      </LegalSection>
      <LegalSection heading="What we do not collect">
        <p>
          No analytics, tracking scripts or advertising. No accounts, emails or
          payment details, because there is nothing to sign up for or buy. Fonts
          are bundled at build time, so your browser does not call a font
          service.
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
