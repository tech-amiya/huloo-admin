import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Plus, Video, Calendar, Users, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { LiveShow, InsertLiveShow } from "@shared/schema";
import { insertLiveShowSchema } from "@shared/schema";
import { format } from "date-fns";

const statusColors = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  live: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  ended: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function LiveShows() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shows, isLoading } = useQuery<LiveShow[]>({
    queryKey: ["/api/shows"],
  });

  const form = useForm<InsertLiveShow>({
    resolver: zodResolver(insertLiveShowSchema),
    defaultValues: {
      title: "",
      description: "",
      scheduledAt: new Date(),
      status: "draft",
      category: "",
    },
  });

  const createShowMutation = useMutation({
    mutationFn: async (data: InsertLiveShow) => {
      const response = await apiRequest("POST", "/api/shows", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shows"] });
      toast({ title: "Live show created successfully" });
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to create live show", variant: "destructive" });
    },
  });

  const onSubmit = (data: InsertLiveShow) => {
    createShowMutation.mutate(data);
  };

  return (
    <div className="py-6">
      <div className="px-4 sm:px-6 md:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-live-shows-title">
            Live Shows
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule and manage your live selling shows.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Shows List */}
          <div className="lg:col-span-2">
            <Card className="shadow border border-border">
              <CardHeader className="px-6 py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-foreground">Your Shows</h3>
                  <Button variant="outline" size="sm" data-testid="button-schedule-show">
                    <Plus className="mr-2" size={16} />
                    Schedule Show
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="animate-pulse space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-20 bg-muted rounded"></div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {shows?.map((show) => (
                      <div 
                        key={show.id} 
                        className="border border-border rounded-lg p-4 hover:bg-accent transition-colors"
                        data-testid={`show-${show.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4">
                            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                              <Video className="text-muted-foreground" />
                            </div>
                            <div>
                              <h4 className="font-medium text-foreground">{show.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{show.description}</p>
                              <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                                <div className="flex items-center">
                                  <Calendar className="mr-1" size={12} />
                                  {format(new Date(show.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                                </div>
                                <div className="flex items-center">
                                  <Users className="mr-1" size={12} />
                                  {show.viewerCount} viewers
                                </div>
                                <div className="flex items-center">
                                  <DollarSign className="mr-1" size={12} />
                                  ${show.totalSales}
                                </div>
                              </div>
                            </div>
                          </div>
                          <Badge 
                            className={statusColors[show.status as keyof typeof statusColors]}
                            data-testid={`show-status-${show.status}`}
                          >
                            {show.status.charAt(0).toUpperCase() + show.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Create Show Form */}
          <div>
            <Card className="shadow border border-border">
              <CardHeader className="px-6 py-4 border-b border-border">
                <h3 className="text-lg font-medium text-foreground">Schedule New Show</h3>
              </CardHeader>
              <CardContent className="p-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Show Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter show title" {...field} data-testid="input-show-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe your show"
                              {...field}
                              value={field.value || ""}
                              data-testid="textarea-show-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-show-category">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Trading Cards">Trading Cards</SelectItem>
                              <SelectItem value="Sneakers">Sneakers</SelectItem>
                              <SelectItem value="Collectibles">Collectibles</SelectItem>
                              <SelectItem value="Electronics">Electronics</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="scheduledAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scheduled Date & Time</FormLabel>
                          <FormControl>
                            <Input 
                              type="datetime-local"
                              {...field}
                              value={field.value instanceof Date ? field.value.toISOString().slice(0, 16) : field.value}
                              onChange={(e) => field.onChange(new Date(e.target.value))}
                              data-testid="input-show-datetime"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={createShowMutation.isPending}
                      data-testid="button-create-show"
                    >
                      {createShowMutation.isPending ? "Creating..." : "Create Show"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
