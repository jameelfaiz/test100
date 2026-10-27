import React, { useState } from 'react';
import { format } from 'date-fns';

interface Document {
  id: string;
  code: string;
  name: string;
  fileName: string;
  type: string;
  size: string;
  uploadDate: string;
  status: string;
  remarks: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

interface Application {
  _id: string;
  id: string; // applicationId
  refNumber: string;
  institutionId: string;
  collegeId: string;
  institutionName: string;
  collegeName: string;
  programme: string;
  intake: number;
  applicationDate: string;
  status: string;
  result: string | null;
  letterGenerated: boolean;
  letterSent: boolean;
  depositDetailsSent: boolean;
  applicationType?: string;
  documents: Document[];
}

interface Props {
  applications: Application[];
  apiPost: (path: string, body: any) => Promise<any>;
  onReload: () => void;
  setMessage: (msg: { type: 'success' | 'error' | 'warning'; text: string } | null) => void;
}

export default function ApprovalApplicationsView({ applications, apiPost, onReload, setMessage }: Props) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  // State for per-application deposit details input
  const [depositDetails, setDepositDetails] = useState<Record<string, { amount: string; bank: string; deadline: string }>>({});

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleVerifyDoc = async (appId: string, docId: string, status: string, remarks?: string) => {
    try {
      await apiPost(`/api/fd/application/${appId}/verify-document`, { docId, status, remarks });
      setMessage({ type: 'success', text: 'Document verification updated.' });
      onReload();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Verification failed.' });
    }
  };

  const handleGenerateLetter = async (appId: string, type: 'LoA' | 'LoD') => {
    try {
      const res = await apiPost(`/api/fd/application/${appId}/generate-letter`, { type });
      setMessage({ type: 'success', text: res.message || `${type} generated.` });
      onReload();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Letter generation failed.' });
    }
  };

  const handleSendLetter = async (appId: string) => {
    try {
      const res = await apiPost(`/api/fd/application/${appId}/send-letter`, {});
      setMessage({ type: 'success', text: res.message || 'Letter sent.' });
      onReload();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Sending letter failed.' });
    }
  };

