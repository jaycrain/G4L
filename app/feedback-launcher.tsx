import { currentMemberId } from './auth.ts';
import { isAdmin } from './authz.ts';
import FeedbackWidget from './feedback-widget.tsx';

// Renders the "Send Feedback" pill only for authenticated members or operators — so it never appears
// during onboarding (the most fragile moment, no member yet) or on login/marketing routes.
export default async function FeedbackLauncher() {
  const [memberId, admin] = await Promise.all([currentMemberId(), isAdmin()]);
  if (!memberId && !admin) return null;
  return <FeedbackWidget />;
}
