import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Shield, CheckCircle2, XCircle, Clock, AlertTriangle, Banknote } from "lucide-react";
import { useMySuretyRequests, useRespondToSurety } from "@/hooks/useLoans";

const SuretyRequests = () => {
  const { data: requests, isLoading } = useMySuretyRequests();
  const respondToSurety = useRespondToSurety();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const selected = requests?.find((r: any) => r.id === selectedId);
  const loan = selected?.loans;

  const pendingCount = requests?.filter((r: any) => r.status === "pending").length || 0;
  const acceptedCount = requests?.filter((r: any) => r.status === "accepted").length || 0;
  const totalGuaranteed = requests
    ?.filter((r: any) => r.status === "accepted")
    .reduce((sum: number, r: any) => sum + r.guarantee_amount, 0) || 0;

  const handleAccept = (id: string) => {
    respondToSurety.mutate({ surety_id: id, accept: true }, {
      onSuccess: () => setSelectedId(null),
    });
  };

  const handleReject = () => {
    if (!selectedId) return;
    respondToSurety.mutate(
      { surety_id: selectedId, accept: false, rejection_reason: rejectReason.trim() || undefined },
      { onSuccess: () => { setSelectedId(null); setShowReject(false); setRejectReason(""); } }
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Surety Requests</h1>
          <p className="text-muted-foreground text-sm">Review and respond to surety/guarantee requests from other members</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Clock className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10"><CheckCircle2 className="w-5 h-5 text-accent-foreground" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="text-2xl font-bold">{acceptedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10"><Banknote className="w-5 h-5 text-destructive" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Guaranteed</p>
                  <p className="text-2xl font-bold">${totalGuaranteed.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alert for pending */}
        {pendingCount > 0 && (
          <Alert className="border-primary/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You have <strong>{pendingCount}</strong> pending surety request{pendingCount > 1 ? "s" : ""}. By accepting, you authorize auto-deduction from your wallets if the borrower defaults.
            </AlertDescription>
          </Alert>
        )}

        {/* Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
            ) : !requests?.length ? (
              <div className="text-center py-12 space-y-3">
                <Shield className="w-12 h-12 mx-auto text-muted-foreground/40" />
                <p className="text-muted-foreground">No surety requests received</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Loan Amount</TableHead>
                    <TableHead>Your Guarantee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req: any) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.loans?.member_name || "—"}</TableCell>
                      <TableCell>${req.loans?.amount_requested?.toLocaleString() || "—"}</TableCell>
                      <TableCell className="font-semibold">${req.guarantee_amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={
                          req.status === "accepted" ? "default" :
                          req.status === "rejected" ? "destructive" :
                          req.status === "called" ? "destructive" : "secondary"
                        }>
                          {req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {req.status === "pending" ? (
                          <div className="flex gap-2">
                            <Button size="sm" variant="default" onClick={() => handleAccept(req.id)} disabled={respondToSurety.isPending}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Accept
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => { setSelectedId(req.id); setShowReject(true); }} disabled={respondToSurety.isPending}>
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => setSelectedId(req.id)}>View</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!selectedId && !showReject} onOpenChange={(o) => !o && setSelectedId(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Surety Request Details</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Borrower</span><p className="font-medium">{loan?.member_name || "—"}</p></div>
                  <div><span className="text-muted-foreground">Loan Amount</span><p className="font-medium">${loan?.amount_requested?.toLocaleString() || "—"}</p></div>
                  <div><span className="text-muted-foreground">Purpose</span><p className="font-medium">{loan?.purpose || "—"}</p></div>
                  <div><span className="text-muted-foreground">Duration</span><p className="font-medium">{loan?.duration_months || "—"} months</p></div>
                  <div><span className="text-muted-foreground">Your Guarantee</span><p className="font-semibold text-primary">${selected.guarantee_amount.toLocaleString()}</p></div>
                  <div><span className="text-muted-foreground">Relationship</span><p className="font-medium">{selected.relationship_to_borrower || "—"}</p></div>
                </div>
                <Separator />
                <Badge variant={selected.status === "accepted" ? "default" : selected.status === "rejected" ? "destructive" : "secondary"} className="text-sm">
                  Status: {selected.status}
                </Badge>
                {selected.rejection_reason && (
                  <p className="text-sm text-destructive">Reason: {selected.rejection_reason}</p>
                )}

                {selected.status === "pending" && (
                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1" onClick={() => handleAccept(selected.id)} disabled={respondToSurety.isPending}>
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Accept Guarantee
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => setShowReject(true)} disabled={respondToSurety.isPending}>
                      <XCircle className="w-4 h-4 mr-2" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showReject} onOpenChange={(o) => { if (!o) { setShowReject(false); setRejectReason(""); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reject Surety Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why are you declining?" rows={3} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setShowReject(false); setRejectReason(""); }}>Cancel</Button>
                <Button variant="destructive" className="flex-1" onClick={handleReject} disabled={respondToSurety.isPending}>
                  {respondToSurety.isPending ? "Rejecting…" : "Confirm Rejection"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default SuretyRequests;
