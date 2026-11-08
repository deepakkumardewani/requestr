import type { Metadata } from "next";
import { PRIVACY_PATH } from "@/components/landing/constants";
import { LEGAL_SITE_NAME } from "@/components/legal/constants";
import {
  LegalLayout,
  LegalOperatorSection,
  LegalSection,
} from "@/components/legal/LegalLayout";

const TITLE = `Privacy Policy — ${LEGAL_SITE_NAME}`;
const DESCRIPTION = `How ${LEGAL_SITE_NAME} handles your data: local-first storage, server proxying, AI helpers, share links and what we do not collect.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PRIVACY_PATH },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: PRIVACY_PATH,
  },
};

export default function PrivacyRoute() {
  return (
    <LegalLayout title="Privacy Policy">
      <LegalOperatorSection />
      <LegalSection heading="Local-first storage">
        <p>
          Your collections, environments, tabs and history are stored in your
          browser (IndexedDB and local storage). There are no accounts and no
          sign-in.
        </p>
      </LegalSection>
      <LegalSection heading="Request proxying">
        <p>
          To let your browser reach APIs, requests are sent through our server
          proxy, which forwards the method, headers and body to the target URL
          and returns the response. Responses are size-capped and are not
          stored.
        </p>
      </LegalSection>
      <LegalSection heading="AI helpers and voice input">
        <p>
          AI features send your prompt and the request or response context you
          select to a third-party AI provider to generate text. Relay chat
          redacts secrets in your browser and the server refuses anything that
          slipped through. Voice input forwards the audio you record to a
          third-party speech-to-text provider. Those providers handle data under
          their own terms, including how long they retain it.
        </p>
      </LegalSection>
      <LegalSection heading="Share links">
        <p>
          Share links are encrypted in your browser. Only the ciphertext is
          stored on our server, the key stays in the part of the link after the
          # and is never sent to us, and links expire after 24 hours.
        </p>
      </LegalSection>
      <LegalSection heading="Hub templates">
        <p>
          The hub lists template folders bundled with the app. No personal data
          is involved.
        </p>
      </LegalSection>
      <LegalSection heading="Rate limiting and server logs">
        <p>
          To prevent abuse, AI features use a counter keyed to your IP address
          and sharing uses an anonymous client id. Our hosting provider may also
          keep standard request logs such as IP address and timestamps.
        </p>
      </LegalSection>
      <LegalSection heading="What we do not collect">
        <p>
          {LEGAL_SITE_NAME} includes no analytics, tracking scripts or ad
          trackers.
        </p>
      </LegalSection>
      <LegalSection heading="Retention and your controls">
        <p>
          Data stored in your browser stays there until you clear it. Clear your
          browser storage or delete the site data to remove everything. Share
          links delete themselves after 24 hours, and proxied responses are not
          retained.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
