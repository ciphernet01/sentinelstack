'use client';

import { useState } from 'react';
import { useWebhooks, useCreateWebhook, useDeleteWebhook, useToggleWebhook, useTestWebhook, WebhookEvent } from '@/hooks/use-webhooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Webhook, Globe, Plus, Trash2, AlertCircle, CheckCircle2, Loader2, Send, RefreshCw, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const WEBHOOK_EVENTS: { value: WebhookEvent; label: string; description: string }[] = [
  { value: 'SCAN_COMPLETED', label: 'Scan Completed', description: 'When a security scan finishes successfully' },
  { value: 'SCAN_FAILED', label: 'Scan Failed', description: 'When a scan encounters an error' },
  { value: 'CRITICAL_FINDING', label: 'Critical Finding', description: 'When critical vulnerabilities are discovered' },
  { value: 'SCHEDULED_SCAN_RUN', label: 'Scheduled Scan Run', description: 'When a scheduled scan starts' },
];

export default function WebhooksPage() {
  const { data: webhooks, isLoading, error } = useWebhooks();
  const createMutation = useCreateWebhook();
  const deleteMutation = useDeleteWebhook();
  const toggleMutation = useToggleWebhook();
  const testMutation = useTestWebhook();
  const { toast } = useToast();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: ['SCAN_COMPLETED'] as WebhookEvent[],
  });

  const handleCreate = async () => {
    if (!newWebhook.name || !newWebhook.url) {
      toast({ variant: 'destructive', title: 'Please fill in all required fields' });
      return;
    }

    if (newWebhook.events.length === 0) {
      toast({ variant: 'destructive', title: 'Please select at least one event' });
      return;
    }

    try {
      await createMutation.mutateAsync(newWebhook);
      toast({ title: 'Webhook created successfully' });
      setIsCreateOpen(false);
      setNewWebhook({ name: '', url: '', events: ['SCAN_COMPLETED'] });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to create webhook' });
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleMutation.mutateAsync({ id, enabled });
      toast({ title: enabled ? 'Webhook enabled' : 'Webhook disabled' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to update webhook' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Webhook deleted' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to delete webhook' });
    }
  };

  const handleTest = async (id: string) => {
    try {
      const result = await testMutation.mutateAsync(id);
      if (result.success) {
        toast({ title: `Test successful (${result.statusCode}) - ${result.responseTime}ms` });
      } else {
        toast({ variant: 'destructive', title: `Test failed: ${result.statusCode || 'No response'}` });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Failed to send test webhook' });
    }
  };

  const toggleEvent = (event: WebhookEvent) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  const activeCount = webhooks?.filter(w => w.enabled).length || 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="h-6 w-6 text-primary" />
            Webhooks
          </h1>
          <p className="text-muted-foreground mt-1">
            Send scan results to external services
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>
                Configure a webhook to receive notifications
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Webhook Name</Label>
                <Input
                  id="name"
                  placeholder="Slack Notifications"
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="url">Endpoint URL</Label>
                <Input
                  id="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                />
              </div>
              
              <div className="space-y-3">
                <Label>Events to Receive</Label>
                <div className="space-y-2">
                  {WEBHOOK_EVENTS.map((event) => (
                    <div key={event.value} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <Checkbox
                        id={event.value}
                        checked={newWebhook.events.includes(event.value)}
                        onCheckedChange={() => toggleEvent(event.value)}
                      />
                      <div className="flex-1">
                        <label htmlFor={event.value} className="text-sm font-medium cursor-pointer">
                          {event.label}
                        </label>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Webhook'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Webhooks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{webhooks?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Webhooks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {webhooks?.reduce((acc, w) => acc + (w._count?.deliveries || 0), 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Webhooks List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Webhooks</CardTitle>
          <CardDescription>
            Manage endpoints for receiving security scan notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-12" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="font-semibold">Failed to load webhooks</h3>
              <p className="text-muted-foreground">Please try again later</p>
            </div>
          ) : webhooks?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Webhook className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold">No webhooks configured</h3>
              <p className="text-muted-foreground mb-4">
                Create a webhook to receive scan notifications
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Webhook
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {webhooks?.map((webhook) => (
                <div
                  key={webhook.id}
                  className={`flex items-center gap-4 p-4 border rounded-lg transition-colors ${
                    webhook.enabled ? 'bg-card' : 'bg-muted/50'
                  }`}
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    webhook.enabled 
                      ? webhook.failureCount > 0 
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {webhook.failureCount >= 5 ? (
                      <XCircle className="h-5 w-5" />
                    ) : webhook.enabled ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Clock className="h-5 w-5" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold truncate">{webhook.name}</h4>
                      {webhook.failureCount >= 5 && (
                        <Badge variant="destructive">Disabled - Too many failures</Badge>
                      )}
                      {webhook.failureCount > 0 && webhook.failureCount < 5 && (
                        <Badge variant="secondary">{webhook.failureCount} failures</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1 truncate max-w-[300px]">
                        <Globe className="h-3 w-3 flex-shrink-0" />
                        {webhook.url}
                      </span>
                      <span className="flex items-center gap-1">
                        {webhook._count?.deliveries || 0} deliveries
                      </span>
                      {webhook.lastTriggeredAt && (
                        <span className="flex items-center gap-1">
                          Last: {formatDistanceToNow(new Date(webhook.lastTriggeredAt), { addSuffix: true })}
                          {webhook.lastStatus && (
                            <Badge variant={webhook.lastStatus < 400 ? 'outline' : 'destructive'} className="ml-1">
                              {webhook.lastStatus}
                            </Badge>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {webhook.events.map((event) => (
                        <Badge key={event} variant="secondary" className="text-xs">
                          {event.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleTest(webhook.id)}
                      disabled={testMutation.isPending}
                      title="Send test webhook"
                    >
                      {testMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <Switch
                      checked={webhook.enabled && webhook.failureCount < 5}
                      onCheckedChange={(checked) => handleToggle(webhook.id, checked)}
                      disabled={toggleMutation.isPending}
                    />
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &quot;{webhook.name}&quot;? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(webhook.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Webhook className="h-6 w-6 text-blue-600 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-100">Webhook Security</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Each webhook includes an HMAC-SHA256 signature in the <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">X-Webhook-Signature</code> header.
                Verify this signature using your webhook secret to ensure requests are from SentinelStack.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
