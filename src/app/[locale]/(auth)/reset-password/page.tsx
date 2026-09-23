import { Suspense } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFormFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordFormFallback() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-40 animate-pulse rounded bg-surface-muted" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="h-10 animate-pulse rounded-md bg-surface-muted" />
          <div className="h-10 animate-pulse rounded-md bg-surface-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
