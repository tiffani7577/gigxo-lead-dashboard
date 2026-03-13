/**
 * StripePaymentDialog
 * Uses CardElement (simple, reliable) instead of PaymentElement (multi-tab, janky).
 * Flow:
 *   1. Parent calls createPaymentIntent → gets clientSecret + paymentIntentId
 *   2. This dialog wraps Elements with that clientSecret
 *   3. User fills card → clicks Pay → stripe.confirmCardPayment() runs
 *   4. On success, parent's onSuccess(paymentIntentId) is called
 */
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Gift, Lock, CreditCard } from "lucide-react";

// ─── Inner form (must be inside <Elements>) ───────────────────────────────────
function CheckoutForm({
  clientSecret,
  paymentIntentId,
  amount,
  creditApplied,
  onSuccess,
  onCancel,
}: {
  clientSecret: string;
  paymentIntentId: string;
  amount: number; // cents
  creditApplied: number; // cents
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cardReady, setCardReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setIsProcessing(true);
    setErrorMsg(null);

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    });

    if (error) {
      setErrorMsg(error.message ?? "Payment failed. Please try again.");
      setIsProcessing(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      onSuccess(paymentIntent.id);
    } else {
      setErrorMsg("Payment was not completed. Please try again.");
      setIsProcessing(false);
    }
  };

  const displayAmount = (amount / 100).toFixed(2);
  const displayCredit = (creditApplied / 100).toFixed(2);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {creditApplied > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm">
          <Gift className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-amber-800">
            ${displayCredit} credit applied — you pay ${displayAmount}
          </span>
        </div>
      )}

      <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
        <ul className="space-y-1">
          <li>✓ Client name and contact details</li>
          <li>✓ Direct email and phone number</li>
          <li>✓ Confirmation email sent to you</li>
        </ul>
      </div>

      {/* Card input */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <CreditCard className="w-4 h-4" /> Card details
        </label>
        <div className="border border-slate-300 rounded-lg px-4 py-3 bg-white focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition-colors">
          <CardElement
            onReady={() => setCardReady(true)}
            options={{
              style: {
                base: {
                  fontSize: "15px",
                  color: "#1e293b",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  "::placeholder": { color: "#94a3b8" },
                  iconColor: "#7c3aed",
                },
                invalid: {
                  color: "#dc2626",
                  iconColor: "#dc2626",
                },
              },
              hidePostalCode: false,
            }}
          />
        </div>
        <p className="text-xs text-slate-400">Test card: 4242 4242 4242 4242 · Any future date · Any CVC</p>
      </div>

      {errorMsg && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {errorMsg}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <Button
          type="submit"
          disabled={!stripe || !elements || !cardReady || isProcessing}
          className="flex-1 bg-purple-600 hover:bg-purple-700 h-11 text-base font-semibold"
        >
          {isProcessing ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
          ) : (
            <><Lock className="w-4 h-4 mr-2" /> Pay ${displayAmount} &amp; Unlock</>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="h-11"
        >
          Cancel
        </Button>
      </div>

      <p className="text-xs text-center text-slate-400">
        Secured by Stripe · One-time payment · Instant access
      </p>
    </form>
  );
}

// ─── Demo mode form (no Stripe keys configured) ───────────────────────────────
function DemoCheckoutForm({
  paymentIntentId,
  amount,
  creditApplied,
  onSuccess,
  onCancel,
}: {
  paymentIntentId: string;
  amount: number;
  creditApplied: number;
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const displayAmount = (amount / 100).toFixed(2);

  const handleConfirm = () => {
    setIsProcessing(true);
    setTimeout(() => onSuccess(paymentIntentId), 500);
  };

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
        <strong>Demo Mode:</strong> Stripe is not configured. Click below to simulate a successful payment.
      </div>
      <div className="flex gap-3">
        <Button
          onClick={handleConfirm}
          disabled={isProcessing}
          className="flex-1 bg-purple-600 hover:bg-purple-700 h-11"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : `Simulate Payment ($${displayAmount})`}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isProcessing} className="h-11">
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Main exported dialog ─────────────────────────────────────────────────────
interface StripePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSecret: string | null;
  paymentIntentId: string | null;
  amount: number; // cents
  creditApplied: number; // cents
  leadTitle: string;
  publishableKey: string | null;
  isDemoMode: boolean;
  onSuccess: (paymentIntentId: string) => void;
}

let stripePromise: ReturnType<typeof loadStripe> | null = null;

function getStripePromise(publishableKey: string) {
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}

export default function StripePaymentDialog({
  open,
  onOpenChange,
  clientSecret,
  paymentIntentId,
  amount,
  creditApplied,
  leadTitle,
  publishableKey,
  isDemoMode,
  onSuccess,
}: StripePaymentDialogProps) {
  const handleCancel = () => onOpenChange(false);

  const isReady = open && (isDemoMode || (clientSecret && publishableKey));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Unlock Gig Lead</DialogTitle>
          <DialogDescription className="line-clamp-2 text-slate-500">
            {leadTitle}
          </DialogDescription>
        </DialogHeader>

        {!isReady ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : isDemoMode ? (
          <DemoCheckoutForm
            paymentIntentId={paymentIntentId ?? `pi_demo_${Date.now()}`}
            amount={amount}
            creditApplied={creditApplied}
            onSuccess={onSuccess}
            onCancel={handleCancel}
          />
        ) : (
          <Elements
            stripe={getStripePromise(publishableKey!)}
            options={{
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: "#7c3aed",
                  borderRadius: "8px",
                  fontFamily: "'Inter', system-ui, sans-serif",
                },
              },
            }}
          >
            <CheckoutForm
              clientSecret={clientSecret!}
              paymentIntentId={paymentIntentId!}
              amount={amount}
              creditApplied={creditApplied}
              onSuccess={onSuccess}
              onCancel={handleCancel}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
}
