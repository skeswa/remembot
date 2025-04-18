import Link from "next/link";
import { Button } from "//components/ui/button";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-14 flex items-center">
        <Link href="/" className="flex items-center justify-center">
          <span className="text-xl font-bold">remembot</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link
            href="/login"
            className="text-sm font-medium hover:underline underline-offset-4"
          >
            Log In
          </Link>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Create Notion Todos via SMS
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                  Remembot helps you capture tasks on the go. Send a text
                  message and we'll add it to your Notion database.
                </p>
              </div>
              <div className="space-x-4">
                <Link href="/login">
                  <Button className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-3 items-center">
              <div className="rounded-lg border bg-background p-6">
                <div className="flex flex-col space-y-2">
                  <h3 className="text-xl font-bold">Connect with Notion</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Securely link your Notion account with a few clicks.
                  </p>
                </div>
              </div>
              <div className="rounded-lg border bg-background p-6">
                <div className="flex flex-col space-y-2">
                  <h3 className="text-xl font-bold">Add Your Phone</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Register and verify your phone number to start sending
                    todos.
                  </p>
                </div>
              </div>
              <div className="rounded-lg border bg-background p-6">
                <div className="flex flex-col space-y-2">
                  <h3 className="text-xl font-bold">Text Your Todos</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Send a text message and we'll add it to your Notion database
                    instantly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} Remembot. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
