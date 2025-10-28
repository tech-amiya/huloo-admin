import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Edit,
  Printer,
  Search,
  ChevronDown,
  ChevronRight,
  Package2,
  Unlink2,
  X,
  Eye,
  MoreHorizontal,
  Ship,
} from "lucide-react";
import type {
  IconaOrder,
  ShipmentBundle,
  IconaOrdersResponse,
} from "@shared/schema";
import { format } from "date-fns";
import { ShippingDrawer } from "@/components/shipping/shipping-drawer";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CompletePagination } from "@/components/ui/pagination";

const statusColors = {
  unfulfilled:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  shipping: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  delivered:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  pickup:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

interface ShipmentMetrics {
  totalSold: string;
  totalEarned: string;
  totalShippingSpend: string;
  totalCouponSpend: string;
  itemsSold: number;
  totalDelivered: number;
  pendingDelivery: number;
}

export default function Shipping() {
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");
  const [bundleName, setBundleName] = useState("");
  const [showBundleDialog, setShowBundleDialog] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [relistOption, setRelistOption] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const { user } = useAuth();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async ({
      orderId,
      relist,
    }: {
      orderId: string;
      relist: boolean;
    }) => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "cancelled", relist }),
      });

      if (!response.ok) {
        throw new Error("Failed to cancel order");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      toast({ title: "Order cancelled successfully" });
      setCancelOrderId(null);
      setRelistOption(false);
    },
    onError: () => {
      toast({ title: "Failed to cancel order", variant: "destructive" });
    },
  });

  const handleCancelOrder = () => {
    if (cancelOrderId) {
      cancelOrderMutation.mutate({
        orderId: cancelOrderId,
        relist: relistOption,
      });
    }
  };

  const canCancelOrder = (status: string) => {
    return (
      status !== "cancelled" &&
      status !== "shipped" &&
      status !== "delivered" &&
      status !== "ended"
    );
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

  // Handle tab clicks - refresh data when clicking the currently active tab
  const handleTabClick = (value: string) => {
    if (value === statusFilter) {
      // If clicking the already active tab, force a refresh
      refetchOrders();
      refetchAllOrders();
      refetchBundles();
      refetchMetrics();
    }
  };

  const { data: metrics, isLoading: metricsLoading, error: metricsError, isError: metricsIsError, refetch: refetchMetrics } =
    useQuery<ShipmentMetrics>({
      queryKey: ["/api/shipping/metrics", user?.id],
      enabled: !!user?.id,
    });

  const { data: orderResponse, isLoading: ordersLoading, error: ordersError, isError: ordersIsError, refetch: refetchOrders } =
    useQuery<IconaOrdersResponse>({
      queryKey: ["external-orders", user?.id, statusFilter, selectedCustomerId, currentPage, itemsPerPage],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (user?.id) {
          // Use customer parameter if seller is false or undefined (non-sellers), otherwise use userId
          if (user.seller === false || user.seller === undefined) {
            params.set("customer", user.id);
          } else {
            params.set("userId", user.id);
          }
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

  // Extract orders array from the response
  const orders = orderResponse?.orders || [];
  
  // Extract pagination data from response
  const totalOrders = orderResponse?.total || 0;
  const totalPages = orderResponse?.pages || 0;

  // Separate unfiltered query for bundle status calculation
  const { data: allOrdersResponse, refetch: refetchAllOrders } = useQuery<IconaOrdersResponse>({
    queryKey: ["external-orders", user?.id, "all", "all"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (user?.id) {
        // Use customer parameter if seller is false or undefined (non-sellers), otherwise use userId
        if (user.seller === false || user.seller === undefined) {
          params.set("customer", user.id);
        } else {
          params.set("userId", user.id);
        }
      }

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
    enabled: !!user?.id,
  });

  // Extract unfiltered orders for bundle status calculation
  const allOrders = allOrdersResponse?.orders || [];

  // Extract unique customers from orders data
  const uniqueCustomers = React.useMemo(() => {
    if (!orders || orders.length === 0) return [];

    const customerMap = new Map();
    orders.forEach((order) => {
      if (order.customer && order.customer._id) {
        customerMap.set(order.customer._id, {
          _id: order.customer._id,
          firstName: order.customer.firstName,
          lastName: order.customer.lastName || "",
        });
      }
    });

    return Array.from(customerMap.values()).sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(
        `${b.firstName} ${b.lastName}`,
      ),
    );
  }, [orders]);

  const { data: bundles, isLoading: bundlesLoading, error: bundlesError, isError: bundlesIsError, refetch: refetchBundles } = useQuery<
    ShipmentBundle[]
  >({
    queryKey: ["/api/bundles", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("User ID required");
      const response = await fetch(`/api/bundles?userId=${user.id}`);
      if (!response.ok) throw new Error("Failed to fetch bundles");
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Filter out orders that are already bundled
  const unbundledOrders =
    orders?.filter(
      (order) => !order.bundleId || order.bundleId.trim() === "",
    ) || [];

  // Function to determine bundle status based on all orders in the bundle
  const getBundleStatus = (bundleId: string) => {
    // Use unfiltered orders to get accurate bundle status
    const bundleOrders =
      allOrders?.filter((order) => order.bundleId === bundleId) || [];

    if (bundleOrders.length === 0) return "processing"; // Default if no orders

    const orderStatuses = bundleOrders.map(
      (order) => order.status || "processing",
    );
    const uniqueStatuses = [...new Set(orderStatuses)];

    // If all orders have the same status, bundle has that status
    if (uniqueStatuses.length === 1) {
      return uniqueStatuses[0];
    }

    // If mixed statuses, prioritize in this order:
    // cancelled > shipped > ready_to_ship > processing
    if (orderStatuses.some((status) => status === "cancelled"))
      return "cancelled";
    if (orderStatuses.some((status) => status === "shipped")) return "shipped";
    if (orderStatuses.some((status) => status === "ready_to_ship"))
      return "ready_to_ship";

    return "processing"; // Default fallback
  };

  const filteredBundles =
    bundles?.filter((bundle) => {
      const bundleStatus = getBundleStatus(bundle.id);

      if (statusFilter === "all") return true;
      return bundleStatus === statusFilter;
    }) || [];

  // Combine unbundled orders and bundles for display
  type DisplayItem = IconaOrder | (ShipmentBundle & { isBundle: true });
  const displayItems: DisplayItem[] = [
    ...unbundledOrders,
    ...filteredBundles.map((bundle) => ({
      ...bundle,
      isBundle: true as const,
    })),
  ].sort((a, b) => {
    const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
    const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
    return bDate.getTime() - aDate.getTime();
  });

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    // Only allow selection of orders with 'processing' status
    const order = orders?.find((o) => o._id === orderId);
    if (checked && order?.status !== "processing") {
      toast({
        title: "Only processing orders can be bundled",
        variant: "destructive",
      });
      return;
    }

    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter((id) => id !== orderId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select orders with 'processing' status for bundling
      const processingOrderIds = displayItems
        .filter((item) => !("isBundle" in item))
        .map((item) => item as IconaOrder)
        .filter((order) => order.status === "processing")
        .map((order) => order._id);
      setSelectedOrders(processingOrderIds);
    } else {
      setSelectedOrders([]);
    }
  };

  const toggleOrderExpansion = (orderId: string) => {
    if (expandedOrders.includes(orderId)) {
      setExpandedOrders(expandedOrders.filter((id) => id !== orderId));
    } else {
      setExpandedOrders([...expandedOrders, orderId]);
    }
  };

  const createBundleMutation = useMutation({
    mutationFn: async (data: { orderIds: string[] }) => {
      if (!user?.id) throw new Error("User ID required");

      const response = await fetch("/api/orders/bundle/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, userId: user.id }),
      });
      if (!response.ok) throw new Error("Failed to create bundle");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bundles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipping/metrics"] });
      setSelectedOrders([]);
      setBundleName("");
      setShowBundleDialog(false);
      toast({ title: "Bundle created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create bundle", variant: "destructive" });
    },
  });

  const unbundleMutation = useMutation({
    mutationFn: async (bundleId: string) => {
      if (!user?.id) throw new Error("User ID required");
      const response = await fetch(
        `/api/bundles/${bundleId}?userId=${user.id}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) throw new Error("Failed to unbundle orders");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bundles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipping/metrics"] });
      toast({ title: "Orders unbundled successfully" });
    },
    onError: () => {
      toast({ title: "Failed to unbundle orders", variant: "destructive" });
    },
  });

  const cancelBundleMutation = useMutation({
    mutationFn: async ({
      bundleId,
      relist,
    }: {
      bundleId: string;
      relist: boolean;
    }) => {
      if (!user?.id) throw new Error("User ID required");

      // Get all orders in the bundle (use unfiltered orders)
      const bundleOrders =
        allOrders?.filter((order) => order.bundleId === bundleId) || [];

      // Cancel each order in the bundle with relist option
      const cancelPromises = bundleOrders.map((order) =>
        fetch(`/api/orders/${order._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "cancelled",
            relist,
          }),
        }),
      );

      const results = await Promise.all(cancelPromises);
      const failedCancellations = results.filter((response) => !response.ok);

      if (failedCancellations.length > 0) {
        throw new Error(
          `Failed to cancel ${failedCancellations.length} orders in bundle`,
        );
      }

      return { cancelledOrders: bundleOrders.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bundles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipping/metrics"] });
      toast({
        title: `Bundle cancelled - ${data.cancelledOrders} orders cancelled`,
      });
      setCancelOrderId(null);
      setRelistOption(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to cancel bundle",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
        throw new Error("Failed to mark order as shipped");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipping/metrics"] });
      toast({ title: "Order marked as shipped" });
    },
    onError: () => {
      toast({
        title: "Failed to mark order as shipped",
        variant: "destructive",
      });
    },
  });

  const shipBundleMutation = useMutation({
    mutationFn: async (bundleId: string) => {
      if (!user?.id) throw new Error("User ID required");

      // Get all orders in the bundle (use unfiltered orders)
      const bundleOrders =
        allOrders?.filter((order) => order.bundleId === bundleId) || [];

      // Ship each order in the bundle
      const shipPromises = bundleOrders.map((order) =>
        fetch(`/api/orders/${order._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "shipped",
          }),
        }),
      );

      const results = await Promise.all(shipPromises);
      const failedShipments = results.filter((response) => !response.ok);

      if (failedShipments.length > 0) {
        throw new Error(
          `Failed to ship ${failedShipments.length} orders in bundle`,
        );
      }

      return { shippedOrders: bundleOrders.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["external-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bundles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipping/metrics"] });
      toast({
        title: `Bundle shipped - ${data.shippedOrders} orders marked as shipped`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to ship bundle",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateBundle = () => {
    if (selectedOrders.length < 2) {
      toast({
        title: "Select at least 2 orders to bundle",
        variant: "destructive",
      });
      return;
    }
    setShowBundleDialog(true);
  };

  const confirmCreateBundle = () => {
    createBundleMutation.mutate({ orderIds: selectedOrders });
  };

  const handleUnbundle = (bundleId: string) => {
    unbundleMutation.mutate(bundleId);
  };

  const handleCancelBundle = (bundleId: string) => {
    cancelBundleMutation.mutate({ bundleId, relist: relistOption });
  };

  if (metricsLoading || ordersLoading || bundlesLoading) {
    return (
      <div className="py-6">
        <div className="px-4 sm:px-6 md:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-48 mb-8"></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded"></div>
              ))}
            </div>
            <div className="h-96 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state with retry functionality
  if (metricsIsError || ordersIsError || bundlesIsError) {
    const errors = [];
    if (metricsIsError) errors.push("metrics");
    if (ordersIsError) errors.push("orders");
    if (bundlesIsError) errors.push("bundles");
    
    return (
      <div className="py-6">
        <div className="px-4 sm:px-6 md:px-8">
          <Card className="max-w-md mx-auto mt-8">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-destructive text-5xl mb-4">⚠️</div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Failed to Load Shipping Data
                </h2>
                <p className="text-muted-foreground mb-4">
                  {ordersError?.message || metricsError?.message || bundlesError?.message || 
                   `Something went wrong while loading your ${errors.join(", ")}. Please try again.`}
                </p>
                <div className="flex gap-2 justify-center">
                  {metricsIsError && (
                    <Button 
                      onClick={() => refetchMetrics()}
                      variant="outline"
                      size="sm"
                      data-testid="button-retry-metrics"
                    >
                      Retry Metrics
                    </Button>
                  )}
                  {ordersIsError && (
                    <Button 
                      onClick={() => refetchOrders()}
                      variant="outline"
                      size="sm"
                      data-testid="button-retry-orders"
                    >
                      Retry Orders
                    </Button>
                  )}
                  {bundlesIsError && (
                    <Button 
                      onClick={() => refetchBundles()}
                      variant="outline"
                      size="sm"
                      data-testid="button-retry-bundles"
                    >
                      Retry Bundles
                    </Button>
                  )}
                  <Button 
                    onClick={() => {
                      refetchMetrics();
                      refetchOrders();
                      refetchBundles();
                    }}
                    data-testid="button-retry-all"
                  >
                    Retry All
                  </Button>
                </div>
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
          <h1
            className="text-2xl font-bold text-foreground"
            data-testid="text-shipments-title"
          >
            Shipments
          </h1>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              View shipments by live show or marketplace
            </p>
            <div className="text-sm text-muted-foreground">
              {format(new Date(), "MM/dd/yyyy 'at' h:mm a")} • Shipping Complete
            </div>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="mb-8">
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="border-2 border-accent bg-accent/10">
              <CardContent className="p-4 text-center">
                <div
                  className="text-lg font-bold text-foreground"
                  data-testid="metric-total-sold"
                >
                  ${metrics?.totalSold || "0"}
                </div>
                <div className="text-xs text-muted-foreground">Total Sold</div>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardContent className="p-4 text-center">
                <div
                  className="text-lg font-bold text-foreground"
                  data-testid="metric-total-earned"
                >
                  ${metrics?.totalEarned || "0"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total Earned (Paid Out)
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardContent className="p-4 text-center">
                <div
                  className="text-lg font-bold text-foreground"
                  data-testid="metric-shipping-spend"
                >
                  ${metrics?.totalShippingSpend || "0"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total Shipping Spend
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardContent className="p-4 text-center">
                <div
                  className="text-lg font-bold text-foreground"
                  data-testid="metric-items-sold"
                >
                  {metrics?.itemsSold || 0}
                </div>
                <div className="text-xs text-muted-foreground">Items sold</div>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardContent className="p-4 text-center">
                <div
                  className="text-lg font-bold text-foreground"
                  data-testid="metric-total-delivered"
                >
                  {metrics?.totalDelivered || 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total Delivered
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardContent className="p-4 text-center">
                <div
                  className="text-lg font-bold text-foreground"
                  data-testid="metric-pending-delivery"
                >
                  {metrics?.pendingDelivery || 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  Pending Delivery
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Filter Tabs and Customer Dropdown */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1">
              <Tabs
                value={statusFilter}
                onValueChange={handleStatusFilterChange}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5">
                  <TabsTrigger value="all" data-testid="tab-all" onClick={() => handleTabClick("all")}>
                    All
                  </TabsTrigger>
                  <TabsTrigger value="processing" data-testid="tab-processing" onClick={() => handleTabClick("processing")}>
                    Need Label
                  </TabsTrigger>
                  <TabsTrigger
                    value="ready_to_ship"
                    data-testid="tab-ready-to-ship"
                    onClick={() => handleTabClick("ready_to_ship")}
                  >
                    Ready to Ship
                  </TabsTrigger>
                  <TabsTrigger value="shipped" data-testid="tab-shipped" onClick={() => handleTabClick("shipped")}>
                    Shipped
                  </TabsTrigger>
                  <TabsTrigger value="cancelled" data-testid="tab-cancelled" onClick={() => handleTabClick("cancelled")}>
                    Cancelled
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

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
          </div>
        </div>

        {/* Search and Actions */}
        <div className="mb-6">
          <div className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-muted-foreground">
                1-{displayItems.length} of {displayItems.length}
              </div>
              {selectedOrders.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedOrders.length} selected
                  </span>
                  <Dialog
                    open={showBundleDialog}
                    onOpenChange={setShowBundleDialog}
                  >
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCreateBundle}
                        disabled={selectedOrders.length < 2}
                        data-testid="button-create-bundle"
                      >
                        <Package2 size={14} className="mr-1" />
                        Bundle ({selectedOrders.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Shipment Bundle</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <label
                            htmlFor="bundleName"
                            className="text-sm font-medium"
                          >
                            Bundle Name
                          </label>
                          <Input
                            id="bundleName"
                            value={bundleName}
                            onChange={(e) => setBundleName(e.target.value)}
                            placeholder="Enter bundle name"
                            className="mt-1"
                            data-testid="input-bundle-name"
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            onClick={() => setShowBundleDialog(false)}
                            data-testid="button-cancel-bundle"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={confirmCreateBundle}
                            disabled={createBundleMutation.isPending}
                            data-testid="button-confirm-bundle"
                          >
                            Create Bundle
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
                <Input
                  placeholder="Username, order ID, shipping carrier"
                  className="pl-10 w-80"
                  data-testid="input-search-shipments"
                />
              </div>
            </div>
          </div>

          {/* Shipments Table */}
          <Card className="shadow border border-border w-full">
            <CardContent className="p-0">
              <table className="w-full border-collapse divide-y divide-border text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-3 text-left w-10">
                      <Checkbox
                        checked={
                          selectedOrders.length ===
                            unbundledOrders.filter(
                              (order) => order.status === "processing",
                            ).length &&
                          unbundledOrders.filter(
                            (order) => order.status === "processing",
                          ).length > 0
                        }
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all-shipments"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Customer
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-24">
                      Order ID
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-24">
                      Order Info
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-24">
                      Dimensions
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-28">
                      Status
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-20">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {displayItems.map((item) => {
                    const isBundle = "isBundle" in item && item.isBundle;

                    if (isBundle) {
                      const bundle = item as ShipmentBundle & {
                        isBundle: true;
                      };
                      // Get the actual orders that belong to this bundle (use unfiltered orders)
                      const bundleOrders: IconaOrder[] =
                        allOrders?.filter(
                          (order) => order.bundleId === bundle.id,
                        ) || [];
                      const bundleStatus = getBundleStatus(bundle.id);
                      const totalItems = bundleOrders.reduce(
                        (sum, order) => sum + 1,
                        0,
                      ); // Each order is 1 item
                      const totalValue = bundleOrders.reduce((sum, order) => {
                        const orderTotal =
                          (order.total || 0) +
                          (order.tax || 0) +
                          (order.shipping_fee || 0);
                        return sum + orderTotal;
                      }, 0);

                      return (
                        <React.Fragment key={bundle.id}>
                          <tr data-testid={`row-bundle-${bundle.id}`}>
                            <td className="px-3 py-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleOrderExpansion(bundle.id)}
                                className="p-1 h-5 w-5"
                                data-testid={`button-expand-${bundle.id}`}
                              >
                                {expandedOrders.includes(bundle.id) ? (
                                  <ChevronDown size={12} />
                                ) : (
                                  <ChevronRight size={12} />
                                )}
                              </Button>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center">
                                <div className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-1 rounded mr-1">
                                  BUNDLE
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-foreground truncate">
                                    {bundle.bundleName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {format(
                                      new Date(bundle.createdAt),
                                      "MM/dd",
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-center">
                                <div className="text-sm text-foreground font-medium">
                                  #{bundle.id.slice(-8)}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-center">
                                <div className="text-sm text-foreground font-medium">
                                  {totalItems}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  ${totalValue.toFixed(2)}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-center text-sm text-muted-foreground">
                                <div>{bundle.totalWeight || "-"}</div>
                                <div className="text-xs">
                                  {(() => {
                                    const firstOrder = bundleOrders[0];
                                    if (!firstOrder) return "-";

                                    // Try giveaway dimensions first
                                    if (
                                      firstOrder.giveaway?.length &&
                                      firstOrder.giveaway?.width &&
                                      firstOrder.giveaway?.height
                                    ) {
                                      return `${firstOrder.giveaway.length}" × ${firstOrder.giveaway.width}" × ${firstOrder.giveaway.height}"`;
                                    }

                                    // Try first item dimensions
                                    if (
                                      firstOrder.items &&
                                      firstOrder.items.length > 0
                                    ) {
                                      const firstItem = firstOrder.items[0];
                                      if (
                                        firstItem.length &&
                                        firstItem.width &&
                                        firstItem.height
                                      ) {
                                        return `${firstItem.length}" × ${firstItem.width}" × ${firstItem.height}"`;
                                      }
                                    }

                                    // Fall back to 12x12x12 for bundles
                                    return '12" × 12" × 12"';
                                  })()}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div>
                                <Badge
                                  className={`text-xs ${
                                    bundleStatus === "processing"
                                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                      : bundleStatus === "ready_to_ship"
                                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                        : bundleStatus === "shipped"
                                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                          : bundleStatus === "cancelled"
                                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                                  }`}
                                  data-testid={`bundle-status-${bundleStatus}`}
                                >
                                  {bundleStatus
                                    .replaceAll("_", " ")
                                    .toUpperCase()}
                                </Badge>
                                {(() => {
                                  // For bundles, display the tracking number of the first order
                                  const firstOrder = bundleOrders[0];
                                  const trackingNumber =
                                    firstOrder?.tracking_number;

                                  if (trackingNumber) {
                                    return (
                                      <div
                                        className="text-xs text-primary font-mono mt-1 cursor-pointer hover:bg-primary/10 px-1 py-0.5 rounded transition-colors"
                                        onClick={() => {
                                          navigator.clipboard.writeText(
                                            trackingNumber,
                                          );
                                          toast({
                                            title: "Copied!",
                                            description:
                                              "Bundle tracking number copied to clipboard",
                                          });
                                        }}
                                        title="Click to copy bundle tracking number"
                                        data-testid={`bundle-tracking-number-${bundle.id}`}
                                      >
                                        {trackingNumber}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      data-testid={`button-bundle-menu-${bundle.id}`}
                                    >
                                      <MoreHorizontal size={16} />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {/* View/Edit bundle option for processing bundles */}
                                    {bundleOrders[0]?.status ===
                                      "processing" && (
                                      <ShippingDrawer
                                        bundle={{
                                          ...bundle,
                                          orders: bundleOrders,
                                        }}
                                      >
                                        <DropdownMenuItem
                                          onSelect={(e) => e.preventDefault()}
                                        >
                                          <Eye size={14} className="mr-2" />
                                          View Bundle Details
                                        </DropdownMenuItem>
                                      </ShippingDrawer>
                                    )}

                                    {/* Ship option for ready_to_ship bundles */}
                                    {bundleStatus === "ready_to_ship" && (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          shipBundleMutation.mutate(bundle.id)
                                        }
                                        disabled={shipBundleMutation.isPending}
                                        data-testid={`menu-ship-bundle-${bundle.id}`}
                                      >
                                        <Ship size={14} className="mr-2" />
                                        {shipBundleMutation.isPending
                                          ? "Shipping..."
                                          : "Mark Bundle as Shipped"}
                                      </DropdownMenuItem>
                                    )}

                                    {/* Print label option when tracking exists */}
                                    {(bundleOrders[0]?.label ||
                                      bundleOrders[0]?.tracking_number ||
                                      bundleOrders[0]?.shipping_label_url) && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          const firstOrder = bundleOrders[0];
                                          const url =
                                            firstOrder.label ??
                                            firstOrder.shipping_label_url ??
                                            firstOrder.tracking_link;
                                          if (url) {
                                            window.open(url, "_blank");
                                          } else {
                                            toast({
                                              title: "No label found",
                                              description:
                                                "This bundle doesn't have a shipping label yet.",
                                              variant: "destructive",
                                            });
                                          }
                                        }}
                                        data-testid={`menu-print-bundle-${bundle.id}`}
                                      >
                                        <Printer size={14} className="mr-2" />
                                        Print Bundle Label
                                      </DropdownMenuItem>
                                    )}

                                    {/* Unbundle option for processing bundles */}
                                    {bundleStatus === "processing" && (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          handleUnbundle(bundle.id)
                                        }
                                        disabled={unbundleMutation.isPending}
                                        data-testid={`menu-unbundle-${bundle.id}`}
                                      >
                                        <Unlink2 size={14} className="mr-2" />
                                        {unbundleMutation.isPending
                                          ? "Unbundling..."
                                          : "Unbundle Orders"}
                                      </DropdownMenuItem>
                                    )}

                                    {/* Cancel bundle option for non-cancelled/shipped bundles */}
                                    {bundleStatus !== "cancelled" &&
                                      bundleStatus !== "shipped" && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <AlertDialog
                                            onOpenChange={(open) => {
                                              if (!open) {
                                                setCancelOrderId(null);
                                                setRelistOption(false);
                                              }
                                            }}
                                          >
                                            <AlertDialogTrigger asChild>
                                              <DropdownMenuItem
                                                onSelect={(e) =>
                                                  e.preventDefault()
                                                }
                                                className="text-red-600"
                                                data-testid={`menu-cancel-bundle-${bundle.id}`}
                                                onClick={() =>
                                                  setCancelOrderId(bundle.id)
                                                }
                                              >
                                                <X size={14} className="mr-2" />
                                                Cancel Bundle
                                              </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>
                                                  Cancel Bundle
                                                </AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  Are you sure you want to
                                                  cancel bundle #
                                                  {bundle.id.slice(-8)}? This
                                                  will cancel all{" "}
                                                  {bundleOrders.length} orders
                                                  in this bundle. This action
                                                  cannot be undone.
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>

                                              <div className="flex items-center space-x-2 my-4">
                                                <Checkbox
                                                  id={`relist-bundle-${bundle.id}`}
                                                  checked={relistOption}
                                                  onCheckedChange={(checked) =>
                                                    setRelistOption(
                                                      Boolean(checked === true),
                                                    )
                                                  }
                                                  data-testid={`checkbox-relist-bundle-${bundle.id}`}
                                                />
                                                <label
                                                  htmlFor={`relist-bundle-${bundle.id}`}
                                                  className="text-sm"
                                                >
                                                  Relist these orders for future
                                                  processing
                                                </label>
                                              </div>

                                              <AlertDialogFooter>
                                                <AlertDialogCancel
                                                  onClick={() => {
                                                    setCancelOrderId(null);
                                                    setRelistOption(false);
                                                  }}
                                                  data-testid={`button-keep-bundle-${bundle.id}`}
                                                >
                                                  Keep Bundle
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                  onClick={() =>
                                                    handleCancelBundle(
                                                      bundle.id,
                                                    )
                                                  }
                                                  disabled={
                                                    cancelBundleMutation.isPending
                                                  }
                                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                                                  data-testid={`button-confirm-cancel-bundle-${bundle.id}`}
                                                >
                                                  {cancelBundleMutation.isPending
                                                    ? "Cancelling Bundle..."
                                                    : "Cancel Bundle"}
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        </>
                                      )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded row showing bundled orders */}
                          {expandedOrders.includes(bundle.id) && (
                            <tr
                              className="bg-muted/50"
                              data-testid={`expanded-bundle-${bundle.id}`}
                            >
                              <td colSpan={7} className="px-3 py-3">
                                <div className="bg-card rounded-lg p-4 border">
                                  <h4 className="font-medium text-sm mb-3 text-foreground">
                                    Orders in this bundle:
                                  </h4>
                                  <div className="space-y-2">
                                    {bundleOrders.map((order) => (
                                      <div
                                        key={order._id}
                                        className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                                      >
                                        <div className="flex items-center space-x-3">
                                          <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center">
                                            <Package2 size={12} />
                                          </div>
                                          <div>
                                            <p className="font-medium text-foreground">
                                              {typeof order.customer ===
                                              "string"
                                                ? order.customer
                                                : `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() ||
                                                  "Unknown Customer"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              Order: #
                                              {order.invoice ||
                                                order._id.slice(-8)}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-medium text-foreground">
                                            $
                                            {(
                                              (order.total || 0) +
                                              (order.tax || 0) +
                                              (order.shipping_fee || 0)
                                            ).toFixed(2)}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {order.items?.reduce(
                                              (sum, item) =>
                                                sum + (item.quantity || 0),
                                              0,
                                            ) || 1}{" "}
                                            items
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-3 pt-3 border-t border-border flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">
                                      Total orders: {bundleOrders.length}
                                    </span>
                                    <span className="font-medium text-foreground">
                                      Total value: ${totalValue.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    } else {
                      const order = item as IconaOrder;

                      return (
                        <React.Fragment key={order._id}>
                          <tr data-testid={`row-shipment-${order._id}`}>
                            <td className="px-3 py-3">
                              <Checkbox
                                checked={selectedOrders.includes(order._id)}
                                onCheckedChange={(checked) =>
                                  handleSelectOrder(
                                    order._id,
                                    checked as boolean,
                                  )
                                }
                                data-testid={`checkbox-shipment-${order._id}`}
                                disabled={order.status !== "processing"}
                                className={
                                  order.status !== "processing"
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                }
                              />
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    toggleOrderExpansion(order._id)
                                  }
                                  className="p-1 h-5 w-5 mr-1"
                                  data-testid={`button-expand-${order._id}`}
                                >
                                  {expandedOrders.includes(order._id) ? (
                                    <ChevronDown size={12} />
                                  ) : (
                                    <ChevronRight size={12} />
                                  )}
                                </Button>
                                <div>
                                  <div className="flex items-center">
                                    {order.status === "delivered" && (
                                      <div className="text-xs bg-accent text-accent-foreground px-1 rounded mr-1">
                                        NEW
                                      </div>
                                    )}
                                    <span className="text-sm font-medium text-foreground">
                                      {order.customer?.firstName || "Unknown"}{" "}
                                      {order.customer?.lastName || ""}
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {order.createdAt
                                      ? format(
                                          new Date(order.createdAt),
                                          "MM/dd",
                                        )
                                      : format(
                                          new Date(order.date || 0),
                                          "MM/dd",
                                        )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-center">
                                <div className="text-sm text-foreground font-medium">
                                  #{order.invoice || order._id.slice(-8)}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-center">
                                <div className="text-sm text-foreground font-medium">
                                  Items: $
                                  {(() => {
                                    // For non-giveaway orders, calculate from items array
                                    if (!order.giveaway && order.items) {
                                      const itemsSubtotal = order.items.reduce((sum, item) => {
                                        const quantity = item.quantity || 0;
                                        const price = item.price || 0;
                                        return sum + (quantity * price);
                                      }, 0);
                                      return (itemsSubtotal + (order.tax || 0)).toFixed(2);
                                    }
                                    // For giveaway orders, use order total
                                    return ((order.total || 0) + (order.tax || 0)).toFixed(2);
                                  })()}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Shipping: ${(order.shipping_fee || 0).toFixed(2)}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-center text-sm text-muted-foreground">
                                <div className="text-xs">
                                  {order.giveaway?.shipping_profile?.weight
                                    ? `${order.giveaway.shipping_profile.weight}${order.giveaway.shipping_profile.scale || "oz"}`
                                    : order.items &&
                                        order.items.length > 0 &&
                                        order.items[0].weight
                                      ? `${order.items[0].weight}${order.items[0].scale || "oz"}`
                                      : "-"}
                                </div>
                                <div className="text-xs">
                                  {order.giveaway
                                    ? "Giveaway"
                                    : order.items &&
                                        order.items.length > 0 &&
                                        order.items[0].height &&
                                        order.items[0].width &&
                                        order.items[0].length
                                      ? `${order.items[0].height}×${order.items[0].width}×${order.items[0].length}"`
                                      : "-"}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div>
                                <Badge
                                  className={`${statusColors[order.status as keyof typeof statusColors]} text-xs`}
                                  data-testid={`shipment-status-${order.status}`}
                                >
                                  {order.status === "delivered"
                                    ? "Delivered"
                                    : order.status
                                      ? order.status
                                          .replaceAll("_", " ")
                                          .charAt(0)
                                          .toUpperCase() +
                                        order.status
                                          .replaceAll("_", " ")
                                          .slice(1)
                                      : "Unknown"}
                                </Badge>
                                {order.tracking_number && (
                                  <div
                                    className="text-xs text-primary font-mono mt-1 cursor-pointer hover:bg-primary/10 px-1 py-0.5 rounded transition-colors"
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        order.tracking_number!,
                                      );
                                      toast({
                                        title: "Copied!",
                                        description:
                                          "Tracking number copied to clipboard",
                                      });
                                    }}
                                    title="Click to copy tracking number"
                                    data-testid={`tracking-number-${order._id}`}
                                  >
                                    {order.tracking_number}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      data-testid={`button-order-menu-${order._id}`}
                                    >
                                      <MoreHorizontal size={16} />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {/* Edit/Ship Label option for processing orders */}
                                    {order.status === "processing" && (
                                      <ShippingDrawer order={order}>
                                        <DropdownMenuItem
                                          onSelect={(e) => e.preventDefault()}
                                        >
                                          <Edit size={14} className="mr-2" />
                                          Edit Shipment
                                        </DropdownMenuItem>
                                      </ShippingDrawer>
                                    )}

                                    {/* Ship option for ready_to_ship orders */}
                                    {order.status === "ready_to_ship" && (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          shipOrderMutation.mutate(order._id)
                                        }
                                        disabled={shipOrderMutation.isPending}
                                        data-testid={`menu-ship-${order._id}`}
                                      >
                                        <Ship size={14} className="mr-2" />
                                        {shipOrderMutation.isPending
                                          ? "Shipping..."
                                          : "Mark as Shipped"}
                                      </DropdownMenuItem>
                                    )}

                                    {/* Print label option when tracking exists */}
                                    {order.tracking_number && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          const url =
                                            order.label ??
                                            order.shipping_label_url ??
                                            order.tracking_link;
                                          if (url) {
                                            window.open(url, "_blank");
                                          } else {
                                            toast({
                                              title: "No label found",
                                              description:
                                                "This order doesn't have a shipping label yet.",
                                              variant: "destructive",
                                            });
                                          }
                                        }}
                                        data-testid={`menu-print-${order._id}`}
                                      >
                                        <Printer size={14} className="mr-2" />
                                        Print Label
                                      </DropdownMenuItem>
                                    )}

                                    {/* Cancel option for processing and ready_to_ship orders */}
                                    {(order.status === "processing" ||
                                      order.status === "ready_to_ship") &&
                                      canCancelOrder(
                                        order.status || "processing",
                                      ) && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <AlertDialog
                                            onOpenChange={(open) => {
                                              if (!open) {
                                                setCancelOrderId(null);
                                                setRelistOption(false);
                                              }
                                            }}
                                          >
                                            <AlertDialogTrigger asChild>
                                              <DropdownMenuItem
                                                onSelect={(e) =>
                                                  e.preventDefault()
                                                }
                                                className="text-red-600"
                                                data-testid={`menu-cancel-${order._id}`}
                                                onClick={() =>
                                                  setCancelOrderId(order._id)
                                                }
                                              >
                                                <X size={14} className="mr-2" />
                                                Cancel Order
                                              </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>
                                                  Cancel Order
                                                </AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  Are you sure you want to
                                                  cancel order #
                                                  {order.invoice ||
                                                    order._id.slice(-8)}
                                                  ? This action cannot be
                                                  undone.
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>

                                              <div className="flex items-center space-x-2 my-4">
                                                <Checkbox
                                                  id={`relist-${order._id}`}
                                                  checked={relistOption}
                                                  onCheckedChange={(checked) =>
                                                    setRelistOption(
                                                      Boolean(checked === true),
                                                    )
                                                  }
                                                  data-testid={`checkbox-relist-${order._id}`}
                                                />
                                                <label
                                                  htmlFor={`relist-${order._id}`}
                                                  className="text-sm"
                                                >
                                                  Relist this order for future
                                                  processing
                                                </label>
                                              </div>

                                              <AlertDialogFooter>
                                                <AlertDialogCancel
                                                  onClick={() => {
                                                    setCancelOrderId(null);
                                                    setRelistOption(false);
                                                  }}
                                                  data-testid={`button-keep-order-${order._id}`}
                                                >
                                                  Keep Order
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                  onClick={handleCancelOrder}
                                                  disabled={
                                                    cancelOrderMutation.isPending
                                                  }
                                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                                                  data-testid={`button-confirm-cancel-${order._id}`}
                                                >
                                                  {cancelOrderMutation.isPending
                                                    ? "Cancelling..."
                                                    : "Cancel Order"}
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        </>
                                      )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded row showing item details */}
                          {expandedOrders.includes(order._id) && (
                            <tr
                              className="bg-muted/50"
                              data-testid={`expanded-row-${order._id}`}
                            >
                              <td colSpan={7} className="px-3 py-3">
                                <div className="bg-card rounded-lg p-4 border">
                                  <h4 className="font-medium text-sm mb-3 text-foreground">
                                    Items in this shipment:
                                  </h4>
                                  <div className="space-y-2">
                                    {order.giveaway ? (
                                      <HoverCard>
                                        <HoverCardTrigger asChild>
                                          <div className="flex items-center justify-between p-2 bg-muted rounded text-sm cursor-pointer hover:bg-muted/80 transition-colors">
                                            <div className="flex items-center space-x-3">
                                              <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded flex items-center justify-center overflow-hidden">
                                                {order.giveaway.images?.[0] ? (
                                                  <img
                                                    src={
                                                      order.giveaway.images[0]
                                                    }
                                                    alt={order.giveaway.name}
                                                    className="w-full h-full object-cover rounded"
                                                  />
                                                ) : (
                                                  <span className="text-xs font-medium text-pink-800 dark:text-pink-400">
                                                    🎁
                                                  </span>
                                                )}
                                              </div>
                                              <div>
                                                <p className="font-medium text-foreground">
                                                  <span className="flex items-center gap-2">
                                                    <span className="text-xs bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400 px-1 rounded">
                                                      GIVEAWAY
                                                    </span>
                                                    {order.giveaway.name}
                                                  </span>
                                                </p>
                                                {order.giveaway.category
                                                  ?.name && (
                                                  <p className="text-xs text-muted-foreground/70 italic">
                                                    {
                                                      order.giveaway.category
                                                        .name
                                                    }
                                                  </p>
                                                )}
                                                <p className="text-xs text-muted-foreground">
                                                  Quantity:{" "}
                                                  {order.giveaway.quantity || 1}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <p className="font-medium text-foreground">
                                                Free
                                              </p>
                                              <p className="text-xs text-muted-foreground">
                                                giveaway item
                                              </p>
                                            </div>
                                          </div>
                                        </HoverCardTrigger>
                                        <HoverCardContent
                                          className="w-80 p-4"
                                          side="right"
                                        >
                                          <div className="space-y-4">
                                            <div className="flex items-start space-x-4">
                                              <div className="w-24 h-24 bg-pink-100 dark:bg-pink-900/30 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {order.giveaway.images?.[0] ? (
                                                  <img
                                                    src={
                                                      order.giveaway.images[0]
                                                    }
                                                    alt={order.giveaway.name}
                                                    className="w-full h-full object-cover rounded-lg"
                                                  />
                                                ) : (
                                                  <Package2 className="h-8 w-8 text-pink-800 dark:text-pink-400" />
                                                )}
                                              </div>
                                              <div className="flex-1 space-y-2">
                                                <h4 className="font-semibold text-foreground flex items-center gap-2">
                                                  <span className="text-xs bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400 px-1 rounded">
                                                    GIVEAWAY
                                                  </span>
                                                  {order.giveaway.name}
                                                </h4>
                                                {order.giveaway.category
                                                  ?.name && (
                                                  <p className="text-sm text-muted-foreground">
                                                    <span className="font-medium">
                                                      Category:
                                                    </span>{" "}
                                                    {
                                                      order.giveaway.category
                                                        .name
                                                    }
                                                  </p>
                                                )}
                                                <p className="text-sm text-muted-foreground">
                                                  <span className="font-medium">
                                                    Quantity:
                                                  </span>{" "}
                                                  {order.giveaway.quantity || 1}
                                                </p>
                                                {order.giveaway
                                                  ?.shipping_profile
                                                  ?.weight && (
                                                  <p className="text-sm text-muted-foreground">
                                                    <span className="font-medium">
                                                      Weight:
                                                    </span>{" "}
                                                    {
                                                      order.giveaway
                                                        .shipping_profile.weight
                                                    }{" "}
                                                    {order.giveaway
                                                      .shipping_profile.scale ||
                                                      "oz"}
                                                  </p>
                                                )}
                                                {order.giveaway.description && (
                                                  <p className="text-sm text-muted-foreground">
                                                    <span className="font-medium">
                                                      Description:
                                                    </span>{" "}
                                                    {order.giveaway.description}
                                                  </p>
                                                )}
                                                <p className="text-sm font-medium text-foreground">
                                                  <span className="text-muted-foreground">
                                                    Price:
                                                  </span>{" "}
                                                  Free (Giveaway)
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        </HoverCardContent>
                                      </HoverCard>
                                    ) : order.items &&
                                      order.items.length > 0 ? (
                                      order.items.map((item, index) => (
                                        <HoverCard key={item._id || index}>
                                          <HoverCardTrigger asChild>
                                            <div className="flex items-center justify-between p-2 bg-muted rounded text-sm cursor-pointer hover:bg-muted/80 transition-colors">
                                              <div className="flex items-center space-x-3">
                                                <div className="w-12 h-12 bg-primary/20 rounded flex items-center justify-center overflow-hidden">
                                                  {item.productId
                                                    ?.images?.[0] ? (
                                                    <img
                                                      src={
                                                        item.productId.images[0]
                                                      }
                                                      alt={
                                                        item.productId.name ||
                                                        "Product"
                                                      }
                                                      className="w-full h-full object-cover rounded"
                                                    />
                                                  ) : (
                                                    <span className="text-xs font-medium">
                                                      {index + 1}
                                                    </span>
                                                  )}
                                                </div>
                                                <div>
                                                  <p className="font-medium text-foreground">
                                                    {item.productId?.name ||
                                                      "Item"}
                                                  </p>
                                                  {item.productId?.category
                                                    ?.name && (
                                                    <p className="text-xs text-muted-foreground/70 italic">
                                                      {
                                                        item.productId.category
                                                          .name
                                                      }
                                                    </p>
                                                  )}
                                                  <p className="text-xs text-muted-foreground">
                                                    Quantity:{" "}
                                                    {item.quantity || 1}
                                                  </p>
                                                </div>
                                              </div>
                                              <div className="text-right">
                                                <p className="font-medium text-foreground">
                                                  $
                                                  {(item.price || 0).toFixed(2)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                  per item
                                                </p>
                                              </div>
                                            </div>
                                          </HoverCardTrigger>
                                          <HoverCardContent
                                            className="w-80 p-4"
                                            side="right"
                                          >
                                            <div className="space-y-4">
                                              <div className="flex items-start space-x-4">
                                                <div className="w-24 h-24 bg-primary/20 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                                                  {item.productId
                                                    ?.images?.[0] ? (
                                                    <img
                                                      src={
                                                        item.productId.images[0]
                                                      }
                                                      alt={
                                                        item.productId.name ||
                                                        "Product"
                                                      }
                                                      className="w-full h-full object-cover rounded-lg"
                                                    />
                                                  ) : (
                                                    <Package2 className="h-8 w-8 text-muted-foreground" />
                                                  )}
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                  <h4 className="font-semibold text-foreground">
                                                    {item.productId?.name ||
                                                      "Product"}
                                                  </h4>
                                                  {item.productId?.category
                                                    ?.name && (
                                                    <p className="text-sm text-muted-foreground">
                                                      <span className="font-medium">
                                                        Category:
                                                      </span>{" "}
                                                      {
                                                        item.productId.category
                                                          .name
                                                      }
                                                    </p>
                                                  )}
                                                  <p className="text-sm text-muted-foreground">
                                                    <span className="font-medium">
                                                      Quantity:
                                                    </span>{" "}
                                                    {item.quantity || 1}
                                                  </p>
                                                  <p className="text-sm text-muted-foreground">
                                                    <span className="font-medium">
                                                      Price:
                                                    </span>{" "}
                                                    $
                                                    {(item.price || 0).toFixed(
                                                      2,
                                                    )}{" "}
                                                    per item
                                                  </p>
                                                  {(item.height ||
                                                    item.length ||
                                                    item.width) && (
                                                    <p className="text-sm text-muted-foreground">
                                                      <span className="font-medium">
                                                        Dimensions:
                                                      </span>{" "}
                                                      {item.height || "?"}" ×{" "}
                                                      {item.width || "?"}" ×{" "}
                                                      {item.length || "?"}"
                                                    </p>
                                                  )}
                                                  <p className="text-sm font-medium text-foreground">
                                                    <span className="text-muted-foreground">
                                                      Total:
                                                    </span>{" "}
                                                    $
                                                    {(
                                                      (item.price || 0) *
                                                      (item.quantity || 1)
                                                    ).toFixed(2)}
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                          </HoverCardContent>
                                        </HoverCard>
                                      ))
                                    ) : (
                                      <div className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                                        <div className="flex items-center space-x-3">
                                          <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center">
                                            <span className="text-xs font-medium">
                                              ?
                                            </span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-foreground">
                                              {order.ordertype === "auction"
                                                ? "Auction Item"
                                                : order.ordertype === "tokshow"
                                                  ? "Tokshow Item"
                                                  : "Unknown Item"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              No item details available
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-medium text-foreground">
                                            -
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            n/a
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-3 pt-3 border-t border-border flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">
                                      Total items:{" "}
                                      {order.items?.reduce(
                                        (sum, item) =>
                                          sum + (item.quantity || 0),
                                        0,
                                      ) || 1}
                                    </span>
                                    <span className="font-medium text-foreground">
                                      Total value: $
                                      {(
                                        (order.total || 0) +
                                        (order.tax || 0) +
                                        (order.shipping_fee || 0)
                                      ).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    }
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
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
            showingText="shipping items"
            className="bg-white dark:bg-gray-950 rounded-lg border p-4"
          />
        </div>
      </div>
    </div>
  );
}
