'use client';

import { useState, useEffect } from 'react';
import { PublicationConfig } from '@/types';

interface ConfigurationManagementProps {
  className?: string;
}

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney'
];

export default function ConfigurationManagement({ className = '' }: ConfigurationManagementProps) {
  const [config, setConfig] = useState<PublicationConfig>({
    frequency: 'daily',
    times: ['09:00'],
    timezone: 'UTC'
  });
  const [nextPublicationTime, setNextPublicationTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formConfig, setFormConfig] = useState<PublicationConfig>(config);
  const [newTime, setNewTime] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/config/publication', {
        headers: {
          'x-admin-email': 'admin@example.com' // TODO: Get from auth context
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setConfig(data.config);
        setFormConfig(data.config);
        setNextPublicationTime(data.nextPublicationTime);
      } else {
        setError('Failed to fetch configuration');
      }
    } catch (err) {
      setError('Error fetching configuration');
      console.error('Error fetching config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      const response = await fetch('/api/config/publication', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': 'admin@example.com' // TODO: Get from auth context
        },
        body: JSON.stringify(formConfig),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setConfig(data.config);
        setNextPublicationTime(data.nextPublicationTime);
        setSuccess('Configuration updated successfully');
      } else {
        setError(data.error || 'Failed to update configuration');
      }
    } catch (err) {
      setError('Error updating configuration');
      console.error('Error updating config:', err);
    } finally {
      setSaving(false);
    }
  };

  const addTime = () => {
    if (newTime && !formConfig.times.includes(newTime)) {
      setFormConfig({
        ...formConfig,
        times: [...formConfig.times, newTime].sort()
      });
      setNewTime('');
    }
  };

  const removeTime = (timeToRemove: string) => {
    setFormConfig({
      ...formConfig,
      times: formConfig.times.filter(time => time !== timeToRemove)
    });
  };

  const handleFrequencyChange = (frequency: PublicationConfig['frequency']) => {
    const newConfig = { ...formConfig, frequency };
    
    // Reset times based on frequency
    if (frequency === 'daily') {
      newConfig.times = formConfig.times.length > 0 ? [formConfig.times[0]] : ['09:00'];
      delete newConfig.interval;
    } else if (frequency === 'every-x-days') {
      newConfig.times = formConfig.times.length > 0 ? [formConfig.times[0]] : ['09:00'];
      newConfig.interval = newConfig.interval || 2;
    }
    
    setFormConfig(newConfig);
  };

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Publication Configuration</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Form */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Publication Settings</h3>
          
          <div className="space-y-4">
            {/* Frequency Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Publication Frequency
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="frequency"
                    value="daily"
                    checked={formConfig.frequency === 'daily'}
                    onChange={(e) => handleFrequencyChange(e.target.value as PublicationConfig['frequency'])}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Daily</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="frequency"
                    value="multiple-daily"
                    checked={formConfig.frequency === 'multiple-daily'}
                    onChange={(e) => handleFrequencyChange(e.target.value as PublicationConfig['frequency'])}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Multiple times daily</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="frequency"
                    value="every-x-days"
                    checked={formConfig.frequency === 'every-x-days'}
                    onChange={(e) => handleFrequencyChange(e.target.value as PublicationConfig['frequency'])}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Every X days</span>
                </label>
              </div>
            </div>

            {/* Interval for every-x-days */}
            {formConfig.frequency === 'every-x-days' && (
              <div>
                <label htmlFor="interval" className="block text-sm font-medium text-gray-700 mb-1">
                  Interval (days)
                </label>
                <input
                  type="number"
                  id="interval"
                  min="1"
                  max="30"
                  value={formConfig.interval || 2}
                  onChange={(e) => setFormConfig({
                    ...formConfig,
                    interval: parseInt(e.target.value) || 2
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Timezone Selection */}
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
                Timezone
              </label>
              <select
                id="timezone"
                value={formConfig.timezone}
                onChange={(e) => setFormConfig({ ...formConfig, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            {/* Publication Times */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Publication Times
              </label>
              
              {/* Current Times */}
              <div className="space-y-2 mb-3">
                {formConfig.times.map((time, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                    <span className="text-sm font-mono">{time}</span>
                    {formConfig.times.length > 1 && (
                      <button
                        onClick={() => removeTime(time)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add New Time */}
              {formConfig.frequency === 'multiple-daily' && (
                <div className="flex space-x-2">
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={addTime}
                    disabled={!newTime || formConfig.times.includes(newTime)}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* API Keys Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Keys
              </label>
              <div className="space-y-3">
                <div>
                  <label htmlFor="instagramToken" className="block text-xs font-medium text-gray-600 mb-1">
                    Instagram Access Token
                  </label>
                  <input
                    type="password"
                    id="instagramToken"
                    placeholder="Enter Instagram access token"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="openaiKey" className="block text-xs font-medium text-gray-600 mb-1">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    id="openaiKey"
                    placeholder="Enter OpenAI API key"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="tiktokKey" className="block text-xs font-medium text-gray-600 mb-1">
                    TikTok API Key
                  </label>
                  <input
                    type="password"
                    id="tiktokKey"
                    placeholder="Enter TikTok API key"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>

        {/* Current Status */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Current Status</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Active Configuration</h4>
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm"><strong>Frequency:</strong> {config.frequency}</p>
                <p className="text-sm"><strong>Times:</strong> {config.times.join(', ')}</p>
                {config.interval && (
                  <p className="text-sm"><strong>Interval:</strong> Every {config.interval} days</p>
                )}
                <p className="text-sm"><strong>Timezone:</strong> {config.timezone}</p>
              </div>
            </div>

            {nextPublicationTime && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Next Publication</h4>
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-sm text-blue-800">
                    {new Date(nextPublicationTime).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Schedule Preview</h4>
              <div className="bg-gray-50 p-3 rounded text-sm text-gray-600">
                {formConfig.frequency === 'daily' && (
                  <p>Posts will be published daily at {formConfig.times[0]} ({formConfig.timezone})</p>
                )}
                {formConfig.frequency === 'multiple-daily' && (
                  <p>Posts will be published {formConfig.times.length} times daily at: {formConfig.times.join(', ')} ({formConfig.timezone})</p>
                )}
                {formConfig.frequency === 'every-x-days' && (
                  <p>Posts will be published every {formConfig.interval} days at {formConfig.times[0]} ({formConfig.timezone})</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}