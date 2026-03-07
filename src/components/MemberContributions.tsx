import { useEffect, useMemo, useState } from 'react';
import {
  getAllContributionCategories,
  getMemberContributions,
  updateMemberProfile,
} from '../supabase';
import {
  Member,
  MemberContribution,
} from '../types';
import {
  ChevronDown,
  Coins,
  FolderTree,
  Lock,
  TrendingUp,
  TrendingDown,
  Save,
  UserCircle2,
} from 'lucide-react';
import { authService } from '../services/authService';

interface MemberContributionsProps {
  member: Member;
  onMemberUpdated: (member: Member) => void;
}

const PIE_COLORS = [
  '#22c55e',
  '#06b6d4',
  '#0ea5e9',
  '#6366f1',
  '#a855f7',
  '#f97316',
  '#f59e0b',
  '#ef4444',
  '#14b8a6',
  '#84cc16',
];

const getGroupedCategoryKey = (category: string | null | undefined): string => {
  const normalized = (category || '').toString().trim().toLowerCase();

  if (
    normalized === 'kofi' ||
    normalized === 'ama' ||
    normalized === 'kofi&ama' ||
    normalized === 'kofi & ama' ||
    normalized === 'kofi-ama' ||
    normalized === 'kofi_ama'
  ) {
    return 'kofi-ama';
  }

  return normalized;
};

const formatCategoryLabel = (category: string): string => {
  if (!category) {
    return 'No Category';
  }

  if (category === 'kofi-ama') {
    return 'Kofi & Ama';
  }

  return category
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value || 0);

