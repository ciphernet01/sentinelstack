'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Copy, ExternalLink, Loader2, MailPlus, RefreshCw, Trash2, Users, Palette, CreditCard, Key, Shield } from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER';

type OrgMember = {
  id: string;
  role: OrganizationRole;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: 'CLIENT' | 'ADMIN';
    persona?: 'SECURITY_ANALYST' | 'COMPLIANCE_MANAGER' | 'EXECUTIVE' | 'ADMINISTRATOR' | null;
    emailVerified: boolean;
  };
};

type Organization = {
  id: string;
  name: string;
  members: OrgMember[];
};

type OrganizationInvitation = {
  id: string;
  email: string;
  role: OrganizationRole;
  token: string;
  expiresAt: string;
  createdAt: string;
};

type OrganizationMembership = {
  id: string;
  role: OrganizationRole;
  createdAt: string;
  organization: {
    id: string;
    name: string;
  };
};

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  role: z.enum(['MEMBER', 'ADMIN', 'OWNER']).default('MEMBER'),
});

type InviteFormData = z.infer<typeof inviteSchema>;

const canManageInvites = (currentUserId: string | undefined, org: Organization | null) => {
  if (!currentUserId || !org) return false;
  const me = org.members.find(m => m.user.id === currentUserId);
  return me?.role === 'OWNER' || me?.role === 'ADMIN';
};

const roleRank: Record<OrganizationRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  MEMBER: 2,
};

const formatRoleLabel = (role: OrganizationRole) => {
  switch (role) {
    case 'OWNER':
      return 'Owner';
    case 'ADMIN':
      return 'Admin';
    default:
      return 'Member';
  }
};

