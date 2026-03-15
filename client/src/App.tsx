import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ArtistDashboard from "./pages/ArtistDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminOverview from "./pages/AdminOverview";
import AdminEventWindows from "./pages/AdminEventWindows";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ArtistProfile from "./pages/ArtistProfile";
import ArtistDirectory from "./pages/ArtistDirectory";
import PublicArtistProfile from "./pages/PublicArtistProfile";
import PipelineBoard from "./pages/PipelineBoard";
import SharePage from "./pages/SharePage";
import RequestEntertainment from "./pages/RequestEntertainment";
import BookDj from "./pages/BookDj";
import Welcome from "./pages/Welcome";
import VenueDashboard from "./pages/VenueDashboard";
import { ScraperConfig } from "./pages/ScraperConfig";
import AdminLeadsExplorer from "./pages/AdminLeadsExplorer";
import AdminVenueIntelligence from "./pages/AdminVenueIntelligence";
import AdminArtistLeads from "./pages/AdminArtistLeads";
import AdminOutreachDashboard from "./pages/AdminOutreachDashboard";
import AdminOutreachLeads from "./pages/AdminOutreachLeads";
import AdminOutreachTemplates from "./pages/AdminOutreachTemplates";
import LiveLeadSearch from "./pages/LiveLeadSearch";
import Contracts from "./pages/Contracts";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Pricing from "./pages/Pricing";
import SEOLandingPage from "./pages/SEOLandingPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/dashboard" component={ArtistDashboard} />
      <Route path="/profile" component={ArtistProfile} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/welcome" component={Welcome} />
      <Route path="/book" component={RequestEntertainment} />
      <Route path="/venue-dashboard" component={VenueDashboard} />
      <Route path="/artists" component={ArtistDirectory} />
      <Route path="/artist/:slug" component={PublicArtistProfile} />
      <Route path="/pipeline" component={PipelineBoard} />
      <Route path="/share" component={SharePage} />
      <Route path="/request-entertainment" component={RequestEntertainment} />
      <Route path="/book-dj" component={BookDj} />
      <Route path="/admin" component={AdminOverview} />
      <Route path="/admin/queue" component={AdminDashboard} />
      <Route path="/admin/event-windows" component={AdminEventWindows} />
      <Route path="/admin/scraper-config" component={ScraperConfig} />
      <Route path="/admin/leads-explorer" component={AdminLeadsExplorer} />
      <Route path="/admin/venue-intelligence" component={AdminVenueIntelligence} />
      <Route path="/admin/artist-growth" component={AdminArtistLeads} />
      <Route path="/admin/outreach" component={AdminOutreachDashboard} />
      <Route path="/admin/outreach/leads" component={AdminOutreachLeads} />
      <Route path="/admin/outreach/templates" component={AdminOutreachTemplates} />
      <Route path="/admin/live-lead-search" component={LiveLeadSearch} />
      <Route path="/contracts" component={Contracts} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/pricing" component={Pricing} />
      {/* SEO Landing Pages - Dynamic route for all service+city combinations */}
      <Route path="/:slug" component={SEOLandingPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
