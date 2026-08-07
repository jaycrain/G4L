import { redirect } from 'next/navigation';
import { isAdmin } from '../../authz.ts';
import ConsoleSubpage from '../console/subpage.tsx';
import { RETENTION_POLICY, RETENTION_CAVEATS } from '../../../lib/content/retention.ts';
import { crisisAlertingConfigured } from '../../../lib/agent/crisis-escalation.ts';

export const metadata = { title: 'Data policy — Grinta for Life' };

// The retention policy, where Jay can find it. He asked for it on the console rather than in a document
// (2026-08-07) — a policy you have to go looking for in a repo is one you stop consulting.
//
// The `status` badge is the load-bearing part of this page. Most rows are AGREED, not RUNNING, and rendering
// them all the same way would recreate this afternoon's bug: a surface that reads as covered, so nobody checks.
export default async function DataPolicyPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const running = RETENTION_POLICY.filter((r) => r.status === 'enforced').length;
  const alerting = crisisAlertingConfigured();

  return (
    <ConsoleSubpage title="Data policy" here="/admin/policy">
      {/* CONFIGURATION, NOT POLICY — but it belongs on the page you check, because on 2026-08-07 the alert
          address was believed set and wasn't, and the only evidence was a server log nobody reads. A promise
          whose plumbing is off is worse than no promise. */}
      <div className="card">
        <h3>Crisis alerting <span className={alerting ? 'pol-on' : 'pol-off'}>{alerting ? 'configured' : 'NOT configured'}</span></h3>
        {alerting ? (
          <p className="muted">
            A distress signal records an event and emails the alert address. Verify end to end any time with{' '}
            <code>npm run crisis-drill</code>.
          </p>
        ) : (
          <p className="error">
            Distress signals still route the member to 988 and are still recorded here — but <strong>no one is
            notified out of band.</strong> Set CRISIS_ALERT_EMAIL (plus RESEND_API_KEY and EMAIL_FROM) on
            Production and redeploy; Vercel only picks up new variables on a rebuild.
          </p>
        )}
      </div>

      <div className="card">
        <h3>What we keep, and for how long</h3>
        <p className="muted">
          Agreed 2026-08-07. Retention is set by <strong>purpose</strong>, not one blanket number — the Companion
          reads recent messages plus its folded memory and never the long tail, so old raw transcripts carry no
          product value and maximum sensitivity.
        </p>
        <p className="muted">
          <strong>{running} of {RETENTION_POLICY.length} rows are actually running.</strong> The rest are decisions
          we&rsquo;ve made and not yet built. Each row says which.
        </p>
      </div>

      {RETENTION_POLICY.map((r) => (
        <div className="card" key={r.what}>
          <h3>{r.what}</h3>
          <p>
            <strong>{r.keep}</strong>{' '}
            <span className={r.status === 'enforced' ? 'pol-on' : 'pol-off'}>
              {r.status === 'enforced' ? 'running' : 'agreed — not built'}
            </span>
          </p>
          <p className="muted">{r.why}</p>
          <p className="muted"><em>{r.mechanism}</em></p>
        </div>
      ))}

      <div className="card">
        <h3>What this policy can&rsquo;t promise</h3>
        {RETENTION_CAVEATS.map((c) => (
          <p key={c.head} className="muted">
            <strong>{c.head}.</strong> {c.body}
          </p>
        ))}
      </div>
    </ConsoleSubpage>
  );
}
