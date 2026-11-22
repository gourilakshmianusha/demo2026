import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import type { ScanLog } from '../types';

interface ScanLogsViewProps {
  scanHistory: ScanLog[];
}

export const ScanLogsView: React.FC<ScanLogsViewProps> = ({ scanHistory }) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          Verified Social Search Audit Logs
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Every live Google Search grounded scan executed for Website Development &amp; SEO social opportunities, along with cited source URLs.
        </p>
      </div>

      {scanHistory.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
          <Globe className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-900">No social media scans logged yet</p>
          <p className="text-xs text-slate-500">
            Run a live scan from the Opportunities tab to view grounded search citations and scan records here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {scanHistory.map((log) => (
            <div
              key={log.id}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{log.platformFilter}</span>
                  <span aria-hidden="true">·</span>
                  <span>{log.categoryFilter}</span>
                  {log.keywords && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Keywords: {log.keywords}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 font-mono text-xs tabular-nums text-slate-500">
                  <span>
                    Found {log.foundCount} · Added {log.addedCount}
                  </span>
                  <span>
                    {new Date(log.scannedAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {log.searchQueries && log.searchQueries.length > 0 && (
                <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <span className="font-medium text-slate-700">Google Search queries: </span>
                  {log.searchQueries.join(' · ')}
                </div>
              )}

              {log.groundingSources.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Grounded Search URLs ({log.groundingSources.length})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {log.groundingSources.map((src, idx) => (
                      <a
                        key={idx}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg transition-colors"
                      >
                        <span className="truncate">{src.title || src.uri}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
