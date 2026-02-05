'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Copy, Loader2, MailPlus, RefreshCw, Trash2, Users, UserPlus, Crown, Shield, User } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  role: z.enum(['MEMBER', 'ADMIN', 'OWNER']).default('MEMBER'),
});

type InviteFormData = z.infer<typeof inviteSchema>;

const roleRank: Record<OrganizationRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  MEMBER: 2,
};

const formatRoleLabel = (role: OrganizationRole) => {
  switch (role) {
    case 'OWNER': return 'Owner';
    case 'ADMIN': return 'Admin';
    default: return 'Member';
  }
};

const getRoleIcon = (role: OrganizationRole) => {
  switch (role) {
    case 'OWNER': return <Crown className="h-4 w-4 text-yellow-500" />;
    case 'ADMIN': return <Shield className="h-4 w-4 text-blue-500" />;
    default: return <User className="h-4 w-4 text-gray-500" />;
  }
};

const formatPersonaLabel = (persona?: OrgMember['user']['persona']) => {
  switch (persona) {
    case 'SECURITY_ANALYST': return 'Security Analyst';
    case 'COMPLIANCE_MANAGER': return 'Compliance Manager';
    case 'EXECUTIVE': return 'Executive';
    case 'ADMINISTRATOR': return 'Administrator';
    default: return null;
  }
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
};

