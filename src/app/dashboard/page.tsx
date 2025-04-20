import { cookies } from "next/headers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MessageSquare, Settings } from "lucide-react";

export default async function Dashboard() {
  const cookieStore = await cookies();
  const workspaceName =
    cookieStore.get("notion_workspace_name")?.value || "Your Workspace";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Connected to Notion workspace: {workspaceName}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your SMS Number</CardTitle>
            <CardDescription>
              Send text messages to this number to create Notion todos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {process.env.TWILIO_PHONE_NUMBER || "+1 (555) 123-4567"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Simply text your todo and we&apos;ll add it to your Notion
              database
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest todos added via SMS</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your recent todos will appear here once you start sending
                messages.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link href="/dashboard/settings">
          <Button variant="outline" className="w-full">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </Link>
        <Link href="/dashboard/messages">
          <Button variant="outline" className="w-full">
            <MessageSquare className="mr-2 h-4 w-4" />
            Message History
          </Button>
        </Link>
      </div>
    </div>
  );
}
