import React, { useState, useEffect } from 'react';
import { Shield, Users, Calendar, CheckCircle, AlertTriangle, UserCheck } from 'lucide-react';
import { adminService } from './services/adminService';
import { AdminAnalytics, AuditLogItem } from './types';
import { useAuth } from '../../context/AuthContext';

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Clinic Administration & Audit Trail</h2>
        <p className="text-xs text-slate-500 mt-1">Operational oversight, KPI analytics, and tamper-proof log</p>
      </div>

      {/* Analytics KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total Bookings</span>
            <p className="text-2xl font-black text-slate-900 mt-1">{analytics.totalBookings}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Completed</span>
            <p className="text-2xl font-black text-teal-700 mt-1">{analytics.completedCount}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Active Doctors</span>
            <p className="text-2xl font-black text-slate-900 mt-1">{analytics.activeDoctors}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase">No-Show Rate</span>
            <p className="text-2xl font-black text-amber-700 mt-1">{analytics.noShowRatePercentage}%</p>
          </div>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
          Immutable Audit Log (Compliance & Security)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
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
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold text-slate-800">{log.action}</td>
                    <td className="p-3.5 text-slate-600">{log.targetType}</td>
                    <td className="p-3.5 text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3.5 text-slate-400">{log.ipAddress || '127.0.0.1'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