const buildInviteLink = (token: string) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/invite?token=${encodeURIComponent(token)}`;
};

const canManageInvites = (currentUserId: string | undefined, org: Organization | null) => {
  if (!currentUserId || !org) return false;
  const me = org.members.find(m => m.user.id === currentUserId);
  return me?.role === 'OWNER' || me?.role === 'ADMIN';
};

export default function TeamPage() {
  usePageTitle('Team');

  const { user } = useAuth();
  const { toast } = useToast();

  const [org, setOrg] = React.useState<Organization | null>(null);
  const [invitations, setInvitations] = React.useState<OrganizationInvitation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
  const [inviteActionBusy, setInviteActionBusy] = React.useState<Record<string, boolean>>({});
  const [memberActionBusy, setMemberActionBusy] = React.useState<Record<string, { role?: boolean; remove?: boolean }>>({});

  const inviteForm = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'MEMBER' },
  });

  const myOrgRole: OrganizationRole | null = React.useMemo(() => {
    if (!user?.id || !org) return null;
    const me = org.members.find(m => m.user.id === user.id);
    return me?.role || null;
  }, [org, user?.id]);

  const manageEnabled = user?.role === 'ADMIN' || canManageInvites(user?.id, org);
  const canEditMemberRoles = user?.role === 'ADMIN' || myOrgRole === 'OWNER';
  const canRemoveMembers = user?.role === 'ADMIN' || myOrgRole === 'OWNER' || myOrgRole === 'ADMIN';

  const sortedMembers = React.useMemo(() => {
    if (!org) return [];
    return [...org.members].sort((a, b) => {
      const r = roleRank[a.role] - roleRank[b.role];
      if (r !== 0) return r;
      return (a.user.name || a.user.email).localeCompare(b.user.name || b.user.email);
    });
  }, [org]);

  const sortedInvitations = React.useMemo(() => {
    return [...invitations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [invitations]);

  const refreshData = React.useCallback(async () => {
    setLoading(true);
    try {
      const orgRes = await api.get('/org/me');
      const organization = orgRes.data.organization || null;
      setOrg(organization);

      if (user?.role === 'ADMIN' || canManageInvites(user?.id, organization)) {
        try {
          const invRes = await api.get('/org/invitations');
          setInvitations(invRes.data.invitations || []);
        } catch {
          setInvitations([]);
        }
      }
    } catch (error: any) {
      setOrg(null);
      toast({ variant: 'destructive', title: 'Could not load team', description: error?.response?.data?.message || 'Please try again.' });
    } finally {
      setLoading(false);
    }
  }, [toast, user?.id, user?.role]);

  React.useEffect(() => {
    if (user?.id) void refreshData();
  }, [user?.id, refreshData]);

  const onInviteSubmit = async (data: InviteFormData) => {
    try {
      const res = await api.post('/org/invitations', data);
      const created = res.data?.invitation;
      inviteForm.reset({ email: '', role: 'MEMBER' });
      setInviteDialogOpen(false);
      toast({ title: 'Invite sent', description: `Invitation sent to ${data.email}.` });
      if (created?.id) {
        setInvitations(prev => [created, ...prev]);
      } else {
        await refreshData();
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Invite failed', description: error?.response?.data?.message || 'Please try again.' });
    }
  };

  const onCopyInviteLink = async (inv: OrganizationInvitation) => {
    setInviteActionBusy(prev => ({ ...prev, [inv.id]: true }));
    try {
      await navigator.clipboard.writeText(buildInviteLink(inv.token));
      toast({ title: 'Copied', description: 'Invite link copied to clipboard.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Could not copy to clipboard.' });
    } finally {
      setInviteActionBusy(prev => ({ ...prev, [inv.id]: false }));
    }
  };

  const onRevokeInvite = async (invitationId: string) => {
    setInviteActionBusy(prev => ({ ...prev, [invitationId]: true }));
    try {
      await api.delete(`/org/invitations/${invitationId}`);
      setInvitations(prev => prev.filter(i => i.id !== invitationId));
      toast({ title: 'Revoked', description: 'Invitation revoked.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Revoke failed', description: error?.response?.data?.message || 'Please try again.' });
    } finally {
      setInviteActionBusy(prev => ({ ...prev, [invitationId]: false }));
    }
  };

  const onUpdateMemberRole = async (memberId: string, role: OrganizationRole) => {
    setMemberActionBusy(prev => ({ ...prev, [memberId]: { ...prev[memberId], role: true } }));
    try {
      const res = await api.patch(`/org/members/${memberId}`, { role });
      const updated = res.data?.member;
      if (updated?.id) {
        setOrg(prev => prev ? { ...prev, members: prev.members.map(m => m.id === updated.id ? { ...m, role: updated.role } : m) } : prev);
      }
      toast({ title: 'Updated', description: 'Member role updated.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: error?.response?.data?.message || 'Please try again.' });
    } finally {
      setMemberActionBusy(prev => ({ ...prev, [memberId]: { ...prev[memberId], role: false } }));
    }
  };

  const onRemoveMember = async (memberId: string) => {
    setMemberActionBusy(prev => ({ ...prev, [memberId]: { ...prev[memberId], remove: true } }));
    try {
      await api.delete(`/org/members/${memberId}`);
      setOrg(prev => prev ? { ...prev, members: prev.members.filter(m => m.id !== memberId) } : prev);
      toast({ title: 'Removed', description: 'Member removed from team.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Remove failed', description: error?.response?.data?.message || 'Please try again.' });
    } finally {
      setMemberActionBusy(prev => ({ ...prev, [memberId]: { ...prev[memberId], remove: false } }));
    }
  };

  if (!user?.id) {
    return (
      <div className="p-4 sm:p-6 flex-1">
        <p className="text-muted-foreground">Sign in to manage your team.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 flex-1 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl font-headline">Team</h1>
          <p className="text-muted-foreground">Manage your workspace members and invitations.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshData} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          {manageEnabled && (
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a teammate</DialogTitle>
                  <DialogDescription>Send an invitation to join your workspace.</DialogDescription>
                </DialogHeader>
                <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="inviteEmail">Email address</Label>
                    <Input id="inviteEmail" placeholder="teammate@company.com" {...inviteForm.register('email')} />
                    {inviteForm.formState.errors.email && (
                      <p className="text-xs text-destructive">{inviteForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteForm.watch('role')} onValueChange={(v) => inviteForm.setValue('role', v as OrganizationRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">Member - Can view and run assessments</SelectItem>
                        <SelectItem value="ADMIN">Admin - Can manage team members</SelectItem>
                        <SelectItem value="OWNER">Owner - Full workspace control</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={inviteForm.formState.isSubmitting}>
                      {inviteForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}
                      Send Invitation
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {loading && !org ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading team…
        </div>
      ) : !org ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">No workspace found for this account.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{org.members.length}</p>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-full bg-yellow-500/10">
                  <MailPlus className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{invitations.length}</p>
                  <p className="text-sm text-muted-foreground">Pending Invites</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <Shield className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{org.members.filter(m => m.role === 'ADMIN' || m.role === 'OWNER').length}</p>
                  <p className="text-sm text-muted-foreground">Admins</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Members Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Members
              </CardTitle>
              <CardDescription>People who have access to {org.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden md:table-cell">Job Function</TableHead>
                      <TableHead className="hidden md:table-cell">Joined</TableHead>
                      {canRemoveMembers && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedMembers.map(m => {
                      const isSelf = user?.id === m.user.id;
                      const ownerCount = org.members.filter(mm => mm.role === 'OWNER').length;
                      const isLastOwner = m.role === 'OWNER' && ownerCount <= 1;
                      const canRemoveThis = !isSelf && !isLastOwner && canRemoveMembers;
                      const busyRole = memberActionBusy[m.id]?.role;
                      const busyRemove = memberActionBusy[m.id]?.remove;

                      return (
                        <TableRow key={m.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                {(m.user.name || m.user.email).charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  {m.user.name || 'No name'}
                                  {isSelf && <Badge variant="secondary" className="text-xs">You</Badge>}
                                </div>
                                <div className="text-sm text-muted-foreground">{m.user.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {canEditMemberRoles && !isSelf ? (
                              <Select value={m.role} onValueChange={(v) => onUpdateMemberRole(m.id, v as OrganizationRole)} disabled={busyRole}>
                                <SelectTrigger className="w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="MEMBER">Member</SelectItem>
                                  <SelectItem value="ADMIN">Admin</SelectItem>
                                  <SelectItem value="OWNER">Owner</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="flex items-center gap-2">
                                {getRoleIcon(m.role)}
                                <span>{formatRoleLabel(m.role)}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {formatPersonaLabel(m.user.persona) || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {formatDateTime(m.createdAt)}
                          </TableCell>
                          {canRemoveMembers && (
                            <TableCell className="text-right">
                              {canRemoveThis ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" disabled={busyRemove}>
                                      {busyRemove ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remove member?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will revoke access for <span className="font-medium">{m.user.email}</span>.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => onRemoveMember(m.id)}>Remove</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          {manageEnabled && invitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MailPlus className="h-5 w-5" />
                  Pending Invitations
                </CardTitle>
                <CardDescription>People who have been invited but haven&apos;t joined yet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
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
                        const busy = inviteActionBusy[inv.id];
                        const expMs = new Date(inv.expiresAt).getTime() - Date.now();
                        const expired = expMs <= 0;

                        return (
                          <TableRow key={inv.id}>
                            <TableCell className="font-medium">{inv.email}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getRoleIcon(inv.role)}
                                <span>{formatRoleLabel(inv.role)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {expired ? (
                                <Badge variant="destructive">Expired</Badge>
                              ) : (
                                formatDateTime(inv.expiresAt)
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => onCopyInviteLink(inv)} disabled={busy}>
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" disabled={busy}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        The invite link for {inv.email} will no longer work.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => onRevokeInvite(inv.id)}>Revoke</AlertDialogAction>
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
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
