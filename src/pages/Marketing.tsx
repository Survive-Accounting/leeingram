import { Link, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Video, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const factories = [
  {
    title: "Email Factory",
    description: "Craft authentic, human-first marketing emails with AI refinement.",
    icon: Mail,
    href: "/marketing/emails",
    ready: true,
  },
  {
    title: "Promo Video Factory",
    description: "Plan promotional video content tied to your email campaigns.",
    icon: Video,
    href: "/marketing/videos",
    ready: false,
  },
];

export default function Marketing() {
  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketing Factory</h1>
          <p className="text-sm text-muted-foreground">
            Give more than you receive — your marketing command center
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a
            href="https://www.surviveaccounting.com/author/mass_emails?tab=history"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            LearnWorlds Emails
          </a>
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {factories.map((f) => (
          <Card
            key={f.title}
            className={`transition-colors ${f.ready ? "hover:bg-accent/50 cursor-pointer" : "opacity-60"}`}
          >
            {f.ready ? (
              <Link to={f.href} className="block">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{f.title}</CardTitle>
                      <CardDescription className="text-xs">{f.description}</CardDescription>
                    </div>
                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Link>
            ) : (
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <f.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{f.title}</CardTitle>
                    <CardDescription className="text-xs">{f.description}</CardDescription>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground">Coming Soon</span>
                </div>
              </CardHeader>
            )}
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