const formatPersonaLabel = (persona?: OrgMember['user']['persona']) => {
  switch (persona) {
    case 'SECURITY_ANALYST':
      return 'Security Analyst';
    case 'COMPLIANCE_MANAGER':
      return 'Compliance Manager';
    case 'EXECUTIVE':
      return 'Executive';
    case 'ADMINISTRATOR':
      return 'Administrator';
    default:
      return null;
  }
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

const buildInviteLink = (token: string) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/invite?token=${encodeURIComponent(token)}`;
};

export default function SettingsPage() {
  usePageTitle('Settings');

  const { user } = useAuth();
  const { toast } = useToast();

  const [org, setOrg] = React.useState<Organization | null>(null);
  const [invitations, setInvitations] = React.useState<OrganizationInvitation[]>([]);
  const [memberships, setMemberships] = React.useState<OrganizationMembership[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = React.useState(false);
  const [inviteActionBusy, setInviteActionBusy] = React.useState<
    Record<string, { copy?: boolean; resend?: boolean; revoke?: boolean }>
  >({});
  const [recentlyCopiedInviteId, setRecentlyCopiedInviteId] = React.useState<string | null>(null);
  const [memberActionBusy, setMemberActionBusy] = React.useState<Record<string, { role?: boolean; remove?: boolean }>>({});
  const [activeOrgBusy, setActiveOrgBusy] = React.useState(false);
  const [leaveBusy, setLeaveBusy] = React.useState(false);

  const inviteForm = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'MEMBER',
    },
  });

  const manageEnabled = user?.role === 'ADMIN' || canManageInvites(user?.id, org);

  const myOrgRole: OrganizationRole | null = React.useMemo(() => {
    if (!user?.id || !org) return null;
    const me = org.members.find(m => m.user.id === user.id);
    return me?.role || null;
  }, [org, user?.id]);

  const canEditMemberRoles = user?.role === 'ADMIN' || myOrgRole === 'OWNER';
  const canRemoveMembers = user?.role === 'ADMIN' || myOrgRole === 'OWNER' || myOrgRole === 'ADMIN';

  const ownerCount = React.useMemo(() => {
    if (!org) return 0;
    return org.members.filter(m => m.role === 'OWNER').length;
  }, [org]);

  const canLeaveWorkspace = React.useMemo(() => {
    if (!org || !user?.id || !myOrgRole) return false;
    if (myOrgRole === 'OWNER' && ownerCount <= 1) return false;
    return true;
  }, [myOrgRole, org, ownerCount, user?.id]);

  const sortedMembers = React.useMemo(() => {
    if (!org) return [] as OrgMember[];
    const members = [...org.members];
    members.sort((a, b) => {
      const r = roleRank[a.role] - roleRank[b.role];
      if (r !== 0) return r;
      const aName = (a.user.name || a.user.email || '').toLowerCase();
      const bName = (b.user.name || b.user.email || '').toLowerCase();
      return aName.localeCompare(bName);
    });
    return members;
  }, [org]);

  const sortedInvitations = React.useMemo(() => {
    const list = [...invitations];
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }, [invitations]);

  const refreshWorkspace = React.useCallback(async () => {
    setWorkspaceLoading(true);
    try {
      // 1) Organization is required to render this tab.
      const orgRes = await api.get('/org/me');
      const organization: Organization | null = orgRes.data.organization || null;
      setOrg(organization);

      // 2) Memberships are best-effort (older backends may not have this route yet).
      try {
        const membershipsRes = await api.get('/org/memberships');
        setMemberships(membershipsRes.data.memberships || []);
      } catch {
        setMemberships([]);
      }

      // 3) Invitations are only fetched for managers.
      if (user?.role === 'ADMIN' || canManageInvites(user?.id, organization)) {
        try {
          const invRes = await api.get('/org/invitations');
          setInvitations(invRes.data.invitations || []);
        } catch {
          setInvitations([]);
        }
      } else {
        setInvitations([]);
      }
    } catch (error: any) {
      setOrg(null);
      setInvitations([]);
      setMemberships([]);
      toast({
        variant: 'destructive',
        title: 'Could not load workspace',
        description: error?.response?.data?.message || 'Please try again.',
      });
    } finally {
      setWorkspaceLoading(false);
    }
  }, [toast, user?.id, user?.role]);

  React.useEffect(() => {
    // Load only after user is present (auth token + init flow)
    if (!user?.id) return;
    void refreshWorkspace();
  }, [user?.id, refreshWorkspace]);

  const onInviteSubmit = async (data: InviteFormData) => {
    try {
      const res = await api.post('/org/invitations', data);
      const created: OrganizationInvitation | undefined = res.data?.invitation;

      inviteForm.reset({ email: '', role: data.role });
      toast({
        title: 'Invite sent',
        description: `Invitation sent to ${data.email}.`,
      });

      // Optimistic add if we got token; otherwise refresh.
      if (created?.id) {
        setInvitations(prev => [created, ...prev]);
      } else {
        await refreshWorkspace();
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Invite failed',
        description: error?.response?.data?.message || 'Please try again.',
      });
    }
  };

  const onCopyInviteLink = async (token: string) => {
    const link = buildInviteLink(token);
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Copied', description: 'Invite link copied to clipboard.' });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: 'Could not copy. Your browser may block clipboard access.',
      });
    }
  };

  const withInviteBusy = async (
    invitationId: string,
    action: 'copy' | 'resend' | 'revoke',
    fn: () => Promise<void>
  ) => {
    setInviteActionBusy(prev => ({
      ...prev,
      [invitationId]: { ...prev[invitationId], [action]: true },
    }));
    try {
      await fn();
    } finally {
      setInviteActionBusy(prev => ({
        ...prev,
        [invitationId]: { ...prev[invitationId], [action]: false },
      }));
    }
  };

  const onResendInvite = async (invitationId: string) => {
    await withInviteBusy(invitationId, 'resend', async () => {
      try {
        const res = await api.post(`/org/invitations/${invitationId}/resend`);
        const updated: OrganizationInvitation | undefined = res.data?.invitation;

        if (updated?.id) {
          setInvitations(prev => prev.map(i => (i.id === updated.id ? { ...i, ...updated } : i)));
        }

        toast({ title: 'Resent', description: 'Invitation email resent.' });
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Resend failed',
          description: error?.response?.data?.message || 'Please try again.',
        });
      }
    });
  };

  const onRevokeInvite = async (invitationId: string) => {
    await withInviteBusy(invitationId, 'revoke', async () => {
      try {
        await api.delete(`/org/invitations/${invitationId}`);
        setInvitations(prev => prev.filter(i => i.id !== invitationId));
        toast({ title: 'Revoked', description: 'Invitation revoked.' });
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Revoke failed',
          description: error?.response?.data?.message || 'Please try again.',
        });
      }
    });
  };

  const onCopyInvite = async (invitationId: string, token: string) => {
    await withInviteBusy(invitationId, 'copy', async () => {
      await onCopyInviteLink(token);
      setRecentlyCopiedInviteId(invitationId);
      window.setTimeout(() => setRecentlyCopiedInviteId(current => (current === invitationId ? null : current)), 1500);
    });
  };

  const withMemberBusy = async (memberId: string, action: 'role' | 'remove', fn: () => Promise<void>) => {
    setMemberActionBusy(prev => ({ ...prev, [memberId]: { ...prev[memberId], [action]: true } }));
    try {
      await fn();
    } finally {
      setMemberActionBusy(prev => ({ ...prev, [memberId]: { ...prev[memberId], [action]: false } }));
    }
  };

  const onUpdateMemberRole = async (memberId: string, role: OrganizationRole) => {
    await withMemberBusy(memberId, 'role', async () => {
      try {
        const res = await api.patch(`/org/members/${memberId}`, { role });
        const updated = res.data?.member as { id: string; role: OrganizationRole } | undefined;
        if (updated?.id) {
          setOrg(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              members: prev.members.map(m => (m.id === updated.id ? { ...m, role: updated.role } : m)),
            };
          });
        }
        toast({ title: 'Updated', description: 'Member role updated.' });
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: error?.response?.data?.message || 'Please try again.',
        });
      }
    });
  };

  const onRemoveMember = async (memberId: string) => {
    await withMemberBusy(memberId, 'remove', async () => {
      try {
        await api.delete(`/org/members/${memberId}`);
        setOrg(prev => {
          if (!prev) return prev;
          return { ...prev, members: prev.members.filter(m => m.id !== memberId) };
        });
        toast({ title: 'Removed', description: 'Member removed from workspace.' });
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Remove failed',
          description: error?.response?.data?.message || 'Please try again.',
        });
      }
    });
  };

  const onSwitchOrganization = async (organizationId: string) => {
    setActiveOrgBusy(true);
    try {
      await api.post('/org/active', { organizationId });
      toast({ title: 'Switched', description: 'Active workspace updated.' });
      window.location.href = '/dashboard/settings';
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Switch failed',
        description: error?.response?.data?.message || 'Please try again.',
      });
    } finally {
      setActiveOrgBusy(false);
    }
  };

  const onLeaveWorkspace = async () => {
    setLeaveBusy(true);
    try {
      await api.post('/org/leave');
      toast({ title: 'Left workspace', description: 'Your workspace access has been updated.' });
      window.location.href = '/dashboard';
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not leave workspace',
        description: error?.response?.data?.message || 'Please try again.',
      });
    } finally {
      setLeaveBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 flex-1 space-y-6">
      <div>
        <h1 className="text-lg font-semibold md:text-2xl font-headline">Settings</h1>
        <p className="text-muted-foreground">Manage your account and workspace preferences.</p>
      </div>

      <Tabs defaultValue="account" className="space-y-4">
        <TabsList className="w-full justify-start flex-wrap gap-2">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <Card className="sm:max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your personal account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={user?.name ?? ''} disabled placeholder="Your name" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email ?? ''} disabled placeholder="you@company.com" className="truncate" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {user?.role && (
                  <Badge variant="secondary" className="capitalize">
                    {user.role.toLowerCase()}
                  </Badge>
                )}
                {user?.organization && <Badge variant="secondary">{user.organization}</Badge>}
                {!user?.role && !user?.organization && (
                  <span className="text-sm text-muted-foreground">No workspace metadata yet.</span>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Editing profile fields will be enabled once a profile update endpoint is added.
              </p>
            </CardContent>
          </Card>

          <Card className="sm:max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Password and sign-in settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You’re using email/password auth. Google sign-in can be added here later (account linking, provider management).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="sm:max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Choose what you want to be notified about.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Assessment status updates</p>
                  <p className="text-sm text-muted-foreground">Queued, started, completed, failed.</p>
                </div>
                <Switch disabled />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Report ready</p>
                  <p className="text-sm text-muted-foreground">When a PDF report/export is generated.</p>
                </div>
                <Switch disabled />
              </div>

              <p className="text-sm text-muted-foreground">
                Coming soon: these will be saved per-user (with optional workspace defaults).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspace" className="space-y-6">
          {/* Quick Links */}
          <div className="grid gap-4 md:grid-cols-4">
            <Link href="/dashboard/settings/branding" className="block">
              <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Palette className="h-4 w-4" />
                    White-Label Branding
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Customize logos, colors, and domain
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link href="/dashboard/settings/compliance" className="block">
              <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="h-4 w-4" />
                    Compliance Badges
                  </CardTitle>
                  <CardDescription className="text-sm">
                    SOC2, ISO 27001, GDPR badges
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link href="/dashboard/settings/billing" className="block">
              <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="h-4 w-4" />
                    Billing & Subscription
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Manage plans and payment methods
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link href="/dashboard/api-keys" className="block">
              <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Key className="h-4 w-4" />
                    API Keys
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Manage programmatic access
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
          
          <Card className="w-full">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Workspace</CardTitle>
                  <CardDescription>Team settings, members, and invitations.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {org && user?.id && myOrgRole && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={!canLeaveWorkspace || leaveBusy}>
                          {leaveBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Leave
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Leave workspace?</AlertDialogTitle>
                          <AlertDialogDescription>
                            You will lose access to this workspace’s assessments and reports.
                            {myOrgRole === 'OWNER' && ownerCount <= 1 ? (
                              <span className="block mt-2 text-destructive">
                                You are the last owner. Transfer ownership before leaving.
                              </span>
                            ) : null}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void onLeaveWorkspace()} disabled={!canLeaveWorkspace || leaveBusy}>
                            Leave
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  <Button variant="outline" size="sm" onClick={refreshWorkspace} disabled={workspaceLoading}>
                    {workspaceLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!user?.id ? (
                <div className="text-sm text-muted-foreground">Sign in to manage workspace settings.</div>
              ) : workspaceLoading && !org ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading workspace…
                </div>
              ) : !org ? (
                <div className="text-sm text-muted-foreground">No workspace found for this account.</div>
              ) : (
                <div className="space-y-8">
                  {memberships.length > 1 && (
                    <div className="rounded-lg border p-4">
                      <div className="grid gap-2">
                        <Label>Active workspace</Label>
                        <Select
                          value={org.id}
                          onValueChange={(v) => void onSwitchOrganization(v)}
                          disabled={activeOrgBusy}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select workspace" />
                          </SelectTrigger>
                          <SelectContent>
                            {memberships.map(m => (
                              <SelectItem key={m.organization.id} value={m.organization.id}>
                                {m.organization.name} ({formatRoleLabel(m.role)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Switching workspaces updates what assessments/reports you can access.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="inline-flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {org.name}
                    </Badge>
                    <Badge variant="secondary">Members: {org.members.length}</Badge>
                    {myOrgRole && <Badge variant="outline">Your role: {formatRoleLabel(myOrgRole)}</Badge>}
                    {user?.role === 'ADMIN' && <Badge>Platform Admin</Badge>}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Members</h3>
                    <div className="rounded-md border overflow-x-auto">
                      <Table className="min-w-[600px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Org Role</TableHead>
                            <TableHead className="hidden md:table-cell">Job Function</TableHead>
                            <TableHead className="hidden md:table-cell">Verified</TableHead>
                            <TableHead className="hidden md:table-cell">Platform Role</TableHead>
                            {(canEditMemberRoles || canRemoveMembers) && <TableHead className="text-right">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedMembers.map(m => (
                            <TableRow key={m.id}>
                              <TableCell className="font-medium">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span>{m.user.name || '—'}</span>
                                  {user?.id && m.user.id === user.id && <Badge variant="secondary">You</Badge>}
                                </div>
                              </TableCell>
                              <TableCell>{m.user.email}</TableCell>
                              <TableCell>
                                {canEditMemberRoles ? (
                                  <Select
                                    value={m.role}
                                    onValueChange={(v) => void onUpdateMemberRole(m.id, v as OrganizationRole)}
                                    disabled={Boolean(memberActionBusy[m.id]?.role)}
                                  >
                                    <SelectTrigger className="h-8 w-[120px] text-xs md:w-[140px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="MEMBER">Member</SelectItem>
                                      <SelectItem value="ADMIN">Admin</SelectItem>
                                      <SelectItem value="OWNER">Owner</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant="secondary">{formatRoleLabel(m.role)}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {formatPersonaLabel(m.user.persona) ? (
                                  <Badge variant="outline">{formatPersonaLabel(m.user.persona)}</Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {m.user.emailVerified ? (
                                  <Badge variant="secondary">Yes</Badge>
                                ) : (
                                  <Badge variant="outline">No</Badge>
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Badge variant="outline" className="capitalize">
                                  {m.user.role.toLowerCase()}
                                </Badge>
                              </TableCell>
                              {(canEditMemberRoles || canRemoveMembers) && (
                                <TableCell className="text-right">
                                  {(() => {
                                    const busyRemove = Boolean(memberActionBusy[m.id]?.remove);
                                    const isSelf = Boolean(user?.id && m.user.id === user.id);
                                    const ownerCount = org.members.filter(mm => mm.role === 'OWNER').length;
                                    const isLastOwner = m.role === 'OWNER' && ownerCount <= 1;
                                    const canRemoveThis =
                                      !isSelf &&
                                      !isLastOwner &&
                                      (user?.role === 'ADMIN' ||
                                        myOrgRole === 'OWNER' ||
                                        (myOrgRole === 'ADMIN' && m.role === 'MEMBER'));

                                    if (!canRemoveThis) {
                                      return <span className="text-xs text-muted-foreground">—</span>;
                                    }

                                    return (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="destructive" size="sm" disabled={busyRemove} title="Remove member">
                                            {busyRemove ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Remove member?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              This will revoke workspace access for <span className="font-medium">{m.user.email}</span>.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => void onRemoveMember(m.id)} disabled={busyRemove}>
                                              Remove
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    );
                                  })()}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Invite a teammate</h3>
                    <div className="rounded-lg border p-4">
                      <form
                        onSubmit={inviteForm.handleSubmit(onInviteSubmit)}
                        className="grid gap-4 grid-cols-1 sm:grid-cols-[1fr_180px_auto]"
                      >
                        <div className="grid gap-2">
                          <Label htmlFor="inviteEmail">Email</Label>
                          <Input
                            id="inviteEmail"
                            placeholder="teammate@company.com"
                            {...inviteForm.register('email')}
                            disabled={!manageEnabled}
                          />
                          {inviteForm.formState.errors.email?.message && (
                            <p className="text-xs text-destructive">{inviteForm.formState.errors.email.message}</p>
                          )}
                        </div>

                        <div className="grid gap-2">
                          <Label>Role</Label>
                          <Select
                            value={inviteForm.watch('role')}
                            onValueChange={(v) => inviteForm.setValue('role', v as OrganizationRole)}
                            disabled={!manageEnabled}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MEMBER">Member</SelectItem>
                              <SelectItem value="ADMIN">Admin</SelectItem>
                              <SelectItem value="OWNER">Owner</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-end">
                          <Button type="submit" disabled={!manageEnabled || inviteForm.formState.isSubmitting}>
                            {inviteForm.formState.isSubmitting ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <MailPlus className="mr-2 h-4 w-4" />
                            )}
                            Send
                          </Button>
                        </div>
                      </form>

                      {!manageEnabled && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Only workspace owners/admins can invite members.
                        </p>
                      )}
                    </div>
                  </div>

                  {manageEnabled ? (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">Pending invitations</h3>
                      {invitations.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No pending invitations.</div>
                      ) : (
                        <div className="rounded-md border overflow-x-auto">
                          <Table className="min-w-[500px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead className="hidden md:table-cell">Expires</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedInvitations.map(inv => {
                                const busy = inviteActionBusy[inv.id] || {};
                                const copyBusy = Boolean(busy.copy);
                                const resendBusy = Boolean(busy.resend);
                                const revokeBusy = Boolean(busy.revoke);
                                const expMs = new Date(inv.expiresAt).getTime() - Date.now();
                                const expSoon = expMs > 0 && expMs < 24 * 60 * 60 * 1000;

                                return (
                                  <TableRow key={inv.id}>
                                    <TableCell className="font-medium">{inv.email}</TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">{formatRoleLabel(inv.role)}</Badge>
                                        {expSoon && <Badge variant="outline">Expiring soon</Badge>}
                                      </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">{formatDateTime(inv.expiresAt)}</TableCell>
                                    <TableCell className="text-right">
                                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => onCopyInvite(inv.id, inv.token)}
                                          disabled={copyBusy}
                                          title={recentlyCopiedInviteId === inv.id ? 'Copied!' : 'Copy invite link'}
                                        >
                                          {copyBusy && recentlyCopiedInviteId !== inv.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Copy className="h-4 w-4" />
                                          )}
                                        </Button>

                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => window.open(buildInviteLink(inv.token), '_blank', 'noopener,noreferrer')}
                                          title="Open invite link"
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </Button>

                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => onResendInvite(inv.id)}
                                          disabled={resendBusy}
                                          title="Resend invite email"
                                        >
                                          {resendBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                        </Button>

                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button
                                              variant="destructive"
                                              size="sm"
                                              disabled={revokeBusy}
                                              title="Revoke invite"
                                            >
                                              {revokeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                This will invalidate the invitation for <span className="font-medium">{inv.email}</span>.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                                              <AlertDialogAction onClick={() => onRevokeInvite(inv.id)} disabled={revokeBusy}>
                                                Revoke
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                      Pending invitations are visible to workspace owners/admins.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
