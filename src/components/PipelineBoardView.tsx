import React from 'react';
import { ExternalLink, ArrowRight } from 'lucide-react';
import type { Applicant, Opportunity, PipelineStage } from '../types';

interface PipelineBoardViewProps {
  opportunities: Opportunity[];
  applicants: Applicant[];
  onMoveStage: (id: string, nextStage: PipelineStage) => Promise<void>;
  onInspectOpportunity: (id: string) => void;
}

const ACTIVE_STAGES: PipelineStage[] = [
  'New Lead',
  'Contacted',
  'Proposal Sent',
  'Interviewing',
  'Won',
];

export const PipelineBoardView: React.FC<PipelineBoardViewProps> = ({
  opportunities,
  applicants,
  onMoveStage,
  onInspectOpportunity,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          Project Opportunity Pipeline
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Track Website Development and SEO client opportunities from discovery through outreach, proposal, and closed deals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-start">
        {ACTIVE_STAGES.map((stage, stageIdx) => {
          const items = opportunities.filter((o) => o.stage === stage);
          const nextStage = ACTIVE_STAGES[stageIdx + 1];

          return (
            <div
              key={stage}
              className="bg-slate-100/80 border border-slate-200 rounded-xl p-3 space-y-3 min-h-[260px]"
            >
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold text-slate-800">{stage}</h3>
                <span className="font-mono text-xs tabular-nums text-slate-500">
                  {items.length}
                </span>
              </div>

              {items.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No opportunities
                </div>
              ) : (
                <div className="space-y-2.5">
                  {items.map((opp) => {
                    const assignee = applicants.find(
                      (a) => a.id === opp.assignedApplicantId
                    );
                    return (
                      <div
                        key={opp.id}
                        className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onInspectOpportunity(opp.id)}
                            className="text-left text-xs font-semibold text-slate-900 hover:text-[#0077FF] line-clamp-2"
                          >
                            {opp.title}
                          </button>
                          {opp.sourceUrl && (
                            <a
                              href={opp.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Open source post"
                              className="text-slate-400 hover:text-[#0077FF] shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500">
                          <span className="font-medium text-slate-700">{opp.platform}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{opp.category}</span>
                        </div>

                        <div className="text-[11px] text-slate-600 space-y-0.5">
                          <div className="truncate">
                            <span className="text-slate-400">Contact: </span>
                            {opp.contact.contactName}
                          </div>
                          <div className="font-mono tabular-nums text-slate-700">
                            {opp.budget}
                          </div>
                          {assignee && (
                            <div className="truncate text-sky-700 font-medium">
                              Assigned: {assignee.fullName}
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onInspectOpportunity(opp.id)}
                            className="text-[11px] font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                          >
                            Details
                          </button>
                          {nextStage && (
                            <button
                              type="button"
                              onClick={() => onMoveStage(opp.id, nextStage)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0077FF] hover:text-[#005fcc] whitespace-nowrap"
                            >
                              <span>Move to {nextStage}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
