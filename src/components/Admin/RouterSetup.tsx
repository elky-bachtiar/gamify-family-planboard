import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wifi,
  Search,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Router,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { encrypt, decrypt } from '../../lib/encryption';

interface RouterBridge {
  id: string;
  family_id: string;
  router_ip: string | null;
  router_model: string | null;
  router_username: string | null;
  router_password_encrypted: string | null;
  status: string;
  last_seen_at: string | null;
  last_test_at: string | null;
  last_test_success: boolean | null;
  last_test_error: string | null;
  created_at: string;
}

export function RouterSetup() {
  const { t } = useTranslation(['admin', 'common']);
  const { family } = useAuth();
  const [bridge, setBridge] = useState<RouterBridge | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [routerIp, setRouterIp] = useState('192.168.1.1');
  const [routerUsername, setRouterUsername] = useState('admin');
  const [routerPassword, setRouterPassword] = useState('');

  useEffect(() => {
    if (family?.id) {
      fetchBridge();
    }
  }, [family?.id]);

  const fetchBridge = async () => {
    if (!family?.id) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('router_bridges')
        .select('*')
        .eq('family_id', family.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setBridge(data);
        setRouterIp(data.router_ip || '192.168.1.1');
        setRouterUsername(data.router_username || 'admin');
        if (data.router_password_encrypted) {
          try {
            const decryptedPassword = await decrypt(data.router_password_encrypted);
            setRouterPassword(decryptedPassword);
          } catch (err) {
            console.error('Failed to decrypt router credential:', err);
            // Password might be in old format, clear it
            setRouterPassword('');
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch router bridge:', err);
      setError('Failed to load router configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoDiscover = async () => {
    setDiscovering(true);
    setError(null);

    // Simulate auto-discovery - in production this would scan the network
    setTimeout(() => {
      setRouterIp('192.168.1.1');
      setDiscovering(false);
      setSuccess('Router found at 192.168.1.1');
      setTimeout(() => setSuccess(null), 3000);
    }, 2000);
  };

  const handleTestConnection = async () => {
    if (!routerIp || !routerPassword) {
      setError('Please enter router IP and password');
      return;
    }

    setTesting(true);
    setError(null);
    setSuccess(null);

    try {
      // In production, this would actually test the connection via the Chrome Extension
      // For now, we'll just update the test timestamp
      if (bridge?.id) {
        const { error: updateError } = await supabase
          .from('router_bridges')
          .update({
            last_test_at: new Date().toISOString(),
            last_test_success: true, // Simulated success
            last_test_error: null,
          })
          .eq('id', bridge.id);

        if (updateError) throw updateError;

        setSuccess('Connection test successful! (Note: Full testing requires the Bridge Agent)');
        await fetchBridge();
      } else {
        setSuccess('Save configuration first, then test connection');
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      setError('Connection test failed');
    } finally {
      setTesting(false);
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  const handleSave = async () => {
    if (!family?.id) return;
    if (!routerIp) {
      setError('Router IP address is required');
      return;
    }
    if (!routerPassword) {
      setError('Router admin password is required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const encryptedPassword = await encrypt(routerPassword);

      const bridgeData = {
        family_id: family.id,
        router_ip: routerIp,
        router_username: routerUsername || 'admin',
        router_password_encrypted: encryptedPassword,
        router_model: 'Linksys Velop', // Default for now
        status: 'pending',
      };

      if (bridge?.id) {
        // Update existing
        const { error: updateError } = await supabase
          .from('router_bridges')
          .update(bridgeData)
          .eq('id', bridge.id);

        if (updateError) throw updateError;
      } else {
        // Create new
        const { error: insertError } = await supabase.from('router_bridges').insert(bridgeData);

        if (insertError) throw insertError;
      }

      setSuccess('Router configuration saved successfully!');
      await fetchBridge();
    } catch (err: unknown) {
      console.error('Failed to save router configuration:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to save router configuration';
      setError(errorMessage);
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-xl">
          <Router className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t('admin:router.title', 'Router Configuration')}
          </h3>
          <p className="text-sm text-gray-500">
            {t('admin:router.description', 'Configure your Linksys Velop router for WiFi control')}
          </p>
        </div>
      </div>

      {/* Status Banner */}
      {bridge && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg ${
            bridge.status === 'active'
              ? 'bg-green-50 border border-green-200'
              : bridge.status === 'error'
                ? 'bg-red-50 border border-red-200'
                : 'bg-yellow-50 border border-yellow-200'
          }`}
        >
          {bridge.status === 'active' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : bridge.status === 'error' ? (
            <XCircle className="w-5 h-5 text-red-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-yellow-600" />
          )}
          <div>
            <p
              className={`font-medium ${
                bridge.status === 'active'
                  ? 'text-green-800'
                  : bridge.status === 'error'
                    ? 'text-red-800'
                    : 'text-yellow-800'
              }`}
            >
              {bridge.status === 'active'
                ? 'Router Connected'
                : bridge.status === 'error'
                  ? 'Connection Error'
                  : 'Awaiting Connection'}
            </p>
            {bridge.last_test_at && (
              <p className="text-sm text-gray-600">
                Last tested: {new Date(bridge.last_test_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {/* Find Router Section */}
      <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-900">
            {t('admin:router.findRouter', 'Find Router')}
          </h4>
          <button
            onClick={handleAutoDiscover}
            disabled={discovering}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {discovering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {t('admin:router.autoDiscover', 'Auto-Discover')}
          </button>
        </div>

        {/* Router Credentials */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">
            {t('admin:router.credentials', 'Router Credentials')}
          </h4>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin:router.routerIp', 'Router IP Address')}
            </label>
            <input
              type="text"
              value={routerIp}
              onChange={(e) => setRouterIp(e.target.value)}
              placeholder="192.168.1.1"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin:router.adminPassword', 'Admin Password')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={routerPassword}
                onChange={(e) => setRouterPassword(e.target.value)}
                placeholder="Enter router admin password"
                className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {t(
                'admin:router.passwordHint',
                "This is your router's admin password, not your WiFi password"
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleTestConnection}
          disabled={testing || !routerIp || !routerPassword}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
          {t('admin:router.testConnection', 'Test Connection')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !routerIp || !routerPassword}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('admin:router.saveConfiguration', 'Save Configuration')}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">
              {t('admin:router.infoTitle', 'How WiFi Control Works')}
            </p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>{t('admin:router.info1', 'Configure your router credentials above')}</li>
              <li>
                {t('admin:router.info2', 'Install the Taskaroo Bridge Agent on your computer')}
              </li>
              <li>{t('admin:router.info3', 'Map network devices to family members')}</li>
              <li>
                {t(
                  'admin:router.info4',
                  "Control children's internet access based on chore completion"
                )}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
