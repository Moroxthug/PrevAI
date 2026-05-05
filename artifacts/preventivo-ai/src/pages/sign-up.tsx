import { SignUp } from "@clerk/react";

export default function SignUpPage() {
  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/30">
      <SignUp routing="path" path="/sign-up" />
    </div>
  );
}