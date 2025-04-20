"use client";

import type React from "react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "//components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "//components/ui/card";
import { Input } from "//components/ui/input";
import { Label } from "//components/ui/label";

export default function PhoneVerificationPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSendVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/twilio/send-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      setIsVerifying(true);
      toast("Verification code sent", {
        description: "Please check your phone for the verification code",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to send verification code",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/twilio/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber, code: verificationCode }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      toast.success("Phone verified", {
        description: "Your phone number has been verified successfully",
      });

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to verify code",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify Your Phone Number</CardTitle>
          <CardDescription>
            We'll send a verification code over SMS to confirm your phone number.
            Make sure you have your phone handy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isVerifying ? (
            <form onSubmit={handleSendVerification} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="+1 (555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  type="tel"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your phone number in international format (e.g., +15551234567).
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send Verification"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                  inputMode="numeric"
                  pattern="\d{6}"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code sent to your phone.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Verifying..." : "Verify Code"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          {isVerifying && (
            <Button
              variant="ghost"
              onClick={() => setIsVerifying(false)}
              disabled={isSubmitting}
            >
              Back
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
