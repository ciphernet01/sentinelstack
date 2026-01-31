'use client';

import { useState } from 'react';
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useDeleteApiKey, API_SCOPES, ApiKey, CreateApiKeyData } from '@/hooks/use-api-keys';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Key, Plus, Copy, Eye, EyeOff, Trash2, Ban, RefreshCw, Code } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function ApiKeysPage() {
  const { data: apiKeys = [], isLoading: loading, refetch } = useApiKeys();
  const createApiKeyMutation = useCreateApiKey();
  const revokeApiKeyMutation = useRevokeApiKey();
  const deleteApiKeyMutation = useDeleteApiKey();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['READ_ASSESSMENTS']);
  const [expiresIn, setExpiresIn] = useState<string>('');
  const [createdKey, setCreatedKey] = useState<ApiKey | null>(null);
  const [showKey, setShowKey] = useState(false);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a name for the API key.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedScopes.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one scope.',
        variant: 'destructive',
      });
      return;
    }

    const data: CreateApiKeyData = {
      name: newKeyName.trim(),
      scopes: selectedScopes,
    };

    if (expiresIn) {
      const days = parseInt(expiresIn);
      if (days > 0) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        data.expiresAt = expiresAt.toISOString();
      }
    }

    try {
      const key = await createApiKeyMutation.mutateAsync(data);
      if (key) {
        setCreatedKey(key);
        setNewKeyName('');
        setSelectedScopes(['READ_ASSESSMENTS']);
        setExpiresIn('');
        toast({
          title: 'API Key Created',
          description: 'Save your API key now - it will not be shown again.',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create API key',
        variant: 'destructive',
      });
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      await revokeApiKeyMutation.mutateAsync(id);
      toast({
        title: 'API Key Revoked',
        description: 'The API key has been revoked and can no longer be used.',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to revoke API key',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      await deleteApiKeyMutation.mutateAsync(id);
      toast({
        title: 'API Key Deleted',
        description: 'The API key has been permanently deleted.',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete API key',
        variant: 'destructive',
      });
    }
  };

  const handleCopyKey = () => {
    if (createdKey?.plainKey) {
      navigator.clipboard.writeText(createdKey.plainKey);
      toast({
        title: 'Copied',
        description: 'API key copied to clipboard.',
      });
    }
  };

  const handleCloseCreateDialog = () => {
    setIsCreateOpen(false);
    setCreatedKey(null);
    setShowKey(false);
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes(prev =>
      prev.includes(scope)
        ? prev.filter(s => s !== scope)
        : [...prev, scope]
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">
            Manage API keys for programmatic access to SentinelStack.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={handleCloseCreateDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create API Key
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              {createdKey ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5 text-green-500" />
                      API Key Created
                    </DialogTitle>
                    <DialogDescription>
                      Copy your API key now. You won&apos;t be able to see it again.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="relative">
                      <Input
                        type={showKey ? 'text' : 'password'}
                        value={createdKey.plainKey || ''}
                        readOnly
                        className="pr-20 font-mono text-sm"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setShowKey(!showKey)}
                        >
                          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleCopyKey}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>Important:</strong> Store this key securely. It provides access to your organization&apos;s data based on the scopes you selected.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCloseCreateDialog}>Done</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Create API Key</DialogTitle>
                    <DialogDescription>
                      Create a new API key for programmatic access to SentinelStack.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g., CI/CD Pipeline, Production Server"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Scopes</Label>
                      <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                        {API_SCOPES.map((scope) => (
                          <div key={scope.value} className="flex items-start space-x-2">
                            <Checkbox
                              id={scope.value}
                              checked={selectedScopes.includes(scope.value)}
                              onCheckedChange={() => toggleScope(scope.value)}
                            />
                            <div className="grid gap-1 leading-none">
                              <Label htmlFor={scope.value} className="cursor-pointer font-medium">
                                {scope.label}
                              </Label>
                              <p className="text-xs text-muted-foreground">{scope.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expires">Expiration (optional)</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          id="expires"
                          type="number"
                          placeholder="30"
                          min="1"
                          value={expiresIn}
                          onChange={(e) => setExpiresIn(e.target.value)}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">days (leave empty for no expiration)</span>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleCloseCreateDialog}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateKey} disabled={createApiKeyMutation.isPending}>
                      {createApiKeyMutation.isPending ? 'Creating...' : 'Create Key'}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* API Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Quick Start
          </CardTitle>
          <CardDescription>
            Use your API key to authenticate requests to the SentinelStack API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-900 text-slate-100 p-4 rounded-md font-mono text-sm overflow-x-auto">
            <pre>{`curl -X GET "https://api.sentinelstack.io/api/v1/assessments" \\
  -H "Authorization: Bearer sk_live_your_api_key_here" \\
  -H "Content-Type: application/json"`}</pre>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Replace <code className="bg-muted px-1 rounded">sk_live_your_api_key_here</code> with your actual API key.
          </p>
        </CardContent>
      </Card>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            {apiKeys.length} API key{apiKeys.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading API keys...</div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No API keys yet. Create your first key to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {key.keyPrefix}...
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.slice(0, 2).map((scope) => (
                          <Badge key={scope} variant="secondary" className="text-xs">
                            {scope.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                        {key.scopes.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{key.scopes.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{key.usageCount.toLocaleString()} requests</TableCell>
                    <TableCell>
                      {key.lastUsedAt
                        ? formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {!key.enabled ? (
                        <Badge variant="destructive">Revoked</Badge>
                      ) : key.expiresAt && new Date(key.expiresAt) < new Date() ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-500">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {key.enabled && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Revoke">
                                <Ban className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will immediately disable the API key. Any applications using this key will no longer be able to authenticate.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRevokeKey(key.id)}
                                  className="bg-amber-500 hover:bg-amber-600"
                                >
                                  Revoke
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Delete">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. The API key will be permanently deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteKey(key.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
