import React, { useEffect } from "react";
import { useApp } from "../context/AppContext";
import { LEGAL, LEGAL_PATHS, LEGAL_TITLES, LegalDoc } from "../legal";
import { Crown, CalendarClock, LogIn, Infinity as InfinityIcon } from "lucide-react";

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-lg font-display font-bold text-slate-900 mt-9 mb-2">{children}</h2>
);
const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm leading-relaxed text-slate-700 mb-3">{children}</p>
);
const UL: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed text-slate-700 mb-3">{children}</ul>
);
const A: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} className="text-[#2589BD] underline underline-offset-2 hover:text-[#1b6a93]">
    {children}
  </a>
);

const Contact: React.FC = () =>
  LEGAL.contactEmail ? (
    <A href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</A>
  ) : (
    <A href={LEGAL.contactUrl}>{LEGAL.contactUrl.replace(/^https?:\/\//, "")}</A>
  );

/* ------------------------------------------------------------------ */
/* The signed-in visitor's own plan, with the one action open to them. */
/* ------------------------------------------------------------------ */
const ManageSubscription: React.FC = () => {
  const { user, userSubscription, cancelSubscription, openAuth, setShowUpgradeModal } = useApp();
  const tier = userSubscription.tier;
  const date = userSubscription.premiumExpires ? new Date(userSubscription.premiumExpires).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null;
  const box = "rounded-xl border p-5 sm:p-6 my-6";

  if (!user) {
    return (
      <div className={`${box} border-slate-200 bg-white`}>
        <p className="text-sm font-bold text-slate-900 mb-1">Manage your plan</p>
        <p className="text-sm text-slate-600 mb-4">Sign in to see your plan and cancel a subscription.</p>
        <button onClick={() => openAuth("signin")} className="h-10 px-4 rounded-md bg-slate-900 text-white text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer hover:bg-slate-800">
          <LogIn className="w-4 h-4" /> Sign in
        </button>
      </div>
    );
  }
  if (tier === "free") {
    return (
      <div className={`${box} border-slate-200 bg-white`}>
        <p className="text-sm font-bold text-slate-900 mb-1">You're on the free plan</p>
        <p className="text-sm text-slate-600 mb-4">There is no subscription on this account, so there is nothing to cancel and nothing will be charged.</p>
        <button onClick={() => setShowUpgradeModal(true)} className="h-10 px-4 rounded-md border text-xs font-extrabold uppercase tracking-wider cursor-pointer hover:bg-rose-50" style={{ color: "#7F345F", borderColor: "#7F345F" }}>
          See Pro plans
        </button>
      </div>
    );
  }
  if (tier === "pro-lifetime") {
    return (
      <div className={`${box} border-amber-300 bg-amber-50`}>
        <p className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
          <InfinityIcon className="w-4 h-4 text-amber-600" /> Lifetime Pro
        </p>
        <p className="text-sm text-slate-700">
          Your account has lifetime access. It was a one-time payment, so there is no subscription to cancel, nothing renews and you will never be charged again. Lifetime purchases are not refundable.
        </p>
      </div>
    );
  }
  const canceling = userSubscription.subscriptionStatus === "canceling";
  return (
    <div className={`${box} border-amber-300 bg-amber-50`}>
      <p className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
        <Crown className="w-4 h-4 text-amber-600" /> {userSubscription.pricingPlan || "palette Pro"}
      </p>
      {canceling ? (
        <p className="text-sm text-slate-700 flex items-start gap-2">
          <CalendarClock className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" />
          <span>Your subscription is cancelled. You keep Pro until {date ?? "the end of the period you paid for"}, and you won't be charged again.</span>
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-700 mb-4">
            {date ? `Your plan renews on ${date}. ` : ""}If you cancel, you keep Pro until the end of the period you have already paid for, and you won't be charged again. The current period is not refunded.
          </p>
          <button
            onClick={() => {
              if (window.confirm("Cancel your subscription? You'll keep Pro until the end of the current billing period.")) cancelSubscription();
            }}
            className="h-10 px-4 rounded-md bg-white border border-rose-300 text-rose-700 text-xs font-extrabold uppercase tracking-wider cursor-pointer hover:bg-rose-50"
          >
            Cancel subscription
          </button>
        </>
      )}
    </div>
  );
};

/* ------------------------------ documents ------------------------------ */

const Terms: React.FC = () => (
  <>
    <P>
      These terms are an agreement between you and {LEGAL.operator} ("we", "us"), a company based in {LEGAL.operatorLocation} and the parent company of {LEGAL.brand}, which operates {LEGAL.product} at {LEGAL.site.replace("https://", "")}. By creating an account or using {LEGAL.product} you agree to them. If you don't agree, please don't use the service.
    </P>

    <H2>1. The service</H2>
    <P>
      {LEGAL.product} is a web tool for generating, scoring, previewing, saving and exporting color palettes. Some features are free. Others ("Pro") need a paid plan. We may add, change or remove features, and we will try to give notice of changes that materially reduce what a paid plan includes.
    </P>

    <H2>2. Your account</H2>
    <UL>
      <li>You can sign in with Google or with an email address and password. Keep your sign-in details private; you are responsible for activity on your account.</li>
      <li>You must be at least 13 years old (16 in the European Economic Area and the United Kingdom) and able to enter into a contract.</li>
      <li>Give us accurate information, and tell us if you think someone else has used your account.</li>
    </UL>

    <H2>3. Paid plans and billing</H2>
    <UL>
      <li>Pro is sold as a monthly subscription, an annual subscription, or a one-time lifetime purchase. The price is shown before you pay.</li>
      <li>Monthly and annual subscriptions renew automatically at the end of each period, at the price then in effect, until you cancel.</li>
      <li>Payments are processed by Square. Your card details go directly to Square; we never see or store your full card number.</li>
      <li>If a renewal payment fails we may retry it, and Pro access can end if payment is not received.</li>
      <li>We may change prices for future periods. We will tell you before a change applies to your renewal, and you can cancel before it does.</li>
      <li>"Lifetime" means for as long as we operate {LEGAL.product}. It is tied to one account and cannot be transferred.</li>
      <li>You are responsible for any taxes that apply to your purchase.</li>
    </UL>

    <H2>4. Cancelling, and refunds</H2>
    <P>
      You can cancel a subscription at any time from your account menu or from the <A href={LEGAL_PATHS.refunds}>Refunds &amp; Cancellation</A> page. Cancelling stops future charges; you keep Pro until the end of the period you have paid for. Payments are not refundable, except where the law requires otherwise. The full policy is on that page and forms part of these terms.
    </P>

    <H2>5. Your palettes and what you make</H2>
    <P>
      The palettes you create, save and export are yours to use for any purpose, including commercial work. We claim no ownership of them. You give us permission to store and process them only so we can provide the service to you. Colors themselves and simple color combinations are generally not protected by copyright, so we can't promise that a palette you generate is unique to you.
    </P>

    <H2>6. Our software and brand</H2>
    <P>
      The {LEGAL.product} software, design, scoring methods, text and the {LEGAL.brand} and {LEGAL.product} names and logos belong to us and are protected by law. These terms don't give you any right to them beyond using the service as intended.
    </P>

    <H2>7. Acceptable use</H2>
    <P>Please don't:</P>
    <UL>
      <li>break the law or infringe someone else's rights using the service;</li>
      <li>try to get Pro features without paying, share an account to avoid paying, or resell access;</li>
      <li>probe, overload, scrape or reverse engineer the service, or interfere with other people's use of it;</li>
      <li>use automated means to create accounts or generate output in bulk.</li>
    </UL>
    <P>We may suspend or close an account that does any of these.</P>

    <H2>8. What we don't promise</H2>
    <P>
      {LEGAL.product} is provided "as is" and "as available". Color scores, harmony suggestions and contrast ratios are guidance to help you decide; they are not a guarantee that a design meets WCAG, any accessibility law, or any other standard, and you should verify finished work yourself. To the fullest extent the law allows, we disclaim all implied warranties, including merchantability, fitness for a particular purpose and non-infringement. We don't promise the service will be uninterrupted or error free.
    </P>

    <H2>9. Limit of liability</H2>
    <P>
      To the fullest extent the law allows, we are not liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue, data or goodwill. Our total liability for any claim about the service is limited to the greater of the amount you paid us in the 12 months before the claim arose, or US$50. Nothing in these terms limits liability that cannot be limited by law.
    </P>

    <H2>10. Ending your use</H2>
    <P>
      You can stop using {LEGAL.product} at any time and can ask us to delete your account. We may suspend or end access if you break these terms. If we discontinue the service altogether we will give reasonable notice where we can.
    </P>

    <H2>11. Changes to these terms</H2>
    <P>
      We may update these terms. We will change the date at the top and, for significant changes, tell you in the product or by email. Continuing to use {LEGAL.product} after a change takes effect means you accept it.
    </P>

    <H2>12. Governing law</H2>
    <P>
      These terms are governed by the laws of the State of {LEGAL.governingState}, United States, without regard to conflict-of-law rules. Any dispute that goes to court will be heard in the state or federal courts located in {LEGAL.venue}, and you and we agree to their jurisdiction. If you are a consumer, you keep any protections that the law of your home country says cannot be waived.
    </P>

    <H2>13. Contact</H2>
    <P>
      Questions about these terms: <Contact />. {LEGAL.operator}, {LEGAL.operatorLocation}, United States.
    </P>
  </>
);

const Privacy: React.FC = () => (
  <>
    <P>
      This policy explains what {LEGAL.operator} ("we", "us"), the {LEGAL.operatorLocation} company behind {LEGAL.brand}, collects when you use {LEGAL.product} at {LEGAL.site.replace("https://", "")}, why, and the choices you have. We collect as little as the product needs. We don't sell your personal information and we don't run advertising on {LEGAL.product}. We do use an analytics service to understand how the product is used, described below.
    </P>

    <H2>1. What we collect</H2>
    <UL>
      <li>
        <strong>Account details.</strong> Your email address and, if you sign in with Google, your name and profile picture as Google provides them. If you sign up with email and password, the password is handled by Google Firebase Authentication; we never see it.
      </li>
      <li>
        <strong>Palettes you save.</strong> The colors, roles, lock settings, harmony rule and name of each palette you save to your account.
      </li>
      <li>
        <strong>Plan and billing records.</strong> Which plan you have, its status, start, renewal and cancellation dates, and the customer and subscription reference numbers Square gives us. Your card number, expiry date and security code are entered into a form hosted by Square and go straight to Square. They never reach our servers.
      </li>
      <li>
        <strong>Usage analytics.</strong> We use Amplitude to see how {LEGAL.product} is used: pages viewed, buttons clicked, actions such as spinning or exporting a palette, your approximate location derived from your IP address, and your device and browser type. Amplitude also records session replays, which reconstruct how a visit looked on screen so we can find and fix confusing or broken parts of the product. Text you type into form fields is masked in replays, and card details are entered in a separate form hosted by Square that is never recorded.
      </li>
      <li>
        <strong>Technical logs.</strong> Our hosting and server providers record standard request data such as IP address, browser type and time of request, for security and troubleshooting.
      </li>
    </UL>
    <P>You can use the palette generator without an account. In that case we hold no account or palette data about you; usage analytics are still collected as described above.</P>

    <H2>2. Cookies and storage in your browser</H2>
    <P>
      We don't use advertising cookies. {LEGAL.product} keeps a few items in your browser so it works as you expect: your light or dark backdrop choice and your sign-in session (managed by Firebase Authentication). Amplitude sets cookies and local storage entries that hold a random device identifier and session information, so that visits can be counted and understood. You can clear all of these at any time in your browser settings, and you can block them with your browser's privacy controls.
    </P>

    <H2>3. How we use it</H2>
    <UL>
      <li>to sign you in and keep your account secure;</li>
      <li>to store and show your saved palettes;</li>
      <li>to take payment, apply the right plan, and handle renewals and cancellations;</li>
      <li>to send messages about your account or purchase, such as receipts or a notice of a failed payment;</li>
      <li>to understand how the product is used and improve it;</li>
      <li>to prevent abuse and fix problems.</li>
    </UL>
    <P>
      Where the GDPR or UK GDPR applies, we rely on performance of our contract with you for the account, palettes and billing; on our legitimate interests for security, troubleshooting and understanding how the product is used; and on legal obligation for keeping transaction records.
    </P>

    <H2>4. Who we share it with</H2>
    <P>Only the service providers that run {LEGAL.product} for us:</P>
    <UL>
      <li>
        <strong>Google (Firebase and Google Cloud)</strong> for sign-in, the database, hosting and server functions. The site also loads its typefaces from Google Fonts, which means your browser requests them from Google.
      </li>
      <li>
        <strong>Amplitude</strong> for usage analytics and session replay, as described in section 1.
      </li>
      <li>
        <strong>Brevo</strong> for email. It holds your email address, name and plan status so we can send account emails (welcome, receipt, cancellation, a failed payment) and, only if you opted in, occasional news. Every marketing email has an unsubscribe link.
      </li>
      <li>
        <strong>Square</strong> for payment processing. Square receives your card details and your email address, and handles them under its own privacy policy.
      </li>
    </UL>
    <P>
      We may also disclose information if the law requires it, or to protect our rights, our users or the public. If {LEGAL.operator} or {LEGAL.brand} is involved in a merger or sale, account information may transfer to the new owner under this policy's protections.
    </P>

    <H2>5. Where it is kept, and for how long</H2>
    <P>
      Data is processed in the United States. If you use {LEGAL.product} from elsewhere, your information is transferred to the United States. We keep account and palette data while your account is open. If you ask us to delete your account we delete it, apart from transaction records we must keep for tax, accounting and fraud-prevention purposes.
    </P>

    <H2>6. Your choices and rights</H2>
    <UL>
      <li>You can delete any saved palette yourself, and cancel a subscription from your account menu.</li>
      <li>You can ask us for a copy of your data, to correct it, or to delete your account and data.</li>
      <li>
        Depending on where you live (for example the EEA, the UK or California), you may have further rights, including to object to or restrict certain processing, to data portability, and to complain to your data protection authority. We don't sell or share personal information for cross-context behavioral advertising.
      </li>
    </UL>
    <P>
      To make a request, contact us at <Contact />. We may need to confirm it's really you before acting.
    </P>

    <H2>7. Security</H2>
    <P>
      Data is encrypted in transit, access to each account's palettes and plan is restricted to that account by database rules, and payment data is handled by Square, a PCI-compliant processor. No system is perfectly secure, so we can't guarantee absolute security.
    </P>

    <H2>8. Children</H2>
    <P>
      {LEGAL.product} is not directed to children under 13, and we don't knowingly collect their personal information. If you believe a child has given us information, contact us and we will delete it.
    </P>

    <H2>9. Changes</H2>
    <P>
      If we change this policy we will update the date at the top and, for significant changes, tell you in the product or by email.
    </P>

    <H2>10. Contact</H2>
    <P>
      Privacy questions and requests: <Contact />.
    </P>
  </>
);

const Refunds: React.FC = () => (
  <>
    <P>
      The short version: you can cancel a subscription whenever you like and you keep Pro until the end of the time you've paid for. We don't give refunds.
    </P>

    <ManageSubscription />

    <H2>Why there are no refunds</H2>
    <P>
      What you buy with {LEGAL.product} Pro is access, and it starts the moment you pay. Someone could subscribe, generate and export every palette they need in an afternoon, and then ask for the money back. So all payments are final: monthly, annual and lifetime. We'd rather be clear about that before you buy than surprise you after.
    </P>
    <P>
      Before you pay you can try the generator, scoring, the contrast checker, the Website preview and CSS export on the free plan, to see whether {LEGAL.product} is useful to you.
    </P>

    <H2>Monthly and annual subscriptions</H2>
    <UL>
      <li>Cancel at any time, from your account menu or from the box at the top of this page.</li>
      <li>Cancelling stops all future charges. It does not refund the current period.</li>
      <li>You keep every Pro feature until the end of the period you have already paid for. After that the account moves to the free plan.</li>
      <li>Your saved palettes are kept. On the free plan you can still open and delete them, but saving new palettes is a Pro feature.</li>
      <li>To avoid the next charge, cancel before your renewal date. The date is shown in your account menu.</li>
    </UL>

    <H2>Lifetime</H2>
    <P>
      Lifetime is a single payment for Pro access for as long as we operate {LEGAL.product}. There is no subscription behind it, so there is nothing to cancel and nothing ever renews. A lifetime purchase is not refundable.
    </P>

    <H2>If something went wrong</H2>
    <UL>
      <li>
        <strong>Charged twice, or charged after you cancelled?</strong> That's our mistake to fix, not a refund request. Contact us at <Contact /> and we will correct it.
      </li>
      <li>
        <strong>Paid but Pro didn't unlock?</strong> Sign out and back in. If it still hasn't, contact us and we will sort it out.
      </li>
      <li>
        <strong>Your rights under the law.</strong> Nothing here removes a right to a refund that the law of your country gives you and that can't be waived. By purchasing, you ask us to start your access immediately and, where the law allows, you acknowledge that you lose any right to withdraw from the purchase once access has begun.
      </li>
    </UL>

    <H2>Asked for a refund?</H2>
    <P>
      If you contact us asking for one, we'll point you back here: cancel using the box at the top, and your plan runs to the end of its paid term with no further charges.
    </P>
  </>
);

const DOCS: Record<LegalDoc, React.FC> = { terms: Terms, privacy: Privacy, refunds: Refunds };

export const LegalPage: React.FC<{ doc: LegalDoc }> = ({ doc }) => {
  const Body = DOCS[doc];
  useEffect(() => {
    const before = document.title;
    document.title = `${LEGAL_TITLES[doc]} · ${LEGAL.product} by ${LEGAL.brand}`;
    window.scrollTo(0, 0);
    return () => {
      document.title = before;
    };
  }, [doc]);

  return (
    <article className="w-full max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14 select-text">
      <a href="/" className="text-xs font-bold uppercase tracking-wider text-[#2589BD] hover:underline">
        ← Back to {LEGAL.product}
      </a>
      <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-slate-900 mt-4">{LEGAL_TITLES[doc]}</h1>
      <p className="text-xs text-slate-500 mt-2 mb-8">Effective {LEGAL.effective}</p>
      <Body />
      <nav aria-label="Other policies" className="mt-12 pt-6 border-t border-slate-200 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {(Object.keys(LEGAL_PATHS) as LegalDoc[])
          .filter((d) => d !== doc)
          .map((d) => (
            <A key={d} href={LEGAL_PATHS[d]}>
              {LEGAL_TITLES[d]}
            </A>
          ))}
      </nav>
    </article>
  );
};
