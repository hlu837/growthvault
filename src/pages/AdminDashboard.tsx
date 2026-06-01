import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  ShoppingCart,
  Package,
  Shield,
  Lock,
  Scale,
  Briefcase,
  Loader
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { Badge } from "@/components/ui/badge";

const AdminDashboard = () => {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSellers: 0,
    totalListings: 0,
    totalTransactions: 0,
    escrowBalance: 0,
    openDisputes: 0
  });
  const [chartData, setChartData] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch Total Users
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch Active Sellers (approved seller applications)
      const { count: sellersCount } = await supabase
        .from('seller_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');

      // Fetch Total Active Listings
      const { count: listingsCount } = await supabase
        .from('marketplace_products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Fetch Total Transactions
      const { count: transactionsCount } = await supabase
        .from('marketplace_orders')
        .select('*', { count: 'exact', head: true });

      // Fetch Escrow Balance (sum of held amounts in non-delivered orders)
      const { data: escrowData } = await supabase
        .from('marketplace_orders')
        .select('total_escrow_hold_amount')
        .neq('order_status', 'delivered')
        .neq('order_status', 'cancelled')
        .neq('order_status', 'refunded');

      const escrowBalance = escrowData?.reduce((sum, order) => sum + (parseFloat(order.total_escrow_hold_amount) || 0), 0) || 0;

      // Fetch Open Disputes
      const { count: disputesCount } = await supabase
        .from('marketplace_orders')
        .select('*', { count: 'exact', head: true })
        .not('dispute_opened_at', 'is', null)
        .is('dispute_resolved_at', null);

      setStats({
        totalUsers: usersCount || 0,
        activeSellers: sellersCount || 0,
        totalListings: listingsCount || 0,
        totalTransactions: transactionsCount || 0,
        escrowBalance: Math.round(escrowBalance),
        openDisputes: disputesCount || 0
      });

      // Fetch 7-day trend data
      await fetchChartData();

      // Fetch recent activities
      await fetchRecentActivities();
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    try {
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        last7Days.push(date);
      }

      const chartDataArray = await Promise.all(
        last7Days.map(async (date) => {
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);

          // Get transactions for this day
          const { count: dayTransactions } = await supabase
            .from('marketplace_orders')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', date.toISOString())
            .lt('created_at', nextDate.toISOString());

          // Get disputes for this day
          const { count: dayDisputes } = await supabase
            .from('marketplace_orders')
            .select('*', { count: 'exact', head: true })
            .gte('dispute_opened_at', date.toISOString())
            .lt('dispute_opened_at', nextDate.toISOString());

          // Get revenue (8% commission from completed orders)
          const { data: dayOrders } = await supabase
            .from('marketplace_orders')
            .select('total_amount')
            .eq('order_status', 'delivered')
            .gte('updated_at', date.toISOString())
            .lt('updated_at', nextDate.toISOString());

          const dayRevenue = (dayOrders?.reduce((sum, order) => sum + (parseFloat(order.total_amount) * 0.08), 0) || 0);

          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

          return {
            name: dayName,
            transactions: dayTransactions || 0,
            disputes: dayDisputes || 0,
            revenue: Math.round(dayRevenue)
          };
        })
      );

      setChartData(chartDataArray);
    } catch (error) {
      console.error('Error fetching chart data:', error);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      // Get recent seller applications
      const { data: recentApps } = await supabase
        .from('seller_applications')
        .select('id, business_name, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      // Get recent disputes
      const { data: recentDisputes } = await supabase
        .from('marketplace_orders')
        .select('id, order_number, dispute_opened_at, dispute_resolved_at')
        .not('dispute_opened_at', 'is', null)
        .order('dispute_opened_at', { ascending: false })
        .limit(10);

      // Get recent large transactions
      const { data: largeTxns } = await supabase
        .from('marketplace_orders')
        .select('id, order_number, total_amount, created_at')
        .order('total_amount', { ascending: false })
        .limit(10);

      const activities = [];

      // Add seller applications
      recentApps?.forEach((app) => {
        activities.push({
          id: `app-${app.id}`,
          type: 'seller_application',
          desc: `New seller application: ${app.business_name}`,
          time: getTimeAgo(app.created_at),
          status: app.status
        });
      });

      // Add disputes
      recentDisputes?.forEach((dispute) => {
        const status = dispute.dispute_resolved_at ? 'resolved' : 'open';
        activities.push({
          id: `dispute-${dispute.id}`,
          type: 'dispute',
          desc: `Dispute ${status}: ${dispute.order_number}`,
          time: getTimeAgo(dispute.dispute_opened_at),
          status: status
        });
      });

      // Add large transactions
      largeTxns?.forEach((txn) => {
        activities.push({
          id: `txn-${txn.id}`,
          type: 'transaction',
          desc: `Large transaction: $${parseFloat(txn.total_amount).toLocaleString()} (${txn.order_number})`,
          time: getTimeAgo(txn.created_at),
          status: 'completed'
        });
      });

      // Sort by time and take top 5
      const sorted = activities
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 5);

      setRecentActivities(sorted);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="text-center">
            <Loader className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-400" />
            <h2 className="text-xl font-semibold mb-2">Loading Dashboard...</h2>
            <p className="text-muted-foreground">Fetching real-time data from your marketplace</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-2">Marketplace metrics and key performance indicators</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Total Users</p>
                  <h3 className="text-2xl font-bold text-white mt-1">{stats.totalUsers}</h3>
                </div>
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Active Sellers</p>
                  <h3 className="text-2xl font-bold text-white mt-1">{stats.activeSellers}</h3>
                </div>
                <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-indigo-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Total Listings</p>
                  <h3 className="text-2xl font-bold text-white mt-1">{stats.totalListings.toLocaleString()}</h3>
                </div>
                <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Package className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Total Transactions</p>
                  <h3 className="text-2xl font-bold text-white mt-1">{stats.totalTransactions.toLocaleString()}</h3>
                </div>
                <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Escrow Balance</p>
                  <h3 className="text-2xl font-bold text-green-400 mt-1">${stats.escrowBalance.toLocaleString()}</h3>
                </div>
                <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Open Disputes</p>
                  <h3 className="text-2xl font-bold text-red-400 mt-1">{stats.openDisputes}</h3>
                </div>
                <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <Scale className="w-6 h-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle>Transactions & Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis yAxisId="left" stroke="#94a3b8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#4ade80" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="transactions" stroke="#3b82f6" strokeWidth={2} name="Transactions Volume" />
                    <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#4ade80" strokeWidth={2} name="Revenue ($)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle>Disputes Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }} cursor={{fill: '#334155'}} />
                    <Legend />
                    <Bar dataKey="disputes" fill="#f87171" name="New Disputes" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center
                      ${activity.type === 'seller_application' ? 'bg-indigo-500/20 text-indigo-400' : 
                        activity.type === 'dispute' ? 'bg-red-500/20 text-red-400' : 
                        'bg-green-500/20 text-green-400'}`}>
                      {activity.type === 'seller_application' && <Briefcase className="w-5 h-5" />}
                      {activity.type === 'dispute' && <Scale className="w-5 h-5" />}
                      {activity.type === 'transaction' && <DollarSign className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-white">{activity.desc}</p>
                      <p className="text-sm text-slate-500">{activity.time}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={
                    activity.status === 'pending' ? 'text-yellow-400 border-yellow-500/30' :
                    activity.status === 'open' ? 'text-red-400 border-red-500/30' :
                    'text-green-400 border-green-500/30'
                  }>
                    {activity.status.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
