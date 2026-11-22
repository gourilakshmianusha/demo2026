import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  ExternalLink,
  Mail,
  Phone,
  Globe,
  AtSign,
  Copy,
  Check,
  Trash2,
  Plus,
  Download,
  Sparkles,
  CheckCircle2,
  Clock,
  Send,
  UserCheck,
  Archive,
  X,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import type {
  Applicant,
  HiringStatus,
  Opportunity,
  OpportunityCategory,
  PipelineStage,
  SocialPlatform,
} from '../types';

interface OpportunitiesViewProps {
  opportunities: Opportunity[];
  applicants: Applicant[];
  scanning: boolean;
  scanError: string | null;
  onScan: (params: { platform: string; category: string; keywords: string }) => Promise<void>;
  onUpdateOpportunity: (
    id: string,
    patch: Partial<Pick<Opportunity, 'stage' | 'assignedApplicantId' | 'notes' | 'contact' | 'budget'>>
  ) => Promise<void>;
  onVerifyStatus: (id: string) => Promise<void>;
  onDeleteOpportunity: (id: string) => Promise<void>;
  onDraftOutreach: (id: string) => Promise<string>;
  onOpenAddModal: () => void;
  onExportCsv: (rows: Opportunity[]) => void;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
}

const STAGE_OPTIONS: PipelineStage[] = [
  'New Lead',
  'Contacted',
  'Proposal Sent',
  'Interviewing',
  'Won',
  'Archived',
];

function StageLabel({ stage }: { stage: PipelineStage }) {
  switch (stage) {
    case 'Won':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Won</span>
        </span>
      );
    case 'Interviewing':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 whitespace-nowrap">
          <UserCheck className="w-3.5 h-3.5 shrink-0" />
          <span>Interviewing</span>
        </span>
      );
    case 'Proposal Sent':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Send className="w-3.5 h-3.5 shrink-0" />
          <span>Proposal Sent</span>
        </span>
      );
    case 'Contacted':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 whitespace-nowrap">
          <Mail className="w-3.5 h-3.5 shrink-0" />
          <span>Contacted</span>
        </span>
      );
    case 'Archived':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 whitespace-nowrap">
          <Archive className="w-3.5 h-3.5 shrink-0" />
          <span>Archived</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0077FF] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>New Lead</span>
        </span>
      );
  }
}

function HiringStatusText({ status }: { status: HiringStatus }) {
  switch (status) {
    case 'Still Looking':
      return (
        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>Still Looking</span>
        </span>
      );
    case 'Updated Recently':
      return (
        <span className="inline-flex items-center gap-1 text-[#0077FF] font-medium whitespace-nowrap">
          <RefreshCw className="w-3 h-3 shrink-0" />
          <span>Updated Recently</span>
        </span>
      );
    case 'Likely Filled':
    case 'Closed':
      return (
        <span className="inline-flex items-center gap-1 text-red-700 font-medium whitespace-nowrap">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{status}</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-amber-700 font-medium whitespace-nowrap">
          <Clock className="w-3 h-3 shrink-0" />
          <span>Needs Check</span>
        </span>
      );
  }
}

