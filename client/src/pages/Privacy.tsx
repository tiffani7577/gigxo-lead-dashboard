import { Link } from "wouter";
import { Music } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Link href="/">
          <a className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8">
            <Music className="w-5 h-5" />
            <span className="font-semibold">Gigxo</span>
          </a>
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-slate-400 text-sm mb-10">Last updated: 2026</p>

        <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Account data</h2>
            <p>
              We collect and store account information you provide when you sign up or update your profile, including your <strong>email address</strong> and <strong>name</strong>. This data is used to operate your account, send you service-related communications, and personalize your experience.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Google OAuth login</h2>
            <p>
              You may sign in using Google. When you do, we receive your Google account email, name, and profile picture (if available). We use this only to create or link your Gigxo account and to display your profile. We do not use Google data for advertising or share it with third parties for marketing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Lead data</h2>
            <p>
              Gigxo stores <strong>lead data</strong> in our database, including event and venue information, contact details, and your interactions with leads (e.g., unlocks, views). This data is used to deliver the service, show you relevant leads, and improve the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Email outreach</h2>
            <p>
              Our outreach system allows admins to send emails to leads (e.g., venues and performers). Emails are sent only when an admin explicitly triggers a send. We log sent messages (subject, body, recipient, time) for record-keeping and support. We do not sell or share this data with third parties for marketing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Analytics and cookies</h2>
            <p>
              We may use analytics and cookies to understand how the site is used, to keep you signed in, and to improve performance. Session and authentication cookies are necessary for the service to function. You can control cookie preferences in your browser, but disabling essential cookies may limit your ability to use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Contact</h2>
            <p>
              For privacy-related questions or requests (e.g., access or deletion of your data), contact us at{" "}
              <a href="mailto:support@gigxo.com" className="text-purple-400 hover:underline">support@gigxo.com</a>.
            </p>
          </section>
        </div>

        <footer className="mt-12 pt-8 border-t border-slate-700 text-center text-slate-500 text-xs">
          <Link href="/" className="text-slate-400 hover:text-white">Home</Link>
          {" · "}
          <Link href="/terms" className="text-slate-400 hover:text-white">Terms of Service</Link>
          <p className="mt-2">© 2026 Gigxo.</p>
        </footer>
      </div>
    </div>
  );
}
