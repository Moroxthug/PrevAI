import { SignIn } from "@clerk/react";

export default function SignInPage() {
  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/30">
      <SignIn routing="path" path="/sign-in" />
    </div>
  );
}