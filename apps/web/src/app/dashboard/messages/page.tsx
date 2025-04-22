import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function MessagesPage() {
  // In a real app, you would fetch message history from your database
  const messages = [
    {
      id: 1,
      content: "Buy milk and eggs",
      timestamp: "2023-04-15T14:30:00Z",
      status: "completed",
    },
    {
      id: 2,
      content: "Schedule dentist appointment",
      timestamp: "2023-04-14T09:15:00Z",
      status: "completed",
    },
    {
      id: 3,
      content: "Call mom",
      timestamp: "2023-04-13T18:45:00Z",
      status: "completed",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Message History</h1>
        <p className="text-muted-foreground">
          View all the todos you&apos;ve sent via SMS
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Messages</CardTitle>
          <CardDescription>Your most recent SMS todos</CardDescription>
        </CardHeader>
        <CardContent>
          {messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{message.content}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(message.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      {message.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t sent any SMS todos yet. Start by sending a text
              message to your Remembot number.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
