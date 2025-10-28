import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Search, Filter, MoreHorizontal, Package, Printer, Truck, Ship, X } from "lucide-react";
import type { IconaOrder, IconaOrdersResponse } from "@shared/schema";
import { calculateOrderTotal, formatCurrency } from "@shared/pricing";
import { format } from "date-fns";
import { CompletePagination } from "@/components/ui/pagination";

const statusColors = {
  processing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  shipped: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  ended: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const statusPriority = {
  processing: 1,
  shipped: 2,
  delivered: 3,
  ended: 4,
  cancelled: 5,
};

export default function Orders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: orderResponse, isLoading, error: ordersError, isError, refetch } = useQuery<IconaOrdersResponse>({
    queryKey: ["external-orders", user?.id, statusFilter, selectedCustomerId, currentPage, itemsPerPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (user?.id) {
        // Orders page always shows seller orders (using userId parameter)
        // Non-sellers won't see this page - they get redirected to purchases
        console.log("User seller status:", user.seller);
        params.set("userId", user.id);
      }
      if (statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (selectedCustomerId && selectedCustomerId !== "all") {
        params.set("customerId", selectedCustomerId);
      }
      // Add pagination parameters
      params.set("page", currentPage.toString());
      params.set("limit", itemsPerPage.toString());

      const response = await fetch(
        `/api/orders?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`External API error: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!user?.id, // Only run query when user ID is available
  });

  // Ship order mutation
  const shipOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "shipped",
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark order as shipped');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      toast({ title: "Order marked as shipped" });
    },
    onError: () => {
      toast({ title: "Failed to mark order as shipped", variant: "destructive" });
    },
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel order');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      toast({ title: "Order cancelled" });
    },
    onError: () => {
      toast({ title: "Failed to cancel order", variant: "destructive" });
    },
  });


  const handlePrintLabel = (order: IconaOrder) => {
    if (order.label_url) {
      window.open(order.label_url, '_blank');
    } else {
      toast({ title: "No shipping label available", variant: "destructive" });
    }
  };

  const handleTrackPackage = (order: IconaOrder) => {
    if (order.tracking_number) {
      // TODO: Open tracking modal or navigate to tracking page
      toast({ title: `Tracking: ${order.tracking_number}` });
    } else {
      toast({ title: "No tracking number available", variant: "destructive" });
    }
  };

  const handleShipOrder = (orderId: string) => {
    shipOrderMutation.mutate(orderId);
  };

  const handleCancelOrder = (orderId: string) => {
    if (window.confirm('Are you sure you want to cancel this order?')) {
      cancelOrderMutation.mutate(orderId);
    }
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Reset pagination when filters change
  const resetPaginationOnFilterChange = () => {
    setCurrentPage(1);
  };

  // Update filters to reset pagination
  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    resetPaginationOnFilterChange();
  };

  const handleCustomerFilterChange = (newCustomerId: string) => {
    setSelectedCustomerId(newCustomerId);
    resetPaginationOnFilterChange();
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    resetPaginationOnFilterChange();
  };

  // Extract orders array from the response
  const orders = orderResponse?.orders || [];

  // Use centralized calculation function
  const calculateTotal = calculateOrderTotal;

  // Get unique customers from orders for the filter dropdown
  const uniqueCustomers = orders?.reduce((acc: any[], order) => {
    if (order.customer && !acc.find(c => c._id === order.customer._id)) {
      acc.push(order.customer);
    }
    return acc;
  }, []) || [];

  // Apply client-side search and sorting (filtering is done server-side now)
  const filteredOrders = orders?.filter((order: IconaOrder) => {
    const customerName = `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim();
    const orderNumber = order.invoice?.toString() || order._id.slice(-8);
    const itemName = order.giveaway?.name || '';
    
    const matchesSearch = searchTerm === "" || 
      customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      itemName.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  }).sort((a: IconaOrder, b: IconaOrder) => {
    switch (sortBy) {
      case "newest":
        const aDate = a.date ? new Date(a.date) : new Date(a.createdAt || 0);
        const bDate = b.date ? new Date(b.date) : new Date(b.createdAt || 0);
        return bDate.getTime() - aDate.getTime();
      case "oldest":
        const aDateOld = a.date ? new Date(a.date) : new Date(a.createdAt || 0);
        const bDateOld = b.date ? new Date(b.date) : new Date(b.createdAt || 0);
        return aDateOld.getTime() - bDateOld.getTime();
      case "amount-high":
        return calculateTotal(b) - calculateTotal(a);
      case "amount-low":
        return calculateTotal(a) - calculateTotal(b);
      case "status":
        const aPriority = statusPriority[a.status as keyof typeof statusPriority] || 999;
        const bPriority = statusPriority[b.status as keyof typeof statusPriority] || 999;
        return aPriority - bPriority;
      default:
        return 0;
    }
  }) || [];

  // Calculate overview stats - use pagination data
  const totalOrders = orderResponse?.total || 0;
  const totalPages = orderResponse?.pages || 0;
  const currentPageRevenue = orders?.reduce((sum, order) => sum + calculateTotal(order), 0) || 0;
  const processingCount = orders?.filter(order => order.status === "processing").length || 0;
  const shippingCount = orders?.filter(order => order.status === "shipped").length || 0;
  const deliveredCount = orders?.filter(order => order.status === "delivered" || order.status === "ended").length || 0;

  if (isLoading) {
    return (
      <div className="py-6">
        <div className="px-4 sm:px-6 md:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-32 mb-8"></div>
            <div className="grid grid-cols-5 gap-4 mb-8">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded"></div>
              ))}
            </div>
            <div className="h-96 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state with retry functionality
  if (isError) {
    return (
      <div className="py-6">
        <div className="px-4 sm:px-6 md:px-8">
          <Card className="max-w-md mx-auto mt-8">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-destructive text-5xl mb-4">⚠️</div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Failed to Load Orders
                </h2>
                <p className="text-muted-foreground mb-4">
                  {ordersError?.message || "Something went wrong while loading your orders. Please try again."}
                </p>
                <Button 
                  onClick={() => refetch()}
                  data-testid="button-retry-orders"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="px-4 sm:px-6 md:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-orders-title">
            Orders
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage and track all your customer orders
          </p>
        </div>

        {/* Overview Cards */}
        <div className={`grid gap-4 mb-8 ${user?.seller === false ? 'grid-cols-4' : 'grid-cols-5'}`}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Orders</CardDescription>
              <CardTitle className="text-2xl" data-testid="metric-total-orders">
                {totalOrders}
              </CardTitle>
            </CardHeader>
          </Card>
          
          {user?.seller !== false && (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Current Page Revenue</CardDescription>
                <CardTitle className="text-2xl" data-testid="metric-total-revenue">
                  {formatCurrency(currentPageRevenue)}
                </CardTitle>
              </CardHeader>
            </Card>
          )}

          {user?.seller !== false && (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Processing</CardDescription>
                <CardTitle className="text-2xl text-orange-600" data-testid="metric-processing">
                  {processingCount}
                </CardTitle>
              </CardHeader>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Shipping</CardDescription>
              <CardTitle className="text-2xl text-blue-600" data-testid="metric-shipping">
                {shippingCount}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Delivered</CardDescription>
              <CardTitle className="text-2xl text-green-600" data-testid="metric-delivered">
                {deliveredCount}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={statusFilter} onValueChange={handleStatusFilterChange} className="mb-6">
          <TabsList className={`grid w-full ${user?.seller === false ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-5'}`}>
            <TabsTrigger value="all" data-testid="tab-all">
              All
            </TabsTrigger>
            {user?.seller !== false && (
              <TabsTrigger value="processing" data-testid="tab-processing">
                Need Label
              </TabsTrigger>
            )}
            {user?.seller !== false && (
              <TabsTrigger
                value="ready_to_ship"
                data-testid="tab-ready-to-ship"
              >
                Ready to Ship
              </TabsTrigger>
            )}
            <TabsTrigger value="shipped" data-testid="tab-shipped">
              Shipped
            </TabsTrigger>
            <TabsTrigger value="cancelled" data-testid="tab-cancelled">
              Cancelled
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search and Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4 flex-1">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-orders"
              />
            </div>
            
            {user?.seller !== false && (
              <div className="w-full sm:w-64">
                <Select
                  value={selectedCustomerId}
                  onValueChange={handleCustomerFilterChange}
                >
                  <SelectTrigger data-testid="select-customer">
                    <SelectValue placeholder="Filter by customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    {uniqueCustomers.map((customer) => (
                      <SelectItem key={customer._id} value={customer._id}>
                        {customer.firstName} {customer.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-48" data-testid="select-sort-orders">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="amount-high">Amount: High to Low</SelectItem>
                <SelectItem value="amount-low">Amount: Low to High</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredOrders.length} of {totalOrders} orders
          </div>
        </div>


        {/* Orders List */}
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order._id} className="hover:shadow-md transition-shadow" data-testid={`card-order-${order._id}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                      <Package className="text-muted-foreground" size={20} />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-1">
                        <h3 className="font-semibold text-foreground">
                          #{order.invoice || order._id.slice(-8)}
                        </h3>
                        <Badge 
                          className={statusColors[(order.status || 'processing') as keyof typeof statusColors]}
                          data-testid={`order-status-${order.status || 'processing'}`}
                        >
                          {(order.status || 'processing').charAt(0).toUpperCase() + (order.status || 'processing').slice(1)}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                        <span>
                          <strong className="text-foreground">{`${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim()}</strong> • {order.customer?.email}
                        </span>
                        <span>
                          {order.giveaway?.name || 'N/A'} {(order.giveaway?.quantity || 0) > 1 && `(${order.giveaway?.quantity} items)`}
                        </span>
                        <span>
                          {order.date ? format(new Date(order.date), "MMM dd, yyyy") : format(new Date(order.createdAt || Date.now()), "MMM dd, yyyy")}
                        </span>
                        {order.tracking_number && (
                          <span className="text-primary font-medium">
                            Tracking: {order.tracking_number}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-lg font-bold text-foreground">
                        {formatCurrency(calculateTotal(order))}
                      </div>
                      {(order.shipping_fee || 0) > 0 && (
                        <div className="text-sm text-muted-foreground">
                          +{formatCurrency(order.shipping_fee || 0)} shipping
                        </div>
                      )}
                      {(order.tax || 0) > 0 && (
                        <div className="text-sm text-muted-foreground">
                          +{formatCurrency(order.tax || 0)} tax
                        </div>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" data-testid={`button-order-menu-${order._id}`}>
                          <MoreHorizontal size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {/* Print Label - only for orders with labels */}
                        {order.label_url && (
                          <DropdownMenuItem
                            onClick={() => handlePrintLabel(order)}
                            data-testid={`menu-print-label-${order._id}`}
                          >
                            <Printer size={14} className="mr-2" />
                            Print Label
                          </DropdownMenuItem>
                        )}

                        {/* Track Package - only for shipped orders with tracking */}
                        {(order.status === "shipped" || order.status === "delivered") && order.tracking_number && (
                          <DropdownMenuItem
                            onClick={() => handleTrackPackage(order)}
                            data-testid={`menu-track-package-${order._id}`}
                          >
                            <Truck size={14} className="mr-2" />
                            Track Package
                          </DropdownMenuItem>
                        )}

                        {/* Mark as Shipped - only for ready to ship orders */}
                        {order.status === "ready_to_ship" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleShipOrder(order._id)}
                              disabled={shipOrderMutation.isPending}
                              data-testid={`menu-ship-order-${order._id}`}
                            >
                              <Ship size={14} className="mr-2" />
                              {shipOrderMutation.isPending ? 'Shipping...' : 'Mark as Shipped'}
                            </DropdownMenuItem>
                          </>
                        )}

                        {/* Cancel Order - only for non-shipped, non-cancelled orders */}
                        {order.status !== "shipped" && order.status !== "delivered" && order.status !== "cancelled" && order.status !== "ended" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleCancelOrder(order._id)}
                              disabled={cancelOrderMutation.isPending}
                              className="text-red-600"
                              data-testid={`menu-cancel-order-${order._id}`}
                            >
                              <X size={14} className="mr-2" />
                              {cancelOrderMutation.isPending ? 'Cancelling...' : 'Cancel Order'}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredOrders.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No orders found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== "all" 
                    ? "Try adjusting your search or filters" 
                    : "Orders will appear here when customers make purchases"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Pagination Controls */}
        <div className="mt-6">
          <CompletePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalOrders}
            itemsPerPage={itemsPerPage}
            itemsPerPageOptions={[10, 20, 50, 100]}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
            showingText="orders"
            className="bg-white dark:bg-gray-950 rounded-lg border p-4"
          />
        </div>
      </div>
    </div>
  );
}
