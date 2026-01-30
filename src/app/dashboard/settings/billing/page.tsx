'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Check,
  AlertCircle,
  Loader2,
  ArrowUpRight,
  Crown,
  Zap,
  Building2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface Subscription {
  status: string;
  tier: string;
  tierName: string;
  periodEnd: string | null;
  usage: {
    scansUsed: number;
    scansLimit: number;
    scansRemaining: number | 'unlimited';
    resetAt: string;
  };
  limits: {
    scansPerMonth: number;
    teamMembers: number;
    historyDays: number;
    apiAccess: boolean;
    customBranding: boolean;
    prioritySupport: boolean;
    scheduledScans: boolean;
  };
  features: string[];
}

const tierIcons: Record<string, any> = {
  FREE: Zap,
  PRO: Crown,
  ENTERPRISE: Building2,
};

const tierColors: Record<string, string> = {
  FREE: 'text-slate-400',
  PRO: 'text-cyan-400',
  ENTERPRISE: 'text-purple-400',
};

export default function BillingPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setMessage({ type: 'success', text: 'Your subscription has been updated successfully!' });
    } else if (searchParams.get('canceled') === 'true') {
      setMessage({ type: 'error', text: 'Checkout was canceled.' });
    }
  }, [searchParams]);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/billing/subscription`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tier: 'PRO' | 'ENTERPRISE') => {
    setActionLoading(tier);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/billing/checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tier, billingPeriod: 'monthly' }),
        }
      );

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      setMessage({ type: 'error', text: 'Failed to start checkout. Please try again.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading('portal');
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/billing/portal`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      setMessage({ type: 'error', text: 'Failed to open billing portal. Please try again.' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  const TierIcon = subscription ? tierIcons[subscription.tier] || Zap : Zap;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & Subscription</h1>
        <p className="text-slate-400 mt-1">Manage your subscription and billing settings</p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                subscription?.tier === 'PRO'
                  ? 'bg-cyan-500/20'
                  : subscription?.tier === 'ENTERPRISE'
                  ? 'bg-purple-500/20'
                  : 'bg-slate-700'
              }`}
            >
              <TierIcon className={`w-6 h-6 ${tierColors[subscription?.tier || 'FREE']}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {subscription?.tierName || 'Free'} Plan
              </h2>
              <p className="text-sm text-slate-400">
                {subscription?.status === 'ACTIVE'
                  ? `Renews on ${new Date(subscription.periodEnd!).toLocaleDateString()}`
                  : subscription?.status === 'PAST_DUE'
                  ? 'Payment past due'
                  : subscription?.status === 'TRIALING'
                  ? 'Trial period active'
                  : 'Free tier'}
              </p>
            </div>
          </div>

          {subscription?.tier !== 'FREE' && (
            <button
              onClick={handleManageBilling}
              disabled={actionLoading === 'portal'}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'portal' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              Manage Billing
            </button>
          )}
        </div>

        {/* Usage Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-1">Scans Used</p>
            <p className="text-2xl font-bold text-white">
              {subscription?.usage.scansUsed || 0}
              <span className="text-sm font-normal text-slate-400 ml-1">
                /{' '}
                {subscription?.usage.scansLimit === -1
                  ? '∞'
                  : subscription?.usage.scansLimit || 3}
              </span>
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-1">Team Members</p>
            <p className="text-2xl font-bold text-white">
              {subscription?.limits.teamMembers === -1
                ? 'Unlimited'
                : subscription?.limits.teamMembers || 1}
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-1">History Retention</p>
            <p className="text-2xl font-bold text-white">
              {subscription?.limits.historyDays === -1
                ? 'Unlimited'
                : `${subscription?.limits.historyDays || 7} days`}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {subscription?.usage.scansLimit !== -1 && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">Monthly scan usage</span>
              <span className="text-white">
                {subscription?.usage.scansRemaining === 'unlimited'
                  ? 'Unlimited remaining'
                  : `${subscription?.usage.scansRemaining} remaining`}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    ((subscription?.usage.scansUsed || 0) /
                      (subscription?.usage.scansLimit || 3)) *
                      100
                  )}%`,
                }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Resets on{' '}
              {subscription?.usage.resetAt
                ? new Date(subscription.usage.resetAt).toLocaleDateString()
                : 'N/A'}
            </p>
          </div>
        )}

        {/* Feature List */}
        {subscription?.features && (
          <div className="border-t border-slate-700 pt-4 mt-4">
            <p className="text-sm font-medium text-slate-300 mb-3">Plan Features</p>
            <div className="grid md:grid-cols-2 gap-2">
              {subscription.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-slate-400">
                  <Check className="w-4 h-4 text-cyan-500" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upgrade Options */}
      {subscription?.tier !== 'ENTERPRISE' && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Upgrade Your Plan</h2>

          <div className="grid md:grid-cols-2 gap-4">
            {subscription?.tier === 'FREE' && (
              <div className="bg-gradient-to-br from-cyan-500/10 to-blue-600/10 rounded-xl border border-cyan-500/30 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Crown className="w-6 h-6 text-cyan-400" />
                  <h3 className="text-lg font-semibold text-white">Pro</h3>
                </div>
                <p className="text-slate-400 text-sm mb-4">
                  50 scans/month, 5 team members, priority support
                </p>
                <p className="text-2xl font-bold text-white mb-4">
                  $99<span className="text-sm font-normal text-slate-400">/month</span>
                </p>
                <button
                  onClick={() => handleUpgrade('PRO')}
                  disabled={actionLoading === 'PRO'}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50"
                >
                  {actionLoading === 'PRO' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Upgrade to Pro
                      <ArrowUpRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="bg-gradient-to-br from-purple-500/10 to-pink-600/10 rounded-xl border border-purple-500/30 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="w-6 h-6 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">Enterprise</h3>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Unlimited scans, API access, white-labeling, dedicated support
              </p>
              <p className="text-2xl font-bold text-white mb-4">
                $299<span className="text-sm font-normal text-slate-400">/month</span>
              </p>
              <button
                onClick={() => handleUpgrade('ENTERPRISE')}
                disabled={actionLoading === 'ENTERPRISE'}
                className="w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
              >
                {actionLoading === 'ENTERPRISE' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Upgrade to Enterprise
                    <ArrowUpRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Link */}
      {subscription?.tier !== 'FREE' && (
        <div className="text-center">
          <button
            onClick={handleManageBilling}
            className="text-cyan-400 hover:text-cyan-300 text-sm underline"
          >
            View payment history and invoices →
          </button>
        </div>
      )}
    </div>
  );
}
