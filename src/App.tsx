import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Menu, RefreshCw, Plus } from 'lucide-react';
import { Sidebar, type ActiveTab } from './components/Sidebar';
import { OpportunitiesView } from './components/OpportunitiesView';
import { PipelineBoardView } from './components/PipelineBoardView';
import { ApplicantsView } from './components/ApplicantsView';
import { ScanLogsView } from './components/ScanLogsView';
import { AddApplicantModal, AddOpportunityModal } from './components/Modals';
import { LoginPage } from './components/LoginPage';
import type {
  Applicant,
  ApplicantSpecialty,
  ApplicantStatus,
  Opportunity,
  OpportunityCategory,
  PipelineStage,
  ScanLog,
  SocialPlatform,
  TrackerStore,
} from './types';

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
) {
  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function safeJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export default function App() {
  const [authChecking, setAuthChecking] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [configuredViaEnv, setConfiguredViaEnv] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  const [activeTab, setActiveTab] = useState<ActiveTab>('opportunities');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [scanHistory, setScanHistory] = useState<ScanLog[]>([]);

  const [initialLoading, setInitialLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [addOppOpen, setAddOppOpen] = useState(false);
  const [addApplicantOpen, setAddApplicantOpen] = useState(false);

  const showNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (authToken) {
        headers.set('Authorization', `Bearer ${authToken}`);
      }
      const res = await fetch(input, { ...init, headers });
      if (res.status === 401) {
        setAuthToken(null);
        setUserEmail('');
      }
      return res;
    },
    [authToken]
  );

  // Check authentication status on startup
  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/status');
        if (res.ok) {
          const data = await safeJson<{
            initialized: boolean;
            configuredViaEnv: boolean;
            authenticated: boolean;
            user: { email: string } | null;
          }>(res);
          if (!cancelled) {
            setAuthInitialized(Boolean(data.initialized));
            setConfiguredViaEnv(Boolean(data.configuredViaEnv));
          }
        }
      } catch {
        // Handled cleanly in LoginPage
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    }
    checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedOppRef = useRef<string | null>(null);
  selectedOppRef.current = selectedOpportunityId;

  const handleScan = useCallback(
    async (params: { platform: string; category: string; keywords: string }) => {
      if (!authToken) return;
      setScanning(true);
      setScanError(null);
      try {
        const res = await authFetch('/api/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        const data = await safeJson<{
          error?: string;
          opportunities?: Opportunity[];
          scanLog?: ScanLog;
          warning?: string;
          notice?: string;
          added?: Opportunity[];
        }>(res);
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch live social media opportunities.');
        }
        setOpportunities(data.opportunities || []);
        if (data.scanLog) {
          setScanHistory((prev) => [data.scanLog!, ...prev].slice(0, 25));
        }
        if (data.warning) {
          setScanError(data.warning);
        }
        const addedCount = Array.isArray(data.added) ? data.added.length : 0;
        if (addedCount > 0) {
          showNotice(
            data.notice
              ? `Added ${addedCount} live Web Dev / SEO lead${addedCount === 1 ? '' : 's'} from direct feeds (Google Search Grounding paused due to Gemini quota).`
              : `Added ${addedCount} verified Web Dev / SEO lead${addedCount === 1 ? '' : 's'} from live feeds.`
          );
          if (!selectedOppRef.current && data.added?.[0]?.id) {
            setSelectedOpportunityId(data.added[0].id);
          }
        } else if (!data.warning) {
          showNotice(
            data.notice
              ? 'Direct feeds checked; all matching live leads are already tracked.'
              : 'Scan completed. All matching live opportunities are already tracked.'
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Scan failed.';
        setScanError(msg);
      } finally {
        setScanning(false);
      }
    },
    [authToken, authFetch, showNotice]
  );

  // Load workspace data once authenticated
  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    setInitialLoading(true);
    async function load() {
      try {
        const res = await authFetch('/api/data');
        if (!res.ok) throw new Error('Failed to load workspace data.');
        const data = await safeJson<TrackerStore>(res);
        if (cancelled) return;
        setOpportunities(data.opportunities || []);
        setApplicants(data.applicants || []);
        setScanHistory(data.scanHistory || []);
        if ((data.opportunities || []).length > 0) {
          setSelectedOpportunityId(data.opportunities![0].id);
        } else if ((data.scanHistory || []).length === 0) {
          handleScan({
            platform: 'All Platforms',
            category: 'Website Development & SEO',
            keywords: '',
          });
        }
      } catch (err) {
        if (!cancelled) {
          setScanError(err instanceof Error ? err.message : 'Failed to load workspace data.');
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [authToken, authFetch, handleScan]);

  const handleAuthenticated = (token: string, email: string) => {
    setAuthToken(token);
    setUserEmail(email);
    setAuthInitialized(true);
    setScanError(null);
  };

  const handleLogout = async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clear local session regardless
    }
    setAuthToken(null);
    setUserEmail('');
    setOpportunities([]);
    setApplicants([]);
    setScanHistory([]);
    setSelectedOpportunityId(null);
    setScanError(null);
  };

  const handleCreateOpportunity = async (payload: {
    title: string;
    platform: SocialPlatform;
    category: OpportunityCategory;
    summary: string;
    requirements: string[];
    budget: string;
    location: string;
    sourceUrl: string;
    contact: {
      contactName: string;
      handle: string;
      email: string;
      phone: string;
      website: string;
      preferredChannel: string;
    };
  }) => {
    const res = await authFetch('/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await safeJson<Opportunity & { error?: string }>(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save opportunity.');
    }
    setOpportunities((prev) => [data, ...prev]);
    setSelectedOpportunityId(data.id);
    showNotice('Opportunity saved to tracker.');
  };

  const handleUpdateOpportunity = async (
    id: string,
    patch: Partial<
      Pick<Opportunity, 'stage' | 'assignedApplicantId' | 'notes' | 'contact' | 'budget'>
    >
  ) => {
    const res = await authFetch(`/api/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await safeJson<Opportunity & { error?: string }>(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update opportunity.');
    }
    setOpportunities((prev) => prev.map((o) => (o.id === id ? data : o)));
    showNotice('Opportunity updated.');
  };

  const handleVerifyStatus = async (id: string) => {
    const res = await authFetch(`/api/opportunities/${id}/verify-status`, {
      method: 'POST',
    });
    const data = await safeJson<Opportunity & { error?: string }>(res);
    if (!res.ok) {
      setScanError(data.error || 'Failed to verify role status.');
      return;
    }
    setOpportunities((prev) => prev.map((o) => (o.id === id ? data : o)));
    showNotice(`Status verified: ${data.hiringStatus}.`);
  };

  const handleDeleteOpportunity = async (id: string) => {
    const res = await authFetch(`/api/opportunities/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setOpportunities((prev) => prev.filter((o) => o.id !== id));
    if (selectedOpportunityId === id) {
      setSelectedOpportunityId(null);
    }
    showNotice('Opportunity removed.');
  };

  const handleDraftOutreach = async (id: string): Promise<string> => {
    const res = await authFetch('/api/draft-outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: id }),
    });
    const data = await safeJson<{ draft?: string; error?: string }>(res);
    if (!res.ok) {
      setScanError(data.error || 'Failed to generate outreach draft.');
      return '';
    }
    const draft = data.draft || '';
    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? { ...o, outreachDraft: draft } : o))
    );
    showNotice('Outreach message drafted.');
    return draft;
  };

  const handleCreateApplicant = async (payload: {
    fullName: string;
    specialty: ApplicantSpecialty;
    roleTitle: string;
    skills: string[];
    experienceYears: number;
    hourlyRate: string;
    location: string;
    status: ApplicantStatus;
    email: string;
    phone: string;
    portfolioUrl: string;
    githubOrLinkedIn: string;
    notes: string;
  }) => {
    const res = await authFetch('/api/applicants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await safeJson<Applicant & { error?: string }>(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save applicant.');
    }
    setApplicants((prev) => [data, ...prev]);
    showNotice('Applicant added to roster.');
  };

  const handleUpdateApplicant = async (
    id: string,
    patch: Partial<Pick<Applicant, 'status' | 'notes' | 'hourlyRate'>>
  ) => {
    const res = await authFetch(`/api/applicants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await safeJson<Applicant>(res);
    if (!res.ok) return;
    setApplicants((prev) => prev.map((a) => (a.id === id ? data : a)));
    showNotice('Applicant updated.');
  };

  const handleDeleteApplicant = async (id: string) => {
    const res = await authFetch(`/api/applicants/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setApplicants((prev) => prev.filter((a) => a.id !== id));
    setOpportunities((prev) =>
      prev.map((o) =>
        o.assignedApplicantId === id ? { ...o, assignedApplicantId: null } : o
      )
    );
    showNotice('Applicant removed.');
  };

  const handleExportOpportunitiesCsv = (rows: Opportunity[]) => {
    downloadCsv(
      `hk-surya-opportunities-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Title',
        'Platform',
        'Category',
        'Role Availability',
        'Status Evidence',
        'Stage',
        'Budget',
        'Location',
        'Posted Date',
        'Contact Name',
        'Handle',
        'Email',
        'Phone',
        'Preferred Channel',
        'Source URL',
        'Assigned Applicant',
      ],
      rows.map((o) => {
        const assignee = applicants.find((a) => a.id === o.assignedApplicantId);
        return [
          o.title,
          o.platform,
          o.category,
          o.hiringStatus,
          o.statusEvidence,
          o.stage,
          o.budget,
          o.location,
          o.postedDate,
          o.contact.contactName,
          o.contact.handle,
          o.contact.email,
          o.contact.phone,
          o.contact.preferredChannel,
          o.sourceUrl,
          assignee?.fullName || '',
        ];
      })
    );
  };

  const handleExportApplicantsCsv = (rows: Applicant[]) => {
    downloadCsv(
      `hk-surya-applicants-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Full Name',
        'Specialty',
        'Role Title',
        'Status',
        'Experience (Yrs)',
        'Rate',
        'Location',
        'Email',
        'Phone',
        'Portfolio URL',
        'GitHub / LinkedIn',
        'Skills',
      ],
      rows.map((a) => [
        a.fullName,
        a.specialty,
        a.roleTitle,
        a.status,
        a.experienceYears,
        a.hourlyRate,
        a.location,
        a.email,
        a.phone,
        a.portfolioUrl,
        a.githubOrLinkedIn,
        a.skills.join('; '),
      ])
    );
  };

  const metrics = useMemo(() => {
    const webDevCount = opportunities.filter(
      (o) => o.category === 'Website Development' || o.category === 'Web Dev + SEO'
    ).length;
    const seoCount = opportunities.filter(
      (o) => o.category === 'SEO' || o.category === 'Web Dev + SEO'
    ).length;
    const activePipelineCount = opportunities.filter((o) => o.stage !== 'Archived').length;
    const availableApplicantsCount = applicants.filter(
      (a) => a.status === 'Available' || a.status === 'Shortlisted'
    ).length;

    return {
      totalOpportunities: opportunities.length,
      webDevCount,
      seoCount,
      activePipelineCount,
      totalApplicants: applicants.length,
      availableApplicantsCount,
    };
  }, [opportunities, applicants]);

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-xs text-slate-500">
        Loading HK Surya workspace...
      </div>
    );
  }

  if (!authToken) {
    return (
      <LoginPage
        initialized={authInitialized}
        configuredViaEnv={configuredViaEnv}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  const breadcrumbTitle =
    activeTab === 'opportunities'
      ? 'Social Media Opportunities'
      : activeTab === 'pipeline'
        ? 'Pipeline Board'
        : activeTab === 'applicants'
          ? 'Applicant Roster'
          : 'Search Source Logs';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 overflow-x-hidden">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        counts={{
          opportunities: opportunities.length,
          activePipeline: metrics.activePipelineCount,
          applicants: applicants.length,
          scans: scanHistory.length,
        }}
        userEmail={userEmail}
        onLogout={handleLogout}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="font-semibold text-[#071A38] whitespace-nowrap shrink-0">
                HK Surya
              </span>
              <span className="text-slate-300 shrink-0">/</span>
              <span className="font-medium text-slate-600 truncate">
                {breadcrumbTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {statusNotice && (
              <span className="hidden md:inline text-xs font-medium text-emerald-700 whitespace-nowrap">
                {statusNotice}
              </span>
            )}
            {activeTab === 'applicants' ? (
              <button
                type="button"
                onClick={() => setAddApplicantOpen(true)}
                className="px-3.5 sm:px-4 py-2 text-xs font-medium text-white bg-[#071A38] rounded-lg hover:bg-[#0d2b59] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Applicant</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={scanning}
                onClick={() =>
                  handleScan({
                    platform: 'All Platforms',
                    category: 'Website Development & SEO',
                    keywords: '',
                  })
                }
                className="px-3.5 sm:px-4 py-2 text-xs font-medium text-white bg-[#071A38] rounded-lg hover:bg-[#0d2b59] disabled:opacity-60 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                <span>{scanning ? 'Scanning...' : 'Scan Social Media'}</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1440px] w-full mx-auto space-y-6 min-w-0">
          {statusNotice && (
            <div className="md:hidden p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 break-words">
              {statusNotice}
            </div>
          )}

          {/* 4-Column Metric Summary Strip */}
          <section
            aria-label="Workspace summary metrics"
            className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
          >
            <div className="p-4 sm:px-6">
              <p className="text-xs font-medium text-slate-500">Tracked Opportunities</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#071A38]">
                {metrics.totalOpportunities}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Verified Web Dev &amp; SEO leads
              </p>
            </div>
            <div className="p-4 sm:px-6">
              <p className="text-xs font-medium text-slate-500">Website Development</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#0077FF]">
                {metrics.webDevCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Builds, redesigns &amp; stores
              </p>
            </div>
            <div className="p-4 sm:px-6">
              <p className="text-xs font-medium text-slate-500">SEO Projects</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-amber-600">
                {metrics.seoCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Technical, local &amp; on-page SEO
              </p>
            </div>
            <div className="p-4 sm:px-6">
              <p className="text-xs font-medium text-slate-500">Applicant Roster</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
                {metrics.totalApplicants}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                <span className="font-mono tabular-nums">{metrics.availableApplicantsCount}</span>{' '}
                ready for assignment
              </p>
            </div>
          </section>

          {initialLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500">
              Loading HK Surya workspace...
            </div>
          ) : activeTab === 'opportunities' ? (
            <OpportunitiesView
              opportunities={opportunities}
              applicants={applicants}
              scanning={scanning}
              scanError={scanError}
              onScan={handleScan}
              onUpdateOpportunity={handleUpdateOpportunity}
              onVerifyStatus={handleVerifyStatus}
              onDeleteOpportunity={handleDeleteOpportunity}
              onDraftOutreach={handleDraftOutreach}
              onOpenAddModal={() => setAddOppOpen(true)}
              onExportCsv={handleExportOpportunitiesCsv}
              selectedId={selectedOpportunityId}
              onSelectId={setSelectedOpportunityId}
            />
          ) : activeTab === 'pipeline' ? (
            <PipelineBoardView
              opportunities={opportunities}
              applicants={applicants}
              onMoveStage={(id, nextStage: PipelineStage) =>
                handleUpdateOpportunity(id, { stage: nextStage })
              }
              onInspectOpportunity={(id) => {
                setSelectedOpportunityId(id);
                setActiveTab('opportunities');
              }}
            />
          ) : activeTab === 'applicants' ? (
            <ApplicantsView
              applicants={applicants}
              opportunities={opportunities}
              onOpenAddModal={() => setAddApplicantOpen(true)}
              onUpdateApplicant={handleUpdateApplicant}
              onDeleteApplicant={handleDeleteApplicant}
              onExportCsv={handleExportApplicantsCsv}
            />
          ) : (
            <ScanLogsView scanHistory={scanHistory} />
          )}
        </main>
      </div>

      <AddOpportunityModal
        open={addOppOpen}
        onClose={() => setAddOppOpen(false)}
        onSubmit={handleCreateOpportunity}
      />

      <AddApplicantModal
        open={addApplicantOpen}
        onClose={() => setAddApplicantOpen(false)}
        onSubmit={handleCreateApplicant}
      />
    </div>
  );
}
