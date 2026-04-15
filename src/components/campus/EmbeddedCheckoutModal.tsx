import { useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";

const STRIPE_PK = "pk_test_51TM9RCHyiFzd8XWggqI14jVV69b6HvGUcXqXYAGg3wyRP3RxjZeD97lLxQVl9uTCyWG8JirXbdLemCkOloJhgOnu00lyllwa8U";
const stripePromise = loadStripe(STRIPE_PK);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSecret: string | null;
}

export default function EmbeddedCheckoutModal({ open, onOpenChange, clientSecret }: Props) {
  const fetchClientSecret = useCallback(() => {
    return Promise.resolve(clientSecret!);
  }, [clientSecret]);

  if (!clientSecret) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg p-0 overflow-hidden [&>button]:hidden"
        style={{ borderRadius: 16, maxHeight: "90vh" }}
      >
        <div className="overflow-y-auto" style={{ maxHeight: "85vh", minHeight: 400 }}>
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ fetchClientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
}
