import { type ChangeEvent, type FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import Pagination from '../components/Pagination';
import { supabase } from '../utils/supabase';

interface LoyalCustomerRecord {
  id: number;
  name: string;
  whatsapp: string;
  address: string;
}

interface LoyalCustomerQueryResult {
  records: LoyalCustomerRecord[];
  totalItems: number;
}

interface LoyalCustomerFormData {
  name: string;
  whatsapp: string;
  address: string;
}

const PAGE_SIZE = 10;

const DEFAULT_FORM_DATA: LoyalCustomerFormData = {
  name: '',
  whatsapp: '',
  address: '',
};

const normalizeWhatsappInput = (value: string) => {
  const compact = value.replace(/[\s-]/g, '');
  const hasCountryPrefix = compact.startsWith('+62') || compact.startsWith('62');
  let localNumber = compact.replace(/^\+?62/, '');
  localNumber = localNumber.replace(/\D/g, '');

  return {
    localNumber,
    hasCountryPrefix,
  };
};

const toLocalWhatsappFromRecord = (value: string) => {
  const compact = value.replace(/[\s-]/g, '');
  let localNumber = compact.replace(/^\+?62/, '');

  if (localNumber.startsWith('0')) {
    localNumber = localNumber.slice(1);
  }

  return localNumber.replace(/\D/g, '');
};

const LoyalCustomer = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<LoyalCustomerFormData>(DEFAULT_FORM_DATA);
  const [whatsappPrefixWarning, setWhatsappPrefixWarning] = useState(false);
  const [isDataSensorOn, setIsDataSensorOn] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const {
    data: loyalCustomersQueryData,
    isLoading,
    isFetching,
    isError,
  } = useQuery<LoyalCustomerQueryResult>({
    queryKey: ['loyal-customers', currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('loyal_customers')
        .select('id,name,whatsapp,address', { count: 'exact' })
        .order('id', { ascending: false })
        .range(from, to);

      if (error) {
        if (editingId === null) {
          toast.error(`Gagal menambahkan loyal customer: ${error.message}`);
        }
        throw error;
      }

      return {
        records: (data ?? []) as LoyalCustomerRecord[],
        totalItems: count ?? 0,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const records = loyalCustomersQueryData?.records ?? [];
  const totalItems = loyalCustomersQueryData?.totalItems ?? 0;
  const loading = isLoading || isFetching;
  const sensorClass = isDataSensorOn ? 'select-none blur-sm' : '';

  const openAddModal = () => {
    setEditingId(null);
    setFormData(DEFAULT_FORM_DATA);
    setWhatsappPrefixWarning(false);
    setIsModalOpen(true);
  };

  const openEditModal = (record: LoyalCustomerRecord) => {
    setEditingId(record.id);
    setFormData({
      name: record.name,
      whatsapp: toLocalWhatsappFromRecord(record.whatsapp),
      address: record.address,
    });
    setWhatsappPrefixWarning(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) {
      return;
    }

    setEditingId(null);
    setFormData(DEFAULT_FORM_DATA);
    setWhatsappPrefixWarning(false);
    setIsModalOpen(false);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;

    if (name === 'whatsapp') {
      const { localNumber, hasCountryPrefix } = normalizeWhatsappInput(value);
      setWhatsappPrefixWarning(hasCountryPrefix);

      setFormData((prev) => ({
        ...prev,
        whatsapp: localNumber,
      }));

      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (whatsappPrefixWarning) {
      alert('Nomor Whatsapp tidak perlu diawali +62 karena prefix sudah otomatis.');
      return;
    }

    if (!formData.whatsapp.startsWith('8')) {
      alert('Nomor Whatsapp harus diawali dengan angka 8.');
      return;
    }

    if (!formData.name.trim() || !formData.whatsapp.trim() || !formData.address.trim()) {
      alert('Mohon isi data loyal customer dengan lengkap.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name.trim(),
        whatsapp: `+62${formData.whatsapp.trim()}`,
        address: formData.address.trim(),
      };

      const { error } = editingId === null
        ? await supabase.from('loyal_customers').insert([payload])
        : await supabase.from('loyal_customers').update(payload).eq('id', editingId);

      if (error) {
        throw error;
      }

      if (editingId === null) {
        setCurrentPage(1);
      }

      await queryClient.invalidateQueries({ queryKey: ['loyal-customers'] });
      setEditingId(null);
      setFormData(DEFAULT_FORM_DATA);
      setWhatsappPrefixWarning(false);
      setIsModalOpen(false);

      if (editingId === null) {
        toast.success('Loyal customer berhasil ditambahkan.');
      } else {
        toast.success('Loyal customer berhasil diperbarui.');
      }
    } catch (error) {
      console.error('Error saving loyal customer:', error);
      if (editingId === null) {
        toast.error('Gagal menyimpan loyal customer. Silakan coba lagi.');
      } else {
        toast.error('Gagal memperbarui loyal customer. Silakan coba lagi.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const target = records.find((item) => item.id === id);
    if (!target) {
      return;
    }

    const shouldDelete = window.confirm(`Hapus customer ${target.name}?`);
    if (!shouldDelete) {
      return;
    }

    setDeletingId(id);

    try {
      const { error } = await supabase.from('loyal_customers').delete().eq('id', id);

      if (error) {
        throw error;
      }

      const shouldMoveToPreviousPage = records.length === 1 && currentPage > 1;
      if (shouldMoveToPreviousPage) {
        setCurrentPage((prev) => prev - 1);
      }

      await queryClient.invalidateQueries({ queryKey: ['loyal-customers'] });
      toast.success('Loyal customer berhasil dihapus.');
    } catch (error) {
      console.error('Error deleting loyal customer:', error);
      toast.error('Gagal menghapus data loyal customer. Silakan coba lagi.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page-enter space-y-6">
      <div className="page-header">
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <ol className="list-none inline-flex flex-wrap items-center gap-2 p-0">
            <li>Home</li>
            <li>/</li>
            <li className="font-semibold text-slate-900">Parameter</li>
            <li>/</li>
            <li className="font-semibold uppercase tracking-[0.08em] text-cyan-800">Loyal Customer</li>
          </ol>
        </nav>
        <h1 className="page-title">Loyal Customer</h1>
        <p className="page-subtitle">Kelola data pelanggan loyal untuk kebutuhan penjualan dan retensi.</p>
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl border border-cyan-100">
        <div className="flex items-center justify-end gap-2 border-b border-cyan-100 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setIsDataSensorOn((prev) => !prev)}
            title={isDataSensorOn ? 'Tampilkan data sensitif' : 'Sembunyikan data sensitif'}
            aria-label={isDataSensorOn ? 'Tampilkan data sensitif' : 'Sembunyikan data sensitif'}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              isDataSensorOn
                ? 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                : 'border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
            }`}
          >
            {isDataSensorOn ? <EyeOff size={16} /> : <Eye size={16} />}
            {isDataSensorOn ? 'Sensor: On' : 'Sensor: Off'}
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="modern-primary flex cursor-pointer items-center justify-center gap-2 px-4 py-2 font-medium"
          >
            <Plus size={16} />
            Add
          </button>
        </div>

        {isError ? (
          <div className="p-10 text-center text-slate-500">Gagal memuat data loyal customer.</div>
        ) : loading ? (
          <div className="p-10 text-center text-slate-500">Loading loyal customer...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="modern-table w-full min-w-[720px]">
              <thead className="border-b border-cyan-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Whatsapp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-50 bg-white/80">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                      Belum ada data loyal customer.
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.id}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{record.name}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                        <span className={sensorClass}>{record.whatsapp}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">
                        <span className={sensorClass}>{record.address}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(record)}
                            title="Edit loyal customer"
                            aria-label={`Edit ${record.name}`}
                            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleDelete(record.id);
                            }}
                            title="Delete loyal customer"
                            aria-label={`Delete ${record.name}`}
                            disabled={deletingId === record.id}
                            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-rose-200 text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-cyan-100 bg-white/95 p-5 shadow-2xl sm:mx-4 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">
                {editingId === null ? 'Add Loyal Customer' : 'Edit Loyal Customer'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                aria-label="Close modal"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  autoComplete="off"
                  placeholder="Nama customer"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Whatsapp</label>
                <div className="flex overflow-hidden rounded-md border border-slate-300 focus-within:ring-2 focus-within:ring-blue-500">
                  <span className="inline-flex items-center bg-slate-100 px-3 text-sm font-medium text-slate-700">+62</span>
                  <input
                    type="text"
                    name="whatsapp"
                    value={formData.whatsapp}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    autoComplete="off"
                    inputMode="numeric"
                    placeholder="812xxxxxxxx"
                    className="w-full border-0 px-3 py-2 focus:outline-none"
                  />
                </div>
                {whatsappPrefixWarning && (
                  <p className="mt-1 text-sm text-rose-600">Jangan input +62 lagi, cukup mulai dari angka 8.</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  rows={4}
                  placeholder="Alamat customer"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X size={16} className="mr-2" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="modern-primary inline-flex cursor-pointer items-center justify-center rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send size={16} className="mr-2" />
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoyalCustomer;
