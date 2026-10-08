export default async function VerifyEmail({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <main className="glass-panel" style={{ maxWidth: 480, margin: "80px auto", padding: 28 }}><h1>Verify your login email</h1><p>Confirm this email change, then sign in again.</p>{token ? <form action="/api/auth/change-email/verify" method="POST"><input type="hidden" name="token" value={token} /><button className="btn-primary">Confirm email change</button></form> : <p>Open the verification link from your email.</p>}</main>;
}
