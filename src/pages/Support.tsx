import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, MessageSquare, HelpCircle, Loader2, CheckCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const ticketSchema = z.object({
  subject: z.string().trim().min(5, "Subject must be at least 5 characters").max(100, "Subject must be less than 100 characters"),
  message: z.string().trim().min(20, "Message must be at least 20 characters").max(2000, "Message must be less than 2000 characters"),
  priority: z.enum(["low", "normal", "high"]),
});

const faqs = [
  {
    question: "How do I start investing?",
    answer: "To start investing, first complete your KYC verification, then navigate to the Investments page from your dashboard. Choose your preferred investment tier (from Starter at $50 to Achiever at $5,000) and follow the deposit instructions."
  },
  {
    question: "What is the 50/50 split strategy?",
    answer: "Your investment is automatically split: 50% goes to the MLM Capital pool for referral-based earnings, and 50% goes to the Investment Principal pool for investment profits. This balanced approach maximizes your earning potential."
  },
  {
    question: "How does the referral program work?",
    answer: "You earn commissions across 5 levels of referrals. When someone joins using your referral code and invests, you earn a percentage of their investment. The commission rates vary by level, with higher percentages for direct referrals."
  },
  {
    question: "How do I complete KYC verification?",
    answer: "Go to Settings > Identity Verification in your dashboard. Select your ID type (National ID, Passport, or Driver's License), enter your ID number, and upload a clear photo of your document. Verification typically takes 24-48 hours."
  },
  {
    question: "When can I withdraw my earnings?",
    answer: "You can request withdrawals once your KYC is approved and your account is not frozen. Withdrawal requests are processed within 1-3 business days. Minimum withdrawal amounts and any applicable fees will be displayed during the withdrawal process."
  },
  {
    question: "How do I qualify for a loan?",
    answer: "To qualify for a loan, you must: 1) Have an active investment plan, 2) Have at least 3 active direct referrals, 3) Complete KYC verification, and 4) Comply with all platform rules. Meeting these requirements doesn't guarantee approval."
  },
  {
    question: "What happens when my investment plan matures?",
    answer: "Upon maturity, a percentage of your investment and earnings may be automatically rolled over into a new plan to ensure continuity. You'll be notified of applicable rollover terms via the platform."
  },
  {
    question: "How do I transfer funds between wallets?",
    answer: "Navigate to the Transfer page in your dashboard. Select the source wallet, destination wallet, enter the amount, and confirm. Note: Transfers require completed KYC verification."
  },
];

const Support = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    subject: "",
    message: "",
    priority: "normal",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  // Fetch user's tickets
  const { data: myTickets, refetch: refetchTickets } = useQuery({
    queryKey: ["my-tickets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-warning/10 text-warning border-warning/30";
      case "in_progress": return "bg-primary/10 text-primary border-primary/30";
      case "resolved": return "bg-accent/10 text-accent border-accent/30";
      case "closed": return "bg-secondary text-muted-foreground";
      default: return "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate form data
    const result = ticketSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      const firstError = result.error.errors[0];
      const fieldName = firstError?.path[0] ? String(firstError.path[0]).charAt(0).toUpperCase() + String(firstError.path[0]).slice(1) : null;
      toast({
        title: "Form incomplete",
        description: fieldName ? `${fieldName}: ${firstError.message}` : "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to submit a support ticket.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        subject: result.data.subject,
        message: result.data.message,
        priority: result.data.priority,
      });

      if (error) throw error;

      setSubmitted(true);
      setFormData({ subject: "", message: "", priority: "normal" });
      refetchTickets();
      toast({
        title: "Ticket Submitted",
        description: "We'll get back to you as soon as possible.",
      });
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="GWA Logo" className="w-8 h-8 rounded-md shadow-md" />
            <span className="font-semibold tracking-tight">Golden Wealth Achievers</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="pt-24 pb-16 px-6">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Support Center
          </h1>
          <p className="text-muted-foreground mb-8">
            Find answers to common questions or contact our support team.
          </p>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* FAQ Section */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Frequently Asked Questions</h2>
                  <p className="text-sm text-muted-foreground">Quick answers to common questions</p>
                </div>
              </div>

              <Accordion type="single" collapsible className="space-y-2">
                {faqs.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`item-${index}`}
                    className="border border-border rounded-md bg-card px-4"
                  >
                    <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>

            {/* Contact Form Section */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Contact Support</h2>
                  <p className="text-sm text-muted-foreground">Submit a ticket for assistance</p>
                  <p className="text-sm text-foreground mt-2">
                    Email: <span className="font-mono">support@goldenwealthachivers.com</span>
                  </p>
                </div>
              </div>

              <div className="p-6 rounded-md border border-border bg-card">
                {!user ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                    <h3 className="font-medium mb-2">Sign in to Contact Support</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Please sign in to your account to submit a support ticket.
                    </p>
                    <Link to="/auth" state={{ from: { pathname: "/support" } }}>
                      <Button>Sign In</Button>
                    </Link>
                  </div>
                ) : submitted ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-accent" />
                    </div>
                    <h3 className="font-medium mb-2">Ticket Submitted Successfully</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Our support team will review your request and respond as soon as possible.
                    </p>
                    <Button variant="outline" onClick={() => setSubmitted(false)}>
                      Submit Another Ticket
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject <span className="text-destructive">*</span></Label>
                      <Input
                        id="subject"
                        placeholder="Brief description of your issue"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="bg-background"
                        maxLength={100}
                      />
                      {errors.subject && (
                        <p className="text-xs text-destructive">{errors.subject}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) => setFormData({ ...formData, priority: value })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        placeholder="Please describe your issue in detail..."
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="bg-background min-h-[150px] resize-none"
                        maxLength={2000}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        {errors.message ? (
                          <p className="text-destructive">{errors.message}</p>
                        ) : (
                          <span>Minimum 20 characters</span>
                        )}
                        <span>{formData.message.length}/2000</span>
                      </div>
                    </div>

                    <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Submit Ticket
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </section>
          </div>

          {/* My Tickets Section */}
          {user && myTickets && myTickets.length > 0 && (
            <section className="mt-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold">My Tickets</h2>
                  <p className="text-sm text-muted-foreground">Track your support requests and responses</p>
                </div>
              </div>

              <div className="space-y-3">
                {myTickets.map((ticket: any) => (
                  <div
                    key={ticket.id}
                    className="border border-border rounded-md bg-card overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={getStatusColor(ticket.status)}>
                            {ticket.status.replace("_", " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="font-medium text-sm truncate">{ticket.subject}</p>
                      </div>
                      {expandedTicket === ticket.id ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                    </button>

                    {expandedTicket === ticket.id && (
                      <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Your message:</p>
                          <p className="text-sm">{ticket.message}</p>
                        </div>
                        {ticket.response ? (
                          <div className="p-3 rounded-md bg-accent/10 border border-accent/20">
                            <p className="text-xs font-medium text-accent mb-1">Staff Response:</p>
                            <p className="text-sm">{ticket.response}</p>
                            {ticket.responded_at && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Responded on {new Date(ticket.responded_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 rounded-md bg-secondary/50 text-sm text-muted-foreground">
                            Awaiting response from our support team...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Back to home */}
          <div className="mt-12 pt-8 border-t border-border text-center">
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-border">
        <div className="container mx-auto max-w-4xl text-center text-sm text-muted-foreground space-y-1">
          <div>© {new Date().getFullYear()} Golden Wealth Achievers. All rights reserved.</div>
          <div>Powered by Bisolkay Int'l Company, duly registered in Nigeria.</div>
        </div>
      </footer>
    </div>
  );
};

export default Support;
