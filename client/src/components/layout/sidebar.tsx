import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  Package, 
  Box,
  Truck, 
  TrendingUp, 
  Video, 
  Settings, 
  Gavel,
  User,
  ChevronLeft,
  ChevronRight,
  Package2,
  MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth-context";

const navigation = [
  { name: "Orders", href: "/orders", icon: Package },
  { name: "Purchases", href: "/purchases", icon: Package },
  { name: "Inventory", href: "/inventory", icon: Box },
  { name: "Shipping", href: "/shipping", icon: Truck },
  { name: "Shipping Profiles", href: "/shipping-profiles", icon: Package2 },
  { name: "Addresses", href: "/addresses", icon: MapPin },
  { name: "Profile", href: "/profile", icon: User },
  // { name: "Dashboard", href: "/", icon: BarChart3 },
  // { name: "Analytics", href: "/analytics", icon: TrendingUp },
  // { name: "Live Shows", href: "/live-shows", icon: Video },
  // { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [appName, setAppName] = useState('huloo');

  // Fetch app name from public API
  useEffect(() => {
    const fetchAppName = async () => {
      try {
        const response = await fetch('https://api.huloo.live/api/theme-colors');
        if (response.ok) {
          const data = await response.json();
          if (data.app_name) {
            setAppName(data.app_name);
          }
        }
      } catch (error) {
        console.error('Failed to fetch app name:', error);
      }
    };

    fetchAppName();
  }, []);

  // Filter navigation items based on user permissions
  const filteredNavigation = navigation.filter(item => {
    // Hide Orders for non-sellers (they get Purchases instead)
    if (item.name === "Orders" && (user?.seller === false || user?.seller === undefined)) {
      return false;
    }
    // Hide Purchases for non-sellers is handled differently - they only see Purchases, not Orders
    // But sellers see both Orders and Purchases, so we don't hide Purchases for anyone
    
    // Hide shipping tab if user is not a seller (false or undefined)
    if (item.name === "Shipping" && (user?.seller === false || user?.seller === undefined)) {
      return false;
    }
    // Hide shipping profiles tab if user is not a seller (false or undefined)
    if (item.name === "Shipping Profiles" && (user?.seller === false || user?.seller === undefined)) {
      return false;
    }
    // Hide inventory tab if user is not a seller (false or undefined)
    if (item.name === "Inventory" && (user?.seller === false || user?.seller === undefined)) {
      return false;
    }
    return true;
  });

  return (
    <>
      {/* Desktop sidebar */}
      <div className={cn(
        "hidden lg:flex lg:flex-col transition-all duration-300 bg-card border-r border-border",
        isCollapsed ? "lg:w-16" : "lg:w-64"
      )}>
        <div className="flex flex-col flex-grow pt-5 overflow-y-auto">
          {/* Logo and Toggle */}
          <div className="flex items-center justify-between flex-shrink-0 px-4" data-testid="logo-container">
            {!isCollapsed && (
              <div className="flex items-center">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Gavel className="text-primary-foreground text-lg" />
                </div>
                <h1 className="ml-3 text-xl font-bold text-foreground">{appName}</h1>
              </div>
            )}
            {isCollapsed && (
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto">
                <Gavel className="text-primary-foreground text-lg" />
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className={cn("flex-shrink-0", isCollapsed && "mx-auto mt-2")}
              data-testid="button-toggle-sidebar"
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </Button>
          </div>
          
          {/* Navigation */}
          <nav className="mt-8 flex-1 px-2 pb-4 space-y-1" data-testid="nav-sidebar">
            {filteredNavigation.map((item) => {
              const isActive = location === item.href;
              const navItem = (
                <Link key={item.name} href={item.href}>
                  <div
                    className={cn(
                      "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      isCollapsed && "justify-center"
                    )}
                    data-testid={`nav-${item.name.toLowerCase().replace(" ", "-")}`}
                  >
                    <item.icon className={cn("text-lg", !isCollapsed && "mr-3")} />
                    {!isCollapsed && item.name}
                  </div>
                </Link>
              );

              if (isCollapsed) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      {navItem}
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.name}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return navItem;
            })}
          </nav>

          {/* User Profile */}
          <div className="flex-shrink-0 flex border-t border-border p-4" data-testid="user-profile">
            <div className={cn("flex items-center", isCollapsed && "justify-center")}>
              {user?.profilePhoto ? (
                <img 
                  src={user.profilePhoto} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                  <User className="text-secondary-foreground" />
                </div>
              )}
              {!isCollapsed && (
                <div className="ml-3">
                  <p className="text-sm font-medium text-foreground">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
