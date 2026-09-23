import { Suspense } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFormFallback() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-32 animate-pulse rounded bg-surface-muted" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="h-10 animate-pulse rounded-md bg-surface-muted" />
          <div className="h-10 animate-pulse rounded-md bg-surface-muted" />
          <div className="h-10 animate-pulse rounded-md bg-surface-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
