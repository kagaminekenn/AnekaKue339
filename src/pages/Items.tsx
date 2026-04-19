import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { Plus, X, Check, Pencil } from 'lucide-react';
import Pagination from '../components/Pagination';
import type { Item, ItemFormErrors } from '../types/items';
import {
  DEFAULT_ITEM_FORM_DATA,
  PAGE_SIZE,
  formatDisplayDate,
  formatPriceInput,
  parsePriceInput,
  validateItemForm,
  validateEditItemForm,
  isDateRangeInvalid,
  getNextDateValue
} from '../utils/helper';

type ModalMode = 'add' | 'edit';

const Items = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [formData, setFormData] = useState(DEFAULT_ITEM_FORM_DATA);
  const [errors, setErrors] = useState<ItemFormErrors>({});
  const startDateRef = useRef<HTMLInputElement | null>(null);
  const endDateRef = useRef<HTMLInputElement | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (name in errors) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (name in errors) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPriceInput(e.target.value);
    setFormData(prev => ({
      ...prev,
      base_price: formatted
    }));
    if (errors.base_price) {
      setErrors(prev => ({ ...prev, base_price: undefined }));
    }
  };

  const handleStatusToggle = () => {
    setFormData(prev => ({
      ...prev,
      is_active: !(prev.is_active ?? false)
    }));

    if (errors.status) {
      setErrors(prev => ({ ...prev, status: undefined }));
    }
  };

  const dateRangeInvalid = isDateRangeInvalid(formData.start_date, formData.end_date);
  const editDateRangeInvalid =
    modalMode === 'edit' &&
    Boolean(formData.start_date) &&
    Boolean(formData.end_date) &&
    formData.end_date <= formData.start_date;

  const openAddModal = () => {
    setModalMode('add');
    setEditingItemId(null);
    setFormData(DEFAULT_ITEM_FORM_DATA);
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    setModalMode('edit');
    setEditingItemId(item.id);
    setFormData({
      name: item.name,
      base_price: formatPriceInput(String(item.base_price)),
      start_date: item.start_date,
      end_date: item.end_date ?? '',
      is_active: item.is_active
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const fetchItems = useCallback(async (page: number) => {
    setLoading(true);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      const { data, error, count } = await supabase
        .from('items')
        .select('*', { count: 'exact' })
        .order('name', { ascending: true })
        .range(from, to);

      if (error) {
        console.error('Error fetching items:', error);
        return;
      }

      setItems(data || []);
      setTotalItems(count || 0);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors = modalMode === 'edit'
      ? validateEditItemForm(formData)
      : validateItemForm(formData);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if ((modalMode === 'add' && dateRangeInvalid) || editDateRangeInvalid) {
      alert('Start Date cannot be greater than End Date.');
      return;
    }

    try {
      const { error } = modalMode === 'edit'
        ? await supabase
            .from('items')
            .update({
              end_date: formData.end_date,
              is_active: formData.is_active
            })
            .eq('id', editingItemId)
            .select()
        : await supabase
            .from('items')
            .insert([{
              name: formData.name,
              base_price: parsePriceInput(formData.base_price),
              start_date: formData.start_date,
              end_date: formData.end_date || null,
              is_active: true
            }])
            .select();

      if (error) {
        console.error(`Error ${modalMode === 'edit' ? 'updating' : 'adding'} item:`, error);
        alert(`Error ${modalMode === 'edit' ? 'updating' : 'adding'} item: ` + error.message);
      } else {
        setIsModalOpen(false);
        setModalMode('add');
        setEditingItemId(null);
        setFormData(DEFAULT_ITEM_FORM_DATA);
        setErrors({});

        if (modalMode === 'add' && currentPage !== 1) {
          setCurrentPage(1);
        } else {
          await fetchItems(currentPage);
        }
      }
    } catch (error) {
      console.error(`Error ${modalMode === 'edit' ? 'updating' : 'adding'} item:`, error);
      alert(`Error ${modalMode === 'edit' ? 'updating' : 'adding'} item`);
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setModalMode('add');
    setEditingItemId(null);
    setFormData(DEFAULT_ITEM_FORM_DATA);
    setErrors({});
  };

  useEffect(() => {
    fetchItems(currentPage);
  }, [currentPage, fetchItems]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
            <ol className="list-none p-0 inline-flex flex-wrap items-center gap-2">
              <li>Home</li>
              <li>/</li>
              <li className="font-semibold text-slate-900">Parameter</li>
              <li>/</li>
              <li className="font-semibold text-slate-900">Items</li>
            </ol>
          </nav>
          <h1 className="text-3xl font-bold text-slate-900">Items</h1>
        </div>
        <button
          onClick={openAddModal}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors cursor-pointer hover:bg-blue-700 sm:w-auto"
        >
          <Plus size={16} />
          Add
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading items...</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Base Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Start Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">End Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{item.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">Rp {item.base_price.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{formatDisplayDate(item.start_date)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{formatDisplayDate(item.end_date)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${item.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      title="Edit item"
                      aria-label={`Edit ${item.name}`}
                      className="inline-flex h-9 w-9 items-center justify-center cursor-pointer rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="p-10 text-center text-slate-500">No items found.</div>
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-2xl sm:mx-4 sm:p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {modalMode === 'edit' ? 'Edit Item' : 'Add New Item'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  autoComplete='off'
                  placeholder='Lemper Ayam'
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={modalMode === 'edit'}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-all ${
                    errors.name
                      ? 'border-red-500 ring-2 ring-red-200 animate-pulse'
                      : 'border-slate-300 focus:ring-blue-500'
                  } ${modalMode === 'edit' ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 animate-pulse">{errors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Base Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium">Rp</span>
                  <input
                    type="text"
                    name="base_price"
                    autoComplete='off'
                    value={formData.base_price}
                    onChange={handlePriceChange}
                    disabled={modalMode === 'edit'}
                    className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-all ${
                      errors.base_price
                        ? 'border-red-500 ring-2 ring-red-200 animate-pulse'
                        : 'border-slate-300 focus:ring-blue-500'
                    } ${modalMode === 'edit' ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                    placeholder="0"
                  />
                </div>
                {errors.base_price && (
                  <p className="mt-1 text-sm text-red-600 animate-pulse">{errors.base_price}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                <div
                  className="relative"
                  onClick={() => {
                    if (modalMode === 'add' && startDateRef.current) {
                      startDateRef.current.showPicker?.();
                      startDateRef.current.focus();
                    }
                  }}
                >
                  <input
                    type="text"
                    value={formData.start_date ? formatDisplayDate(formData.start_date) : ''}
                    readOnly
                    placeholder="01 January 2026"
                    className={`w-full px-3 py-2 border rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 cursor-pointer transition-all ${
                      errors.start_date
                        ? 'border-red-500 ring-2 ring-red-200 animate-pulse'
                        : 'border-slate-300 focus:ring-blue-500'
                    } ${modalMode === 'edit' ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                  />
                  {modalMode === 'add' && (
                    <input
                      ref={startDateRef}
                      type="date"
                      name="start_date"
                      autoComplete='off'
                      value={formData.start_date}
                      onChange={handleDateChange}
                      max={formData.end_date || undefined}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  )}
                </div>
                {errors.start_date && (
                  <p className="mt-1 text-sm text-red-600 animate-pulse">{errors.start_date}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  End Date {modalMode === 'edit' ? '' : '(Optional)'}
                </label>
                <div
                  className="relative"
                  onClick={() => {
                    if (endDateRef.current) {
                      endDateRef.current.showPicker?.();
                      endDateRef.current.focus();
                    }
                  }}
                >
                  <input
                    type="text"
                    value={formData.end_date ? formatDisplayDate(formData.end_date) : ''}
                    readOnly
                    placeholder="01 January 2026"
                    className={`w-full px-3 py-2 border rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 cursor-pointer transition-all ${
                      errors.end_date
                        ? 'border-red-500 ring-2 ring-red-200 animate-pulse'
                        : 'border-slate-300 focus:ring-blue-500'
                    }`}
                  />
                  <input
                    ref={endDateRef}
                    type="date"
                    name="end_date"
                    autoComplete="off"
                    value={formData.end_date}
                    onChange={handleDateChange}
                    min={modalMode === 'edit' ? getNextDateValue(formData.start_date) || undefined : formData.start_date || undefined}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                {errors.end_date && (
                  <p className="mt-1 text-sm text-red-600 animate-pulse">{errors.end_date}</p>
                )}
              </div>
              {modalMode === 'edit' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
                  <button
                    type="button"
                    onClick={handleStatusToggle}
                    className={`flex w-full items-center justify-between cursor-pointer rounded-md border px-3 py-2 transition-colors ${
                      errors.status
                        ? 'border-red-500 ring-2 ring-red-200 animate-pulse'
                        : 'border-slate-300 hover:bg-slate-50'
                    }`}
                    role="switch"
                    aria-checked={Boolean(formData.is_active)}
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {formData.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className={`relative h-6 w-11 rounded-full transition-colors ${formData.is_active ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${formData.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                    </span>
                  </button>
                  {errors.status && (
                    <p className="mt-1 text-sm text-red-600 animate-pulse">{errors.status}</p>
                  )}
                </div>
              )}
              {(modalMode === 'add' ? dateRangeInvalid : editDateRangeInvalid) && (
                <p className="text-sm text-red-600">
                  {modalMode === 'edit'
                    ? 'End Date must be later than Start Date.'
                    : 'Start Date cannot be greater than End Date.'}
                </p>
              )}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-md font-medium transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <X size={16} />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalMode === 'add' ? dateRangeInvalid : editDateRangeInvalid}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Check size={16} />
                  {modalMode === 'edit' ? 'Update' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Items;
