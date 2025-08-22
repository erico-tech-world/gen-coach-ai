import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function VerifyEmail() {
  const resend = async () => {
    const session = (await supabase.auth.getSession()).data.session;
    if (session?.user?.email) {
      await supabase.auth.resend({ type: 'signup', email: session.user.email });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          <h1 className="text-xl font-semibold">Confirm your email</h1>
          <p className="text-muted-foreground text-sm">
            We sent a verification link to your email. Please click the link to activate your account.
          </p>
          <Button onClick={resend} variant="outline">Resend Email</Button>
        </CardContent>
      </Card>
    </div>
  );
}


