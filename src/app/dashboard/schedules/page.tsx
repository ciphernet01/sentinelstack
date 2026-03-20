'use client';

import { useState } from 'react';
import { useScheduledScans, useCreateScheduledScan, useDeleteScheduledScan, useToggleScheduledScan, ScheduleType } from '@/hooks/use-scheduled-scans';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, Globe, Play, Plus, Settings, Trash2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const PRESETS = [
  { value: 'quick', label: 'Quick Scan', description: 'Fast security check' },
  { value: 'standard', label: 'Standard', description: 'Balanced coverage' },
  { value: 'comprehensive', label: 'Comprehensive', description: 'Full security audit' },
  { value: 'passive', label: 'Passive Only', description: 'Non-intrusive scan' },
];

const SCHEDULE_TYPES: { value: ScheduleType; label: string; description: string }[] = [
  { value: 'DAILY', label: 'Daily', description: 'Every day at midnight' },
  { value: 'WEEKLY', label: 'Weekly', description: 'Every Monday at midnight' },
  { value: 'BIWEEKLY', label: 'Bi-weekly', description: 'Every other Monday' },
  { value: 'MONTHLY', label: 'Monthly', description: 'First of each month' },
];

export default function SchedulesPage() {
  const { data: schedules, isLoading, error } = useScheduledScans();
  const createMutation = useCreateScheduledScan();
  const deleteMutation = useDeleteScheduledScan();
  const toggleMutation = useToggleScheduledScan();
  const { toast } = useToast();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newScan, setNewScan] = useState({
    name: '',
    targetUrl: '',
    toolPreset: 'standard',
    scheduleType: 'WEEKLY' as ScheduleType,
  });

  const handleCreate = async () => {
    if (!newScan.name || !newScan.targetUrl) {
      toast({ variant: 'destructive', title: 'Please fill in all required fields' });
      return;
    }

    try {
      await createMutation.mutateAsync(newScan);
      toast({ title: 'Scheduled scan created' });
      setIsCreateOpen(false);
      setNewScan({
        name: '',
        targetUrl: '',
        toolPreset: 'standard',
        scheduleType: 'WEEKLY',
      });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to create scheduled scan' });
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleMutation.mutateAsync({ id, enabled });
      toast({ title: enabled ? 'Schedule enabled' : 'Schedule paused' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to update schedule' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Scheduled scan deleted' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to delete scheduled scan' });
    }
  };

  const activeCount = schedules?.filter(s => s.enabled).length || 0;
  const totalRuns = schedules?.reduce((acc, s) => acc + s.runCount, 0) || 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Scheduled Scans
          </h1>
          <p className="text-muted-foreground mt-1">
            Automate recurring security assessments
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Scheduled Scan</DialogTitle>
              <DialogDescription>
                Set up a recurring security scan for your target
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Schedule Name</Label>
                <Input
                  id="name"
                  placeholder="Weekly Production Scan"
                  value={newScan.name}
                  onChange={(e) => setNewScan({ ...newScan, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="url">Target URL</Label>
                <Input
                  id="url"
                  placeholder="https://example.com"
                  value={newScan.targetUrl}
                  onChange={(e) => setNewScan({ ...newScan, targetUrl: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Scan Preset</Label>
                <Select
                  value={newScan.toolPreset}
                  onValueChange={(value) => setNewScan({ ...newScan, toolPreset: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        <div className="flex flex-col">
                          <span>{preset.label}</span>
                          <span className="text-xs text-muted-foreground">{preset.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={newScan.scheduleType}
                  onValueChange={(value) => setNewScan({ ...newScan, scheduleType: value as ScheduleType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex flex-col">
                          <span>{type.label}</span>
                          <span className="text-xs text-muted-foreground">{type.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  'Create Schedule'
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
              Total Schedules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Schedules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRuns}</div>
          </CardContent>
        </Card>
      </div>

      {/* Schedules List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Schedules</CardTitle>
          <CardDescription>
            Manage your automated security scanning schedules
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
              <h3 className="font-semibold">Failed to load schedules</h3>
              <p className="text-muted-foreground">Please try again later</p>
            </div>
          ) : schedules?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold">No scheduled scans yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first schedule to automate security scanning
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Schedule
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {schedules?.map((schedule) => (
                <div
                  key={schedule.id}
                  className={`flex items-center gap-4 p-4 border rounded-lg transition-colors ${
                    schedule.enabled ? 'bg-card' : 'bg-muted/50'
                  }`}
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    schedule.enabled ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                  }`}>
                    {schedule.enabled ? (
                      <Play className="h-5 w-5" />
                    ) : (
                      <Clock className="h-5 w-5" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold truncate">{schedule.name}</h4>
                      <Badge variant={schedule.enabled ? 'default' : 'secondary'}>
                        {schedule.scheduleType.toLowerCase()}
                      </Badge>
                      <Badge variant="outline">
                        {PRESETS.find(p => p.value === schedule.toolPreset)?.label || schedule.toolPreset}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1 truncate">
                        <Globe className="h-3 w-3" />
                        {schedule.targetUrl}
                      </span>
                      {schedule.lastRunAt && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Last: {formatDistanceToNow(new Date(schedule.lastRunAt), { addSuffix: true })}
                        </span>
                      )}
                      {schedule.nextRunAt && schedule.enabled && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Next: {format(new Date(schedule.nextRunAt), 'MMM d, h:mm a')}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {schedule.runCount} runs
                    </span>
                    
                    <Switch
                      checked={schedule.enabled}
                      onCheckedChange={(checked) => handleToggle(schedule.id, checked)}
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
                          <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &quot;{schedule.name}&quot;? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(schedule.id)}
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
            <Settings className="h-6 w-6 text-blue-600 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-100">How Scheduled Scans Work</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Scheduled scans automatically run at your specified frequency. When a scan completes, 
                you&apos;ll receive a notification and the results will appear in your Reports. 
                All scans run in your configured timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
