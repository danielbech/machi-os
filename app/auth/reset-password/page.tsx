"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  const supabase = createClient();

  // Supabase automatically exchanges the token from the URL hash on page load
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setMessage("Password updated successfully!");
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-black">
      <Card className="w-full max-w-md border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl shadow-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <img src="/logo.svg" alt="Machi OS" className="w-10 h-10" />
            <div>
              <CardTitle className="text-2xl">Reset Password</CardTitle>
              <CardDescription className="text-white/40">
                {success ? "You're all set" : "Enter your new password"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4">
              <p className="text-sm text-green-400">{message}</p>
              <Button
                className="w-full bg-white text-black hover:bg-white/90"
                onClick={() => (window.location.href = "/")}
              >
                Go to Dashboard
              </Button>
            </div>
          ) : !ready ? (
            <div className="space-y-4">
              <p className="text-sm text-white/40">
                Verifying your reset link...
              </p>
              <div className="h-1 w-full bg-white/5 rounded overflow-hidden">
                <div className="h-full w-1/3 bg-white/20 rounded animate-pulse" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-white/80"
                >
                  New password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="border-white/10 bg-white/[0.02] focus:border-white/30 focus:ring-white/20"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium text-white/80"
                >
                  Confirm password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="border-white/10 bg-white/[0.02] focus:border-white/30 focus:ring-white/20"
                />
              </div>
              {message && (
                <div
                  className={`text-sm ${message.includes("match") || message.includes("least") ? "text-red-400" : "text-red-400"}`}
                >
                  {message}
                </div>
              )}
              <Button
                type="submit"
                className="w-full bg-white text-black hover:bg-white/90"
                disabled={loading}
              >
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
