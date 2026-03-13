import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ArtistDashboard from "./pages/ArtistDashboard";
import AdminDashboard from "./pages/AdminDashboard";
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
import { ScraperConfig } from "./pages/ScraperConfig";
import AdminLeadsExplorer from "./pages/AdminLeadsExplorer";
import LiveLeadSearch from "./pages/LiveLeadSearch";
import Contracts from "./pages/Contracts";
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
      <Route path="/artists" component={ArtistDirectory} />
      <Route path="/artist/:slug" component={PublicArtistProfile} />
      <Route path="/pipeline" component={PipelineBoard} />
      <Route path="/share" component={SharePage} />
      <Route path="/request-entertainment" component={RequestEntertainment} />
      <Route path="/book-dj" component={BookDj} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/event-windows" component={AdminEventWindows} />
      <Route path="/admin/scraper-config" component={ScraperConfig} />
      <Route path="/admin/leads-explorer" component={AdminLeadsExplorer} />
      <Route path="/admin/live-lead-search" component={LiveLeadSearch} />
      <Route path="/contracts" component={Contracts} />
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
