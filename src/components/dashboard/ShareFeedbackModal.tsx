import { useEffect, useState } from "react";
import QuickFeedbackModal, {
  type QuickFeedbackContext,
} from "./QuickFeedbackModal";
import FeedbackToolModal from "./FeedbackToolModal";

interface Props {
  open: boolean;
  email: string | null;
  onClose: () => void;
  context?: QuickFeedbackContext;
}

/**
 * Default entry point for "Share Feedback".
 *
 * Renders the low-friction QuickFeedbackModal by default. The user can
 * switch to the detailed "Vote on Future Tools" form via a secondary link.
 */
export default function ShareFeedbackModal({
  open,
  email,
  onClose,
  context,
}: Props) {
  const [view, setView] = useState<"quick" | "vote">("quick");

  // Reset to quick view whenever the wrapper is reopened
  useEffect(() => {
    if (open) setView("quick");
  }, [open]);

  return (
    <>
      <QuickFeedbackModal
        open={open && view === "quick"}
        email={email}
        onClose={onClose}
        onOpenVoteOnFutureTools={() => setView("vote")}
        context={context}
      />
      <FeedbackToolModal
        open={open && view === "vote"}
        email={email}
        onClose={onClose}
      />
    </>
  );
}
