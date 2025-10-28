import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdminLayout } from "@/components/admin-layout";
import { Banknote, Search, DollarSign, TrendingUp, Calendar } from "lucide-react";

export default function AdminPayouts() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: payoutsData, isLoading } = useQuery<any>({
    queryKey: ['/api/admin/stripe-payouts'],
  });

  const payouts = payoutsData?.data || [];

  // Filter payouts by payout ID
  const filteredPayouts = payouts.filter((payout: any) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (!payout.id.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    return true;
  });

  // Calculate totals
  const totalPayouts = filteredPayouts.reduce((sum: number, p: any) => sum + ((p.amount || 0) / 100), 0);
  const totalCount = filteredPayouts.length;
  const avgPayout = totalCount > 0 ? totalPayouts / totalCount : 0;

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground">Stripe Payouts</h2>
          <p className="text-muted-foreground">View Stripe payout transactions</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-amount">
                ${totalPayouts.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Across all payouts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-count">
                {totalCount}
              </div>
              <p className="text-xs text-muted-foreground">Payout transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Payout</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-payout">
                ${avgPayout.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Per transaction</p>
            </CardContent>
          </Card>
        </div>

        {/* Payouts Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <CardTitle>Payout Transactions</CardTitle>
                <CardDescription>Stripe payout history</CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by payout ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-payouts"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading payouts...</p>
              </div>
            ) : filteredPayouts.length === 0 ? (
              <div className="text-center py-12">
                <Banknote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? 'No payouts found matching your search' : 'No payouts found'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Payout ID</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="hidden md:table-cell">Currency</TableHead>
                      <TableHead className="hidden lg:table-cell">Created</TableHead>
                      <TableHead className="hidden lg:table-cell">Arrival Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayouts.map((payout: any) => {
                      const payoutId = payout.id;
                      const amount = (payout.amount || 0) / 100;
                      const createdDate = payout.created ? new Date(payout.created * 1000) : null;
                      const arrivalDate = payout.arrival_date ? new Date(payout.arrival_date * 1000) : null;
                      
                      return (
                        <TableRow key={payoutId} data-testid={`row-payout-${payoutId}`}>
                          <TableCell className="font-mono text-xs" data-testid={`text-id-${payoutId}`}>
                            <div className="max-w-[200px] truncate" title={payoutId}>
                              {payoutId}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold" data-testid={`text-amount-${payoutId}`}>
                            ${amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell uppercase">
                            {payout.currency || 'USD'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {createdDate ? createdDate.toLocaleDateString() : 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {arrivalDate ? arrivalDate.toLocaleDateString() : 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={payout.automatic ? "default" : "outline"}>
                              {payout.automatic ? "Automatic" : "Manual"}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="secondary">
                              {payout.status || 'Completed'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {/* Bank Account Details */}
            {filteredPayouts.length > 0 && filteredPayouts[0].destination && (
              <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
                <h4 className="font-semibold text-sm mb-2">Bank Account Information</h4>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-muted-foreground">Bank: </span>
                    <span className="font-medium">
                      {filteredPayouts[0].destination.bank_name || 'Bank Account'}
                    </span>
                  </div>
                  {filteredPayouts[0].destination.last4 && (
                    <div>
                      <span className="text-muted-foreground">Account: </span>
                      <span className="font-mono">****{filteredPayouts[0].destination.last4}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Account Holder: </span>
                    <span>{filteredPayouts[0].destination.account_holder_name || 'Individual'}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
