"use client";

import { useState, useTransition } from "react";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resendMagicLink } from "@/app/admin/members/actions";

export default function ResendMagicLinkButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);

  function onClick() {
    if (!armed) {
      setArmed(true);
      // Auto-disarm so a stray double-click doesn't fire by accident.
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    setArmed(false);
    startTransition(async () => {
      const res = await resendMagicLink({ userId });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Magic link sent to ${email}`);
      }
    });
  }

  return (
    <Button
      type="button"
      variant={armed ? "destructive" : "secondary"}
      onClick={onClick}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Mail className="h-4 w-4" />
      )}
      {pending
        ? "Sending…"
        : armed
          ? "Click again to send"
          : "Resend magic link"}
    </Button>
  );
}
