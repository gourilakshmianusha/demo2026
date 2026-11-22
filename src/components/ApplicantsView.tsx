import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  Download,
  Mail,
  Phone,
  Globe,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Clock,
  UserCheck,
  PauseCircle,
  X,
} from 'lucide-react';
import type {
  Applicant,
  ApplicantSpecialty,
  ApplicantStatus,
  Opportunity,
} from '../types';

interface ApplicantsViewProps {
  applicants: Applicant[];
  opportunities: Opportunity[];
  onOpenAddModal: () => void;
  onUpdateApplicant: (
    id: string,
    patch: Partial<Pick<Applicant, 'status' | 'notes' | 'hourlyRate'>>
  ) => Promise<void>;
  onDeleteApplicant: (id: string) => Promise<void>;
  onExportCsv: (rows: Applicant[]) => void;
}

const STATUS_OPTIONS: ApplicantStatus[] = [
  'Available',
  'Shortlisted',
  'Interviewing',
  'Assigned',
  'On Hold',
];

function ApplicantStatusLabel({ status }: { status: ApplicantStatus }) {
  switch (status) {
    case 'Available':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Available</span>
        </span>
      );
    case 'Assigned':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 whitespace-nowrap">
          <UserCheck className="w-3.5 h-3.5 shrink-0" />
          <span>Assigned</span>
        </span>
      );
    case 'Interviewing':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Interviewing</span>
        </span>
      );
    case 'Shortlisted':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#071A38] whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Shortlisted</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap">
          <PauseCircle className="w-3.5 h-3.5 shrink-0" />
          <span>On Hold</span>
        </span>
      );
  }
}

