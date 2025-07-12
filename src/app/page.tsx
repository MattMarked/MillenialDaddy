'use client';

import { useState } from 'react';
import AdminManagement from '@/components/AdminManagement';
import ConfigurationManagement from '@/components/ConfigurationManagement';

type ActiveTab = 'overview' | 'admins' | 'config';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: '📊' },
    { id: 'admins' as const, label: 'Admin Management', icon: '👥' },
    { id: 'config' as const, label: 'Configuration', icon: '⚙️' },
  ];

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Video Link Queue Service
            </h1>
            <p className="mt-2 text-gray-600">
              Automated content curation and publishing system
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">System Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-blue-900">Queue Status</h3>
                  <p className="text-sm text-blue-700 mt-1">Monitor processing queues</p>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Input Queue:</span>
                      <span className="font-medium">-</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Ready to Publish:</span>
                      <span className="font-medium">-</span>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-green-900">Publication Status</h3>
                  <p className="text-sm text-green-700 mt-1">Next scheduled publication</p>
                  <div className="mt-3">
                    <p className="text-sm font-medium">-</p>
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-purple-900">System Health</h3>
                  <p className="text-sm text-purple-700 mt-1">Service status</p>
                  <div className="mt-3">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Operational
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setActiveTab('admins')}
                  className="text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <h3 className="font-medium text-gray-900">Manage Admins</h3>
                  <p className="text-sm text-gray-500 mt-1">Add or remove system administrators</p>
                </button>
                <button
                  onClick={() => setActiveTab('config')}
                  className="text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <h3 className="font-medium text-gray-900">Configure Publishing</h3>
                  <p className="text-sm text-gray-500 mt-1">Set publication frequency and schedule</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admins' && <AdminManagement />}
        {activeTab === 'config' && <ConfigurationManagement />}
      </div>
    </main>
  );
}