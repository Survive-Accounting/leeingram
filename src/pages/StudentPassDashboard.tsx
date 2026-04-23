import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Wrench, User } from "lucide-react";
import { getPurchaseContext, type PurchaseContext } from "@/lib/purchaseContext";

const StudentPassDashboard = () => {
  const [purchase, setPurchase] = useState<PurchaseContext | null>(null);

  useEffect(() => {
    setPurchase(getPurchaseContext());
  }, []);

  const formattedAmount =
    purchase?.amountPaid != null
      ? `$${purchase.amountPaid.toFixed(2)}`
      : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Welcome to your dashboard
          </h1>
          <p className="mt-2 text-muted-foreground">
            Your study pass is active{purchase?.email ? ` — ${purchase.email}` : ""}.
          </p>
          {purchase && (
            <div className="mt-4 flex flex-wrap gap-2">
              {purchase.selectedPlan && (
                <Badge variant="secondary">Plan: {purchase.selectedPlan}</Badge>
              )}
              {purchase.campus && (
                <Badge variant="secondary">Campus: {purchase.campus}</Badge>
              )}
              {formattedAmount && (
                <Badge variant="secondary">Paid: {formattedAmount}</Badge>
              )}
            </div>
          )}
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-2">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>My Courses</CardTitle>
            </CardHeader>
            <CardContent>
              {purchase?.includedCourses?.length ? (
                <ul className="text-sm text-muted-foreground space-y-1">
                  {purchase.includedCourses.map((course) => (
                    <li key={course}>• {course}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your enrolled courses will appear here.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-2">
                <Wrench className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>My Study Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Flashcards, formula recall, and more.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-2">
                <User className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {purchase?.email
                  ? `Signed in as ${purchase.email}`
                  : "Manage your email and access details."}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 p-4 rounded-md border border-dashed border-border bg-muted/30">
          <p className="text-sm text-muted-foreground">
            More onboarding and course access setup coming next.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StudentPassDashboard;
