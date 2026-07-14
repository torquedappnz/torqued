import React from 'react';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface PrivacyPolicyProps {
  onBack?: () => void;
}

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-xl font-black tracking-tight text-foreground mt-10 mb-3">{children}</h2>
);
const H3: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-base font-bold text-foreground mt-6 mb-2">{children}</h3>
);
const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm text-muted leading-relaxed mb-3">{children}</p>
);
const UL: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ul className="space-y-1.5 mb-3">{children}</ul>
);
const LI: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="flex items-start gap-2 text-sm text-muted leading-relaxed">
    <span className="text-torqued-red mt-1 shrink-0">•</span>
    <span>{children}</span>
  </li>
);

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  const { theme } = useTheme();
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <nav className="p-4 md:px-8 flex justify-between items-center bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-50">
        <Logo variant={theme === 'dark' ? 'light' : 'dark'} />
        {onBack && (
          <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-card" onClick={onBack}>
            <ArrowLeft size={14} className="mr-1.5" /> Back
          </Button>
        )}
      </nav>

      <div className="max-w-3xl mx-auto w-full px-4 md:px-0 py-12">
        <div className="mb-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-torqued-red mb-1.5">Legal</p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground">Torqued NZ — Privacy Policy</h1>
          <p className="text-sm text-muted mt-2">Effective 15 June 2026</p>
        </div>

        <P>
          This Privacy Policy is issued by Torqued NZ (NZBN 9429053747006). It applies to all users of the Torqued
          platform, including customers and mechanics, and governs the collection, use, storage, and disclosure of
          personal information in accordance with the Privacy Act 2020 (NZ).
        </P>

        <H2>1. About Us</H2>
        <P>
          Torqued NZ is a New Zealand-based vehicle servicing marketplace that connects car owners (customers) with
          automotive service providers (mechanics). The platform is operated by:
        </P>
        <UL>
          <LI>Trading as: Torqued NZ</LI>
          <LI>NZBN: 9429053747006 — Sole trader</LI>
          <LI>Email: hello@torqued.site</LI>
          <LI>Phone: +64 22 389 5249</LI>
        </UL>
        <P>References in this policy to "Torqued", "we", "us" or "our" mean Sri Berry, trading as Torqued NZ.</P>

        <H2>2. Who This Policy Applies To</H2>
        <P>This policy applies to two categories of platform users:</P>
        <UL>
          <LI><span className="text-foreground font-semibold">Customers:</span> individuals who register on Torqued to book vehicle servicing, view service history, and interact with mechanics through the platform.</LI>
          <LI><span className="text-foreground font-semibold">Mechanics:</span> automotive service providers who register on Torqued to receive bookings, generate quotes, manage their business portal, and access relevant customer and vehicle data.</LI>
        </UL>
        <P>Separate provisions in this policy apply to each user type where relevant. Where a provision applies to both, it applies equally unless stated otherwise.</P>

        <H2>3. Information We Collect</H2>
        <H3>3.1 Customers</H3>
        <UL>
          <LI><span className="text-foreground font-semibold">Account information:</span> Full name, email address, and phone number.</LI>
          <LI><span className="text-foreground font-semibold">Vehicle information:</span> Vehicle registration plate, which is used to retrieve vehicle details (make, model, year, and associated service history) via the CarJam API. We do not store raw registration plate numbers in association with personal profiles beyond what is necessary for service delivery.</LI>
          <LI><span className="text-foreground font-semibold">Payment information:</span> We do not collect or store payment card details. All payment processing is handled by Stripe, Inc. We receive only transaction confirmations and booking-related metadata.</LI>
          <LI><span className="text-foreground font-semibold">Service history:</span> Records of vehicle servicing connected to your account, whether completed through a Torqued booking or manually added.</LI>
          <LI><span className="text-foreground font-semibold">AI interaction data:</span> Summaries and details related to your vehicle's service history that are processed by our AI features. See section 8.</LI>
          <LI><span className="text-foreground font-semibold">Usage data:</span> Platform activity, session data, and behavioural analytics collected via cookies and Google Analytics. See section 9.</LI>
        </UL>
        <H3>3.2 Mechanics</H3>
        <UL>
          <LI><span className="text-foreground font-semibold">Business information:</span> Business or trading name, New Zealand Business Number (NZBN), and business contact details.</LI>
          <LI><span className="text-foreground font-semibold">Owner verification:</span> Owner name, identity verification details, and supporting documentation submitted during onboarding.</LI>
          <LI><span className="text-foreground font-semibold">Trade credentials:</span> Relevant trade certificates and qualifications submitted for mechanic verification.</LI>
          <LI><span className="text-foreground font-semibold">Payment information:</span> Bank account details for payout purposes, processed securely through Stripe Connect. We do not store raw bank account numbers independently of Stripe's secure vault.</LI>
          <LI><span className="text-foreground font-semibold">Operational data:</span> Quotes generated, parts data, customer service records, and booking history associated with your mechanic portal.</LI>
          <LI><span className="text-foreground font-semibold">AI interaction data:</span> Mechanic portal data including parts data, customer service records, and quotes that may be processed by our AI features. See section 8.</LI>
          <LI><span className="text-foreground font-semibold">Usage data:</span> Platform activity and analytics data. See section 9.</LI>
        </UL>

        <H2>4. How We Collect Information</H2>
        <P>We collect information in the following ways:</P>
        <UL>
          <LI>Directly from you when you create an account, complete your profile, make or receive a booking, generate a quote, add service records, or contact us.</LI>
          <LI>Automatically through your use of the platform, including login activity, page interactions, and session data.</LI>
          <LI>From third-party sources, specifically CarJam (for vehicle lookup using registration plate data you provide) and Stripe (for payment confirmation data).</LI>
          <LI>Indirectly, when a mechanic generates a cold quote for a vehicle registered to your Torqued account. In this scenario, you will be notified and asked to grant access before any of your personal or service history data is shared with that mechanic. See section 6 for full details.</LI>
        </UL>
        <P>We will only collect personal information that is reasonably necessary for the purposes described in this policy, and will do so by lawful means and in a manner that is not unreasonably intrusive.</P>

        <H2>5. Purpose of Collection</H2>
        <P>We collect personal information for the following purposes:</P>
        <H3>For customers:</H3>
        <UL>
          <LI>To create and manage your account.</LI>
          <LI>To match you with mechanics and facilitate service bookings.</LI>
          <LI>To retrieve and display your vehicle's service history and details.</LI>
          <LI>To process payments for services booked through the platform.</LI>
          <LI>To power AI-assisted features including service history summaries and the customer chat assistant.</LI>
          <LI>To send you booking confirmations, service reminders, and platform notifications.</LI>
          <LI>To send marketing communications where you have consented (you may unsubscribe at any time).</LI>
          <LI>To improve the platform through analytics and usage data.</LI>
          <LI>To meet our legal and tax obligations.</LI>
        </UL>
        <H3>For mechanics:</H3>
        <UL>
          <LI>To verify your identity, business credentials, and trade qualifications.</LI>
          <LI>To create and manage your mechanic portal.</LI>
          <LI>To connect you with customers and facilitate bookings.</LI>
          <LI>To process payouts for completed services.</LI>
          <LI>To power AI-assisted features in the mechanic portal including quote generation, parts guidance, and the mechanic chat assistant.</LI>
          <LI>To improve the platform through analytics and usage data.</LI>
          <LI>To meet our legal and tax obligations.</LI>
        </UL>

        <H2>6. Mechanic Access to Customer Information</H2>
        <P>
          We apply strict controls over when and how mechanics may access customer personal information. A mechanic
          may only access a customer's personal details and vehicle service history in the following circumstances:
        </P>
        <H3>6.1 Prior Booking Relationship</H3>
        <P>
          Where a customer has previously completed a booking with a mechanic through Torqued, that mechanic retains
          access to the service records and customer details associated with that booking. This access is limited to
          information generated in connection with the booking relationship.
        </P>
        <H3>6.2 Cold Quotes</H3>
        <P>Where a mechanic initiates a cold quote for a vehicle that has no prior booking history with that mechanic, the following process applies:</P>
        <UL>
          <LI>The mechanic enters a vehicle registration plate. The platform queries CarJam to retrieve vehicle details.</LI>
          <LI>If the registration plate is linked to an existing Torqued customer account, the system will notify the mechanic that the vehicle owner holds a Torqued account and that access to their service history requires customer authorisation.</LI>
          <LI>A one-time access code valid for 24 hours is sent to the customer. If the customer provides this code to the mechanic, the mechanic may view the vehicle's service history for the purposes of generating an accurate quote.</LI>
          <LI>Torqued will notify the customer that their service history has been accessed by the mechanic, identifying the mechanic by name, consistent with our obligations under Information Privacy Principle 3A of the Privacy Act 2020.</LI>
          <LI>Where no Torqued account is linked to the registration plate, only general vehicle details from CarJam are available to the mechanic. No personal customer information is disclosed.</LI>
        </UL>
        <P>
          Under Information Privacy Principle 11 of the Privacy Act 2020, we may only disclose personal information
          to a third party where the individual would reasonably expect such disclosure, or has consented to it. The
          24-hour authorisation code mechanism described above is the mechanism by which customer consent to
          mechanic access is obtained.
        </P>

        <H2>7. Disclosure of Information</H2>
        <P>We do not sell your personal information. We do not share your personal information with third parties except in the following circumstances:</P>
        <UL>
          <LI>To our service providers who assist us in operating the platform, as described in section 8.</LI>
          <LI>To mechanics with whom you have an active or historical booking relationship, or where you have granted access via the cold quote authorisation process.</LI>
          <LI>Where required by New Zealand law, a court order, or a regulatory authority.</LI>
          <LI>Where you have otherwise consented.</LI>
        </UL>

        <H2>8. Third-Party Services and Overseas Disclosure</H2>
        <P>
          Torqued uses a number of third-party service providers to operate the platform. Some of these providers are
          based outside New Zealand, meaning your personal information may be transferred, stored, or processed
          overseas. Under Information Privacy Principle 12 of the Privacy Act 2020, we are required to disclose these
          transfers. The following third-party providers process personal information on our behalf:
        </P>
        <H3>Stripe, Inc. (United States)</H3>
        <P>
          Stripe processes payment transactions and mechanic payouts. Customer payment card data and mechanic bank
          account details are stored within Stripe's secure infrastructure. Torqued does not hold raw payment or
          banking details independently of Stripe. Stripe maintains its own privacy policy and is certified under
          internationally recognised data security standards.
        </P>
        <H3>Supabase, Inc. (Database hosted in Tokyo, Japan)</H3>
        <P>
          Supabase provides the database and authentication infrastructure underpinning Torqued. Your account data,
          service records, booking history, and platform activity are stored on Supabase servers located in the
          Tokyo, Japan region. Japan has been recognised as having comparable data protection standards to New
          Zealand.
        </P>
        <H3>CarJam (New Zealand)</H3>
        <P>
          CarJam provides vehicle lookup services. When you enter a vehicle registration plate on Torqued, that
          registration plate is transmitted to CarJam to retrieve vehicle details such as make, model, and year.
          CarJam is a New Zealand company and your data is processed within New Zealand.
        </P>
        <H3>Anthropic, Inc. (United States)</H3>
        <P>Torqued uses Anthropic's AI API to power two features:</P>
        <UL>
          <LI><span className="text-foreground font-semibold">Customer service history summaries:</span> aggregated vehicle service history and vehicle details (excluding VIN and registration plate) are sent to Anthropic to generate a readable summary for your dashboard.</LI>
          <LI><span className="text-foreground font-semibold">AI chat assistants:</span> both the customer-facing and mechanic-facing AI chat features send relevant contextual data (for customers, vehicle and service history data; for mechanics, parts data, quotes, and customer service records) to Anthropic to generate responses. No raw identification information such as names, email addresses, or contact numbers is included in AI prompts.</LI>
        </UL>
        <P>
          Your data transmitted to Anthropic is processed in the United States. Anthropic maintains enterprise-grade
          data handling practices and does not use API data to train its models. You may opt out of AI features by
          contacting us at torqued.nz@icloud.com, in which case no data associated with your account will be
          transmitted to Anthropic.
        </P>
        <H3>Google LLC (United States) — Gmail and Google Analytics</H3>
        <P>
          We use Gmail for transactional and marketing communications. Email content and your email address are
          processed through Google's servers. We also use Google Analytics to collect anonymised usage and
          behavioural data about how users interact with the platform. Google Analytics uses cookies (see section
          9). Google LLC is based in the United States and processes data under Google's own privacy framework. You
          may opt out of Google Analytics tracking using the Google Analytics Opt-Out Browser Add-on or by adjusting
          your cookie preferences on the platform.
        </P>

        <H2>9. Cookies and Analytics</H2>
        <P>
          Torqued uses cookies and similar tracking technologies to operate and improve the platform. Cookies are
          small files stored on your device that allow us to recognise your session, maintain login state, and
          analyse platform usage. We use cookies for the following purposes:
        </P>
        <UL>
          <LI><span className="text-foreground font-semibold">Authentication cookies:</span> Issued by Supabase to maintain your logged-in session. These are strictly necessary and cannot be disabled without preventing platform access.</LI>
          <LI><span className="text-foreground font-semibold">Analytics cookies:</span> Issued by Google Analytics to collect anonymised data about page visits, session duration, and user flows. These are not strictly necessary. You may opt out via your browser settings or the Google Analytics Opt-Out tool.</LI>
        </UL>
        <P>We do not use advertising cookies or sell your cookie data to third parties.</P>

        <H2>10. AI-Powered Features</H2>
        <P>Torqued uses artificial intelligence to provide the following features:</P>
        <H3>Customer Portal</H3>
        <UL>
          <LI>Service history summaries generated from your vehicle's service records.</LI>
          <LI>An AI chat assistant that can answer questions about your vehicle, service history, and bookings.</LI>
        </UL>
        <H3>Mechanic Portal</H3>
        <UL>
          <LI>An AI chat assistant that can provide general guidance on repairs, parts, quotes, and customer service history where the mechanic has authorised access.</LI>
        </UL>
        <P>
          Data sent to our AI provider (Anthropic) is limited to what is necessary for the feature to function.
          Identifying information such as full names, email addresses, phone numbers, and VIN or registration plate
          numbers are excluded from AI prompts. AI features operate on the minimum data needed to generate a useful
          response.
        </P>
        <P>
          You may opt out of all AI features at any time by contacting us at torqued.nz@icloud.com. Opting out does
          not affect your ability to use the rest of the Torqued platform.
        </P>

        <H2>11. Data Retention</H2>
        <P>We retain personal information only for as long as is necessary for the purposes described in this policy, or as required by law.</P>
        <UL>
          <LI><span className="text-foreground font-semibold">Financial and tax records:</span> Retained for a minimum of seven (7) years in accordance with the requirements of the Tax Administration Act 1994 and the Companies Act 1993 (as applicable to sole traders). These records include transaction data, revenue information, and invoicing records.</LI>
          <LI><span className="text-foreground font-semibold">Active account data:</span> Retained for the duration of your account and for as long as reasonably necessary following account closure to meet operational or legal obligations.</LI>
          <LI><span className="text-foreground font-semibold">Vehicle service history:</span> Retained as described in section 12 below.</LI>
          <LI><span className="text-foreground font-semibold">Mechanic verification data:</span> Retained for the duration of the mechanic's active status on the platform and for a reasonable period thereafter to meet any applicable regulatory requirements.</LI>
        </UL>
        <P>Where we no longer have a legitimate purpose for holding your personal information, we will delete or anonymise it in a secure manner.</P>

        <H2>12. Account Deletion and Vehicle Service History</H2>
        <P>You may request the deletion of your Torqued account at any time by contacting us at torqued.nz@icloud.com.</P>
        <H3>12.1 Account Archive Period</H3>
        <P>
          Upon receiving a valid deletion request, your account will be disabled and archived for thirty (30) days.
          During this period, your account and associated data are not accessible to other platform users. You may
          cancel the deletion and restore your account within this window by contacting us.
        </P>
        <H3>12.2 Permanent Deletion</H3>
        <P>After the 30-day archive period, your personal account data (including name, email address, phone number, and login credentials) will be permanently deleted.</P>
        <H3>12.3 Vehicle Service History Retention</H3>
        <P>
          Vehicle service history records exist to maintain an accurate history of a vehicle's maintenance over time.
          This history may be relevant to future owners, mechanics, and buyers of that vehicle, independent of any
          individual account.
        </P>
        <P>
          Following permanent account deletion, vehicle service history records associated with your account will be
          retained by Torqued in a de-identified state, detached from your personal profile. This means the service
          history remains linked to the vehicle (by internal vehicle identifier), but is no longer associated with
          your name, contact details, or account. The following applies to this retained service history:
        </P>
        <UL>
          <LI>It is not accessible to mechanics or other platform users through normal platform functions.</LI>
          <LI>It is accessible to Torqued's administrative and back-office functions for platform integrity and dispute resolution purposes.</LI>
          <LI>You retain the right to access this data as described in section 13.</LI>
        </UL>
        <H3>12.4 Written Requests to Destroy Service History</H3>
        <P>
          You may submit a written request to torqued.nz@icloud.com asking that your vehicle's service history be
          destroyed. We will honour such requests with the following limitation: service records created by Torqued
          platform bookings cannot be destroyed, as these constitute transaction records necessary for our legal,
          financial, and operational obligations. Records you manually added to your account, or records sourced
          from external service history, are eligible for destruction upon written request.
        </P>
        <P>We will respond to written destruction requests within 20 working days and will confirm which records can and cannot be destroyed, with reasons.</P>

        <H2>13. Your Privacy Rights</H2>
        <P>Under the Privacy Act 2020, you have the following rights in relation to your personal information held by Torqued:</P>
        <H3>13.1 Right of Access (Information Privacy Principle 6)</H3>
        <P>
          You have the right to request access to personal information we hold about you. We will respond to access
          requests within 20 working days. In most cases, access will be provided at no charge. If we decline
          access, we will provide written reasons.
        </P>
        <H3>13.2 Right of Correction (Information Privacy Principle 7)</H3>
        <P>
          You have the right to request correction of personal information we hold about you that is inaccurate, out
          of date, incomplete, or misleading. We will either correct the information or, where we disagree with the
          requested correction, attach a statement of the correction sought.
        </P>
        <H3>13.3 How to Exercise Your Rights</H3>
        <P>To make an access or correction request, contact us at:</P>
        <UL>
          <LI>Email: torqued.nz@icloud.com</LI>
          <LI>Phone: +64 22 389 5249</LI>
        </UL>
        <P>
          Please include your full name, account email address, and a description of the information you are
          requesting access to or seeking to correct. We may ask you to verify your identity before we process your
          request.
        </P>

        <H2>14. Marketing Communications</H2>
        <P>
          With your consent, we may send you marketing communications relating to Torqued features, promotions, and
          updates. Consent is obtained at the time of account registration. You may withdraw your consent at any
          time by:
        </P>
        <UL>
          <LI>Clicking the unsubscribe link at the bottom of any marketing email we send you.</LI>
          <LI>Contacting us directly at torqued.nz@icloud.com.</LI>
        </UL>
        <P>Withdrawal of marketing consent does not affect our ability to send you transactional communications related to your bookings, account security, or platform functionality.</P>

        <H2>15. Age Requirements</H2>
        <P>Torqued operates the following minimum age requirements:</P>
        <UL>
          <LI><span className="text-foreground font-semibold">Customers:</span> You must be at least 16 years of age to register as a customer. This reflects the minimum age for holding a New Zealand driver licence. By registering, you confirm that you meet this requirement.</LI>
          <LI><span className="text-foreground font-semibold">Mechanics:</span> You must be at least 18 years of age to register as a mechanic on Torqued. This reflects the minimum age for directorship of a New Zealand business entity. By registering, you confirm that you meet this requirement.</LI>
        </UL>
        <P>If we become aware that a user does not meet the applicable age requirement, we reserve the right to suspend or terminate their account and delete associated personal information.</P>

        <H2>16. Security of Personal Information</H2>
        <P>We take reasonable steps to protect the personal information we hold from loss, unauthorised access, use, modification, or disclosure. Security measures in place include:</P>
        <UL>
          <LI>Two-factor authentication (2FA) for all user accounts.</LI>
          <LI>Encrypted data transmission using industry-standard TLS protocols.</LI>
          <LI>Database access controls and role-based permissions enforced through Supabase.</LI>
          <LI>Stripe's PCI-DSS compliant infrastructure for all payment processing.</LI>
        </UL>
        <P>
          Despite these measures, no internet-based platform can guarantee absolute security. You should ensure your
          account password is strong and not shared with others, and contact us immediately at
          torqued.nz@icloud.com if you suspect unauthorised access to your account.
        </P>

        <H2>17. Privacy Breach Notification</H2>
        <P>
          Under the Privacy Act 2020, Torqued is required to notify the Office of the Privacy Commissioner and
          affected individuals if a privacy breach occurs that is likely to cause serious harm. In the event of a
          notifiable privacy breach, we will:
        </P>
        <UL>
          <LI>Notify affected individuals as soon as practicable.</LI>
          <LI>Notify the Office of the Privacy Commissioner in accordance with our statutory obligations.</LI>
          <LI>Take steps to contain the breach and prevent recurrence.</LI>
        </UL>
        <P>If you believe a privacy breach has occurred affecting your personal information held by Torqued, please contact us immediately at torqued.nz@icloud.com.</P>

        <H2>18. Complaints</H2>
        <P>If you have a concern about how we have handled your personal information, please contact us in the first instance:</P>
        <UL>
          <LI>Email: torqued.nz@icloud.com | Phone: +64 22 389 5249</LI>
        </UL>
        <P>We will respond to complaints within 20 working days and will work with you to resolve the issue. If you are not satisfied with our response, you have the right to complain to the Office of the Privacy Commissioner:</P>
        <UL>
          <LI>Website: <a href="https://www.privacy.org.nz" target="_blank" rel="noreferrer" className="text-torqued-red underline underline-offset-2">www.privacy.org.nz</a></LI>
          <LI>Phone: 0800 803 909</LI>
          <LI>Post: PO Box 10094, Wellington 6143, New Zealand</LI>
        </UL>

        <H2>19. Changes to This Policy</H2>
        <P>
          We may update this Privacy Policy from time to time to reflect changes in our practices, legal
          obligations, or platform features. When we make material changes, we will notify registered users by email
          and update the effective date at the top of this document.
        </P>
        <P>We encourage you to review this policy periodically. Continued use of the Torqued platform after notification of changes constitutes acceptance of the updated policy.</P>

        <H2>20. Governing Law</H2>
        <P>
          This Privacy Policy is governed by and construed in accordance with the laws of New Zealand, including the
          Privacy Act 2020. Any disputes arising in connection with this policy shall be subject to the jurisdiction
          of New Zealand law.
        </P>

        <div className="mt-10 pt-6 border-t border-border">
          <p className="text-xs text-muted font-semibold">Reviewed and approved on 15th June 2026.</p>
        </div>
      </div>

      <footer className="bg-card text-foreground py-8 px-4 border-t border-border">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted text-sm">© 2026 Torqued NZ.</p>
          <a href="mailto:hello@torqued.site" className="text-xs text-muted hover:text-foreground transition-colors">hello@torqued.site</a>
        </div>
      </footer>
    </div>
  );
};
