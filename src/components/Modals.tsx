import React, { useState } from 'react';
import { X } from 'lucide-react';
import type {
  ApplicantSpecialty,
  ApplicantStatus,
  OpportunityCategory,
  SocialPlatform,
} from '../types';

interface AddOpportunityModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
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
  }) => Promise<void>;
}

export const AddOpportunityModal: React.FC<AddOpportunityModalProps> = ({
  open,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<SocialPlatform>('LinkedIn');
  const [category, setCategory] = useState<OpportunityCategory>('Website Development');
  const [summary, setSummary] = useState('');
  const [requirementsInput, setRequirementsInput] = useState('');
  const [budget, setBudget] = useState('');
  const [location, setLocation] = useState('Remote');
  const [sourceUrl, setSourceUrl] = useState('');
  const [contactName, setContactName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [preferredChannel, setPreferredChannel] = useState('Direct Message');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !summary.trim()) {
      setError('Project title and scope summary are required.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        platform,
        category,
        summary: summary.trim(),
        requirements: requirementsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        budget: budget.trim() || 'Not specified',
        location: location.trim() || 'Remote',
        sourceUrl: sourceUrl.trim(),
        contact: {
          contactName: contactName.trim() || 'Direct Client',
          handle: handle.trim(),
          email: email.trim(),
          phone: phone.trim(),
          website: website.trim(),
          preferredChannel: preferredChannel.trim() || 'Direct Outreach',
        },
      });
      setTitle('');
      setSummary('');
      setRequirementsInput('');
      setBudget('');
      setSourceUrl('');
      setContactName('');
      setHandle('');
      setEmail('');
      setPhone('');
      setWebsite('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save opportunity.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Log Website Dev or SEO Opportunity
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Project Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Next.js E-Commerce Storefront + Technical SEO Audit"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Social Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
              >
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
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Service Scope (Strict)
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as OpportunityCategory)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
              >
                <option value="Website Development">Website Development</option>
                <option value="SEO">SEO</option>
                <option value="Web Dev + SEO">Web Dev + SEO</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Stated Budget / Rate
              </label>
              <input
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g., $2,500 fixed or $50/hr"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Remote / USA / India"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Verified Post URL
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Scope Summary *
              </label>
              <textarea
                rows={3}
                required
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Exact website development or SEO requirements from the post..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Required Stack / SEO Skills (comma-separated)
              </label>
              <input
                type="text"
                value={requirementsInput}
                onChange={(e) => setRequirementsInput(e.target.value)}
                placeholder="React, WordPress, Technical SEO, Core Web Vitals"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <h3 className="text-xs font-semibold text-slate-800 mb-3">
              Client Contact Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Contact Name / Company
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Client or company name"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Social Handle
                </label>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@handle or u/username"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@company.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 ..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Company Website
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://company.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Preferred Channel
                </label>
                <input
                  type="text"
                  value={preferredChannel}
                  onChange={(e) => setPreferredChannel(e.target.value)}
                  placeholder="LinkedIn DM, Email, Reddit PM"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-[#071A38] rounded-lg hover:bg-[#0d2b59] disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {submitting ? 'Saving...' : 'Save Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AddApplicantModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
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
  }) => Promise<void>;
}

export const AddApplicantModal: React.FC<AddApplicantModalProps> = ({
  open,
  onClose,
  onSubmit,
}) => {
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState<ApplicantSpecialty>('Website Development');
  const [roleTitle, setRoleTitle] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [experienceYears, setExperienceYears] = useState('3');
  const [hourlyRate, setHourlyRate] = useState('$35/hr');
  const [location, setLocation] = useState('Remote');
  const [status, setStatus] = useState<ApplicantStatus>('Available');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [githubOrLinkedIn, setGithubOrLinkedIn] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !email.trim()) {
      setError('Full name and email address are required.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        fullName: fullName.trim(),
        specialty,
        roleTitle: roleTitle.trim() || specialty,
        skills: skillsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        experienceYears: Number(experienceYears) || 0,
        hourlyRate: hourlyRate.trim() || 'Negotiable',
        location: location.trim() || 'Remote',
        status,
        email: email.trim(),
        phone: phone.trim(),
        portfolioUrl: portfolioUrl.trim(),
        githubOrLinkedIn: githubOrLinkedIn.trim(),
        notes: notes.trim(),
      });
      setFullName('');
      setRoleTitle('');
      setSkillsInput('');
      setEmail('');
      setPhone('');
      setPortfolioUrl('');
      setGithubOrLinkedIn('');
      setNotes('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save applicant.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Add Website Developer / SEO Applicant
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Applicant full name"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Primary Specialty
              </label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value as ApplicantSpecialty)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
              >
                <option value="Website Development">Website Development</option>
                <option value="SEO">SEO</option>
                <option value="Full-Stack & SEO">Full-Stack &amp; SEO</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Role Title
              </label>
              <input
                type="text"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g., Senior Next.js Developer / Technical SEO Lead"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Availability Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ApplicantStatus)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
              >
                <option value="Available">Available</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Interviewing">Interviewing</option>
                <option value="Assigned">Assigned</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="applicant@domain.com"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Phone / WhatsApp
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 ... / +1 ..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Rate
              </label>
              <input
                type="text"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="$35/hr or $1,500/project"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Experience (Yrs)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City / Country"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Technical / SEO Skills (comma-separated)
              </label>
              <input
                type="text"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                placeholder="React, Next.js, WordPress, Technical SEO, Google Search Console"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Portfolio Website URL
              </label>
              <input
                type="url"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://portfolio.dev"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                GitHub / LinkedIn URL
              </label>
              <input
                type="url"
                value={githubOrLinkedIn}
                onChange={(e) => setGithubOrLinkedIn(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Screening Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Vetting summary, past website launches or SEO ranking wins..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-[#071A38] rounded-lg hover:bg-[#0d2b59] disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {submitting ? 'Saving...' : 'Save Applicant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
