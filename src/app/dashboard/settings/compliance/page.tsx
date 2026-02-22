'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useComplianceBadges, useComplianceStats, useBadgeTypes, useCreateBadge, useUpdateBadge, useDeleteBadge, ComplianceBadge, ComplianceBadgeInput } from '@/hooks/use-compliance';
import { Shield, Plus, Pencil, Trash2, ExternalLink, Award, AlertTriangle, CheckCircle, Clock, Copy, Eye } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ComplianceType } from '@prisma/client';

const BADGE_ICONS: Record<ComplianceType, string> = {
  SOC2_TYPE1: '🛡️',
  SOC2_TYPE2: '🛡️',
  ISO27001: '🔒',
  ISO27017: '☁️',
  ISO27018: '🔐',
  GDPR: '🇪🇺',
  HIPAA: '🏥',
  PCI_DSS: '💳',
  CCPA: '🌴',
  FEDRAMP: '🏛️',
  NIST: '📋',
  CSA_STAR: '⭐',
  CUSTOM: '✅',
};

export default function CompliancePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: badges, isLoading: badgesLoading } = useComplianceBadges();
  const { data: stats } = useComplianceStats();
  const { data: badgeTypes } = useBadgeTypes();
  const createBadge = useCreateBadge();
  const updateBadge = useUpdateBadge();
  const deleteBadge = useDeleteBadge();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<ComplianceBadge | null>(null);
  const [formData, setFormData] = useState<ComplianceBadgeInput>({
    type: 'SOC2_TYPE2' as ComplianceType,
    name: '',
    description: '',
    isVerified: false,
    verificationUrl: '',
    certificateUrl: '',
    issuedAt: '',
    expiresAt: '',
    displayOnPublicPage: true,
  });
  
  // Get org ID from user's active organization
  const organizationId = (user as any)?.activeOrganization?.id || '';
  const trustPageUrl = organizationId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/trust/${organizationId}` : '';
  
  const resetForm = () => {
    setFormData({
      type: 'SOC2_TYPE2' as ComplianceType,
      name: '',
      description: '',
      isVerified: false,
      verificationUrl: '',
      certificateUrl: '',
      issuedAt: '',
      expiresAt: '',
      displayOnPublicPage: true,
    });
    setEditingBadge(null);
  };
  
  const handleCreate = async () => {
    try {
      await createBadge.mutateAsync(formData);
      toast({ title: 'Badge added', description: 'Compliance badge has been added successfully.' });
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.error || 'Failed to add badge', variant: 'destructive' });
    }
  };
  
  const handleUpdate = async () => {
    if (!editingBadge) return;
    try {
      await updateBadge.mutateAsync({ id: editingBadge.id, data: formData });
      toast({ title: 'Badge updated', description: 'Compliance badge has been updated.' });
      setEditingBadge(null);
      resetForm();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.error || 'Failed to update badge', variant: 'destructive' });
    }
  };
  
  const handleDelete = async (id: string) => {
    try {
      await deleteBadge.mutateAsync(id);
      toast({ title: 'Badge deleted', description: 'Compliance badge has been removed.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.error || 'Failed to delete badge', variant: 'destructive' });
    }
  };
  
  const openEditDialog = (badge: ComplianceBadge) => {
    setEditingBadge(badge);
    setFormData({
      type: badge.type,
      name: badge.name,
      description: badge.description || '',
      isVerified: badge.isVerified,
      verificationUrl: badge.verificationUrl || '',
      certificateUrl: badge.certificateUrl || '',
      issuedAt: badge.issuedAt ? badge.issuedAt.split('T')[0] : '',
      expiresAt: badge.expiresAt ? badge.expiresAt.split('T')[0] : '',
      displayOnPublicPage: badge.displayOnPublicPage,
    });
  };
  
  const copyTrustUrl = () => {
    navigator.clipboard.writeText(trustPageUrl);
    toast({ title: 'Copied!', description: 'Trust page URL copied to clipboard.' });
  };
  
  const isExpired = (badge: ComplianceBadge) => {
    if (!badge.expiresAt) return false;
    return new Date(badge.expiresAt) < new Date();
  };
  
  const isExpiringSoon = (badge: ComplianceBadge) => {
    if (!badge.expiresAt) return false;
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiresAt = new Date(badge.expiresAt);
    return expiresAt > new Date() && expiresAt < thirtyDaysFromNow;
  };
  
  const BadgeForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Compliance Type</Label>
        <Select
          value={formData.type}
          onValueChange={(v) => setFormData({ ...formData, type: v as ComplianceType, name: badgeTypes?.[v as ComplianceType]?.name || '' })}
          disabled={!!editingBadge}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {badgeTypes && Object.entries(badgeTypes).map(([key, meta]) => (
              <SelectItem key={key} value={key}>
                {meta.icon} {meta.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label>Display Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., SOC 2 Type II"
        />
      </div>
      
      <div className="space-y-2">
        <Label>Description (optional)</Label>
        <Textarea
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of this certification..."
          rows={2}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Issued Date</Label>
          <Input
            type="date"
            value={formData.issuedAt || ''}
            onChange={(e) => setFormData({ ...formData, issuedAt: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Expiration Date</Label>
          <Input
            type="date"
            value={formData.expiresAt || ''}
            onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>Verification URL (optional)</Label>
        <Input
          type="url"
          value={formData.verificationUrl || ''}
          onChange={(e) => setFormData({ ...formData, verificationUrl: e.target.value })}
          placeholder="https://verify.example.com/..."
        />
        <p className="text-xs text-muted-foreground">Link to third-party verification page</p>
      </div>
      
      <div className="space-y-2">
        <Label>Certificate URL (optional)</Label>
        <Input
          type="url"
          value={formData.certificateUrl || ''}
          onChange={(e) => setFormData({ ...formData, certificateUrl: e.target.value })}
          placeholder="https://example.com/certificate.pdf"
        />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Verified</Label>
          <p className="text-xs text-muted-foreground">Mark as independently verified</p>
        </div>
        <Switch
          checked={formData.isVerified}
          onCheckedChange={(checked) => setFormData({ ...formData, isVerified: checked })}
        />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Display on Trust Page</Label>
          <p className="text-xs text-muted-foreground">Show this badge publicly</p>
        </div>
        <Switch
          checked={formData.displayOnPublicPage}
          onCheckedChange={(checked) => setFormData({ ...formData, displayOnPublicPage: checked })}
        />
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 flex-1 space-y-6">
      <div>
        <h1 className="text-lg font-semibold md:text-2xl font-headline flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Compliance & Trust Badges
        </h1>
        <p className="text-muted-foreground">
          Manage your security certifications and compliance badges to build trust with customers.
        </p>
      </div>
      
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Badges</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.verified}</p>
                  <p className="text-xs text-muted-foreground">Verified</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.expiringSoon}</p>
                  <p className="text-xs text-muted-foreground">Expiring Soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.expired}</p>
                  <p className="text-xs text-muted-foreground">Expired</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <Tabs defaultValue="badges">
        <TabsList>
          <TabsTrigger value="badges">Badges</TabsTrigger>
          <TabsTrigger value="trust-page">Trust Page</TabsTrigger>
        </TabsList>
        
        <TabsContent value="badges" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Your Compliance Badges</CardTitle>
                <CardDescription>
                  Add certifications and compliance badges that your organization has achieved.
                </CardDescription>
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Badge
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Compliance Badge</DialogTitle>
                    <DialogDescription>
                      Add a new compliance certification or security badge.
                    </DialogDescription>
                  </DialogHeader>
                  <BadgeForm />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={createBadge.isPending}>
                      {createBadge.isPending ? 'Adding...' : 'Add Badge'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {badgesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading badges...</div>
              ) : !badges?.length ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No compliance badges yet.</p>
                  <p className="text-sm text-muted-foreground">Add your first certification to start building trust.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {badges.map((badge) => (
                    <div
                      key={badge.id}
                      className={`flex items-center justify-between p-4 border rounded-lg ${
                        isExpired(badge) ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950' :
                        isExpiringSoon(badge) ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950' :
                        ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-3xl">{BADGE_ICONS[badge.type]}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{badge.name}</h3>
                            {badge.isVerified && (
                              <Badge variant="secondary" className="text-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                            {isExpired(badge) && (
                              <Badge variant="destructive">Expired</Badge>
                            )}
                            {isExpiringSoon(badge) && !isExpired(badge) && (
                              <Badge variant="outline" className="text-yellow-600">Expiring Soon</Badge>
                            )}
                            {!badge.displayOnPublicPage && (
                              <Badge variant="outline">Hidden</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {badge.description || badgeTypes?.[badge.type]?.description}
                          </p>
                          {badge.expiresAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Expires: {new Date(badge.expiresAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {badge.verificationUrl && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={badge.verificationUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Dialog open={editingBadge?.id === badge.id} onOpenChange={(open) => { if (!open) { setEditingBadge(null); resetForm(); } }}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(badge)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Badge</DialogTitle>
                              <DialogDescription>
                                Update compliance badge details.
                              </DialogDescription>
                            </DialogHeader>
                            <BadgeForm />
                            <DialogFooter>
                              <Button variant="outline" onClick={() => { setEditingBadge(null); resetForm(); }}>Cancel</Button>
                              <Button onClick={handleUpdate} disabled={updateBadge.isPending}>
                                {updateBadge.isPending ? 'Saving...' : 'Save Changes'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Badge?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove the {badge.name} badge from your organization. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(badge.id)}>Delete</AlertDialogAction>
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
        </TabsContent>
        
        <TabsContent value="trust-page" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Public Trust Page</CardTitle>
              <CardDescription>
                Share your compliance status with customers and prospects through a public trust page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Your Trust Page URL</Label>
                <div className="flex gap-2">
                  <Input value={trustPageUrl} readOnly />
                  <Button variant="outline" onClick={copyTrustUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={trustPageUrl} target="_blank" rel="noopener noreferrer">
                      <Eye className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with customers to showcase your security compliance.
                </p>
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">What&apos;s displayed on your trust page:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ Your company name and logo (from branding settings)</li>
                  <li>✓ All badges marked as &quot;Display on Trust Page&quot;</li>
                  <li>✓ Verification status and links</li>
                  <li>✓ Certification dates and expiration</li>
                </ul>
              </div>
              
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">💡 Pro tip</h4>
                <p className="text-sm text-muted-foreground">
                  Add your trust page URL to your website footer, sales materials, and security questionnaire responses 
                  to streamline vendor due diligence processes.
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Embed Badges</CardTitle>
              <CardDescription>
                Embed compliance badges directly on your website.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>HTML Embed Code</Label>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`<a href="${trustPageUrl}" target="_blank">
  <img src="${typeof window !== 'undefined' ? window.location.origin : ''}/api/compliance/public/${organizationId}/badge.svg" 
       alt="Security Compliance" />
</a>`}
                  </pre>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="absolute top-2 right-2"
                    onClick={() => {
                      navigator.clipboard.writeText(`<a href="${trustPageUrl}" target="_blank"><img src="${window.location.origin}/api/compliance/public/${organizationId}/badge.svg" alt="Security Compliance" /></a>`);
                      toast({ title: 'Copied!', description: 'Embed code copied to clipboard.' });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