  const handleDepositDetails = async (appId: string) => {
    try {
      const details = depositDetails[appId] || {};
      const { amount, bank, deadline } = details;
      const res = await apiPost(`/api/fd/application/${appId}/deposit-details`, {
        bankAccountNumber: bank,
        depositAmount: amount,
        depositDeadline: deadline,
      });
      setMessage({ type: 'success', text: res.message || 'Deposit details sent.' });
      // clear fields for this app only
      setDepositDetails((prev) => ({
        ...prev,
        [appId]: { amount: '', bank: '', deadline: '' },
      }));
      onReload();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Deposit details failed.' });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Approval Seeking Applications</h1>
      {applications.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No approval seeking applications found.</div>
      ) : (
        <div className="grid gap-4">
          {applications.map(app => (
            <div key={app.id} className="bg-white bg-opacity-90 backdrop-filter backdrop-blur-lg rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300">
              <button
                className="w-full text-left p-4 flex justify-between items-center"
                onClick={() => toggleExpand(app.id)}
              >
                <div className="space-y-1">
                  <div className="text-lg font-medium text-gray-800">{app.refNumber}</div>
                  <div className="text-sm text-gray-600">{app.collegeName || app.institutionName}</div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    app.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    app.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    app.status === 'SUBMITTED' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>{app.status}</span>
                  <svg className={`w-4 h-4 transform transition-transform ${expandedId === app.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </button>
              {expandedId === app.id && (
                <div className="border-t px-4 py-3 space-y-4">
                  <div className="text-sm text-gray-700">
                    <strong>Application Type:</strong> {app.applicationType === "LOA" || app.applicationType === "LoA" ? "LOA" : app.applicationType === "EOA" || app.applicationType === "EoA" ? "EOA" : "Type not specified"}<br />
                    <strong>Intake:</strong> {app.intake}<br />
                    <strong>Submitted:</strong> {format(new Date(app.applicationDate), 'PPP p')}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-auto">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-2 py-1 text-left text-xs font-semibold text-gray-600">Doc</th>
                          <th className="px-2 py-1 text-left text-xs font-semibold text-gray-600">Status</th>
                          <th className="px-2 py-1 text-left text-xs font-semibold text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {app.documents.map(doc => (
                          <tr key={doc.id} className="hover:bg-gray-50">
                            <td className="px-2 py-1 text-sm">{doc.name}</td>
                            <td className="px-2 py-1">
                              <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                                doc.status === 'Verified' ? 'bg-green-100 text-green-800' :
                                doc.status === 'Not Verified' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>{doc.status}</span>
                            </td>
                            <td className="px-2 py-1 space-x-2">
                              {doc.status !== 'Verified' && (
                                <button
                                  className="bg-green-600 text-white text-xs px-2 py-0.5 rounded hover:bg-green-700"
                                  onClick={() => handleVerifyDoc(app.id, doc.id, 'Verified')}
                                >Verify</button>
                              )}
                              {doc.status !== 'Not Verified' && (
                                <button
                                  className="bg-red-600 text-white text-xs px-2 py-0.5 rounded hover:bg-red-700"
                                  onClick={() => handleVerifyDoc(app.id, doc.id, 'Not Verified', 'Deficiency noted')}
                                >Reject</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
{/* Letter and Deposit Actions */}
<div className="mt-4 space-y-2">
  <button
    type="button"
    className="bg-blue-600 text-white text-sm px-3 py-1 rounded hover:bg-blue-700"
    onClick={() =>
      handleGenerateLetter(
        app.id,
        app.result === "LoA" ? "LoA" : "LoD"
      )
    }
  >
    Generate {app.result === "LoA" ? "LoA" : "LoD"}
  </button>

  <button
    type="button"
    className="bg-gray-600 text-white text-sm px-3 py-1 rounded hover:bg-gray-700"
    onClick={() =>
      window.open(
        `/api/fd/application/${app.id}/letter-preview`,
        "_blank"
      )
    }
  >
    Preview Letter
  </button>

  <button
    type="button"
    className="bg-green-600 text-white text-sm px-3 py-1 rounded hover:bg-green-700"
    onClick={() => handleSendLetter(app.id)}
  >
    Send Letter
  </button>

  <div className="mt-2 flex flex-wrap gap-2 items-center">
    <input
      type="number"
      min="0"
      placeholder="Deposit Amount (INR)"
      className="border rounded px-2 py-1"
      value={depositDetails[app.id]?.amount || ''}
      onChange={(e) =>
        setDepositDetails((prev) => ({
          ...prev,
          [app.id]: {
            ...(prev[app.id] || {}),
            amount: e.target.value,
          },
        }))
      }
    />

    <input
      type="text"
      placeholder="Bank Account No"
      className="border rounded px-2 py-1"
      value={depositDetails[app.id]?.bank || ''}
      onChange={(e) =>
        setDepositDetails((prev) => ({
          ...prev,
          [app.id]: {
            ...(prev[app.id] || {}),
            bank: e.target.value,
          },
        }))
      }
    />

    <input
      type="date"
      aria-label="Deposit Deadline"
      className="border rounded px-2 py-1"
      value={depositDetails[app.id]?.deadline || ''}
      onChange={(e) =>
        setDepositDetails((prev) => ({
          ...prev,
          [app.id]: {
            ...(prev[app.id] || {}),
            deadline: e.target.value,
          },
        }))
      }
    />

    <button
      type="button"
      className="bg-purple-600 text-white text-sm px-3 py-1 rounded hover:bg-purple-700"
      onClick={() => handleDepositDetails(app.id)}
    >
      Send Deposit Details
    </button>
  </div>
</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
