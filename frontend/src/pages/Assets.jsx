import { useState, useEffect } from 'react';
import {
  Plus,
  Upload,
  Radar,
  Trash2,
  Server,
  RefreshCw,
} from 'lucide-react';
import Modal from '../components/Modal';
import Spinner, { FullPageSpinner } from '../components/Spinner';
import { useToast } from '../components/ToastContext';
import {
  getAssets,
  createAsset,
  importYamlAssets,
  scanAssets,
  deleteAsset,
} from '../services/api';

const ASSET_TYPES = ['server', 'workstation', 'network_device', 'application', 'database', 'iot', 'cloud', 'other'];

const emptyForm = {
  name: '',
  type: 'server',
  vendor: '',
  product: '',
  version: '',
  port: '',
  network: '',
};

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showYamlModal, setShowYamlModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [yamlContent, setYamlContent] = useState('');
  const [scanTarget, setScanTarget] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const { addToast } = useToast();

  const fetchAssets = async () => {
    try {
      const res = await getAssets();
      setAssets(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      addToast('Failed to load assets', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleAddAsset = async (e) => {
    e.preventDefault();
    if (!form.name || !form.vendor || !form.product || !form.version) {
      addToast('Please fill in all required fields', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        vendor: form.vendor,
        product: form.product,
        version: form.version,
      };
      if (form.port) payload.port = parseInt(form.port, 10);
      if (form.network) payload.network = form.network;
      await createAsset(payload);
      addToast('Asset added successfully', 'success');
      setShowAddModal(false);
      setForm({ ...emptyForm });
      fetchAssets();
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to add asset', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportYaml = async () => {
    if (!yamlContent.trim()) {
      addToast('Please paste YAML content', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await importYamlAssets(yamlContent);
      addToast('YAML imported successfully', 'success');
      setShowYamlModal(false);
      setYamlContent('');
      fetchAssets();
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to import YAML', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScan = async () => {
    if (!scanTarget.trim()) {
      addToast('Please enter a target IP or range', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await scanAssets(scanTarget);
      addToast('Network scan initiated', 'success');
      setShowScanModal(false);
      setScanTarget('');
      setTimeout(fetchAssets, 2000);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Scan failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteAsset(id);
      addToast('Asset deleted', 'success');
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      addToast('Failed to delete asset', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <FullPageSpinner message="Loading assets..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Assets</h1>
          <p className="text-sm text-gray-400 mt-1">
            {assets.length} asset{assets.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Asset
          </button>
          <button
            onClick={() => setShowYamlModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg text-sm font-medium hover:bg-purple-500/20 transition-all"
          >
            <Upload className="w-4 h-4" />
            Import YAML
          </button>
          <button
            onClick={() => setShowScanModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-all"
          >
            <Radar className="w-4 h-4" />
            Scan Network
          </button>
          <button
            onClick={() => {
              setLoading(true);
              fetchAssets();
            }}
            className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Port
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500 text-sm">
                    <Server className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No assets found. Add assets manually, import YAML, or scan your network.
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="px-5 py-3 text-sm text-gray-200 font-medium">
                      {asset.name}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded border bg-gray-800 border-gray-700 text-gray-300 capitalize">
                        {asset.type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-400">
                      {asset.vendor}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-300">
                      {asset.product}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-cyan-400">
                      {asset.version}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-400">
                      {asset.port || '--'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDelete(asset.id)}
                        disabled={deletingId === asset.id}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10 disabled:opacity-50"
                      >
                        {deletingId === asset.id ? (
                          <Spinner size="sm" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Asset Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Asset"
      >
        <form onSubmit={handleAddAsset} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Web Server 01"
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
              Type
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50"
            >
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
                Vendor <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                placeholder="e.g., Apache"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
                Product <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.product}
                onChange={(e) => setForm({ ...form, product: e.target.value })}
                placeholder="e.g., HTTP Server"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
                Version <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                placeholder="2.4.51"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
                Port
              </label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
                placeholder="443"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">
                Network
              </label>
              <input
                type="text"
                value={form.network}
                onChange={(e) => setForm({ ...form, network: e.target.value })}
                placeholder="10.0.0.0/24"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg border border-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/25 transition-all disabled:opacity-50"
            >
              {submitting && <Spinner size="sm" />}
              Add Asset
            </button>
          </div>
        </form>
      </Modal>

      {/* Import YAML Modal */}
      <Modal
        isOpen={showYamlModal}
        onClose={() => setShowYamlModal(false)}
        title="Import Assets from YAML"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Paste your asset inventory YAML below. Each asset should define name, type, vendor, product, and version.
          </p>
          <textarea
            value={yamlContent}
            onChange={(e) => setYamlContent(e.target.value)}
            rows={12}
            placeholder={`assets:\n  - name: Web Server\n    type: server\n    vendor: Apache\n    product: HTTP Server\n    version: "2.4.51"\n    port: 443`}
            className="w-full px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 resize-none"
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowYamlModal(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg border border-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImportYaml}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/25 transition-all disabled:opacity-50"
            >
              {submitting && <Spinner size="sm" />}
              Import
            </button>
          </div>
        </div>
      </Modal>

      {/* Scan Network Modal */}
      <Modal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        title="Scan Network"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Enter an IP address or CIDR range to scan for assets.
          </p>
          <input
            type="text"
            value={scanTarget}
            onChange={(e) => setScanTarget(e.target.value)}
            placeholder="192.168.1.0/24"
            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowScanModal(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg border border-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleScan}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/25 transition-all disabled:opacity-50"
            >
              {submitting && <Spinner size="sm" />}
              Start Scan
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
