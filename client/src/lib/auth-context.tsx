import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { onAuthStateChange, signInWithGoogle, signInWithApple, firebaseSignOut, handleAuthRedirect } from "./firebase";
import type { User as FirebaseUser } from "firebase/auth";
import { loginSchema, signupSchema, socialAuthSchema, socialAuthCompleteSchema, type LoginData, type SignupData, type SocialAuthData, type SocialAuthCompleteData } from "@shared/schema";
import { apiRequest } from "./queryClient";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePhoto?: string;
  userName?: string;
  country?: string;
  phone?: string;
  seller?: boolean;
  admin?: boolean;
  role?: 'superAdmin' | 'admin';
  authProvider?: 'email' | 'google' | 'apple'; // Track how user signed up
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  pendingSocialAuth: boolean;
  pendingSocialAuthEmail: string | null;
  pendingSocialAuthData: FirebaseUser | null;
  login: (email: string, password: string) => Promise<void>;
  emailLogin: (email: string, password: string) => Promise<void>;
  emailSignup: (email: string, password: string, firstname: string, lastname: string, username: string, phone: string, country: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  completeSocialAuth: (data: SocialAuthCompleteData) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingSocialAuth, setPendingSocialAuth] = useState(false);
  const [pendingSocialAuthEmail, setPendingSocialAuthEmail] = useState<string | null>(null);
  const [pendingSocialAuthData, setPendingSocialAuthData] = useState<FirebaseUser | null>(null);
  const isProcessingRef = useRef(false);

  const isAuthenticated = !!user;

  // Call backend social auth API after successful Firebase auth
  const authenticateWithIcona = async (firebaseUser: FirebaseUser, additionalUserInfo?: any) => {
    try {
      // Get Firebase ID token for server-side verification
      const idToken = await firebaseUser.getIdToken(true);
      
      // Detect provider type based on provider data
      let authType: 'google' | 'apple' | null = null;
      if (firebaseUser.providerData && firebaseUser.providerData.length > 0) {
        if (firebaseUser.providerData.some(p => p.providerId === 'apple.com')) {
          authType = 'apple';
        } else if (firebaseUser.providerData.some(p => p.providerId === 'google.com')) {
          authType = 'google';
        }
      }
      
      // For Apple, try to get provider info from additionalUserInfo if available
      if (!authType && additionalUserInfo?.providerId === 'apple.com') {
        authType = 'apple';
      } else if (!authType && additionalUserInfo?.providerId === 'google.com') {
        authType = 'google';
      }
      
      // If we still can't determine the provider, this is an error condition
      if (!authType) {
        throw new Error('Unable to determine authentication provider');
      }

      // Extract Apple profile data from additionalUserInfo if available (first-time login)
      let firstName = '';
      let lastName = '';
      let email = firebaseUser.email || '';
      
      if (authType === 'apple' && additionalUserInfo?.profile) {
        // Apple provides profile data only on first sign-in
        const profile = additionalUserInfo.profile;
        if (profile.name) {
          firstName = profile.name.firstName || '';
          lastName = profile.name.lastName || '';
        }
        if (profile.email) {
          email = profile.email;
        }
      } else if (authType === 'google' || !additionalUserInfo?.profile) {
        // Google or subsequent Apple logins - use displayName
        firstName = firebaseUser.displayName?.split(' ')[0] || '';
        lastName = firebaseUser.displayName?.split(' ').slice(1).join(' ') || '';
      }
      
      // For Apple users, skip the user existence check and proceed directly to social auth
      // The backend social auth endpoint will handle user creation/login appropriately

      // Prepare social auth data with Firebase verification info
      const socialAuthData = {
        // Firebase verification data (server will use this for identity)
        idToken: idToken,
        uid: firebaseUser.uid,
        // Profile data (server will use verified Firebase data as primary source)
        email: email,
        firstName: firstName,
        lastName: lastName,
        type: authType,
        profilePhoto: firebaseUser.photoURL || '',
        userName: authType === 'apple' ? '' : (email || firebaseUser.uid), // For Apple, don't set userName as email
        country: '',
        phone: '',
        gender: ''
      };

      // Send to backend with Firebase token - let server handle validation and user correlation
      const response = await apiRequest('POST', '/api/auth/social', socialAuthData);

      const iconaResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(iconaResponse.error || `Authentication failed: ${response.status}`);
      }
      
      if (iconaResponse.success) {
        // Check if this is a new user who needs to complete their profile
        // Always show completion form if user doesn't have a username, country, or if marked as new user
        const needsCompletion = iconaResponse.newuser === true || 
                               !iconaResponse.data?.userName || 
                               iconaResponse.data?.userName === iconaResponse.data?.email ||
                               !iconaResponse.data?.country || 
                               iconaResponse.data?.country === '';
        
        if (needsCompletion) {
          // Set pending social auth state instead of completing authentication
          setPendingSocialAuth(true);
          setPendingSocialAuthEmail(firebaseUser.email || '');
          setPendingSocialAuthData(firebaseUser);
          return iconaResponse;
        }

        // Existing user - complete authentication immediately
        const userData = {
          id: iconaResponse.data._id || iconaResponse.data.id,
          email: iconaResponse.data.email,
          firstName: iconaResponse.data.firstName,
          lastName: iconaResponse.data.lastName || '',
          profilePhoto: iconaResponse.data.profilePhoto || firebaseUser.photoURL || '',
          userName: iconaResponse.data.userName,
          country: iconaResponse.data.country || '',
          phone: iconaResponse.data.phone || '',
          seller: iconaResponse.data.seller || false,
          admin: iconaResponse.data.admin || false,
          authProvider: authType as 'google' | 'apple'
        };
        
        setUser(userData);
        // Store complete user data and access token in localStorage for header-based persistence
        localStorage.setItem('userId', userData.id);
        localStorage.setItem('user', JSON.stringify(userData));
        if (iconaResponse.accessToken) {
          localStorage.setItem('accessToken', iconaResponse.accessToken);
        }
        // Clear any pending auth state
        setPendingSocialAuth(false);
        setPendingSocialAuthEmail(null);
        setPendingSocialAuthData(null);
      } else {
        throw new Error(iconaResponse.message || 'Authentication failed');
      }

      return iconaResponse;
    } catch (error: any) {
      console.error('Authentication failed:', error?.message || error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    return await emailLogin(email, password);
  };

  const emailLogin = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Validate input using schema
      const validatedData = loginSchema.parse({ email, password });
      
      const response = await apiRequest('POST', '/api/auth/login', validatedData);
      const loginResponse = await response.json();
      
      if (loginResponse.success) {
        // Set user data from login response
        const userData = {
          id: loginResponse.data._id || loginResponse.data.id,
          email: loginResponse.data.email,
          firstName: loginResponse.data.firstName,
          lastName: loginResponse.data.lastName || '',
          profilePhoto: loginResponse.data.profilePhoto || '',
          userName: loginResponse.data.userName,
          country: loginResponse.data.country || '',
          phone: loginResponse.data.phone || '',
          seller: loginResponse.data.seller || false,
          admin: loginResponse.data.admin || false,
          authProvider: 'email' as const
        };
        
        setUser(userData);
        // Store complete user data and access token in localStorage for header-based persistence
        localStorage.setItem('userId', userData.id);
        localStorage.setItem('user', JSON.stringify(userData));
        if (loginResponse.accessToken) {
          localStorage.setItem('accessToken', loginResponse.accessToken);
        }
      } else {
        // Use the actual API message first, fallback to friendly error, then generic message
        const apiMessage = loginResponse.message || loginResponse.error || 'Login failed';
        throw new Error(apiMessage);
      }
    } catch (error: any) {
      console.error('Email login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const emailSignup = async (email: string, password: string, firstName: string, lastName: string, userName: string, phone: string, country: string) => {
    try {
      setIsLoading(true);
      
      // Validate input using schema
      const validatedData = signupSchema.parse({ email, password, firstName, lastName, userName, phone, country });
      
      const response = await apiRequest('POST', '/api/auth/signup', validatedData);
      const signupResponse = await response.json();
      
      if (signupResponse.success) {
        // Set user data from signup response
        const userData = {
          id: signupResponse.data._id || signupResponse.data.id,
          email: signupResponse.data.email,
          firstName: signupResponse.data.firstName,
          lastName: signupResponse.data.lastName || '',
          profilePhoto: signupResponse.data.profilePhoto || '',
          userName: signupResponse.data.userName,
          country: signupResponse.data.country || country, // Use from signup form
          phone: signupResponse.data.phone || '',
          seller: signupResponse.data.seller || false,
          admin: signupResponse.data.admin || false,
          authProvider: 'email' as const
        };
        
        setUser(userData);
        // Store complete user data and access token in localStorage for header-based persistence
        localStorage.setItem('userId', userData.id);
        localStorage.setItem('user', JSON.stringify(userData));
        if (signupResponse.accessToken) {
          localStorage.setItem('accessToken', signupResponse.accessToken);
        }
      } else {
        // Use the actual API message first, fallback to friendly error, then generic message
        const apiMessage = signupResponse.message || signupResponse.error || 'Signup failed';
        throw new Error(apiMessage);
      }
    } catch (error: any) {
      console.error('Email signup failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      setIsLoading(true);
      const result = await signInWithGoogle();
      // Handle authentication directly to capture additionalUserInfo
      if (result?.user) {
        await authenticateWithIcona(result.user, (result as any)?.additionalUserInfo);
      }
    } catch (error) {
      console.error('Google login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithApple = async () => {
    try {
      setIsLoading(true);
      const result = await signInWithApple();
      // Handle authentication directly to capture additionalUserInfo for Apple
      if (result?.user) {
        await authenticateWithIcona(result.user, (result as any)?.additionalUserInfo);
      }
    } catch (error) {
      console.error('Apple login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const completeSocialAuth = async (completionData: SocialAuthCompleteData) => {
    try {
      setIsLoading(true);
      
      if (!pendingSocialAuthData) {
        throw new Error('No pending social authentication data found');
      }

      // Validate input using schema
      const validatedData = socialAuthCompleteSchema.parse(completionData);

      // Detect provider type based on pending auth data
      let authType: 'google' | 'apple' = 'google'; // default
      if (pendingSocialAuthData.providerData && pendingSocialAuthData.providerData.length > 0) {
        if (pendingSocialAuthData.providerData.some(p => p.providerId === 'apple.com')) {
          authType = 'apple';
        } else if (pendingSocialAuthData.providerData.some(p => p.providerId === 'google.com')) {
          authType = 'google';
        }
      }

      // Combine the original Firebase data with the completion data
      const fullSocialAuthData = {
        email: pendingSocialAuthData.email || '',
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        userName: validatedData.userName,
        type: authType,
        profilePhoto: pendingSocialAuthData.photoURL || '',
        country: validatedData.country || '',
        phone: validatedData.phone || '',
        gender: validatedData.gender || ''
      };

      const response = await apiRequest('POST', '/api/auth/social/complete', fullSocialAuthData);
      const completeResponse = await response.json();
      
      if (completeResponse.success) {
        // Set user data from completion response
        const userData = {
          id: completeResponse.data._id || completeResponse.data.id,
          email: completeResponse.data.email,
          firstName: completeResponse.data.firstName,
          lastName: completeResponse.data.lastName || '',
          profilePhoto: completeResponse.data.profilePhoto || pendingSocialAuthData.photoURL || '',
          userName: completeResponse.data.userName,
          country: completeResponse.data.country || '',
          phone: completeResponse.data.phone || '',
          seller: completeResponse.data.seller || false,
          admin: completeResponse.data.admin || false,
          authProvider: authType as 'google' | 'apple'
        };
        
        setUser(userData);
        // Store complete user data and access token in localStorage for header-based persistence
        localStorage.setItem('userId', userData.id);
        localStorage.setItem('user', JSON.stringify(userData));
        if (completeResponse.accessToken) {
          localStorage.setItem('accessToken', completeResponse.accessToken);
        }

        // Clear pending auth state
        setPendingSocialAuth(false);
        setPendingSocialAuthEmail(null);
        setPendingSocialAuthData(null);
      } else {
        throw new Error(completeResponse.error || 'Failed to complete social authentication');
      }
    } catch (error: any) {
      console.error('Social auth completion failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call backend logout endpoint to clear HttpOnly cookies
      await apiRequest('POST', '/api/auth/logout', {});
      await firebaseSignOut();
      setUser(null);
      // Clear stored user data and access token
      localStorage.removeItem('userId');
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      // Clear pending auth state
      setPendingSocialAuth(false);
      setPendingSocialAuthEmail(null);
      setPendingSocialAuthData(null);
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear user state on error
      setUser(null);
      // Clear stored user data and access token
      localStorage.removeItem('userId');
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      // Clear pending auth state
      setPendingSocialAuth(false);
      setPendingSocialAuthEmail(null);
      setPendingSocialAuthData(null);
    }
  };

  const checkAuth = async () => {
    try {
      // First handle any pending redirects
      const redirectResult = await handleAuthRedirect();
      if (redirectResult?.user && !isProcessingRef.current) {
        isProcessingRef.current = true;
        try {
          // Handle redirect result with additionalUserInfo
          await authenticateWithIcona(redirectResult.user, (redirectResult as any)?.additionalUserInfo);
        } finally {
          isProcessingRef.current = false;
        }
        return;
      }

      // Check if we have stored user data in localStorage
      const storedUser = localStorage.getItem('user');
      
      if (storedUser) {
        try {
          // Parse stored user data first
          const userData = JSON.parse(storedUser);
          
          // Validate that the session is still active on the backend
          const response = await apiRequest('GET', '/api/auth/session');
          const sessionData = await response.json();
          
          if (response.ok && sessionData.success) {
            // Session is valid, restore user data
            setUser(userData);
          } else {
            // Trust localStorage even if session validation fails
            // The backend middleware will restore session from headers on API calls
            console.log('Session validation failed but trusting localStorage');
            setUser(userData);
          }
        } catch (error) {
          console.error('Session validation failed:', error);
          // Trust localStorage even on error
          // The backend middleware will restore session from headers on API calls
          try {
            const userData = JSON.parse(storedUser);
            console.log('Session validation error but trusting localStorage');
            setUser(userData);
          } catch (parseError) {
            // If we can't parse the stored data, clear it
            localStorage.removeItem('userId');
            localStorage.removeItem('user');
            setUser(null);
          }
        }
      } else {
        // No stored user data, user not authenticated
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Clear user state and stored data on error
      localStorage.removeItem('userId');
      localStorage.removeItem('user');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Set up Firebase auth state listener (mainly for logout events now)
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
      }
      // Note: Sign-in authentication now handled directly in login functions
      // to properly capture additionalUserInfo
      setIsLoading(false);
    });

    // Check for any pending redirects on app load
    checkAuth();

    return () => unsubscribe();
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    pendingSocialAuth,
    pendingSocialAuthEmail,
    pendingSocialAuthData,
    login,
    emailLogin,
    emailSignup,
    loginWithGoogle,
    loginWithApple,
    completeSocialAuth,
    logout,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}