export const ApplicantsView: React.FC<ApplicantsViewProps> = ({
  applicants,
  opportunities,
  onOpenAddModal,
  onUpdateApplicant,
  onDeleteApplicant,
  onExportCsv,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState<'All' | ApplicantSpecialty>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | ApplicantStatus>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const selected = useMemo(
    () => applicants.find((a) => a.id === selectedId) || null,
    [applicants, selectedId]
  );

  useEffect(() => {
    setNotesDraft(selected?.notes ?? '');
  }, [selected?.id, selected?.notes]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return applicants.filter((app) => {
      if (specialtyFilter !== 'All' && app.specialty !== specialtyFilter) return false;
      if (statusFilter !== 'All' && app.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        app.fullName,
        app.roleTitle,
        app.specialty,
        app.email,
        app.phone,
        app.location,
        ...app.skills,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [applicants, searchQuery, specialtyFilter, statusFilter]);

  const handleSaveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    try {
      await onUpdateApplicant(selected.id, { notes: notesDraft });
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Website Developer &amp; SEO Applicants
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track vetted freelance developers and SEO specialists, full contact details, rates, and assigned client projects.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onExportCsv(filtered)}
            disabled={filtered.length === 0}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-4 py-2 text-xs font-medium text-white bg-[#071A38] rounded-lg hover:bg-[#0d2b59] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Applicant</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg">
            {(['All', 'Website Development', 'SEO', 'Full-Stack & SEO'] as const).map((spec) => (
              <button
                key={spec}
                type="button"
                onClick={() => setSpecialtyFilter(spec)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  specialtyFilter === spec
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {spec === 'All' ? 'All Specialties' : spec}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by applicant status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'All' | ApplicantStatus)}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            <option value="All">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search applicants, skills, email..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
          />
        </div>
      </div>

      {/* Master-Detail Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div
          className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${
            selected ? 'xl:col-span-7' : 'xl:col-span-12'
          }`}
        >
          {filtered.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                {applicants.length === 0
                  ? 'No Website Developer or SEO applicants added yet'
                  : 'No applicants match your active filters'}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Add freelance Website Developers and SEO Specialists to store their verified contact info, rates, portfolios, and assign them to tracked client opportunities.
              </p>
              {applicants.length === 0 && (
                <button
                  type="button"
                  onClick={onOpenAddModal}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#071A38] rounded-lg hover:bg-[#0d2b59]"
                >
                  Add First Applicant
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Applicant &amp; Specialty</th>
                    <th className="py-3 px-3">Contact Details</th>
                    <th className="py-3 px-3">Rate</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Projects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((app) => {
                    const isSelected = app.id === selectedId;
                    const assignedCount = opportunities.filter(
                      (o) => o.assignedApplicantId === app.id
                    ).length;

                    return (
                      <tr
                        key={app.id}
                        onClick={() => setSelectedId(isSelected ? null : app.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-sky-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-medium text-slate-900">{app.fullName}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            <span className="text-slate-700 font-medium">{app.specialty}</span>
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono tabular-nums">{app.experienceYears} yrs</span>
                            <span aria-hidden="true"> · </span>
                            <span>{app.location}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 align-top text-xs">
                          <div className="text-slate-800 truncate max-w-[190px]">{app.email}</div>
                          <div className="font-mono tabular-nums text-slate-500">
                            {app.phone || 'No phone listed'}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 align-top font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                          {app.hourlyRate}
                        </td>
                        <td className="py-3.5 px-3 align-top">
                          <ApplicantStatusLabel status={app.status} />
                        </td>
                        <td className="py-3.5 px-4 align-top text-right font-mono text-xs tabular-nums text-slate-700">
                          {assignedCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected && (
          <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-5 sticky top-20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-[#071A38]">{selected.specialty}</span>
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono tabular-nums">{selected.experienceYears} yrs exp</span>
                  <span aria-hidden="true"> · </span>
                  <span>{selected.location}</span>
                </div>
                <h3 className="text-base font-semibold text-slate-900 mt-1">
                  {selected.fullName}
                </h3>
                <p className="text-xs text-slate-600">{selected.roleTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close applicant details"
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selected.skills.length > 0 && (
              <div className="text-xs text-slate-600">
                <span className="font-medium text-slate-800">Skills: </span>
                {selected.skills.join(' · ')}
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 space-y-2 text-xs">
              <h4 className="font-semibold text-slate-900">Contact &amp; Portfolio Details</h4>
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-slate-500 inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email</span>
                </span>
                <a
                  href={`mailto:${selected.email}`}
                  className="font-mono text-[#0077FF] hover:underline"
                >
                  {selected.email}
                </a>
              </div>

              {selected.phone && (
                <div className="flex items-center justify-between gap-2 py-1 border-t border-slate-100">
                  <span className="text-slate-500 inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Phone</span>
                  </span>
                  <span className="font-mono tabular-nums text-slate-900">{selected.phone}</span>
                </div>
              )}

              {selected.portfolioUrl && (
                <div className="flex items-center justify-between gap-2 py-1 border-t border-slate-100">
                  <span className="text-slate-500 inline-flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>Portfolio</span>
                  </span>
                  <a
                    href={selected.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#0077FF] hover:underline"
                  >
                    <span>View Portfolio</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {selected.githubOrLinkedIn && (
                <div className="flex items-center justify-between gap-2 py-1 border-t border-slate-100">
                  <span className="text-slate-500">Profile</span>
                  <a
                    href={selected.githubOrLinkedIn}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#0077FF] hover:underline"
                  >
                    <span>GitHub / LinkedIn</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 py-1 border-t border-slate-100">
                <span className="text-slate-500">Rate</span>
                <span className="font-mono tabular-nums font-medium text-slate-900">
                  {selected.hourlyRate}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Applicant Status
                </label>
                <select
                  value={selected.status}
                  onChange={(e) =>
                    onUpdateApplicant(selected.id, {
                      status: e.target.value as ApplicantStatus,
                    })
                  }
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700">
                    Screening Notes
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
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2">
              <h4 className="text-xs font-semibold text-slate-900">
                Assigned Opportunities
              </h4>
              {opportunities.filter((o) => o.assignedApplicantId === selected.id).length === 0 ? (
                <p className="text-xs text-slate-400">
                  Not currently assigned to any tracked project opportunities.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {opportunities
                    .filter((o) => o.assignedApplicantId === selected.id)
                    .map((opp) => (
                      <li
                        key={opp.id}
                        className="text-xs text-slate-700 flex items-center justify-between gap-2 py-1 border-b border-slate-100 last:border-0"
                      >
                        <span className="truncate">{opp.title}</span>
                        <span className="text-slate-500 shrink-0">{opp.stage}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => onDeleteApplicant(selected.id)}
                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Applicant</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
