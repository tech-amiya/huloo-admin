import { Search, Bell, Plus, Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";

export function Header() {
  const { logout } = useAuth();
  
  return (
    <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-card border-b border-border shadow-sm">
      <div className="flex-1 px-4 flex justify-between items-center">
        <div className="flex-1 flex">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="px-4 border-r border-border lg:hidden"
            data-testid="button-mobile-menu"
          >
            <Menu className="text-lg" />
          </Button>
          
          {/* Search */}
          <div className="flex-1 flex justify-center px-2 lg:ml-6 lg:justify-end">
            <div className="max-w-lg w-full lg:max-w-xs">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="text-muted-foreground" size={16} />
                </div>
                <Input
                  className="pl-10"
                  placeholder="Search orders, products..."
                  type="search"
                  data-testid="input-search"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Header Actions */}
        <div className="ml-4 flex items-center md:ml-6 space-x-4">
          <Button variant="ghost" size="icon" data-testid="button-notifications">
            <Bell className="text-lg" />
          </Button>
          <Button variant="ghost" size="icon" onClick={logout} data-testid="button-logout">
            <LogOut className="text-lg" />
          </Button>
        </div>
      </div>
    </div>
  );
}
