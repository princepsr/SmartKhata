import React, { useState, useEffect, useRef } from 'react';
import { useIPCMutation } from '../../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import './CustomerFormModal.css';

interface Customer {
  id: number;
  name: string;
  phone: string;
  address?: string;
  email?: string;
  balanceDue: number;
  isActive: boolean;
}

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Customer | null;
}

interface FormData {
  name: string;
  phone: string;
  address: string;
  email: string;
  isActive: boolean;
}

const INITIAL_STATE: FormData = {
  name: '',
  phone: '',
  address: '',
  email: '',
  isActive: true,
};

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}) => {
  const [formData, setFormData] = useState<FormData>(INITIAL_STATE);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const firstInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!initialData;

  // IPC Mutations
  const {
    execute: createCustomer,
    loading: creating,
    error: createError,
  } = useIPCMutation(IPC_CHANNELS.CUSTOMER_CREATE);

  const {
    execute: updateCustomer,
    loading: updating,
    error: updateError,
  } = useIPCMutation(IPC_CHANNELS.CUSTOMER_UPDATE);

  const { execute: deleteCustomer, loading: deleting } = useIPCMutation(
    IPC_CHANNELS.CUSTOMER_DELETE
  );

  // Initialize form when opening
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name,
          phone: initialData.phone || '',
          address: initialData.address || '',
          email: initialData.email || '',
          isActive: initialData.isActive ?? true,
        });
      } else {
        setFormData(INITIAL_STATE);
      }
      setErrors({});
      if (!initialData) {
        setTimeout(() => firstInputRef.current?.focus(), 50);
      }
    }
  }, [isOpen, initialData]);

  // Keyboard Shortcuts for Modal
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';

    setFormData((prev) => ({
      ...prev,
      [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value,
    }));

    if (name in errors) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    let isValid = true;

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
      isValid = false;
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
      isValid = false;
    } else if (!/^\d{10}$/.test(formData.phone.replace(/[\s-()]/g, ''))) {
      newErrors.phone = 'Enter a valid 10-digit phone number';
      isValid = false;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Enter a valid email address';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    const payload = {
      name: formData.name,
      phone: formData.phone.replace(/[\s-()]/g, ''),
      address: formData.address || undefined,
      email: formData.email || undefined,
      isActive: formData.isActive,
    };

    const result = isEditMode
      ? await updateCustomer({ id: initialData.id, data: payload })
      : await createCustomer(payload);

    if (result) {
      onSuccess();
      onClose();
    }
  };

  const handleDelete = async () => {
    if (
      !initialData ||
      !window.confirm(`Are you sure you want to deactivate "${initialData.name}"?`)
    ) {
      return;
    }

    try {
      await deleteCustomer(initialData.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to deactivate customer:', err);
      alert('Failed to delete customer. Please try again.');
    }
  };

  const isLoading = creating || updating || deleting;
  const errorMsg = createError || updateError;

  return (
    <div className="modal-overlay">
      <div className="modal-content customer-form-modal">
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Customer' : 'Add New Customer'}</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {errorMsg && <div className="error-banner">{errorMsg}</div>}

        <form id="customer-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Full Name *</label>
              <input
                ref={firstInputRef}
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Rahul Sharma"
                className={errors.name ? 'error' : ''}
                disabled={isLoading}
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label>Phone Number *</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="10-digit mobile number"
                className={errors.phone ? 'error' : ''}
                disabled={isLoading}
              />
              {errors.phone && <span className="error-text">{errors.phone}</span>}
            </div>

            <div className="form-group">
              <label>Email Address (Optional)</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="customer@example.com"
                className={errors.email ? 'error' : ''}
                disabled={isLoading}
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label>Address (Optional)</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Full mailing address..."
                rows={3}
                disabled={isLoading}
              />
            </div>

            {isEditMode && (
              <div className="form-group">
                <label
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    disabled={isLoading}
                    style={{ width: 'auto' }}
                  />
                  Active Customer
                </label>
              </div>
            )}
          </div>
        </form>

        <div className="modal-actions">
          {isEditMode && (
            <button
              type="button"
              className="btn-danger"
              onClick={handleDelete}
              disabled={isLoading}
              style={{ marginRight: 'auto' }}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button type="submit" form="customer-form" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving...' : isEditMode ? 'Update Customer' : 'Create Customer'}
          </button>
        </div>
      </div>
    </div>
  );
};
