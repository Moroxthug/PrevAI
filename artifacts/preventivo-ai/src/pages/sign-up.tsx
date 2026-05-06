import { SignUp } from "@clerk/react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Logo } from "@/components/logo";

export default function SignUpPage() {
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/settings/registration`, { credentials: "include" })
      .then(r => r.json())
      .then((data: { open: boolean }) => setRegistrationOpen(data.open))
      .catch(() => setRegistrationOpen(true));
  }, []);

  if (registrationOpen === null) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="h-8 w-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!registrationOpen) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/30">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-10 max-w-sm w-full text-center">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Beta chiusa</h1>
          <p className="text-sm text-gray-500 mb-6">
            Stiamo raccogliendo i feedback dei nostri beta tester. Le registrazioni pubbliche apriranno presto.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Hai già un invito?{" "}
            <Link href="/sign-in" className="text-violet-600 font-semibold hover:underline">
              Accedi qui
            </Link>
          </p>
          <a
            href="https://wa.me/393791059492"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 w-full justify-center h-10 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
            style={{ background: "#25D366" }}
          >
            Richiedi accesso via WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/30">
      <SignUp routing="path" path="/sign-up" />
    </div>
  );
}
