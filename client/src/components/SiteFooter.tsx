import { Link } from "wouter";

interface SiteFooterProps {
  className?: string;
  /** If true, use compact styling (e.g. for auth pages) */
  compact?: boolean;
}

export function SiteFooter({ className = "", compact }: SiteFooterProps) {
  const base = "border-t border-slate-200 bg-white text-slate-500 text-sm";
  const padding = compact ? "py-4" : "py-8";

  return (
    <footer className={`${base} ${padding} ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex flex-col items-center gap-2 ${compact ? "text-center" : "text-center"}`}>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link href="/pricing">
              <a className="hover:text-slate-900 transition-colors">Pricing</a>
            </Link>
            <span className="text-slate-600">·</span>
            <Link href="/privacy">
              <a className="hover:text-slate-900 transition-colors">Privacy Policy</a>
            </Link>
            <span className="text-slate-600">·</span>
            <Link href="/terms">
              <a className="hover:text-slate-900 transition-colors">Terms of Service</a>
            </Link>
          </div>
          {!compact && <p>© 2026 Gigxo. Founded by artists, for artists.</p>}
          {compact && <p className="text-xs">© 2026 Gigxo</p>}
        </div>
      </div>
    </footer>
  );
}
