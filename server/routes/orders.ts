import type { Express } from "express";
import fetch from "node-fetch";
import { ICONA_API_BASE } from "../utils";
import { z } from "zod";

export function registerOrderRoutes(app: Express) {
  // Get single order by ID (must be before general orders route)
  app.get("/api/orders/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;
      console.log('Fetching single order:', orderId);
      
      // Use query parameter approach like products endpoint since /orders/:id doesn't work
      const url = `${ICONA_API_BASE}/orders/?_id=${orderId}`;
      console.log('Final API URL being called:', url);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (req.session?.accessToken) {
        headers['Authorization'] = `Bearer ${req.session.accessToken}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ 
            success: false,
            error: "Order not found" 
          });
        }
        throw new Error(`Icona API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Order data structure:', Object.keys(data));
      
      // Extract the single order from the orders array (like products endpoint)
      const order = data.orders?.[0] || data.data?.orders?.[0];
      
      if (!order) {
        return res.status(404).json({
          success: false,
          error: "Order not found"
        });
      }
      
      console.log('Order fields:', Object.keys(order));
      console.log('Order items:', order.items?.length || 0);
      if (order.items && order.items[0]) {
        console.log('First item fields:', Object.keys(order.items[0]));
      }
      
      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      console.error('Single order fetch error:', error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch order from Icona API" 
      });
    }
  });

  // Orders proxy
  app.get("/api/orders", async (req, res) => {
    try {
      console.log('Proxying orders request to Icona API');
      console.log('Query params received:', req.query);
      
      // Build query parameters for Icona API
      const queryParams = new URLSearchParams();
      
      // Add userId parameter (this is the key parameter for filtering user's orders)
      if (req.query.userId) {
        queryParams.set('userId', req.query.userId as string);
      }
      
      if (req.query.status && req.query.status !== 'all') {
        queryParams.set('status', req.query.status as string);
      }
      if (req.query.page) {
        queryParams.set('page', req.query.page as string);
      }
      if (req.query.limit) {
        queryParams.set('limit', req.query.limit as string);
      }
      if (req.query.invoice) {
        queryParams.set('invoice', req.query.invoice as string);
      }
      if (req.query.customer) {
        queryParams.set('customer', req.query.customer as string);
      }
      if (req.query.customerId) {
        queryParams.set('customerId', req.query.customerId as string);
      }
      if (req.query.day) {
        queryParams.set('day', req.query.day as string);
      }
      if (req.query.tokshow) {
        queryParams.set('tokshow', req.query.tokshow as string);
      }
      
      const queryString = queryParams.toString();
      const url = `${ICONA_API_BASE}/orders${queryString ? '?' + queryString : ''}`;
      
      console.log('Final API URL being called:', url);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (req.session?.accessToken) {
        headers['Authorization'] = `Bearer ${req.session.accessToken}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Icona API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Orders proxy error:', error);
      res.status(500).json({ error: "Failed to fetch orders from Icona API" });
    }
  });

  // Update order endpoint
  app.patch("/api/orders/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;
      const updateData = req.body;

      console.log('Updating order:', orderId, 'with data:', updateData);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (req.session?.accessToken) {
        headers['Authorization'] = `Bearer ${req.session.accessToken}`;
      }

      const response = await fetch(`${ICONA_API_BASE}/orders/${orderId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to update order in Icona API:', response.status, errorText);
        return res.status(response.status).json({ 
          error: `Failed to update order: ${response.status}`,
          details: errorText
        });
      }

      const updatedOrder = await response.json();
      console.log('Order updated successfully:', updatedOrder);
      res.json(updatedOrder);

    } catch (error) {
      console.error('Order update error:', error);
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  // PUT endpoint for order updates (including cancellation)
  app.put("/api/orders/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;
      const updateData = req.body;

      console.log('PUT updating order:', orderId, 'with data:', updateData);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (req.session?.accessToken) {
        headers['Authorization'] = `Bearer ${req.session.accessToken}`;
      }

      const response = await fetch(`${ICONA_API_BASE}/orders/${orderId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to PUT update order in Icona API:', response.status, errorText);
        return res.status(response.status).json({ 
          error: `Failed to update order: ${response.status}`,
          details: errorText
        });
      }

      const updatedOrder = await response.json();
      console.log('Order PUT updated successfully:', updatedOrder);
      res.json(updatedOrder);

    } catch (error) {
      console.error('Order PUT update error:', error);
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  // Bundle orders endpoint - assigns bundle ID to selected orders
  app.post("/api/orders/bundle/orders", async (req, res) => {
    try {
      const bundleRequestSchema = z.object({
        orderIds: z.array(z.string().min(1, "Order ID cannot be empty")).min(1, "At least one order ID is required"),
      });

      const { orderIds } = bundleRequestSchema.parse(req.body);
      console.log('Creating bundle for orders:', orderIds);

      // Validate that all orders have 'processing' status before bundling
      const fetchHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (req.session?.accessToken) {
        fetchHeaders['Authorization'] = `Bearer ${req.session.accessToken}`;
      }

      const ordersResponse = await fetch(`${ICONA_API_BASE}/orders?userId=${req.query.userId || req.body.userId}`, {
        method: 'GET',
        headers: fetchHeaders
      });

      if (!ordersResponse.ok) {
        return res.status(500).json({
          success: false,
          message: "Failed to validate order status",
          error: "Could not fetch orders for validation"
        });
      }

      const ordersData = await ordersResponse.json() as any;
      const orders = ordersData.orders || [];
      
      // Check that all selected orders have 'processing' status
      const invalidOrders = orderIds.filter(orderId => {
        const order = orders.find((o: any) => o._id === orderId);
        return !order || order.status !== 'processing';
      });

      if (invalidOrders.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Only orders with 'processing' status can be bundled",
          error: `Invalid orders: ${invalidOrders.join(', ')}`
        });
      }

      // Call external API bundling endpoint
      const response = await fetch(`${ICONA_API_BASE}/orders/bundle/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderIds })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('External API bundle creation failed:', response.status, errorText);
        return res.status(response.status).json({
          success: false,
          message: "Failed to create bundle via external API",
          error: errorText
        });
      }

      const bundleResult = await response.json();
      console.log('Bundle created successfully via external API:', bundleResult);

      // Return the result from external API
      res.json({
        success: true,
        message: "Bundle created successfully",
        data: bundleResult
      });

    } catch (error) {
      console.error('Bundle creation error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data",
          details: error.errors 
        });
      }
      res.status(500).json({ error: "Failed to create bundle" });
    }
  });
}