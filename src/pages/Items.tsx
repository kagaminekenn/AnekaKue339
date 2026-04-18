import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { Plus, X, Check } from 'lucide-react';
import Pagination from '../components/Pagination';
import type { Item, ItemFormErrors } from '../types/items';
import {
  DEFAULT_ITEM_FORM_DATA,
  PAGE_SIZE,
  formatDisplayDate,
  formatPriceInput,
  parsePriceInput,
  validateItemForm,
  isDateRangeInvalid
} from '../utils/items';

const Items = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const dateRangeInvalid = isDateRangeInvalid(formData.start_date, formData.end_date);

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

    const nextErrors = validateItemForm(formData);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (dateRangeInvalid) {
      alert('Start Date cannot be greater than End Date.');
      return;
    }

    try {
      const dataToSubmit = {
        name: formData.name,
        base_price: parsePriceInput(formData.base_price),
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        is_active: true
      };

      const { error } = await supabase
        .from('items')
        .insert([dataToSubmit])
        .select();

      if (error) {
        console.error('Error adding item:', error);
        alert('Error adding item: ' + error.message);
      } else {
        setIsModalOpen(false);
        setFormData(DEFAULT_ITEM_FORM_DATA);
        setErrors({});

        if (currentPage === 1) {
          await fetchItems(1);
        } else {
          setCurrentPage(1);
        }
      }
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Error adding item');
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setFormData(DEFAULT_ITEM_FORM_DATA);
    setErrors({});
  };

  useEffect(() => {
    fetchItems(currentPage);
  }, [currentPage, fetchItems]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
            <ol className="list-none p-0 inline-flex items-center gap-2">
              <li>Home</li>
              <li>/</li>
              <li className="font-semibold text-slate-900">Settings</li>
              <li>/</li>
              <li className="font-semibold text-slate-900">Items</li>
            </ol>
          </nav>
          <h1 className="text-3xl font-bold text-slate-900">Items</h1>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-2"
        >
          <Plus size={16} />
          Add
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading items...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Base Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Start Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">End Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
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
                </tr>
              ))}
            </tbody>
          </table>
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
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Add New Item</h2>
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
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-all ${
                    errors.name
                      ? 'border-red-500 ring-2 ring-red-200 animate-pulse'
                      : 'border-slate-300 focus:ring-blue-500'
                  }`}
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
                    value={formData.base_price}
                    onChange={handlePriceChange}
                    className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-all ${
                      errors.base_price
                        ? 'border-red-500 ring-2 ring-red-200 animate-pulse'
                        : 'border-slate-300 focus:ring-blue-500'
                    }`}
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
                    if (startDateRef.current) {
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
                    }`}
                  />
                  <input
                    ref={startDateRef}
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleDateChange}
                    max={formData.end_date || undefined}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                {errors.start_date && (
                  <p className="mt-1 text-sm text-red-600 animate-pulse">{errors.start_date}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Date (Optional)</label>
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <input
                    ref={endDateRef}
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleDateChange}
                    min={formData.start_date || undefined}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>
              {dateRangeInvalid && (
                <p className="text-sm text-red-600">
                  Start Date cannot be greater than End Date.
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
                  disabled={dateRangeInvalid}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Check size={16} />
                  Submit
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
