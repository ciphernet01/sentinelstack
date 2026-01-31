'use client';

import { useState, useEffect } from 'react';
import { useBranding, useUpdateBranding, useVerifyDomain, useDomainVerificationInfo, useResetBranding, BrandingUpdateData } from '@/hooks/use-branding';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import { Palette, Globe, Mail, FileText, RefreshCw, Check, X, Copy, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function BrandingPage() {
  const { data: branding, isLoading } = useBranding();
  const { data: domainInfo } = useDomainVerificationInfo();
  const updateBranding = useUpdateBranding();
  const verifyDomain = useVerifyDomain();
  const resetBranding = useResetBranding();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<BrandingUpdateData>({
    logoUrl: '',
    faviconUrl: '',
    companyName: '',
    primaryColor: '#6366f1',
    secondaryColor: '',
    accentColor: '',
    customDomain: '',
    emailFromName: '',
    emailReplyTo: '',
    reportLogoUrl: '',
    reportFooterText: '',
    reportHeaderText: '',
    hidePoweredBy: false,
  });
  
  useEffect(() => {
    if (branding) {
      setFormData({
        logoUrl: branding.logoUrl || '',
        faviconUrl: branding.faviconUrl || '',
        companyName: branding.companyName || '',
        primaryColor: branding.primaryColor || '#6366f1',
        secondaryColor: branding.secondaryColor || '',
        accentColor: branding.accentColor || '',
        customDomain: branding.customDomain || '',
        emailFromName: branding.emailFromName || '',
        emailReplyTo: branding.emailReplyTo || '',
        reportLogoUrl: branding.reportLogoUrl || '',
        reportFooterText: branding.reportFooterText || '',
        reportHeaderText: branding.reportHeaderText || '',
        hidePoweredBy: branding.hidePoweredBy || false,
      });
    }
  }, [branding]);
  
  const handleSave = async () => {
    try {
      await updateBranding.mutateAsync(formData);
      toast({
        title: 'Branding Updated',
        description: 'Your branding settings have been saved.',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to update branding',
        variant: 'destructive',
      });
    }
  };
  
  const handleVerifyDomain = async () => {
    try {
      const result = await verifyDomain.mutateAsync();
      toast({
        title: result.verified ? 'Domain Verified!' : 'Verification Pending',
        description: result.message,
        variant: result.verified ? 'default' : 'destructive',
      });
    } catch (err: any) {
      toast({
        title: 'Verification Failed',
        description: err.response?.data?.message || 'Failed to verify domain',
        variant: 'destructive',
      });
    }
  };
  
  const handleReset = async () => {
    try {
      await resetBranding.mutateAsync();
      setFormData({
        logoUrl: '',
        faviconUrl: '',
        companyName: '',
        primaryColor: '#6366f1',
        secondaryColor: '',
        accentColor: '',
        customDomain: '',
        emailFromName: '',
        emailReplyTo: '',
        reportLogoUrl: '',
        reportFooterText: '',
        reportHeaderText: '',
        hidePoweredBy: false,
      });
      toast({
        title: 'Branding Reset',
        description: 'Your branding has been reset to defaults.',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to reset branding',
        variant: 'destructive',
      });
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Value copied to clipboard.',
    });
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-8 text-muted-foreground">Loading branding settings...</div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">White-Label Branding</h1>
          <p className="text-muted-foreground">
            Customize the look and feel of SentinelStack for your organization.
          </p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Branding?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all custom branding and restore the default SentinelStack branding.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={handleSave} disabled={updateBranding.isPending}>
            {updateBranding.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="appearance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="domain" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Custom Domain
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>
        
        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logo & Identity</CardTitle>
              <CardDescription>
                Customize your organization&apos;s logo and branding identity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    placeholder="Your Company Name"
                    value={formData.companyName || ''}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Displayed in the header and emails instead of &quot;SentinelStack&quot;
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    placeholder="https://example.com/logo.png"
                    value={formData.logoUrl || ''}
                    onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Recommended: 200x50px PNG with transparent background
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="faviconUrl">Favicon URL</Label>
                  <Input
                    id="faviconUrl"
                    placeholder="https://example.com/favicon.ico"
                    value={formData.faviconUrl || ''}
                    onChange={(e) => setFormData({ ...formData, faviconUrl: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    32x32px ICO or PNG for browser tabs
                  </p>
                </div>
                <div className="space-y-2 flex items-center justify-between pt-6">
                  <div>
                    <Label htmlFor="hidePoweredBy">Hide &quot;Powered by SentinelStack&quot;</Label>
                    <p className="text-xs text-muted-foreground">
                      Remove the SentinelStack attribution
                    </p>
                  </div>
                  <Switch
                    id="hidePoweredBy"
                    checked={formData.hidePoweredBy}
                    onCheckedChange={(checked) => setFormData({ ...formData, hidePoweredBy: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Brand Colors</CardTitle>
              <CardDescription>
                Customize the color scheme to match your brand.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={formData.primaryColor || '#6366f1'}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-14 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.primaryColor || '#6366f1'}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      placeholder="#6366f1"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Main brand color for buttons and links
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondaryColor"
                      type="color"
                      value={formData.secondaryColor || '#64748b'}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      className="w-14 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.secondaryColor || ''}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      placeholder="#64748b"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Secondary accent color
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accentColor">Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accentColor"
                      type="color"
                      value={formData.accentColor || '#f59e0b'}
                      onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                      className="w-14 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.accentColor || ''}
                      onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                      placeholder="#f59e0b"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Highlights and alerts
                  </p>
                </div>
              </div>
              
              {/* Color Preview */}
              <div className="mt-6 p-4 border rounded-lg">
                <p className="text-sm font-medium mb-3">Preview</p>
                <div className="flex gap-3 items-center">
                  <Button style={{ backgroundColor: formData.primaryColor }}>
                    Primary Button
                  </Button>
                  <Button variant="outline" style={{ borderColor: formData.primaryColor, color: formData.primaryColor }}>
                    Outline Button
                  </Button>
                  <Badge style={{ backgroundColor: formData.secondaryColor || '#64748b' }}>
                    Badge
                  </Badge>
                  <span style={{ color: formData.accentColor || '#f59e0b' }} className="font-medium">
                    Accent Text
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Custom Domain Tab */}
        <TabsContent value="domain" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Domain</CardTitle>
              <CardDescription>
                Use your own domain to access SentinelStack (e.g., security.yourcompany.com).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customDomain">Custom Domain</Label>
                <div className="flex gap-2">
                  <Input
                    id="customDomain"
                    placeholder="security.yourcompany.com"
                    value={formData.customDomain || ''}
                    onChange={(e) => setFormData({ ...formData, customDomain: e.target.value })}
                  />
                  {branding?.customDomain && (
                    <Badge variant={branding.domainVerified ? 'default' : 'secondary'} className="shrink-0">
                      {branding.domainVerified ? (
                        <><Check className="h-3 w-3 mr-1" /> Verified</>
                      ) : (
                        <><AlertTriangle className="h-3 w-3 mr-1" /> Pending</>
                      )}
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Domain Verification Instructions */}
              {domainInfo && !domainInfo.verified && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Domain Verification Required</span>
                  </div>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Add the following DNS TXT record to verify ownership of your domain:
                  </p>
                  <div className="bg-white dark:bg-slate-800 p-3 rounded border space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Record Type:</span>
                      <code className="bg-muted px-2 py-1 rounded text-sm">{domainInfo.instructions.recordType}</code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Name:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-sm text-xs">{domainInfo.instructions.recordName}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(domainInfo.instructions.recordName)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Value:</span>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-xs max-w-[200px] truncate">{domainInfo.instructions.recordValue}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(domainInfo.instructions.recordValue)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {domainInfo.instructions.note}
                  </p>
                  <Button onClick={handleVerifyDomain} disabled={verifyDomain.isPending} className="w-full">
                    {verifyDomain.isPending ? 'Verifying...' : 'Verify Domain'}
                  </Button>
                </div>
              )}
              
              {branding?.domainVerified && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                    <Check className="h-4 w-4" />
                    <span className="font-medium">Domain Verified</span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Your custom domain is active. Users can access SentinelStack at{' '}
                    <a href={`https://${branding.customDomain}`} className="underline" target="_blank" rel="noopener noreferrer">
                      https://{branding.customDomain}
                    </a>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Email Tab */}
        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Branding</CardTitle>
              <CardDescription>
                Customize how emails appear to your users.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="emailFromName">From Name</Label>
                  <Input
                    id="emailFromName"
                    placeholder="ACME Security Team"
                    value={formData.emailFromName || ''}
                    onChange={(e) => setFormData({ ...formData, emailFromName: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    The sender name shown in emails
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailReplyTo">Reply-To Address</Label>
                  <Input
                    id="emailReplyTo"
                    type="email"
                    placeholder="security@yourcompany.com"
                    value={formData.emailReplyTo || ''}
                    onChange={(e) => setFormData({ ...formData, emailReplyTo: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Where replies to emails will be sent
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Report Branding</CardTitle>
              <CardDescription>
                Customize the appearance of generated PDF reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reportLogoUrl">Report Logo URL</Label>
                <Input
                  id="reportLogoUrl"
                  placeholder="https://example.com/report-logo.png"
                  value={formData.reportLogoUrl || ''}
                  onChange={(e) => setFormData({ ...formData, reportLogoUrl: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Logo displayed at the top of PDF reports. Recommended: 300x100px
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportHeaderText">Report Header Text</Label>
                <Input
                  id="reportHeaderText"
                  placeholder="Security Assessment Report"
                  value={formData.reportHeaderText || ''}
                  onChange={(e) => setFormData({ ...formData, reportHeaderText: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Custom header text for reports
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportFooterText">Report Footer Text</Label>
                <Textarea
                  id="reportFooterText"
                  placeholder="Confidential - ACME Corporation Security Team"
                  value={formData.reportFooterText || ''}
                  onChange={(e) => setFormData({ ...formData, reportFooterText: e.target.value })}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Custom footer text for reports (e.g., confidentiality notice)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
