import { useState, useEffect } from 'react';
import { resetMemberPasswordToDefault, bulkCreateMemberAuth, supabase } from '../supabase';
import { Member } from '../types';
import { UserPlus, Users, Search, Edit2, Trash2, X, Check, KeyRound, Shield } from 'lucide-react';

interface MemberManagementProps {
  onBack: () => void;
}

export default function MemberManagement({ onBack }: MemberManagementProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [resetAdminPassword, setResetAdminPassword] = useState('');
  const [showBulkAuthModal, setShowBulkAuthModal] = useState(false);
  const [bulkAuthAdminPassword, setBulkAuthAdminPassword] = useState('');
  const [bulkAuthResults, setBulkAuthResults] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    class_number: '',
    member_number: '',
    phone: '',
    address: '',
    city: '',
    province: '',
    postal_code: '',
    date_of_birth: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      setMembers(data || []);
    } catch (err: any) {
      console.error('Error loading members:', err);
      setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      class_number: '',
      member_number: '',
      phone: '',
      address: '',
      city: '',
      province: '',
      postal_code: '',
      date_of_birth: '',
    });
    setEditingMember(null);
    setShowAddForm(false);
    setError('');
    setSuccess('');
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!formData.name || !formData.class_number) {
        setError('Name and Class Number are required');
        setLoading(false);
        return;
      }

      // Convert class_number to email format
      const email = `${formData.class_number.toLowerCase()}@gmct.member`;

      const newMember = {
        email,
        name: formData.name,
        class_number: formData.class_number.toUpperCase(),
        member_number: formData.member_number || null,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        province: formData.province || null,
        postal_code: formData.postal_code || null,
        date_of_birth: formData.date_of_birth || null,
        is_active: true,
      };

      const { error } = await supabase
        .from('members')
        .insert([newMember])
        .select()
        .single();

      if (error) {
        if (error.message.includes('duplicate key')) {
          throw new Error('Member with this class number already exists');
        }
        throw error;
      }

      setSuccess(`Member ${formData.name} added successfully! Default password: gmct2026`);
      resetForm();
      loadMembers();
    } catch (err: any) {
      console.error('Error adding member:', err);
      setError(err.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const updates = {
        name: formData.name,
        class_number: formData.class_number.toUpperCase(),
        member_number: formData.member_number || null,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        province: formData.province || null,
        postal_code: formData.postal_code || null,
        date_of_birth: formData.date_of_birth || null,
      };

      const { error } = await supabase
        .from('members')
        .update(updates)
        .eq('id', editingMember.id);

      if (error) throw error;

      setSuccess('Member updated successfully!');
      resetForm();
      loadMembers();
    } catch (err: any) {
      console.error('Error updating member:', err);
      setError(err.message || 'Failed to update member');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (member: Member) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      class_number: member.class_number || '',
      member_number: member.member_number || '',
      phone: member.phone || '',
      address: member.address || '',
      city: member.city || '',
      province: member.province || '',
      postal_code: member.postal_code || '',
      date_of_birth: member.date_of_birth || '',
    });
    setShowAddForm(true);
  };

  const getCurrentAdminCodeFromSession = () => {
    try {
      const rawSession = localStorage.getItem('classSession');
      if (!rawSession) return '';

      const parsed = JSON.parse(rawSession);
      if (parsed?.classNumber === -1 && typeof parsed?.accessCode === 'string') {
        return parsed.accessCode;
      }
    } catch (err) {
      console.warn('Unable to parse classSession for admin code prefill:', err);
    }

    return '';
  };

  const openMemberProfile = (member: Member) => {
    setSelectedMember(member);
    setShowResetConfirmation(false);
    setResetAdminPassword(getCurrentAdminCodeFromSession());
    setError('');
  };

  const closeMemberProfile = () => {
    setSelectedMember(null);
    setShowResetConfirmation(false);
    setResetAdminPassword('');
  };

  const handleDeleteMember = async (member: Member) => {
    if (!confirm(`Are you sure you want to delete ${member.name}?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', member.id);

      if (error) throw error;

      setSuccess('Member deleted successfully!');
      loadMembers();
    } catch (err: any) {
      console.error('Error deleting member:', err);
      setError(err.message || 'Failed to delete member');
    } finally {
      setLoading(false);
    }
  };

  const handleResetMemberPassword = async () => {
    if (!selectedMember) return;

    setError('');
    setSuccess('');

    if (!resetAdminPassword.trim()) {
      setError('Password reset cancelled: admin password is required.');
      return;
    }

    setLoading(true);
    try {
      await resetMemberPasswordToDefault(selectedMember.id, resetAdminPassword.trim());
      setSuccess(`Password reset for ${selectedMember.name}. Default password is gmct2026.`);
      setShowResetConfirmation(false);
      setResetAdminPassword('');
    } catch (err: any) {
      console.error('Error resetting member password:', err);
      const message = err?.message || 'Failed to reset member password';
      if (message.includes('reset_member_password_to_default')) {
        setError('Password reset function not found. Run SQL migration: 2026-03-06_add_member_password_reset_rpc.sql');
      } else if (err?.code === '42703' && message.includes('admin_password')) {
        setError('Reset function is using a missing admin_password column. Re-run SQL migration: 2026-03-06_add_member_password_reset_rpc.sql');
      } else if (message.includes('Invalid admin password')) {
        setError('Invalid admin password for reset. Use the same admin password used to log in as admin. If it still fails, update app_settings.admin_password to match your active admin code.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCreateAuth = async () => {
    setError('');
    setSuccess('');
    setBulkAuthResults(null);

    if (!bulkAuthAdminPassword.trim()) {
      setError('Admin password is required.');
      return;
    }

    setLoading(true);
    try {
      const results = await bulkCreateMemberAuth(bulkAuthAdminPassword.trim());
      setBulkAuthResults(results);
      setSuccess(`Auth accounts created! ${results.summary.created} created, ${results.summary.skipped} skipped, ${results.summary.errors} errors.`);
      setBulkAuthAdminPassword('');
    } catch (err: any) {
      console.error('Error creating member auth:', err);
      setError(err?.message || 'Failed to create member auth accounts');
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter((member) =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.class_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.member_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-7 h-7 text-indigo-400" />
              Member Management
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBulkAuthModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
            >
              <Shield className="w-5 h-5" />
              Fix Member Auth
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
            >
              <UserPlus className="w-5 h-5" />
              Add Member
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-lg text-green-200">
            {success}
          </div>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="mb-6 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">
              {editingMember ? 'Edit Member' : 'Add New Member'}
            </h2>
            <form onSubmit={editingMember ? handleUpdateMember : handleAddMember}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Class Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.class_number}
                    onChange={(e) => handleInputChange('class_number', e.target.value)}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g., A123"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Member Number</label>
                  <input
                    type="text"
                    value={formData.member_number}
                    onChange={(e) => handleInputChange('member_number', e.target.value)}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Province</label>
                  <input
                    type="text"
                    value={formData.province}
                    onChange={(e) => handleInputChange('province', e.target.value)}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Postal Code</label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => handleInputChange('postal_code', e.target.value)}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                    className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50"
                >
                  <Check className="w-5 h-5" />
                  {editingMember ? 'Update Member' : 'Add Member'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, class number, or member number..."
              className="w-full pl-11 pr-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Members List */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          {loading && !showAddForm ? (
            <div className="p-8 text-center">
              <div className="inline-block w-8 h-8 border-4 border-slate-600 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="mt-2 text-slate-400">Loading members...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              {searchQuery ? 'No members found matching your search' : 'No members yet. Add your first member!'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Class #</th>
                    <th className="px-4 py-3 text-left">Member #</th>
                    <th className="px-4 py-3 text-left">Phone</th>
                    <th className="px-4 py-3 text-left">City</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr
                      key={member.id}
                      className="border-t border-slate-700 hover:bg-slate-700/30 cursor-pointer"
                      onClick={() => openMemberProfile(member)}
                    >
                      <td className="px-4 py-3">{member.name}</td>
                      <td className="px-4 py-3">{member.class_number || '-'}</td>
                      <td className="px-4 py-3">{member.member_number || '-'}</td>
                      <td className="px-4 py-3">{member.phone || '-'}</td>
                      <td className="px-4 py-3">{member.city || '-'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            member.is_active
                              ? 'bg-green-900/50 text-green-200'
                              : 'bg-red-900/50 text-red-200'
                          }`}
                        >
                          {member.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openMemberProfile(member);
                            }}
                            className="px-3 py-2 rounded-lg bg-blue-900/50 hover:bg-blue-900 transition text-xs font-semibold"
                            title="Open member profile"
                          >
                            Profile
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(member);
                            }}
                            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition"
                            title="Edit member"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMember(member);
                            }}
                            className="p-2 rounded-lg bg-red-900/50 hover:bg-red-900 transition"
                            title="Delete member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-slate-400">
          Total members: {filteredMembers.length}
        </div>

        {selectedMember && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Member Profile</h2>
                  <p className="text-sm text-slate-400">{selectedMember.name}</p>
                </div>
                <button
                  onClick={closeMemberProfile}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-800/60 p-3 border border-slate-700">
                    <p className="text-slate-400">Class Number</p>
                    <p className="font-semibold text-white">{selectedMember.class_number || '-'}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3 border border-slate-700">
                    <p className="text-slate-400">Member Number</p>
                    <p className="font-semibold text-white">{selectedMember.member_number || '-'}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3 border border-slate-700">
                    <p className="text-slate-400">Phone</p>
                    <p className="font-semibold text-white">{selectedMember.phone || '-'}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3 border border-slate-700">
                    <p className="text-slate-400">City</p>
                    <p className="font-semibold text-white">{selectedMember.city || '-'}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-600/40 bg-amber-900/20 p-4">
                  <h3 className="text-base font-semibold text-amber-100 flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Reset Password
                  </h3>

                  {!showResetConfirmation ? (
                    <div className="mt-3">
                      <button
                        onClick={() => setShowResetConfirmation(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 transition font-semibold text-white"
                      >
                        <KeyRound className="w-4 h-4" />
                        Reset To Default
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <p className="text-sm text-amber-100">
                        Confirm reset for <span className="font-semibold">{selectedMember.name}</span>.
                        Password will be set to <span className="font-bold">gmct2026</span>.
                      </p>
                      <label className="block text-sm text-amber-50">
                        Enter admin password to confirm
                        <input
                          type="password"
                          value={resetAdminPassword}
                          onChange={(e) => setResetAdminPassword(e.target.value)}
                          className="mt-1 w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-amber-500 focus:outline-none"
                          placeholder="Admin password"
                        />
                      </label>
                      <p className="text-xs text-amber-100/80">
                        This field is prefilled from your current admin login when available.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handleResetMemberPassword}
                          disabled={loading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 transition font-semibold text-white disabled:opacity-60"
                        >
                          {loading ? 'Resetting...' : 'Confirm Reset'}
                        </button>
                        <button
                          onClick={() => {
                            setShowResetConfirmation(false);
                            setResetAdminPassword('');
                          }}
                          className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Auth Creation Modal */}
        {showBulkAuthModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Shield className="w-6 h-6 text-emerald-400" />
                  Fix Member Auth Accounts
                </h2>
                <button
                  onClick={() => {
                    setShowBulkAuthModal(false);
                    setBulkAuthResults(null);
                    setBulkAuthAdminPassword('');
                  }}
                  className="text-slate-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {!bulkAuthResults ? (
                <div className="space-y-4">
                  <p className="text-slate-300">
                    This will create auth accounts for all members who don't have them yet.
                    All accounts will be created with the default password: <span className="font-bold text-emerald-400">gmct2026</span>
                  </p>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Admin Password (Required)
                    </label>
                    <input
                      type="password"
                      value={bulkAuthAdminPassword}
                      onChange={(e) => setBulkAuthAdminPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Enter admin password"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={handleBulkCreateAuth}
                      disabled={loading || !bulkAuthAdminPassword.trim()}
                      className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold text-white disabled:opacity-50 transition"
                    >
                      {loading ? 'Creating...' : 'Create Auth Accounts'}
                    </button>
                    <button
                      onClick={() => {
                        setShowBulkAuthModal(false);
                        setBulkAuthAdminPassword('');
                      }}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-800 rounded-lg p-4">
                    <h3 className="font-bold text-lg mb-2">Summary</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">Total Members:</span>
                        <span className="ml-2 font-bold">{bulkAuthResults.summary.total}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Created:</span>
                        <span className="ml-2 font-bold text-emerald-400">{bulkAuthResults.summary.created}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Skipped:</span>
                        <span className="ml-2 font-bold text-yellow-400">{bulkAuthResults.summary.skipped}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Errors:</span>
                        <span className="ml-2 font-bold text-red-400">{bulkAuthResults.summary.errors}</span>
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-slate-400">
                      Default password for all created accounts: <span className="font-bold text-emerald-400">gmct2026</span>
                    </p>
                  </div>

                  {bulkAuthResults.results.created.length > 0 && (
                    <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4">
                      <h4 className="font-bold mb-2 text-emerald-400">Created ({bulkAuthResults.results.created.length})</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
                        {bulkAuthResults.results.created.map((item: any, idx: number) => (
                          <div key={idx} className="text-slate-300">{item.name} ({item.email})</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {bulkAuthResults.results.errors.length > 0 && (
                    <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                      <h4 className="font-bold mb-2 text-red-400">Errors ({bulkAuthResults.results.errors.length})</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
                        {bulkAuthResults.results.errors.map((item: any, idx: number) => (
                          <div key={idx} className="text-red-300">{item.name}: {item.error}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setShowBulkAuthModal(false);
                      setBulkAuthResults(null);
                      setBulkAuthAdminPassword('');
                      loadMembers();
                    }}
                    className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
