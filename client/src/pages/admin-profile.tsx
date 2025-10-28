import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Mail, MapPin, Calendar, Shield } from "lucide-react";

export default function AdminProfile() {
  const { data: sessionData } = useQuery<any>({
    queryKey: ['/api/auth/session'],
  });

  const userId = sessionData?.user?._id;

  const { data: profileData, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/profile/${userId}`],
    enabled: !!userId,
  });

  const user = profileData?.data || profileData;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground">My Profile</h2>
          <p className="text-muted-foreground">View your account information</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={user?.profilepic} alt={user?.fullname || user?.name} />
                  <AvatarFallback className="text-2xl">
                    {user?.fullname || user?.name ? getInitials(user.fullname || user.name) : 'AD'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-2xl font-bold" data-testid="text-profile-name">
                      {user?.fullname || user?.name || 'Super Admin'}
                    </h3>
                    <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                      <Shield className="h-3 w-3" />
                      Super Admin
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-muted-foreground">
                    {user?.username && (
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        @{user.username}
                      </div>
                    )}
                    {user?.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {user.email}
                      </div>
                    )}
                    {user?.country && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {user.country}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user?.fullname && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Full Name</Label>
                    <p className="text-sm font-medium p-2 bg-muted rounded-md" data-testid="text-fullname">
                      {user.fullname}
                    </p>
                  </div>
                )}

                {user?.name && !user?.fullname && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="text-sm font-medium p-2 bg-muted rounded-md" data-testid="text-name">
                      {user.name}
                    </p>
                  </div>
                )}

                {user?.username && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Username</Label>
                    <p className="text-sm font-medium p-2 bg-muted rounded-md" data-testid="text-username">
                      {user.username}
                    </p>
                  </div>
                )}

                {user?.email && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="text-sm font-medium p-2 bg-muted rounded-md" data-testid="text-email">
                      {user.email}
                    </p>
                  </div>
                )}

                {user?.phone && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="text-sm font-medium p-2 bg-muted rounded-md" data-testid="text-phone">
                      {user.phone}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Additional account information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user?._id && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">User ID</Label>
                    <p className="text-sm font-mono p-2 bg-muted rounded-md" data-testid="text-user-id">
                      {user._id}
                    </p>
                  </div>
                )}

                {user?.accountType && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Account Type</Label>
                    <p className="text-sm font-medium p-2 bg-muted rounded-md" data-testid="text-account-type">
                      {user.accountType}
                    </p>
                  </div>
                )}

                {user?.role && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Role</Label>
                    <p className="text-sm font-medium p-2 bg-muted rounded-md" data-testid="text-role">
                      {user.role}
                    </p>
                  </div>
                )}

                {user?.country && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Country</Label>
                    <p className="text-sm font-medium p-2 bg-muted rounded-md" data-testid="text-country">
                      {user.country}
                    </p>
                  </div>
                )}

                {user?.createdAt && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Member Since
                    </Label>
                    <p className="text-sm font-medium p-2 bg-muted rounded-md" data-testid="text-created-at">
                      {new Date(user.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
