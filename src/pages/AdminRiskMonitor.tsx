import { useState } from "react";
import { Shield, AlertTriangle, Clock, Users, Activity, Eye, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminLayout from "@/components/AdminLayout";
import { useAllLoans, useLoanSureties } from "@/hooks/useLoans";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AdminRiskMonitor = () => {
  const { data: loans, isLoading } = useAllLoans();
  const navigate = useNavigate();

  const allLoans = loans || [];
  const activeLoans = allLoans.filter(l => ["disbursed", "repaying"].includes(l.status));
  const defaultedLoans = allLoans.filter(l => l.status === "defaulted");

  // Total Outstanding
  const totalOutstanding = allLoans
    .filter(l => ["disbursed", "repaying", "defaulted"].includes(l.status))
    .reduce((s, l) => s + (l.amount_approved || l.amount_requested) - l.total_repaid, 0);

  const totalRepaid = allLoans.reduce((s, l) => s + l.total_repaid, 0);
  const reserveFund = totalRepaid * 0.1;
  const totalRecovery = defaultedLoans.reduce((s, l) => s + l.recovery_amount, 0);
  const liquidityRatio = totalOutstanding > 0 ? ((reserveFund + totalRecovery) / totalOutstanding) * 100 : 100;
  const exposureRatio = totalOutstanding > 0 ? (totalOutstanding / (reserveFund || 1)) * 100 : 0;
  const isExposureHigh = exposureRatio > 60;

  // High Risk Borrowers (risk_score < 50)
  const highRiskBorrowers = allLoans
    .filter(l => l.risk_score < 50 && ["disbursed", "repaying", "defaulted"].includes(l.status))
    .sort((a, b) => a.risk_score - b.risk_score);

  // Borrowers Near Expiry (next_payment_date within 7 days)
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nearExpiryLoans = activeLoans.filter(l => {
    if (!l.next_payment_date) return false;
    const payDate = new Date(l.next_payment_date);
    return payDate <= sevenDaysFromNow && payDate >= now;
  }).sort((a, b) => new Date(a.next_payment_date!).getTime() - new Date(b.next_payment_date!).getTime());

  // Overdue loans
  const overdueLoans = allLoans.filter(l => {
    if (l.status === "defaulted") return true;
    if (!l.next_payment_date) return false;
    return new Date(l.next_payment_date) < now && ["disbursed", "repaying"].includes(l.status);
  });

  // Fetch all sureties for surety liability section
  const { data: allSureties } = useQuery({
    queryKey: ["all_loan_sureties"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("loan_sureties")
        .select("*, loans(id, status, amount_requested, amount_approved, total_repaid)")
        .eq("status", "accepted");
      if (error) throw error;
      return data as any[];
    },
  });

  // Aggregate surety exposure by surety name
  const suretyExposureMap: Record<string, { name: string; phone: string; totalGuaranteed: number; activeLoanCount: number; loans: any[] }> = {};
  (allSureties || []).forEach((s: any) => {
    const loan = s.loans;
    if (!loan || !["disbursed", "repaying", "defaulted"].includes(loan.status)) return;
    const key = s.surety_name || s.surety_user_id || s.id;
    if (!suretyExposureMap[key]) {
      suretyExposureMap[key] = { name: s.surety_name, phone: s.surety_phone || "", totalGuaranteed: 0, activeLoanCount: 0, loans: [] };
    }
    suretyExposureMap[key].totalGuaranteed += s.guarantee_amount;
    suretyExposureMap[key].activeLoanCount += 1;
    suretyExposureMap[key].loans.push({ loanId: loan.id, amount: s.guarantee_amount, status: loan.status });
  });
  const suretyExposureList = Object.values(suretyExposureMap).sort((a, b) => b.totalGuaranteed - a.totalGuaranteed);
  const multiGuaranteeSureties = suretyExposureList.filter(s => s.activeLoanCount > 1);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Shield className="w-4 h-4" /> Admin Panel
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Risk Monitoring Center</h1>
          <p className="text-muted-foreground mt-1">System health, high-risk borrowers, and surety liability tracking.</p>
        </div>

        {/* Exposure Warning */}
        {isExposureHigh && (
          <Alert className="border-destructive/50 bg-destructive/5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              <strong>⚠ High Exposure Warning:</strong> Loan Exposure is {exposureRatio.toFixed(0)}% of Reserve Fund. Target should be below 60%.
            </AlertDescription>
          </Alert>
        )}

        {/* Top Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground">Total Exposure</p>
              <p className="text-xl font-bold font-mono">${totalOutstanding.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground">Reserve Fund</p>
              <p className="text-xl font-bold font-mono text-emerald-400">${reserveFund.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground">Liquidity Coverage</p>
              <p className={`text-xl font-bold font-mono ${liquidityRatio >= 50 ? "text-green-400" : liquidityRatio >= 25 ? "text-yellow-400" : "text-destructive"}`}>
                {liquidityRatio.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground">Overdue Loans</p>
              <p className="text-xl font-bold font-mono text-destructive">{overdueLoans.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="high_risk" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="high_risk">High Risk ({highRiskBorrowers.length})</TabsTrigger>
            <TabsTrigger value="near_expiry">Near Expiry ({nearExpiryLoans.length})</TabsTrigger>
            <TabsTrigger value="surety_exposure">Surety Liability ({suretyExposureList.length})</TabsTrigger>
            <TabsTrigger value="multi_guarantee">Multi-Guarantee ({multiGuaranteeSureties.length})</TabsTrigger>
          </TabsList>

          {/* High Risk Borrowers */}
          <TabsContent value="high_risk">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> High Risk Borrowers</CardTitle>
                <CardDescription>Borrowers with risk score below 50 on active loans.</CardDescription>
              </CardHeader>
              <CardContent>
                {highRiskBorrowers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">No high-risk borrowers found.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Borrower</TableHead>
                        <TableHead>Risk Score</TableHead>
                        <TableHead>Loan Amount</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {highRiskBorrowers.map(l => (
                        <TableRow key={l.id} className="border-border">
                          <TableCell>
                            <p className="font-medium">{l.member_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{l.id.slice(0, 8)}</p>
                          </TableCell>
                          <TableCell>
                            <span className="text-destructive font-mono font-bold">{l.risk_score}/100</span>
                          </TableCell>
                          <TableCell className="font-mono">${(l.amount_approved || l.amount_requested).toLocaleString()}</TableCell>
                          <TableCell className="font-mono">${((l.amount_approved || l.amount_requested) - l.total_repaid).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={l.status === "defaulted" ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-400"}>
                              {l.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/loans/${l.id}`)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Near Expiry */}
          <TabsContent value="near_expiry">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-yellow-500" /> Borrowers Near Expiry</CardTitle>
                <CardDescription>Loans with payment due within the next 7 days.</CardDescription>
              </CardHeader>
              <CardContent>
                {nearExpiryLoans.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">No loans near expiry.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Borrower</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Installment</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nearExpiryLoans.map(l => (
                        <TableRow key={l.id} className="border-border">
                          <TableCell className="font-medium">{l.member_name}</TableCell>
                          <TableCell className="font-mono">{new Date(l.next_payment_date!).toLocaleDateString()}</TableCell>
                          <TableCell className="font-mono">${(l.monthly_installment || 0).toLocaleString()}</TableCell>
                          <TableCell className="font-mono">${((l.amount_approved || l.amount_requested) - l.total_repaid).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/loans/${l.id}`)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Surety Liability Monitor */}
          <TabsContent value="surety_exposure">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-purple-500" /> Surety Liability Monitor</CardTitle>
                <CardDescription>Each surety's total exposure across all guaranteed loans.</CardDescription>
              </CardHeader>
              <CardContent>
                {suretyExposureList.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">No active surety exposures.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Surety Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Active Guarantees</TableHead>
                        <TableHead>Total Exposure</TableHead>
                        <TableHead>Loan Statuses</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suretyExposureList.map((s, i) => (
                        <TableRow key={i} className="border-border">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{s.name}</p>
                              {s.activeLoanCount > 1 && (
                                <Badge variant="destructive" className="text-[10px]">Multi</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{s.phone || "—"}</TableCell>
                          <TableCell className="font-mono">{s.activeLoanCount}</TableCell>
                          <TableCell className="font-mono font-bold">${s.totalGuaranteed.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {s.loans.map((sl: any, j: number) => (
                                <Badge key={j} variant="outline" className={`text-[10px] ${sl.status === "defaulted" ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"}`}>
                                  {sl.status}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Multi-Guarantee Sureties */}
          <TabsContent value="multi_guarantee">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-500" /> Sureties with Multiple Guarantees</CardTitle>
                <CardDescription>Sureties guaranteeing more than 1 active loan — higher risk concentration.</CardDescription>
              </CardHeader>
              <CardContent>
                {multiGuaranteeSureties.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">No sureties with multiple active guarantees.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Surety Name</TableHead>
                        <TableHead>Guarantees</TableHead>
                        <TableHead>Total Exposure</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {multiGuaranteeSureties.map((s, i) => (
                        <TableRow key={i} className="border-border">
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">{s.activeLoanCount}</Badge>
                          </TableCell>
                          <TableCell className="font-mono font-bold text-destructive">${s.totalGuaranteed.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {s.loans.map((sl: any, j: number) => (
                                <p key={j} className="text-xs text-muted-foreground">
                                  Loan {sl.loanId.slice(0, 8)}… — ${sl.amount.toLocaleString()} ({sl.status})
                                </p>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminRiskMonitor;