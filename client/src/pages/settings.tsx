import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Bell, Shield, CreditCard, Truck } from "lucide-react";

export default function Settings() {
  return (
    <div className="py-6">
      <div className="px-4 sm:px-6 md:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-settings-title">
            Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your account preferences and seller settings.
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <Card className="shadow border border-border">
            <CardHeader className="px-6 py-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <User size={20} />
                <h3 className="text-lg font-medium text-foreground">Profile Information</h3>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Display Name</Label>
                  <Input id="name" defaultValue="Sarah Johnson" data-testid="input-display-name" />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" defaultValue="sarah@example.com" data-testid="input-email" />
                </div>
              </div>
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Input id="bio" placeholder="Tell buyers about yourself" data-testid="input-bio" />
              </div>
              <Button data-testid="button-save-profile">Save Changes</Button>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="shadow border border-border">
            <CardHeader className="px-6 py-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <Bell size={20} />
                <h3 className="text-lg font-medium text-foreground">Notifications</h3>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Order Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive notifications for new orders</p>
                </div>
                <Switch defaultChecked data-testid="switch-order-notifications" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Reminders</Label>
                  <p className="text-sm text-muted-foreground">Get reminders before scheduled shows</p>
                </div>
                <Switch defaultChecked data-testid="switch-show-reminders" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Performance Alerts</Label>
                  <p className="text-sm text-muted-foreground">Alerts for account health changes</p>
                </div>
                <Switch defaultChecked data-testid="switch-performance-alerts" />
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card className="shadow border border-border">
            <CardHeader className="px-6 py-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <Shield size={20} />
                <h3 className="text-lg font-medium text-foreground">Security</h3>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" data-testid="input-current-password" />
              </div>
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" data-testid="input-new-password" />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input id="confirm-password" type="password" data-testid="input-confirm-password" />
              </div>
              <Button data-testid="button-update-password">Update Password</Button>
            </CardContent>
          </Card>

          {/* Payment Settings */}
          <Card className="shadow border border-border">
            <CardHeader className="px-6 py-4 border-b border-border">
              <div className="flex items-center space-x-2">
                <CreditCard size={20} />
                <h3 className="text-lg font-medium text-foreground">Payment & Payouts</h3>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Payout Schedule</Label>
                <Select defaultValue="weekly">
                  <SelectTrigger data-testid="select-payout-schedule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bank Account</Label>
                <div className="flex items-center space-x-2">
                  <Input placeholder="**** **** **** 1234" disabled />
                  <Button variant="outline" data-testid="button-update-bank">Update</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
