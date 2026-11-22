import React from 'react';
import {
  Briefcase,
  Columns3,
  Users,
  Globe,
  X,
  LogOut,
} from 'lucide-react';

export type ActiveTab = 'opportunities' | 'pipeline' | 'applicants' | 'scans';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  counts: {
    opportunities: number;
    activePipeline: number;
    applicants: number;
    scans: number;
  };
  userEmail: string;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  counts,
  userEmail,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) => {
  const navItems: Array<{
    id: ActiveTab;
    label: string;
    count: number;
    icon: React.FC<{ className?: string }>;
  }> = [
    { id: 'opportunities', label: 'Opportunities', count: counts.opportunities, icon: Briefcase },
    { id: 'pipeline', label: 'Pipeline Board', count: counts.activePipeline, icon: Columns3 },
    { id: 'applicants', label: 'Applicants', count: counts.applicants, icon: Users },
    { id: 'scans', label: 'Source Logs', count: counts.scans, icon: Globe },
  ];

  const content = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200 w-[260px] shrink-0">
      <div className="px-5 pt-5 pb-4 border-b border-slate-200 flex items-center justify-between gap-2">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('opportunities');
            onCloseMobile();
          }}
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded-md"
        >
          <img
            src="/assets/aistudio/AFCCFDAF-04E5-4AA2-ADE0-E837A7BA9B92_a8ada254.png"
            alt="HK Surya Website Development"
            referrerPolicy="no-referrer"
            className="h-14 w-auto object-contain"
          />
        </a>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Workspace navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                active
                  ? 'bg-[#071A38] text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${active ? 'text-sky-300' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </span>
              <span
                className={`font-mono text-xs tabular-nums ${
                  active ? 'text-sky-200' : 'text-slate-400'
                }`}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-slate-200 space-y-3">
        <div className="px-1 space-y-0.5">
          <p className="text-xs font-medium text-slate-800 truncate">{userEmail}</p>
          <p className="text-[11px] text-slate-500">Website Development &amp; SEO Only</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block h-screen sticky top-0 shrink-0">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
};
