import LegalLayout from "@/components/LegalLayout";

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="September 2, 2026">
      <section>
        <h2>Information We Collect</h2>
        <p>
          We collect information you provide directly, such as your display name,
          email address, and password when you create an account, along with
          activity data like watch history, favorites, and lists as you use the
          service.
        </p>
      </section>
      <section>
        <h2>How We Use Information</h2>
        <p>
          We use this information to operate and improve DramaShort — remembering
          your progress, recommending titles, keeping your account secure, and
          communicating with you about your account.
        </p>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>
          We use cookies and similar technologies to keep you signed in and to
          understand how the site is used.
        </p>
      </section>
      <section>
        <h2>Data Retention</h2>
        <p>
          We retain account data for as long as your account is active. Watch
          history is retained from the day your account is created, though only a
          recent window is shown in your History page at any given time.
        </p>
      </section>
      <section>
        <h2>Your Rights</h2>
        <p>
          You can review and update your account information at any time from
          Account settings, and you can request deletion of your account and
          associated data.
        </p>
      </section>
      <section>
        <h2>Children&apos;s Privacy</h2>
        <p>
          DramaShort is not directed at children, and we do not knowingly collect
          information from children under the age required by local law.
        </p>
      </section>
      <section>
        <h2>Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. Material changes will be
          communicated before they take effect.
        </p>
      </section>
      <section>
        <h2>Contact Us</h2>
        <p>
          Questions about this policy can be directed to our support team through
          the Help Center.
        </p>
      </section>
    </LegalLayout>
  );
}
