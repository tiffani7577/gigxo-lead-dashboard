import { Link } from "wouter";
import { Music } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Link href="/">
          <a className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8">
            <Music className="w-5 h-5" />
            <span className="font-semibold">Gigxo</span>
          </a>
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-slate-400 text-sm mb-10">Last updated: 2026</p>

        <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Nature of the service</h2>
            <p>
              <strong>Gigxo</strong> is a booking marketplace that connects venues, event organizers, and clients with performers (e.g., DJs, bands, artists) in South Florida. We provide a platform to discover leads, view event and contact information, and facilitate connections. We do not employ performers or venues; we are not a party to any booking or performance agreement between you and a performer or venue.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. No guarantee of performer quality</h2>
            <p>
              Gigxo <strong>does not guarantee</strong> the quality, conduct, or performance of any performer, venue, or third party listed on the platform. Listings and profiles are provided for informational purposes. You are responsible for your own due diligence, communications, and agreements with performers and venues.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Responsibility for agreements</h2>
            <p>
              Any <strong>agreements</strong> (including rates, dates, cancellation, and performance terms) are solely between you and the performer or venue. Gigxo is not a party to those agreements and is not responsible for enforcing them or for any breach. We encourage clear, written terms between parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, <strong>Gigxo is not liable</strong> for any disputes, losses, damages, or claims arising from events, performances, no-shows, cancellations, or interactions between users, performers, and venues. Use of the platform and any transactions are at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Account suspension and abuse</h2>
            <p>
              We may <strong>suspend or terminate</strong> accounts that violate these terms, engage in fraud, abuse, harassment, or misuse of the platform. We reserve the right to remove content and restrict access without prior notice when we believe it is necessary to protect the community or the service.
            </p>
          </section>
        </div>

        <footer className="mt-12 pt-8 border-t border-slate-700 text-center text-slate-500 text-xs">
          <Link href="/" className="text-slate-400 hover:text-white">Home</Link>
          {" · "}
          <Link href="/privacy" className="text-slate-400 hover:text-white">Privacy Policy</Link>
          <p className="mt-2">© 2026 Gigxo.</p>
        </footer>
      </div>
    </div>
  );
}
