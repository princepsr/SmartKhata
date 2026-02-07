import React, { useState } from 'react';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { useIPC } from '../../hooks/useIPC';

export const IPCPoc: React.FC = () => {
  // State for Ping
  const [pingResult, setPingResult] = useState<string | null>(null);
  
  // Use IPC Hook for App Info
  const { 
    data: appInfo, 
    loading: loadingInfo, 
    error: errorInfo, 
    execute: fetchAppInfo 
  } = useIPC<{ name: string; version: string; platform: string }>(
    IPC_CHANNELS.SYSTEM_GET_APP_INFO
  );

  // Manual IPC call for Ping using window.electron
  // (Or we could use useIPC here too, but let's demonstrate both or just use hooks)
  // Let's use the hook for consistency in this POC component
  const {
    data: pingData,
    loading: loadingPing,
    execute: executePing
  } = useIPC<string>(IPC_CHANNELS.SYSTEM_PING);

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 space-y-6">
      <h2 className="text-xl font-bold text-gray-800 border-b pb-2">
        IPC Connectivity Test (POC)
      </h2>

      {/* Ping Test */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-700">System Ping</span>
          <button
            onClick={() => executePing()}
            disabled={loadingPing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loadingPing ? 'Pinging...' : 'Send Ping'}
          </button>
        </div>
        
        {pingData && (
          <div className="p-3 bg-green-50 text-green-700 rounded border border-green-200">
            ✅ Response: <strong>{pingData}</strong>
          </div>
        )}
      </div>

      {/* App Info Test */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-700">App Information</span>
          <button
            onClick={() => fetchAppInfo()}
            disabled={loadingInfo}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {loadingInfo ? 'Loading...' : 'Get Info'}
          </button>
        </div>

        {errorInfo && (
          <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200">
            ❌ Error: {errorInfo}
          </div>
        )}

        {appInfo && (
          <div className="p-4 bg-gray-50 rounded border border-gray-200 font-mono text-sm space-y-1">
            <p><span className="text-gray-500">Name:</span> {appInfo.name}</p>
            <p><span className="text-gray-500">Version:</span> {appInfo.version}</p>
            <p><span className="text-gray-500">Platform:</span> {appInfo.platform}</p>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 pt-4 border-t">
        <p>Using Channel Registry & IPC Client Wrapper</p>
      </div>
    </div>
  );
};
