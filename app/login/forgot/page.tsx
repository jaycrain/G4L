import ForgotForm from './forgot-form.tsx';

export const metadata = { title: 'Reset your password — Grinta for Life' };

export default function ForgotPage() {
  return (
    <div className="auth-hero">
      <div className="auth-hero-heart">
        <h1 className="auth-hero-h">Reset your password</h1>
        <p className="auth-hero-sub">Tell us the email you signed up with and we’ll send you a link.</p>
        <div className="auth-card">
          <ForgotForm />
        </div>
      </div>
    </div>
  );
}
