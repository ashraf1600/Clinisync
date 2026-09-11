import React, { useState, useEffect } from 'react';
import { Shield, Users, Calendar, CheckCircle, AlertTriangle, UserCheck, Activity } from 'lucide-react';
import { adminService } from './services/adminService';
import { AdminAnalytics, AuditLogItem } from './types';
import { useAuth } from '../../context/AuthContext';
import { PageShell, PageHero, StatCard, EmptyState } from '../../components/Page';

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [anRes, logRes] = await Promise.all([
        adminService.getAnalytics(),
        adminService.getAuditLogs({ page: 1, pageSize: 15 }),
      ]);
      setAnalytics(anRes || null);
      setAuditLogs(Array.isArray(logRes?.items) ? logRes.items : (Array.isArray(logRes) ? logRes : []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <PageHero
        eyebrow="Admin Console · Live Ops"
        title={<>Clinic Administration <span className="text-gradient-teal">& Audit Trail</span></>}
        subtitle="Operational oversight, KPI analytics, and tamper-proof log — everything updating in real time."
        actions={
          <button
            onClick={loadData}
            className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition border border-white/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-teal-300" /> Refresh Data
          </button>
        }
      />

      {/* Analytics KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Bookings" value={analytics.totalBookings} accent="slate" />
          <StatCard label="Completed" value={analytics.completedCount} accent="teal" />
          <StatCard label="Active Doctors" value={analytics.activeDoctors} accent="blue" />
          <StatCard label="No-Show Rate" value={<>{analytics.noShowRatePercentage}%</>} accent="amber" />
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 sm:px-6 bg-slate-950 text-white flex items-center justify-between">
          <span className="text-xs font-black tracking-wide flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-400" /> Immutable Audit Log
          </span>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Compliance & Security</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs table-premium">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Target Type</th>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    No audit records recorded yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-teal-50/50 transition">
                    <td className="p-3.5">
                      <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">{log.action}</span>
                    </td>
                    <td className="p-3.5 text-slate-600">{log.targetType}</td>
                    <td className="p-3.5 text-slate-500 tabular-nums">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3.5 text-slate-400 font-mono">{log.ipAddress || '127.0.0.1'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
};
