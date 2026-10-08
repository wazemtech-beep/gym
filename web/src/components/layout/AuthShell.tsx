import { Dumbbell } from "lucide-react";
import type { ReactNode } from "react";

export default function AuthShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="auth-shell">
      <section className={`auth-form-content${wide ? " auth-form-wide" : ""}`}>
        <div className="auth-brand">
          <span className="brand-mark"><Dumbbell size={22} strokeWidth={1.8} /></span>
          <span className="brand-name">OXGEN GYM</span>
        </div>
        {children}
      </section>
    </main>
  );
}
