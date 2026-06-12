import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAM } from "@/context/AMContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const { user, loading, authError, loginWithGoogle } = useAM();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) navigate("/");
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">AM Strategist</CardTitle>
          <CardDescription>
            Sign in with your Vendasta Google account to access your book of business.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {authError && (
            <div className="rounded-lg border border-v-red/20 bg-v-red/5 p-3 text-sm text-v-red">
              {authError}
            </div>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={loading}
            onClick={loginWithGoogle}
          >
            {loading ? "Signing in…" : "Continue with Google"}
          </Button>
          <p className="text-center text-[0.8rem] text-muted-foreground">
            Access is restricted to assigned Account Managers on @vendasta.com accounts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
