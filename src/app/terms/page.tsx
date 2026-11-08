import type { Metadata } from "next";
import { TERMS_PATH } from "@/components/landing/constants";
import { LEGAL_SITE_NAME } from "@/components/legal/constants";
import {
  LegalLayout,
  LegalOperatorSection,
  LegalSection,
} from "@/components/legal/LegalLayout";

const TITLE = `Terms & Conditions — ${LEGAL_SITE_NAME}`;
const DESCRIPTION = `The terms for using ${LEGAL_SITE_NAME}: acceptable use, third-party services, no warranty and governing law.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: TERMS_PATH },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: TERMS_PATH,
  },
};

export default function TermsRoute() {
  return (
    <LegalLayout title="Terms & Conditions">
      <LegalOperatorSection />
      <LegalSection heading="Using the service">
        <p>
          By using {LEGAL_SITE_NAME} you agree to these terms. Use it only for
          lawful purposes and only against APIs you are allowed to test. Do not
          use the proxy or AI features to attack, overload or abuse any system,
          or to bypass rate limits.
        </p>
      </LegalSection>
      <LegalSection heading="Your data">
        <p>
          Your collections, environments and history live in your browser and
          you are responsible for them. Requests are forwarded through our proxy
          without being stored, AI and voice features send the content you
          choose to third-party providers, and share links are stored encrypted
          for 24 hours. See the Privacy Policy for details. We use no analytics
          or tracking.
        </p>
      </LegalSection>
      <LegalSection heading="Third-party services">
        <p>
          AI and speech features rely on third-party providers whose terms apply
          to the data sent to them. Do not send secrets or data you are not
          permitted to share.
        </p>
      </LegalSection>
      <LegalSection heading="No warranty and liability">
        <p>
          {LEGAL_SITE_NAME} is provided as is, without warranties of any kind.
          To the extent permitted by law, the operator is not liable for any
          loss arising from its use, including lost or cleared local data and
          expired share links.
        </p>
      </LegalSection>
      <LegalSection heading="Changes and governing law">
        <p>
          These terms may change; the effective date above shows the latest
          version. They are governed by the laws of India.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
