import type { Express } from "express";
import fetch from "node-fetch";
import { ICONA_API_BASE } from "../utils";
import { verifyFirebaseToken } from "../firebase-admin";
import {
  signupSchema,
  loginSchema,
  socialAuthSchema,
  socialAuthCompleteSchema,
  iconaAuthResponseSchema,
  IconaAuthResponse,
  IconaApiErrorResponse,
} from "@shared/schema";

// Resilient fetch helper that handles non-JSON responses gracefully
async function resilientFetch(url: string, options: any) {
  console.log(
    `[Resilient Fetch] Requesting: ${options.method || "GET"} ${url}`,
  );

  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type");

    console.log(
      `[Resilient Fetch] Response: ${response.status} ${response.statusText}`,
    );
    console.log(`[Resilient Fetch] Content-Type: ${contentType}`);

    let responseData;
    if (contentType && contentType.includes("application/json")) {
      try {
        responseData = await response.json();
      } catch (jsonError) {
        console.error(
          "[Resilient Fetch] Failed to parse JSON response:",
          jsonError,
        );
        const textData = await response.text();
        console.error(
          "[Resilient Fetch] Raw response:",
          textData.slice(0, 200),
        );
        throw new Error(`API returned invalid JSON: ${textData.slice(0, 200)}`);
      }
    } else {
      const textData = await response.text();
      console.error(
        `[Resilient Fetch] Non-JSON response received:`,
        textData.slice(0, 200),
      );
      throw new Error(
        `API returned non-JSON response (${contentType}): ${textData.slice(0, 100)}`,
      );
    }

    return { response, data: responseData };
  } catch (error) {
    console.error("[Resilient Fetch] Network/Parse error:", error);
    throw error;
  }
}

