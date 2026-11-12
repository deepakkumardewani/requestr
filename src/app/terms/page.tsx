import type { Metadata } from "next";
import { TERMS_PATH } from "@/components/landing/constants";
import { LEGAL_SITE_NAME } from "@/components/legal/constants";
import {
  LegalLayout,
  LegalOperatorSection,
  LegalSection,
} from "@/components/legal/LegalLayout";
import { absoluteUrl } from "@/components/seo/jsonLdBuilders";

const TITLE = `Terms & Conditions — ${LEGAL_SITE_NAME}`;
const DESCRIPTION = `The terms for using ${LEGAL_SITE_NAME}, a free API client: acceptable use, AI output, the request proxy, availability, liability and governing law.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl(TERMS_PATH) },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: absoluteUrl(TERMS_PATH),
  },
};

export default function TermsRoute() {
  return (
    <LegalLayout title="Terms & Conditions">
      <LegalOperatorSection />
      <LegalSection heading="Using the service">
        <p>
          {LEGAL_SITE_NAME} is a free tool that needs no sign-up. By using it
          you agree to these terms. If you do not agree, please do not use it.
        </p>
      </LegalSection>
      <LegalSection heading="Acceptable use">
        <p>
          Use {LEGAL_SITE_NAME} lawfully and only against APIs and systems you
          are allowed to test. Do not use the proxy or the AI features to
          attack, scan, overload or abuse any system, to send spam, or to get
          around rate limits.
        </p>
      </LegalSection>
      <LegalSection heading="The request proxy and third-party APIs">
        <p>
          The proxy forwards the requests you build to the address you enter.
          You are responsible for what you send, for the terms of the APIs you
          call, and for any cost or effect those calls have. Do not send secrets
          or personal data you are not permitted to share.
        </p>
      </LegalSection>
      <LegalSection heading="AI output">
        <p>
          AI features and voice transcription rely on third-party providers,
          whose terms apply to the data sent to them. Their output can be wrong,
          incomplete or unsuitable. Review every generated request, script or
          answer before you run or rely on it. You are responsible for what you
          do with it.
        </p>
      </LegalSection>
      <LegalSection heading="Your data">
        <p>
          Your collections, environments and history live in your browser, and
          you are responsible for keeping backups. Share links expire after 24
          hours. The Privacy Policy explains how data is handled.
        </p>
      </LegalSection>
      <LegalSection heading="Availability and changes">
        <p>
          The service is provided when available and may change, break or stop
          at any time, with no promise of support or uptime. These terms may
          change too. The effective date above shows the latest version, and
          continued use means you accept the update.
        </p>
      </LegalSection>
      <LegalSection heading="No warranty and limit of liability">
        <p>
          {LEGAL_SITE_NAME} is provided as is, without warranties of any kind.
          To the extent the law allows, the operator is not liable for any loss
          or damage from its use, including lost or cleared local data, expired
          share links, wrong AI output, or the effect of requests you send.
        </p>
      </LegalSection>
      <LegalSection heading="Governing law">
        <p>These terms are governed by the laws of India.</p>
      </LegalSection>
    </LegalLayout>
  );
}
