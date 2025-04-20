"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const handleNotionLogin = async () => {
    // Redirect to Notion OAuth
    const redirectUri = `${window.location.origin}/api/notion/callback`;
    const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_NOTION_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;

    router.push(notionAuthUrl);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Welcome to Remembot
          </CardTitle>
          <CardDescription className="text-center">
            Connect your Notion account to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <div className="w-full max-w-sm">
            <Button
              onClick={handleNotionLogin}
              className="w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white"
            >
              <Image
                src="/notion-logo-white.svg"
                alt="Notion logo"
                width={24}
                height={24}
              />
              Continue with Notion
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-center">
          <p className="text-xs text-gray-500 mt-4 text-center">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