export const OpportunitiesView: React.FC<OpportunitiesViewProps> = ({
  opportunities,
  applicants,
  scanning,
  scanError,
  onScan,
  onUpdateOpportunity,
  onVerifyStatus,
  onDeleteOpportunity,
  onDraftOutreach,
  onOpenAddModal,
  onExportCsv,
  selectedId,
  onSelectId,
}) => {
  const [scanPlatform, setScanPlatform] = useState('All Platforms');
  const [scanCategory, setScanCategory] = useState('Website Development & SEO');
  const [scanKeywords, setScanKeywords] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | OpportunityCategory>('All');
  const [platformFilter, setPlatformFilter] = useState<'All' | SocialPlatform>('All');
  const [stageFilter, setStageFilter] = useState<'All' | PipelineStage>('All');
  const [availabilityFilter, setAvailabilityFilter] = useState<'All' | 'ActiveOnly'>('All');

  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [draftingOutreach, setDraftingOutreach] = useState(false);
  const [verifyingStatus, setVerifyingStatus] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const selected = useMemo(
    () => opportunities.find((o) => o.id === selectedId) || null,
    [opportunities, selectedId]
  );

  useEffect(() => {
    setNotesDraft(selected?.notes ?? '');
  }, [selected?.id, selected?.notes]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return opportunities.filter((opp) => {
      if (categoryFilter !== 'All' && opp.category !== categoryFilter) return false;
      if (platformFilter !== 'All' && opp.platform !== platformFilter) return false;
      if (stageFilter !== 'All' && opp.stage !== stageFilter) return false;
      if (
        availabilityFilter === 'ActiveOnly' &&
        opp.hiringStatus !== 'Still Looking' &&
        opp.hiringStatus !== 'Updated Recently'
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        opp.title,
        opp.summary,
        opp.platform,
        opp.category,
        opp.budget,
        opp.location,
        opp.hiringStatus,
        opp.contact.contactName,
        opp.contact.handle || '',
        opp.contact.email || '',
        ...opp.requirements,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [opportunities, searchQuery, categoryFilter, platformFilter, stageFilter, availabilityFilter]);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard blocked in some contexts
    }
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onScan({
      platform: scanPlatform,
      category: scanCategory,
      keywords: scanKeywords.trim(),
    });
  };

  const handleSaveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    try {
      await onUpdateOpportunity(selected.id, { notes: notesDraft });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleGenerateOutreach = async () => {
    if (!selected) return;
    setDraftingOutreach(true);
    try {
      await onDraftOutreach(selected.id);
    } finally {
      setDraftingOutreach(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Social Media Discovery Bar */}
      <form
        onSubmit={handleScanSubmit}
        className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Live Google &amp; Social Freelance Scanner
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fetches updated posts (past 14 days, no stale monthly threads) from Google Search &amp; live feeds where clients are still looking for freelance Website Dev &amp; SEO.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Lead</span>
            </button>
            <button
              type="button"
              onClick={() => onExportCsv(filtered)}
              disabled={filtered.length === 0}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Social Platform
            </label>
            <select
              value={scanPlatform}
              onChange={(e) => setScanPlatform(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
            >
              <option value="All Platforms">All Platforms (Instagram, Facebook, Google &amp; More)</option>
              <option value="Instagram">Instagram</option>
              <option value="Facebook">Facebook</option>
              <option value="Google">Google (Search &amp; Web Leads)</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Reddit">Reddit (r/forhire, r/webdev)</option>
              <option value="X (Twitter)">X (Twitter)</option>
              <option value="Hacker News">Hacker News</option>
              <option value="IndieHackers">IndieHackers</option>
              <option value="Other">Mastodon &amp; Remote Feeds</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Service Scope
            </label>
            <select
              value={scanCategory}
              onChange={(e) => setScanCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
            >
              <option value="Website Development & SEO">Website Development &amp; SEO</option>
              <option value="Website Development">Website Development Only</option>
              <option value="SEO">SEO Only</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Stack or Niche Focus (Optional)
            </label>
            <input
              type="text"
              value={scanKeywords}
              onChange={(e) => setScanKeywords(e.target.value)}
              placeholder="e.g., Next.js, Shopify, WordPress, Local SEO"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={scanning}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-[#0077FF] rounded-lg hover:bg-[#0062d6] disabled:opacity-60 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Scanning...' : 'Fetch Leads'}</span>
            </button>
          </div>
        </div>

        {scanError && (
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="min-w-0 break-words leading-relaxed">{scanError}</span>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {scanPlatform !== 'All Platforms' && (
                  <button
                    type="button"
                    onClick={() => {
                      setScanPlatform('All Platforms');
                      onScan({
                        platform: 'All Platforms',
                        category: scanCategory,
                        keywords: scanKeywords.trim(),
                      });
                    }}
                    className="px-3 py-1.5 font-medium text-white bg-[#0077FF] rounded-md hover:bg-[#0062d6] whitespace-nowrap shrink-0"
                  >
                    Scan Direct Feeds
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    onScan({
                      platform: scanPlatform,
                      category: scanCategory,
                      keywords: scanKeywords.trim(),
                    })
                  }
                  className="px-3 py-1.5 font-medium text-amber-900 bg-white border border-amber-300 rounded-md hover:bg-amber-100/60 whitespace-nowrap shrink-0"
                >
                  Retry
                </button>
              </div>
            </div>
            {(scanPlatform === 'Instagram' ||
              scanPlatform === 'Facebook' ||
              scanPlatform === 'Google') && (
              <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-amber-800">
                  Open live 14-day search directly:
                </span>
                {scanPlatform === 'Instagram' && (
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(
                      `site:instagram.com ("looking for" OR "need") ("website developer" OR "web developer" OR "SEO") freelance ${scanKeywords}`.trim()
                    )}&tbs=qdr:w2`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/60 font-medium"
                  >
                    <span>Instagram Leads (Past 14d)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {scanPlatform === 'Facebook' && (
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(
                      `site:facebook.com ("looking for" OR "need") ("website developer" OR "web developer" OR "SEO") freelance ${scanKeywords}`.trim()
                    )}&tbs=qdr:w2`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/60 font-medium"
                  >
                    <span>Facebook Leads (Past 14d)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {scanPlatform === 'Google' && (
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(
                      `("looking for a freelance website developer" OR "looking for freelance SEO") ("email" OR "contact" OR "WhatsApp") ${scanKeywords}`.trim()
                    )}&tbs=qdr:w2`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/60 font-medium"
                  >
                    <span>Google Web Leads (Past 14d)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={onOpenAddModal}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/60 font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>Log Found Lead</span>
                </button>
              </div>
            )}
          </div>
        )}
      </form>

      {/* Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="w-full sm:w-auto max-w-full overflow-x-auto pb-1 sm:pb-0">
            <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg">
              {(['All', 'Website Development', 'SEO', 'Web Dev + SEO'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    categoryFilter === cat
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat === 'All' ? 'All Services' : cat}
                </button>
              ))}
            </div>
          </div>

          <select
            aria-label="Filter by social platform"
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as 'All' | SocialPlatform)}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            <option value="All">All Platforms</option>
            <option value="Instagram">Instagram</option>
            <option value="Facebook">Facebook</option>
            <option value="Google">Google</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="Reddit">Reddit</option>
            <option value="X (Twitter)">X (Twitter)</option>
            <option value="Hacker News">Hacker News</option>
            <option value="IndieHackers">IndieHackers</option>
            <option value="Other">Other</option>
          </select>

          <select
            aria-label="Filter by pipeline stage"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as 'All' | PipelineStage)}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            <option value="All">All Stages</option>
            {STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by role availability"
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value as 'All' | 'ActiveOnly')}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            <option value="All">All Availability</option>
            <option value="ActiveOnly">Still Looking Only</option>
          </select>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects, contacts, skills..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
          />
        </div>
      </div>

      {/* Main Master-Detail Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Table Pane */}
        <div
          className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${
            selected ? 'xl:col-span-7' : 'xl:col-span-12'
          }`}
        >
          {scanning && opportunities.length === 0 ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse flex items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-3/5" />
                    <div className="h-3 bg-slate-100 rounded w-2/5" />
                  </div>
                  <div className="h-4 bg-slate-100 rounded w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                {opportunities.length === 0
                  ? 'No social media leads fetched yet'
                  : 'No opportunities match your active filters'}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {opportunities.length === 0
                  ? 'Run a live scan to pull verified Website Development and SEO freelance posts with contact details from Reddit, LinkedIn, X, and Hacker News.'
                  : 'Clear your search query or switch filters to see tracked opportunities.'}
              </p>
              {opportunities.length === 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    onScan({
                      platform: scanPlatform,
                      category: scanCategory,
                      keywords: scanKeywords.trim(),
                    })
                  }
                  disabled={scanning}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#071A38] rounded-lg hover:bg-[#0d2b59] whitespace-nowrap"
                >
                  {scanning ? 'Scanning Social Media...' : 'Scan Social Media Now'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('All');
                    setPlatformFilter('All');
                    setStageFilter('All');
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Opportunity &amp; Source</th>
                    <th className="py-3 px-3">Client Contact</th>
                    <th className="py-3 px-3">Budget</th>
                    <th className="py-3 px-3">Stage</th>
                    <th className="py-3 px-4 text-right">Assigned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((opp) => {
                    const isSelected = opp.id === selectedId;
                    const assignee = applicants.find((a) => a.id === opp.assignedApplicantId);
                    return (
                      <tr
                        key={opp.id}
                        onClick={() => onSelectId(isSelected ? null : opp.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-sky-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-medium text-slate-900 line-clamp-1">
                            {opp.title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span className="font-medium text-slate-700">{opp.platform}</span>
                            <span aria-hidden="true">·</span>
                            <span>{opp.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{opp.postedDate}</span>
                            <span aria-hidden="true">·</span>
                            <HiringStatusText status={opp.hiringStatus} />
                          </div>
                        </td>
                        <td className="py-3.5 px-3 align-top">
                          <div className="text-xs font-medium text-slate-800 truncate max-w-[160px]">
                            {opp.contact.contactName}
                          </div>
                          <div className="text-xs text-slate-500 truncate max-w-[160px]">
                            {opp.contact.email || opp.contact.handle || opp.contact.preferredChannel}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 align-top font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                          {opp.budget}
                        </td>
                        <td className="py-3.5 px-3 align-top">
                          <StageLabel stage={opp.stage} />
                        </td>
                        <td className="py-3.5 px-4 align-top text-right text-xs text-slate-600 whitespace-nowrap">
                          {assignee ? assignee.fullName : 'Unassigned'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail Inspector Pane */}
        {selected && (
          <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-5 sticky top-20">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span className="font-semibold text-[#071A38]">{selected.platform}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selected.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selected.location}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{selected.postedDate}</span>
                </div>
                <h3 className="text-base font-semibold text-slate-900 leading-snug">
                  {selected.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onSelectId(null)}
                aria-label="Close inspector"
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-700 leading-relaxed space-y-2">
              <p>{selected.summary}</p>
              {selected.requirements.length > 0 && (
                <p className="text-slate-500">
                  <span className="font-medium text-slate-700">Skills: </span>
                  {selected.requirements.join(' · ')}
                </p>
              )}
              <p className="font-mono tabular-nums text-slate-800">
                <span className="font-sans font-medium text-slate-700">Budget: </span>
                {selected.budget}
              </p>
            </div>

            {/* Live Role Availability Check */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <ShieldCheck className="w-4 h-4 text-[#071A38] shrink-0" />
                  <span className="font-semibold text-slate-800">Role Status:</span>
                  <HiringStatusText status={selected.hiringStatus} />
                </div>
                <button
                  type="button"
                  disabled={verifyingStatus}
                  onClick={async () => {
                    setVerifyingStatus(true);
                    try {
                      await onVerifyStatus(selected.id);
                    } finally {
                      setVerifyingStatus(false);
                    }
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#071A38] bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3 h-3 ${verifyingStatus ? 'animate-spin' : ''}`} />
                  <span>{verifyingStatus ? 'Checking...' : 'Check Status Now'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {selected.statusEvidence}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-slate-400">
                Last checked: {new Date(selected.statusCheckedAt).toLocaleString()}
              </p>
            </div>

            {/* Verified Contact Details */}
            <div className="pt-4 border-t border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-900">
                  Verified Client Contact Details
                </h4>
                {selected.sourceUrl && (
                  <a
                    href={selected.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0077FF] hover:underline whitespace-nowrap"
                  >
                    <span>Open Source Post</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-slate-500">Contact / Poster</span>
                  <span className="font-medium text-slate-900">{selected.contact.contactName}</span>
                </div>

                {selected.contact.handle && (
                  <div className="flex items-center justify-between gap-2 py-1 border-t border-slate-100">
                    <span className="text-slate-500 inline-flex items-center gap-1.5">
                      <AtSign className="w-3.5 h-3.5 text-slate-400" />
                      <span>Handle</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy('handle', selected.contact.handle || '')}
                      className="inline-flex items-center gap-1.5 font-mono text-slate-800 hover:text-[#0077FF]"
                    >
                      <span>{selected.contact.handle}</span>
                      {copiedKey === 'handle' ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                  </div>
                )}

                {selected.contact.email && (
                  <div className="flex items-center justify-between gap-2 py-1 border-t border-slate-100">
                    <span className="text-slate-500 inline-flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>Email</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={`mailto:${selected.contact.email}`}
                        className="font-mono text-[#0077FF] hover:underline"
                      >
                        {selected.contact.email}
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy('email', selected.contact.email || '')}
                        aria-label="Copy email"
                        className="text-slate-400 hover:text-slate-700"
                      >
                        {copiedKey === 'email' ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {selected.contact.phone && (
                  <div className="flex items-center justify-between gap-2 py-1 border-t border-slate-100">
                    <span className="text-slate-500 inline-flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>Phone</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${selected.contact.phone}`}
                        className="font-mono tabular-nums text-[#0077FF] hover:underline"
                      >
                        {selected.contact.phone}
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy('phone', selected.contact.phone || '')}
                        aria-label="Copy phone"
                        className="text-slate-400 hover:text-slate-700"
                      >
                        {copiedKey === 'phone' ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {selected.contact.website && (
                  <div className="flex items-center justify-between gap-2 py-1 border-t border-slate-100">
                    <span className="text-slate-500 inline-flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                      <span>Website</span>
                    </span>
                    <a
                      href={selected.contact.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0077FF] hover:underline truncate max-w-[200px]"
                    >
                      {selected.contact.website}
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 py-1 border-t border-slate-100">
                  <span className="text-slate-500">Preferred Channel</span>
                  <span className="font-medium text-slate-800 text-right">
                    {selected.contact.preferredChannel}
                  </span>
                </div>
              </div>
            </div>

            {/* Pipeline & Applicant Assignment */}
            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Pipeline Stage
                </label>
                <select
                  value={selected.stage}
                  onChange={(e) =>
                    onUpdateOpportunity(selected.id, {
                      stage: e.target.value as PipelineStage,
                    })
                  }
                  className="w-full px-2.5 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  {STAGE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Assign Applicant / Specialist
                </label>
                <select
                  value={selected.assignedApplicantId || ''}
                  onChange={(e) =>
                    onUpdateOpportunity(selected.id, {
                      assignedApplicantId: e.target.value || null,
                    })
                  }
                  className="w-full px-2.5 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  <option value="">Unassigned</option>
                  {applicants.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.fullName} ({app.specialty})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Internal Notes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700">
                  Tracking Notes
                </label>
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={savingNotes || notesDraft === selected.notes}
                  className="text-xs font-medium text-[#0077FF] hover:underline disabled:opacity-40"
                >
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
              <textarea
                rows={2}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Log outreach date, follow-up plan, or client feedback..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            {/* Tailored Outreach Draft */}
            <div className="pt-4 border-t border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900">
                  Outreach Pitch Draft
                </span>
                <div className="flex items-center gap-2">
                  {selected.outreachDraft && (
                    <button
                      type="button"
                      onClick={() => handleCopy('draft', selected.outreachDraft || '')}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                    >
                      {copiedKey === 'draft' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'draft' ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleGenerateOutreach}
                    disabled={draftingOutreach}
                    className="px-2.5 py-1.5 text-xs font-medium text-[#071A38] bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#0077FF]" />
                    <span>{draftingOutreach ? 'Drafting...' : 'Draft Outreach'}</span>
                  </button>
                </div>
              </div>
              {selected.outreachDraft && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {selected.outreachDraft}
                </div>
              )}
            </div>

            {/* Grounded Search Citations */}
            {(selected.groundingSources.length > 0 || (selected.searchQueries && selected.searchQueries.length > 0)) && (
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Google &amp; Live Source Verification
                </p>
                {selected.searchQueries && selected.searchQueries.length > 0 && (
                  <p className="text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700">Google queries: </span>
                    {selected.searchQueries.join(' · ')}
                  </p>
                )}
                {selected.groundingSources.length > 0 && (
                  <ul className="space-y-1">
                    {selected.groundingSources.slice(0, 4).map((src, idx) => (
                      <li key={idx} className="text-xs truncate">
                        <a
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-600 hover:text-[#0077FF] hover:underline"
                        >
                          {src.title || src.uri}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => onDeleteOpportunity(selected.id)}
                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Opportunity</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