export function registerAuthRoutes(app: Express) {
  // Authentication signup proxy
  app.post("/api/auth/signup", async (req, res) => {
    try {
      console.log("Proxying signup request to Icona API");
      console.log("Signup payload received:", {
        ...req.body,
        password: "[REDACTED]",
      });

      // Validate request body using schema
      const validationResult = signupSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const { email, country, firstName, lastName, userName, phone, password } = validationResult.data;

      const { response, data: responseData } = await resilientFetch(
        `${ICONA_API_BASE}/auth/signup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            country,
            firstName,
            lastName,
            userName,
            phone,
            password,
          }),
        },
      );

      if (!response.ok) {
        const errorData = responseData as IconaApiErrorResponse;
        console.error("Icona API signup error:", errorData);

        // Return the actual API message instead of friendly messages
        return res.status(response.status).json({
          success: false,
          message: errorData.message, // Use the actual API message
          error: errorData.message || "Account creation failed. Please try again.", // Fallback for compatibility
          details: errorData,
        });
      }

      // Validate the successful response
      const parseResult = iconaAuthResponseSchema.safeParse(responseData);
      if (!parseResult.success) {
        console.error("Invalid signup response structure:", parseResult.error);
        return res.status(500).json({
          success: false,
          error: "Invalid response from authentication service",
        });
      }

      const data = parseResult.data;
      console.log("Signup successful");

      // Store session data and return access token for header-based persistence
      req.session.user = data.data;
      req.session.accessToken = data.accessToken;

      res.json({
        success: true,
        data: data.data,
        accessToken: data.accessToken, // Return token for localStorage storage
        message: data.message,
      });
    } catch (error) {
      console.error("Signup proxy error:", error);
      
      res.status(500).json({
        success: false,
        error: "Failed to process signup request",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Authentication login proxy
  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log("Proxying login request to Icona API");
      console.log("Login payload received:", {
        ...req.body,
        password: "[REDACTED]",
      });

      // Validate request body using schema
      const validationResult = loginSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const { email, password } = validationResult.data;

      const { response, data: responseData } = await resilientFetch(
        `${ICONA_API_BASE}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        },
      );

      if (!response.ok) {
        const errorData = responseData as IconaApiErrorResponse;
        console.error("Icona API login error:", errorData);

        // Return the actual API message instead of friendly messages
        return res.status(response.status).json({
          success: false,
          message: errorData.message, // Use the actual API message
          error: errorData.message || "Login failed. Please try again.", // Fallback for compatibility
          details: errorData,
        });
      }

      // Validate the successful response
      const parseResult = iconaAuthResponseSchema.safeParse(responseData);
      if (!parseResult.success) {
        console.error("Invalid login response structure:", parseResult.error);
        return res.status(500).json({
          success: false,
          error: "Invalid response from authentication service",
        });
      }

      const data = parseResult.data;
      console.log("Login successful");

      // Store session data and return access token for header-based persistence
      req.session.user = data.data;
      req.session.accessToken = data.accessToken;

      res.json({
        success: true,
        data: data.data,
        accessToken: data.accessToken, // Return token for localStorage storage
        message: data.message,
      });
    } catch (error) {
      console.error("Login proxy error:", error);
      
      res.status(500).json({
        success: false,
        error: "Failed to process login request",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Social authentication proxy (Google/Apple)
  app.post("/api/auth/social", async (req, res) => {
    try {
      console.log("Processing social auth with Firebase token verification");
      console.log("Social auth payload received:", {
        ...req.body,
        idToken: "[REDACTED]",
      });

      // Validate request body using schema
      const validationResult = socialAuthSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const socialAuthData = validationResult.data;

      // Verify Firebase ID token server-side for security
      console.log("Verifying Firebase ID token...");
      const decodedToken = await verifyFirebaseToken(socialAuthData.idToken);
      console.log("Firebase token verified successfully for UID:", decodedToken.uid);

      // Use the verified Firebase data as the authoritative source
      const verifiedSocialAuthData = {
        email: decodedToken.email || socialAuthData.email,
        firstName: socialAuthData.firstName,
        lastName: socialAuthData.lastName,
        userName: socialAuthData.userName,
        type: socialAuthData.type,
        profilePhoto: decodedToken.picture || socialAuthData.profilePhoto,
        country: socialAuthData.country,
        phone: socialAuthData.phone,
        gender: socialAuthData.gender,
      };

      const { response, data: responseData } = await resilientFetch(
        `${ICONA_API_BASE}/auth/social`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(verifiedSocialAuthData),
        },
      );

      if (!response.ok) {
        const errorData = responseData as IconaApiErrorResponse;
        console.error("Icona API social auth error:", errorData);
        return res.status(response.status).json({
          success: false,
          error: errorData.message || "Social authentication failed",
          details: errorData,
        });
      }

      // Validate the successful response
      const parseResult = iconaAuthResponseSchema.safeParse(responseData);
      if (!parseResult.success) {
        console.error("Invalid social auth response structure:", parseResult.error);
        return res.status(500).json({
          success: false,
          error: "Invalid response from authentication service",
        });
      }

      const data = parseResult.data;
      console.log("Social auth successful");

      // Store session data and return access token for header-based persistence
      req.session.user = data.data;
      req.session.accessToken = data.accessToken;

      res.json({
        success: true,
        data: data.data,
        accessToken: data.accessToken, // Return token for localStorage storage
        message: data.message,
        newuser: data.newuser || false,
      });
    } catch (error) {
      console.error("Social auth proxy error:", error);
      
      res.status(500).json({
        success: false,
        error: "Failed to process social auth request",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Social auth completion endpoint for new users
  app.post("/api/auth/social/complete", async (req, res) => {
    try {
      console.log("Proxying social auth completion request to Icona API");
      console.log("Social auth completion payload received:", req.body);

      // Validate request body using the social auth schema (which includes all fields)
      const validationResult = socialAuthSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const socialAuthData = validationResult.data;

      // Call auth endpoint with all user data
      const apiEndpoint = `${ICONA_API_BASE}/auth`;
      const { response, data: responseData } = await resilientFetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: socialAuthData.email,
          firstName: socialAuthData.firstName,
          lastName: socialAuthData.lastName,
          userName: socialAuthData.userName,
          country: socialAuthData.country,
          phone: socialAuthData.phone,
          gender: socialAuthData.gender,
          type: socialAuthData.type,
          profilePhoto: socialAuthData.profilePhoto
        }),
      });

      if (!response.ok) {
        const errorData = responseData as IconaApiErrorResponse;
        console.error("Icona API social auth completion error:", errorData);
        return res.status(response.status).json({
          success: false,
          error: errorData.message || "Social authentication completion failed",
          details: errorData,
        });
      }

      // Validate the successful response
      const parseResult = iconaAuthResponseSchema.safeParse(responseData);
      if (!parseResult.success) {
        console.error("Invalid social auth completion response structure:", parseResult.error);
        return res.status(500).json({
          success: false,
          error: "Invalid response from authentication service",
        });
      }

      const data = parseResult.data;
      console.log("Social auth completion successful");

      // Update session data with the completed user info and return token
      req.session.user = data.data;
      req.session.accessToken = data.accessToken;

      res.json({
        success: true,
        data: data.data,
        accessToken: data.accessToken, // Return token for localStorage storage
        message: data.message || "Profile completed successfully",
      });
    } catch (error) {
      console.error("Social auth completion proxy error:", error);
      
      res.status(500).json({
        success: false,
        error: "Failed to process social auth completion request",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get user data by ID
  app.get("/api/users/:id", async (req, res) => {
    try {
      let requestedUserId = req.params.id;

      // Check for session data instead of Authorization headers
      if (!req.session.user || !req.session.accessToken) {
        return res.status(401).json({
          success: false,
          error: "No active session found",
        });
      }

      const sessionUserId = req.session.user._id || req.session.user.id;

      // Handle special case: "me" resolves to current session user
      if (requestedUserId === "me") {
        requestedUserId = sessionUserId;
      }

      // Security check: Users can only access their own data
      if (requestedUserId !== sessionUserId) {
        return res.status(403).json({
          success: false,
          error: "Access denied: Cannot access other user's data",
        });
      }

      // Return user data from session (no external API call needed)
      res.json({
        success: true,
        data: req.session.user,
        message: "User data retrieved successfully",
      });
    } catch (error) {
      console.error("User data retrieval error:", error);
      
      res.status(500).json({
        success: false,
        error: "Failed to retrieve user data",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", async (req, res) => {
    try {
      // Destroy the session
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destruction error:", err);
          return res.status(500).json({
            success: false,
            error: "Failed to logout",
          });
        }

        // Clear the session cookie
        res.clearCookie("sessionId");
        res.json({
          success: true,
          message: "Logged out successfully",
        });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to logout",
      });
    }
  });

  // Check if user exists by email
  app.get("/api/users/userexists/email", async (req, res) => {
    try {
      const { email } = req.query;

      if (!email || typeof email !== "string") {
        return res.status(400).json({
          success: false,
          error: "Email parameter is required",
        });
      }

      console.log("Checking if user exists with email:", email);

      // Use login attempt with dummy password to check user existence
      const checkPayload = {
        email: email,
        password: "dummy-password-for-existence-check",
      };

      const { response, data } = await resilientFetch(`${ICONA_API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkPayload),
      });

      if (response.ok) {
        // User exists (successful login would mean user exists)
        res.json({
          success: true,
          exists: true,
          message: "User exists",
        });
      } else if (response.status === 400) {
        // Check the error message to determine if user exists but password is wrong
        const errorMessage = (data as any)?.message || "";
        console.log("User existence check error message:", errorMessage);

        if (errorMessage.toLowerCase().includes("user not found")) {
          // User definitely doesn't exist
          res.json({
            success: true,
            exists: false,
            message: "User does not exist",
          });
        } else {
          // User exists but password is wrong (or other validation error)
          res.json({
            success: true,
            exists: true,
            message: "User exists",
          });
        }
      } else {
        // Other error - assume user doesn't exist for safety
        res.json({
          success: true,
          exists: false,
          message: "User does not exist",
        });
      }
    } catch (error) {
      console.error("User existence check error:", error);
      
      res.status(500).json({
        success: false,
        error: "Failed to check user existence",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Admin login proxy - uses different Icona API endpoint
  app.post("/api/admin/auth/login", async (req, res) => {
    try {
      console.log("Proxying admin login request to Icona API");
      console.log("Admin login payload received:", {
        ...req.body,
        password: "[REDACTED]",
      });

      // Validate request body using schema
      const validationResult = loginSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const { email, password } = validationResult.data;

      // Call the admin/login endpoint instead of auth/login
      const { response, data: responseData } = await resilientFetch(
        `${ICONA_API_BASE}/admin/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        },
      );

      if (!response.ok) {
        const errorData = responseData as IconaApiErrorResponse;
        console.error("Icona API admin login error:", errorData);

        // Return the actual API message
        return res.status(response.status).json({
          success: false,
          message: errorData.message,
          error: errorData.message || "Admin login failed. Please try again.",
          details: errorData,
        });
      }

      // Log the raw response for debugging
      console.log("Admin login raw response:", JSON.stringify(responseData).substring(0, 500));

      // Admin endpoint returns different structure: { user, accesstoken } instead of { data, accessToken }
      // Transform to match expected schema
      const adminResponse = responseData as any;
      const normalizedResponse = {
        success: adminResponse.success,
        data: adminResponse.user || adminResponse.data,
        accessToken: adminResponse.accesstoken || adminResponse.accessToken,
        message: adminResponse.message || "Admin login successful"
      };

      // Validate the normalized response
      const parseResult = iconaAuthResponseSchema.safeParse(normalizedResponse);
      if (!parseResult.success) {
        console.error("Invalid admin login response structure:", parseResult.error);
        console.error("Raw response data:", JSON.stringify(responseData).substring(0, 500));
        return res.status(500).json({
          success: false,
          error: "Invalid response from authentication service",
        });
      }

      const data = parseResult.data;
      console.log("Admin login successful, user data:", data.data ? "present" : "missing");

      // Store session data and explicitly mark as admin since they logged in via admin endpoint
      req.session.user = {
        ...data.data,
        admin: true,  // Explicitly set admin flag for admin login
        role: data.data?.role || 'admin'  // Preserve role from API or default to 'admin'
      };
      req.session.accessToken = data.accessToken;

      console.log("Session user set with admin flag:", req.session.user?.admin);
      console.log("Session user role:", req.session.user?.role);

      res.json({
        success: true,
        data: {
          ...data.data,
          admin: true,
          role: data.data?.role || 'admin'
        },
        accessToken: data.accessToken, // Return token to frontend for storage
        message: data.message,
      });
    } catch (error) {
      console.error("Admin login proxy error:", error);
      
      res.status(500).json({
        success: false,
        error: "Failed to process admin login request",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Session validation endpoint
  app.get("/api/auth/session", (req, res) => {
    // Check if token is provided in header for session restoration
    const tokenFromHeader = req.headers['x-admin-token'];
    
    // If session exists, return it
    if (req.session?.user) {
      return res.json({
        success: true,
        data: req.session.user,
      });
    }
    
    // If no session but token exists, try to restore from localStorage user data
    if (tokenFromHeader && req.headers['x-admin-user']) {
      try {
        const userData = JSON.parse(req.headers['x-admin-user'] as string);
        // Restore session
        req.session.user = userData;
        req.session.accessToken = tokenFromHeader as string;
        
        return res.json({
          success: true,
          data: userData,
        });
      } catch (error) {
        console.error('Failed to parse user data from header:', error);
      }
    }
    
    return res.status(401).json({
      success: false,
      error: "No active session",
    });
  });
}