const formatMonthLabel = (yearMonth: string) => {
  const [year, month] = yearMonth.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

const formatDateLabel = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export default function MemberContributions({ member, onMemberUpdated }: MemberContributionsProps) {
  const [profileForm, setProfileForm] = useState({
    name: member.name || '',
    phone: member.phone || '',
    address: member.address || '',
    city: member.city || '',
    province: member.province || '',
    postal_code: member.postal_code || '',
    date_of_birth: member.date_of_birth || '',
    dob_month: member.dob_month?.toString() || '',
    dob_day: member.dob_day?.toString() || '',
    day_born: member.day_born || '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [contributions, setContributions] = useState<MemberContribution[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [contributionLoading, setContributionLoading] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showRecentContributions, setShowRecentContributions] = useState(false);
  const [showProfileFields, setShowProfileFields] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setProfileForm({
      name: member.name || '',
      phone: member.phone || '',
      address: member.address || '',
      city: member.city || '',
      province: member.province || '',
      postal_code: member.postal_code || '',
      date_of_birth: member.date_of_birth || '',
      dob_month: member.dob_month?.toString() || '',
      dob_day: member.dob_day?.toString() || '',
      day_born: member.day_born || '',
    });
  }, [member]);

  useEffect(() => {
    void loadContributions();
    void loadAllCategories();
  }, [member.id]);

  useEffect(() => {
    if (showProfile) {
      setShowProfileFields(false);
      setShowPasswordFields(false);
    }
  }, [showProfile]);

  const groupedByFolder = useMemo(() => {
    const grouped: Record<string, Record<string, Record<string, MemberContribution[]>>> = {};

    for (const item of contributions) {
      const [year, month] = item.contributionDate.split('-');
      const yearMonth = `${year}-${month}`;

      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][yearMonth]) grouped[year][yearMonth] = {};
      if (!grouped[year][yearMonth][item.contributionDate]) {
        grouped[year][yearMonth][item.contributionDate] = [];
      }
      grouped[year][yearMonth][item.contributionDate].push(item);
    }

    return grouped;
  }, [contributions]);

  const grandTotal = useMemo(
    () => contributions.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [contributions]
  );

  const categorySummaries = useMemo(() => {
    const totals = new Map<string, { total: number; count: number }>();

    // First, initialize all categories with 0 contributions
    for (const category of allCategories) {
      const key = getGroupedCategoryKey(category);
      if (!totals.has(key)) {
        totals.set(key, { total: 0, count: 0 });
      }
    }

    // Then, add actual contributions
    for (const item of contributions) {
      const key = getGroupedCategoryKey(item.category);
      const amount = Number(item.amount || 0);
      const existing = totals.get(key);

      if (existing) {
        existing.total += amount;
        existing.count += 1;
      } else {
        totals.set(key, { total: amount, count: 1 });
      }
    }

    return Array.from(totals.entries())
      .filter(([key]) => {
        // Hide development fund category only if member explicitly has pledge = false
        // If undefined or true, show the category
        const isDevelopmentFund = 
          key === 'development-fund' || 
          key === 'development_fund' || 
          key === 'dev_fund' || 
          key === 'dev-fund' ||
          key === 'developmentfund' ||
          key === 'devfund';
        
        // Show category if: not dev fund, OR pledge is not explicitly false
        return !isDevelopmentFund || member.dev_fund_pledge !== false;
      })
      .map(([key, stats]) => ({
        key,
        label: formatCategoryLabel(key),
        total: stats.total,
        count: stats.count,
      }))
      .sort((a, b) => b.total - a.total)
      .map((entry, index) => ({
        ...entry,
        percentage: grandTotal > 0 ? (entry.total / grandTotal) * 100 : 0,
        color: PIE_COLORS[index % PIE_COLORS.length],
      }));
  }, [contributions, allCategories, grandTotal, member.dev_fund_pledge]);

  const monthlyTotals = useMemo(() => {
    const monthMap = new Map<string, number>();
    
    contributions.forEach((contrib) => {
      const [year, month] = contrib.contributionDate.split('-');
      const monthKey = `${year}-${month}`;
      const amount = monthMap.get(monthKey) || 0;
      monthMap.set(monthKey, amount + (contrib.amount || 0));
    });

    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monthKey, total]) => ({
        month: formatMonthLabel(monthKey),
        total,
      }));
  }, [contributions]);

  const recentContributions = useMemo(() => contributions.slice(0, 5), [contributions]);

  const loadContributions = async () => {
    setContributionLoading(true);
    setError(null);
    try {
      const rows = await getMemberContributions(member.id);
      setContributions(rows);
    } catch (err: any) {
      setError(err?.message || 'Failed to load contributions.');
    } finally {
      setContributionLoading(false);
    }
  };

  const loadAllCategories = async () => {
    try {
      const categories = await getAllContributionCategories();
      setAllCategories(categories);
    } catch (err: any) {
      console.warn('Failed to load all categories:', err);
    }
  };

  const handleSaveProfile = async () => {
    if (!profileForm.name.trim()) {
      setError('Name is required.');
      return;
    }

    setProfileLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateMemberProfile(member.id, {
        name: profileForm.name,
        phone: profileForm.phone,
        address: profileForm.address,
        city: profileForm.city,
        province: profileForm.province,
        postal_code: profileForm.postal_code,
        date_of_birth: profileForm.date_of_birth,
        dob_month: profileForm.dob_month ? parseInt(profileForm.dob_month) : undefined,
        dob_day: profileForm.dob_day ? parseInt(profileForm.dob_day) : undefined,
        day_born: profileForm.day_born,
      });

      onMemberUpdated({
        ...member,
        name: updated.name,
        phone: updated.phone || undefined,
        address: updated.address || undefined,
        city: updated.city || undefined,
        province: updated.province || undefined,
        postal_code: updated.postal_code || undefined,
        date_of_birth: updated.date_of_birth || undefined,
        dob_month: updated.dob_month,
        dob_day: updated.dob_day,
        day_born: updated.day_born || undefined,
        updated_at: updated.updated_at || undefined,
      });

      setSuccess('Profile update successful.');
      setTimeout(() => setSuccess(null), 2500);
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const resetPasswordForm = () => {
    setPasswordForm({
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  };

  const handleChangePassword = async () => {
    const oldPassword = passwordForm.oldPassword;
    const newPassword = passwordForm.newPassword;
    const confirmPassword = passwordForm.confirmPassword;

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('Please fill in old password, new password, and confirm password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (oldPassword === newPassword) {
      setError('New password must be different from old password.');
      return;
    }

    setPasswordLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: changeError } = await authService.changePasswordWithOldPassword(
        oldPassword,
        newPassword,
        member.email || member.class_number
      );

      if (changeError) {
        setError(changeError);
        return;
      }

      setSuccess('Password change successful.');
      resetPasswordForm();
      setTimeout(() => setSuccess(null), 2500);
    } catch (err: any) {
      setError(err?.message || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
          {success}
        </div>
      )}

      {/* Profile Toggle Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowProfile(!showProfile)}
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
        >
          <UserCircle2 className="h-4 w-4" />
          {showProfile ? 'Back to Dashboard' : 'View / Update Profile'}
        </button>
      </div>

      {!showProfile && (
      <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/55 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Coins className="h-5 w-5 text-emerald-300" />
          Contributions Dashboard
        </h2>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
            <p className="text-xs text-emerald-200">Grand Total</p>
            <p className="text-lg font-bold text-white">{formatCurrency(grandTotal)}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
            <p className="text-xs text-slate-300">Total Entries</p>
            <p className="text-lg font-bold text-white">{contributions.length}</p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 md:p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <TrendingUp className="h-4 w-4 text-cyan-300" />
            Contribution Trend (Monthly)
          </h3>

          {monthlyTotals.length === 0 ? (
            <p className="text-sm text-slate-400">No contribution data available yet.</p>
          ) : (
            <div className="space-y-4">
              {/* Monthly Contribution List */}
              <div className="space-y-2 rounded-lg bg-slate-950/50 p-3">
                {monthlyTotals.map((month, idx) => {
                  const isUp = idx > 0 && month.total > monthlyTotals[idx - 1].total;
                  const isDown = idx > 0 && month.total < monthlyTotals[idx - 1].total;
                  const trend = idx === 0 ? null : isUp ? 'up' : isDown ? 'down' : 'flat';

                  return (
                    <div key={month.month} className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-900 p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-300">{month.month}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-emerald-300">{formatCurrency(month.total)}</span>
                        {trend && (
                          <div className={`flex items-center gap-1 ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                            {trend === 'up' ? (
                              <>
                                <TrendingUp className="h-4 w-4" />
                                <span className="text-xs font-semibold">+{formatCurrency(month.total - monthlyTotals[idx - 1].total)}</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="h-4 w-4" />
                                <span className="text-xs font-semibold">{formatCurrency(month.total - monthlyTotals[idx - 1].total)}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Category Summary */}
              {categorySummaries.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-700 bg-slate-900 p-2">
                    <p className="text-[10px] text-slate-300">Categories Used</p>
                    <p className="text-base font-bold text-white">{categorySummaries.length}</p>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-900 p-2">
                    <p className="text-[10px] text-slate-300">Latest</p>
                    <p className="text-[10px] font-semibold text-white">
                      {recentContributions[0] ? formatDateLabel(recentContributions[0].contributionDate) : 'No data'}
                    </p>
                  </div>
                </div>
              )}

              {/* Category List */}
              {categorySummaries.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                  {categorySummaries.map((entry) => (
                    <div key={entry.key} className="min-w-0 rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1.5 md:px-3 md:py-2">
                      <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-1.5 md:gap-2">
                        <span
                          className="mt-0.5 h-2 w-2 shrink-0 rounded-full md:h-2.5 md:w-2.5"
                          style={{ backgroundColor: PIE_COLORS[categorySummaries.indexOf(entry) % PIE_COLORS.length] }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold text-white md:text-xs">{entry.label}</p>
                          <p className="text-[10px] text-slate-400 md:text-[11px]">
                            {entry.count} {entry.count === 1 ? 'entry' : 'entries'} • {entry.percentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 text-[11px] font-semibold text-emerald-300 md:text-xs">{formatCurrency(entry.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/70 p-4">
          <button
            onClick={() => setShowRecentContributions(!showRecentContributions)}
            className="mb-3 flex w-full items-center justify-between text-sm font-semibold text-slate-100 transition hover:text-white"
          >
            <span>Recent Contributions (Top 5)</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showRecentContributions ? 'rotate-180' : ''}`}
            />
          </button>
          {showRecentContributions && (
            recentContributions.length === 0 ? (
              <p className="text-sm text-slate-400">No recent contributions available.</p>
            ) : (
              <div className="space-y-2">
                {recentContributions.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">
                        {formatCategoryLabel(getGroupedCategoryKey(item.category))}
                      </p>
                      <p className="text-[11px] text-slate-400">{formatDateLabel(item.contributionDate)}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-emerald-300">{formatCurrency(item.amount)}</p>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/55 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <FolderTree className="h-5 w-5 text-indigo-300" />
          Contributions by Year / Month / Date
        </h2>

        {contributionLoading ? (
          <p className="text-sm text-slate-300">Loading contributions...</p>
        ) : contributions.length === 0 ? (
          <p className="text-sm text-slate-400">No contributions recorded yet.</p>
        ) : (
          <div className="max-h-[600px] space-y-2 overflow-y-auto pr-2">
            {Object.keys(groupedByFolder)
              .sort((a, b) => Number(b) - Number(a))
              .map((year) => (
                <details key={year} className="group rounded-lg border border-slate-700 bg-slate-900/70 p-2">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-100 hover:text-cyan-300">
                    📅 Year {year} ({Object.keys(groupedByFolder[year]).length} months)
                  </summary>
                  <div className="mt-2 space-y-2 pl-4">
                    {Object.keys(groupedByFolder[year])
                      .sort((a, b) => b.localeCompare(a))
                      .map((yearMonth) => {
                        const monthTotal = Object.values(groupedByFolder[year][yearMonth])
                          .flat()
                          .reduce((sum, item) => sum + Number(item.amount || 0), 0);
                        return (
                          <details key={yearMonth} className="rounded-lg border border-slate-700 bg-slate-900 p-2">
                            <summary className="cursor-pointer text-xs font-medium text-slate-200 hover:text-emerald-300">
                              📁 {formatMonthLabel(yearMonth)} - {formatCurrency(monthTotal)}
                            </summary>
                            <div className="mt-2 space-y-1 pl-4">
                              {Object.keys(groupedByFolder[year][yearMonth])
                                .sort((a, b) => b.localeCompare(a))
                                .map((date) => {
                                  const dayTotal = groupedByFolder[year][yearMonth][date].reduce(
                                    (sum, item) => sum + Number(item.amount || 0),
                                    0
                                  );
                                  return (
                                    <details key={date} className="rounded-lg border border-slate-700 bg-slate-950/80 p-2">
                                      <summary className="cursor-pointer text-xs text-slate-300 hover:text-white">
                                        📄 {formatDateLabel(date)} - {formatCurrency(dayTotal)}
                                      </summary>
                                      <div className="mt-2 space-y-1 pl-4">
                                        {groupedByFolder[year][yearMonth][date].map((item) => (
                                          <div
                                            key={item.id}
                                            className="flex items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5"
                                          >
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-semibold text-white truncate">
                                                {formatCategoryLabel(getGroupedCategoryKey(item.category))}
                                              </p>
                                              <p className="text-xs text-slate-400 truncate">
                                                {item.note || 'No note'}
                                              </p>
                                            </div>
                                            <span className="text-sm font-bold text-emerald-300 whitespace-nowrap">
                                              {formatCurrency(item.amount)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  );
                                })}
                            </div>
                          </details>
                        );
                      })}
                  </div>
                </details>
              ))}
          </div>
        )}
      </section>

      </>
      )}

      {/* Profile Section - Hidden by Default */}
      {showProfile && (
        <section className="rounded-xl border border-slate-700 bg-slate-900/55 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <UserCircle2 className="h-5 w-5 text-cyan-300" />
            Update Your Profile
          </h2>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <button
                type="button"
                onClick={() => setShowProfileFields((prev) => !prev)}
                className="flex w-full items-center justify-between text-left"
              >
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <UserCircle2 className="h-4 w-4 text-cyan-300" />
                  Member Profile
                </h3>
                <ChevronDown
                  className={`h-4 w-4 text-slate-300 transition-transform ${showProfileFields ? 'rotate-180' : ''}`}
                />
              </button>

              {showProfileFields && (
                <>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="text-sm text-slate-200">
                      Name
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                      />
                    </label>
                    <label className="text-sm text-slate-200">
                      Phone
                      <input
                        type="text"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                      />
                    </label>
                    <label className="text-sm text-slate-200 md:col-span-2">
                      Address
                      <input
                        type="text"
                        value={profileForm.address}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, address: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                      />
                    </label>
                    <label className="text-sm text-slate-200">
                      City
                      <input
                        type="text"
                        value={profileForm.city}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, city: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                      />
                    </label>
                    <label className="text-sm text-slate-200">
                      Province
                      <input
                        type="text"
                        value={profileForm.province}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, province: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                      />
                    </label>
                    <label className="text-sm text-slate-200">
                      Postal Code
                      <input
                        type="text"
                        value={profileForm.postal_code}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, postal_code: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                      />
                    </label>
                    <label className="text-sm text-slate-200">
                      Birth Month
                      <select
                        value={profileForm.dob_month}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, dob_month: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                      >
                        <option value="">Select Month</option>
                        <option value="1">January</option>
                        <option value="2">February</option>
                        <option value="3">March</option>
                        <option value="4">April</option>
                        <option value="5">May</option>
                        <option value="6">June</option>
                        <option value="7">July</option>
                        <option value="8">August</option>
                        <option value="9">September</option>
                        <option value="10">October</option>
                        <option value="11">November</option>
                        <option value="12">December</option>
                      </select>
                    </label>
                    <label className="text-sm text-slate-200">
                      Birth Day
                      <select
                        value={profileForm.dob_day}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, dob_day: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                      >
                        <option value="">Select Day</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                          <option key={day} value={day.toString()}>{day}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-slate-200">
                      Day Born
                      <select
                        value={profileForm.day_born}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, day_born: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                      >
                        <option value="">Select Day</option>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={handleSaveProfile}
                      disabled={profileLoading}
                      className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      {profileLoading ? 'Saving...' : 'Save Profile'}
                    </button>
                  </div>

                  {success === 'Profile update successful.' && (
                    <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100">
                      Profile update successful.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <button
                type="button"
                onClick={() => setShowPasswordFields((prev) => !prev)}
                className="flex w-full items-center justify-between text-left"
              >
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <Lock className="h-4 w-4 text-amber-300" />
                  Change Password
                </h3>
                <ChevronDown
                  className={`h-4 w-4 text-slate-300 transition-transform ${showPasswordFields ? 'rotate-180' : ''}`}
                />
              </button>

              {showPasswordFields && (
                <>
                  <p className="mt-4 text-xs text-slate-400">
                    Enter your old password first. If old password is incorrect, password change will be blocked.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <label className="text-sm text-slate-200">
                      Old Password
                      <input
                        type="password"
                        value={passwordForm.oldPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, oldPassword: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                        autoComplete="current-password"
                      />
                    </label>
                    <label className="text-sm text-slate-200">
                      New Password
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                        autoComplete="new-password"
                      />
                    </label>
                    <label className="text-sm text-slate-200">
                      Confirm New Password
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                        autoComplete="new-password"
                      />
                    </label>
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={handleChangePassword}
                      disabled={passwordLoading}
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Lock className="h-4 w-4" />
                      {passwordLoading ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>

                  {success === 'Password change successful.' && (
                    <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100">
                      Password change successful.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
