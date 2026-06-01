import { useState } from "react";
import { Shield, Search, Filter, Eye, Banknote, AlertTriangle, Clock, TrendingUp, Activity, Gauge, PiggyBank, Users, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AdminLayout from "@/components/AdminLayout";
import { useAllLoans, LoanStatus } from "@/hooks/useLoans";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const statusColors: Record<LoanStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  surety_pending: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  under_review: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  disbursed: "bg-primary/20 text-primary border-primary/30",
  repaying: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  defaulted: "bg-destructive/20 text-destructive border-destructive/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "#f59e0b"];

const AdminLoans = () => {
  const { data: loans, isLoading } = useAllLoans();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = (loans || []).filter((l) => {
    const matchSearch = l.member_name.toLowerCase().includes(search.toLowerCase()) ||
      l.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Core metrics
  const allLoans = loans || [];
  const activeStatuses: LoanStatus[] = ["disbursed", "repaying"];
  const activeLoans = allLoans.filter(l => activeStatuses.includes(l.status));
  const totalDisbursed = allLoans.filter(l => ["disbursed", "repaying", "completed"].includes(l.status)).reduce((s, l) => s + (l.amount_approved || l.amount_requested), 0);
  const totalRepaid = allLoans.reduce((s, l) => s + l.total_repaid, 0);
  const defaultedCount = allLoans.filter(l => l.status === "defaulted").length;
  const pendingCount = allLoans.filter(l => ["pending", "surety_pending", "under_review"].includes(l.status)).length;
  const overdueCount = allLoans.filter(l => l.status === "defaulted" || (l.next_payment_date && new Date(l.next_payment_date) < new Date() && activeStatuses.includes(l.status))).length;

  const totalOutstanding = allLoans
    .filter(l => ["disbursed", "repaying", "defaulted"].includes(l.status))
    .reduce((s, l) => s + (l.amount_approved || l.amount_requested) - l.total_repaid, 0);

  const totalRecovery = allLoans.filter(l => l.status === "defaulted").reduce((s, l) => s + l.recovery_amount, 0);

  // Reserve fund: 10% of repaid
  const reserveFund = totalRepaid * 0.1;
  const liquidityRatio = totalOutstanding > 0 ? ((reserveFund + totalRecovery) / totalOutstanding) * 100 : 100;
  const liquidityHealth = liquidityRatio >= 50 ? "Healthy" : liquidityRatio >= 25 ? "Warning" : "Critical";
  const liquidityColor = liquidityRatio >= 50 ? "text-green-400" : liquidityRatio >= 25 ? "text-yellow-400" : "text-destructive";

  // NEW CARDS: Loans Due Today
  const today = new Date().toISOString().split("T")[0];
  const loansDueToday = activeLoans.filter(l => l.next_payment_date?.startsWith(today));
  const loansDueTodayValue = loansDueToday.reduce((s, l) => s + (l.monthly_installment || 0), 0);

  // Surety Exposure: total guarantee amounts on active loans (approximation from loan amounts * 1.2)
  const suretyExposure = activeLoans.reduce((s, l) => s + (l.amount_approved || l.amount_requested), 0) * 1.2;

  // Monthly Interest Earned (simple: sum of interest_rate * amount for completed/repaying)
  const monthlyInterest = allLoans
    .filter(l => ["repaying", "completed"].includes(l.status))
    .reduce((s, l) => s + ((l.amount_approved || l.amount_requested) * l.interest_rate / 100 / 12), 0);

  // Fraud flags
  const recentLoans = allLoans.filter(l => {
    const created = new Date(l.created_at);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return created > dayAgo;
  });
  const rapidApplications = recentLoans.length > 5;

  // Default Rate
  const completedOrDefaulted = allLoans.filter(l => ["completed", "defaulted"].includes(l.status));
  const defaultRate = completedOrDefaulted.length > 0 ? (defaultedCount / completedOrDefaulted.length) * 100 : 0;

  // CHART DATA: Risk Score Distribution
  const riskBuckets = [
    { name: "Low (80-100)", count: allLoans.filter(l => l.risk_score >= 80).length, fill: CHART_COLORS[0] },
    { name: "Medium (60-79)", count: allLoans.filter(l => l.risk_score >= 60 && l.risk_score < 80).length, fill: CHART_COLORS[5] },
    { name: "High (40-59)", count: allLoans.filter(l => l.risk_score >= 40 && l.risk_score < 60).length, fill: CHART_COLORS[2] },
    { name: "Reject (<40)", count: allLoans.filter(l => l.risk_score < 40).length, fill: CHART_COLORS[3] },
  ];

  // CHART DATA: Loan Distribution by Plan (use amount buckets as proxy for plan)
  const planBuckets = [
    { name: "$25", count: allLoans.filter(l => l.amount_requested <= 75).length },
    { name: "$50", count: allLoans.filter(l => l.amount_requested > 75 && l.amount_requested <= 150).length },
    { name: "$250", count: allLoans.filter(l => l.amount_requested > 150 && l.amount_requested <= 375).length },
    { name: "$500", count: allLoans.filter(l => l.amount_requested > 375 && l.amount_requested <= 875).length },
    { name: "$1,250", count: allLoans.filter(l => l.amount_requested > 875 && l.amount_requested <= 1875).length },
    { name: "$2,500+", count: allLoans.filter(l => l.amount_requested > 1875).length },
  ];

  // CHART DATA: Loan Growth (by month)
  const loansByMonth: Record<string, number> = {};
  allLoans.forEach(l => {
    const month = l.created_at.slice(0, 7);
    loansByMonth[month] = (loansByMonth[month] || 0) + 1;
  });
  const growthData = Object.entries(loansByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  // CHART DATA: Repayment Trend (last 90 days, grouped by week)
  const now = Date.now();
  const repaymentByWeek: Record<string, number> = {};
  allLoans.forEach(l => {
    if (l.total_repaid > 0) {
      const week = `W${Math.ceil((now - new Date(l.updated_at).getTime()) / (7 * 24 * 60 * 60 * 1000))}`;
      if (parseInt(week.slice(1)) <= 13) {
        repaymentByWeek[week] = (repaymentByWeek[week] || 0) + l.total_repaid;
      }
    }
  });
  const repaymentTrend = Object.entries(repaymentByWeek)
    .sort(([a], [b]) => parseInt(b.slice(1)) - parseInt(a.slice(1)))
    .map(([week, amount]) => ({ week, amount }));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Shield className="w-4 h-4" />
            Admin Panel
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Loan Management</h1>
          <p className="text-muted-foreground mt-1">Review, approve, and monitor all loan applications.</p>
        </div>

        {/* Summary Cards Row 1: Financial Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Disbursed</p>
                  <p className="text-lg font-bold font-mono">${totalDisbursed.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Repaid</p>
                  <p className="text-lg font-bold font-mono">${totalRepaid.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pending Review</p>
                  <p className="text-lg font-bold font-mono">{pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Defaulted</p>
                  <p className="text-lg font-bold font-mono">{defaultedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Cards Row 2: NEW cards + existing */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Loans Due Today */}
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Loans Due Today</p>
                  <p className="text-lg font-bold font-mono">{loansDueToday.length}</p>
                  <p className="text-xs text-muted-foreground">${loansDueTodayValue.toLocaleString()} value</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Reserve Fund Balance */}
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <PiggyBank className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reserve Fund</p>
                  <p className="text-lg font-bold font-mono">${reserveFund.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Available coverage</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Surety Exposure */}
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Surety Exposure</p>
                  <p className="text-lg font-bold font-mono">${suretyExposure.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total at risk</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Monthly Interest Earned */}
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Interest</p>
                  <p className="text-lg font-bold font-mono">${monthlyInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 3: Liquidity + Fraud + Outstanding */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Total Outstanding</p>
                  <p className="text-lg font-bold font-mono">${totalOutstanding.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{overdueCount} overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="pt-5 pb-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Gauge className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Liquidity Ratio</p>
                  <div className="flex items-center gap-2">
                    <p className={`text-lg font-bold font-mono ${liquidityColor}`}>{liquidityRatio.toFixed(1)}%</p>
                    <Badge variant="outline" className={`text-xs ${liquidityColor}`}>{liquidityHealth}</Badge>
                  </div>
                </div>
              </div>
              <Progress value={Math.min(100, liquidityRatio)} className="h-2" />
              <p className="text-[10px] text-muted-foreground">(Reserve + Recovery) ÷ Outstanding Loans</p>
            </CardContent>
          </Card>

          <Card className={`border-border ${rapidApplications ? "border-destructive/50" : ""}`}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${rapidApplications ? "bg-destructive/10" : "bg-green-500/10"}`}>
                  <Shield className={`w-5 h-5 ${rapidApplications ? "text-destructive" : "text-green-500"}`} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Fraud Detection</p>
                  {rapidApplications ? (
                    <div>
                      <p className="text-sm font-medium text-destructive">⚠ {recentLoans.length} applications in 24h</p>
                      <p className="text-xs text-muted-foreground">Possible rapid application fraud</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-green-400">No flags detected</p>
                      <p className="text-xs text-muted-foreground">{recentLoans.length} applications in 24h</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CHARTS Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Loan Distribution by Plan */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Loan Distribution by Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={planBuckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Risk Score Distribution */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Risk Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={riskBuckets} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, count }) => count > 0 ? `${name}: ${count}` : ""}>
                    {riskBuckets.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Loan Growth */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Loan Growth (Monthly)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Default Rate + Repayment Trend */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Default Rate & Repayment Trend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <span className="text-sm text-muted-foreground">Default Rate</span>
                <span className={`text-lg font-bold font-mono ${defaultRate > 10 ? "text-destructive" : defaultRate > 5 ? "text-yellow-400" : "text-green-400"}`}>
                  {defaultRate.toFixed(1)}%
                </span>
              </div>
              {repaymentTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={repaymentTrend}>
                    <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                    <Bar dataKey="amount" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No repayment data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="surety_pending">Surety Pending</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="disbursed">Disbursed</SelectItem>
              <SelectItem value="repaying">Repaying</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="defaulted">Defaulted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loan Table */}
        <Card className="border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading loans...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No loans found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Borrower</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Repaid</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((loan) => (
                    <TableRow key={loan.id} className="border-border hover:bg-secondary/30 cursor-pointer" onClick={() => navigate(`/admin/loans/${loan.id}`)}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{loan.member_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{loan.id.slice(0, 8)}...</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">${loan.amount_requested.toLocaleString()}</TableCell>
                      <TableCell>{loan.duration_months}mo</TableCell>
                      <TableCell>
                        <span className={`font-mono font-bold ${loan.risk_score >= 80 ? "text-green-400" : loan.risk_score >= 60 ? "text-yellow-400" : "text-destructive"}`}>
                          {loan.risk_score}/100
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[loan.status]}>
                          {loan.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">${loan.total_repaid.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(`/admin/loans/${loan.id}`); }}>
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
      </div>
    </AdminLayout>
  );
};

export default AdminLoans;